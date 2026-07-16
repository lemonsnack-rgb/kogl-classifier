# -*- coding: utf-8 -*-
"""KOGL 유형추정 엔진 (Kogl_Type_best_260610.pt / model_kind=kogl_type_axis_grounded_v2).

전달된 체크포인트 구조에 맞춰 재구성한 로더:
- evidence_head: Linear(hidden, len(evidence_labels))  — 토큰별 sigmoid 근거
- axis_heads[axis]: Linear(hidden*2, 2)  — 축(COMMERCIAL_USE/DERIVATIVE_MODIFICATION) 상태(ALLOW/PROHIBIT)
- type_head: Linear(hidden*(1+num_axes), 4)  — 유형1~4
근거 가중 평균 풀링은 권리 모델(FinalSchemaGroundedModel)과 동일 방식.
"""
from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Tuple

import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer

from rights_engine import safe_torch_load, DEFAULT_MAX_LENGTH, DEFAULT_MAX_EVIDENCE, DEFAULT_EVIDENCE_THRESHOLD, DEFAULT_TOP_K
from schema import STATUS_KO, _is_checkbox_evidence_segment, _sentence_or_line_bounds


class TypeAxisGroundedModel(nn.Module):
    def __init__(self, base_model: str, axes: List[str], evidence_label_to_id: Dict[str, int]):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(base_model, add_pooling_layer=False)
        hidden = self.encoder.config.hidden_size
        self.axes = axes
        self.evidence_label_to_id = evidence_label_to_id
        self.evidence_head = nn.Linear(hidden, len(evidence_label_to_id))
        self.axis_heads = nn.ModuleDict({axis: nn.Linear(hidden * 2, 2) for axis in axes})
        self.type_head = nn.Linear(hidden * (1 + len(axes)), 4)
        self.dropout = nn.Dropout(0.1)
        # 축별 근거 인덱스 (axis::ALLOW, axis::PROHIBIT)
        self.axis_evidence_indices: Dict[str, List[int]] = {}
        for axis in axes:
            idxs = []
            for st in ("ALLOW", "PROHIBIT"):
                key = f"{axis}::{st}"
                if key in evidence_label_to_id:
                    idxs.append(evidence_label_to_id[key])
            self.axis_evidence_indices[axis] = idxs

    def forward(self, input_ids, attention_mask, token_type_ids=None):
        kwargs = {"input_ids": input_ids, "attention_mask": attention_mask}
        if token_type_ids is not None:
            kwargs["token_type_ids"] = token_type_ids
        out = self.encoder(**kwargs)
        hidden_raw = out.last_hidden_state
        cls = hidden_raw[:, 0, :]
        hidden = self.dropout(hidden_raw)
        evidence_logits = self.evidence_head(hidden)
        evidence_probs = torch.sigmoid(evidence_logits)
        mask = attention_mask.float()
        pooled_by_axis: Dict[str, torch.Tensor] = {}
        axis_logits: Dict[str, torch.Tensor] = {}
        for axis in self.axes:
            idxs = self.axis_evidence_indices.get(axis, [])
            if idxs:
                weights = evidence_probs[:, :, idxs].max(dim=-1).values * mask
            else:
                weights = mask
            denom = weights.sum(dim=1, keepdim=True).clamp_min(1e-6)
            pooled = torch.bmm(weights.unsqueeze(1), hidden).squeeze(1) / denom
            pooled_by_axis[axis] = pooled
            axis_logits[axis] = self.axis_heads[axis](torch.cat([cls, pooled], dim=-1))
        type_vec = torch.cat([cls] + [pooled_by_axis[a] for a in self.axes], dim=-1)
        type_logits = self.type_head(type_vec)
        return type_logits, axis_logits, evidence_logits


class TypeAxisGroundedEngine:
    def __init__(self, checkpoint_path: Path):
        if not checkpoint_path.exists():
            raise FileNotFoundError(f"체크포인트 파일이 없습니다: {checkpoint_path}")
        ckpt = safe_torch_load(checkpoint_path, "cpu")
        state = ckpt.get("model_state_dict") or ckpt.get("state_dict")
        if not isinstance(state, dict):
            raise ValueError("유형 체크포인트에 model_state_dict가 없습니다.")
        self.model_kind = ckpt.get("model_kind", "")
        self.checkpoint_path = str(checkpoint_path.resolve())
        self.base_model = ckpt.get("base_model") or ckpt.get("model_name") or "klue/roberta-base"
        self.max_length = int(ckpt.get("max_length", DEFAULT_MAX_LENGTH))
        self.axes = [str(x) for x in ckpt.get("axes", [])]
        self.axis_ko = {str(k): str(v) for k, v in (ckpt.get("axis_ko") or {}).items()}
        self.id_to_type = {int(k): str(v) for k, v in (ckpt.get("id_to_type") or {}).items()}
        self.id_to_status = {int(k): str(v) for k, v in (ckpt.get("id_to_status") or {0: "ALLOW", 1: "PROHIBIT"}).items()}
        self.evidence_labels = [str(x) for x in ckpt.get("evidence_labels", [])]
        raw_label_to_id = ckpt.get("evidence_label_to_id") or {x: i for i, x in enumerate(self.evidence_labels)}
        self.evidence_label_to_id = {str(k): int(v) for k, v in raw_label_to_id.items()}
        self.evidence_threshold = float(ckpt.get("evidence_threshold", DEFAULT_EVIDENCE_THRESHOLD))
        self.top_k = int(ckpt.get("top_k", DEFAULT_TOP_K))
        self.tokenizer = AutoTokenizer.from_pretrained(self.base_model, use_fast=True)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = TypeAxisGroundedModel(self.base_model, self.axes, self.evidence_label_to_id)
        self.model.load_state_dict(state, strict=True)
        self.model.to(self.device)
        self.model.eval()
        self.info = {
            "kind": self.model_kind,
            "base": self.base_model,
            "max_length": self.max_length,
            "axes": len(self.axes),
            "threshold": self.evidence_threshold,
            "top_k": self.top_k,
            "device": str(self.device),
            "path": self.checkpoint_path,
        }

    def _extract_axis_evidence(self, text, offsets, mask, ev_probs, axis, status, max_candidates):
        key = f"{axis}::{status}"
        ev_idx = self.evidence_label_to_id.get(key)
        if ev_idx is None:
            return []
        scores = [float(x) for x in ev_probs[:, ev_idx].detach().cpu().tolist()]
        valid = []
        for i, ((s, e), m) in enumerate(zip(offsets, mask)):
            if int(m) != 1 or i >= len(scores) or e <= s or (s == 0 and e == 0):
                continue
            if scores[i] >= self.evidence_threshold:
                valid.append(i)
        if not valid:
            return []
        groups: List[List[int]] = []
        cur: List[int] = []
        prev = -999
        for idx in valid:
            if not cur or idx == prev + 1:
                cur.append(idx)
            else:
                groups.append(cur); cur = [idx]
            prev = idx
        if cur:
            groups.append(cur)
        cands: List[Dict[str, Any]] = []
        for g in groups:
            start = min(int(offsets[i][0]) for i in g)
            end = max(int(offsets[i][1]) for i in g)
            if start < 0 or end <= start or end > len(text):
                continue
            raw = text[start:end]
            if _is_checkbox_evidence_segment(raw, axis) or _is_checkbox_evidence_segment(raw, "DERIVATIVE_MODIFICATION"):
                ds, de = start, end
            else:
                ds, de = _sentence_or_line_bounds(text, start, end)
            seg = text[ds:de].strip()
            if not seg:
                continue
            sc = [scores[i] for i in g]
            cands.append({
                "axis": axis, "status": status, "tag": f"{axis}:{status}", "source": "type",
                "text": seg, "start_char": ds, "end_char": de, "confidence": max(sc),
            })
        dedup, seen = [], set()
        for c in sorted(cands, key=lambda x: x["confidence"], reverse=True):
            k2 = (c["start_char"], c["end_char"])
            if k2 in seen:
                continue
            seen.add(k2); dedup.append(c)
            if len(dedup) >= max_candidates:
                break
        return dedup

    def predict(self, text: str, max_length: int, max_evidence: int) -> Dict[str, Any]:
        text = (text or "").strip()
        if not text:
            raise ValueError("입력 텍스트가 비어 있습니다.")
        if max_length <= 0:
            max_length = self.max_length
        enc = self.tokenizer(text, max_length=max_length, truncation=True, padding="max_length", return_offsets_mapping=True, return_tensors="pt")
        offsets = [(int(s), int(e)) for s, e in enc["offset_mapping"][0].tolist()]
        mask_list = [int(x) for x in enc["attention_mask"][0].tolist()]
        input_ids = enc["input_ids"].to(self.device)
        attention_mask = enc["attention_mask"].to(self.device)
        token_type_ids = enc.get("token_type_ids")
        if token_type_ids is not None:
            token_type_ids = token_type_ids.to(self.device)
        with torch.no_grad():
            type_logits, axis_logits, ev_logits = self.model(input_ids, attention_mask, token_type_ids)
            type_probs = torch.softmax(type_logits, dim=-1)[0].detach().cpu()
            ev_probs = torch.sigmoid(ev_logits)[0]
        type_id = int(torch.argmax(type_probs).item())
        predicted_type = self.id_to_type.get(type_id, str(type_id))
        confidence = float(type_probs[type_id].item())
        axes_out: List[Dict[str, Any]] = []
        all_evidence: List[Dict[str, Any]] = []
        for axis in self.axes:
            ax_probs = torch.softmax(axis_logits[axis], dim=-1)[0].detach().cpu()
            st_id = int(torch.argmax(ax_probs).item())
            status = self.id_to_status.get(st_id, str(st_id))
            ax_conf = float(ax_probs[st_id].item())
            cands = self._extract_axis_evidence(text, offsets, mask_list, ev_probs, axis, status, self.top_k)
            axes_out.append({
                "axis": axis,
                "axis_ko": self.axis_ko.get(axis, axis),
                "status": status,
                "status_ko": STATUS_KO.get(status, status),
                "confidence": ax_conf,
                "evidence": cands,
            })
            all_evidence.extend(cands)
        # 근거 위치순 정렬 + 번호
        seen, final_ev = set(), []
        for ev in sorted(all_evidence, key=lambda x: (x["start_char"], -x["confidence"])):
            k = (ev["axis"], ev["status"], ev["start_char"], ev["end_char"])
            if k in seen:
                continue
            seen.add(k)
            ev = dict(ev); ev["evidence_no"] = len(final_ev) + 1
            final_ev.append(ev)
            if len(final_ev) >= max_evidence:
                break
        return {
            "predicted_type": predicted_type,
            "confidence": confidence,
            "axes": axes_out,
            "evidence": final_ev,
            "model_name": self.base_model,
            "checkpoint_path": self.checkpoint_path,
            "model_kind": self.model_kind,
        }
