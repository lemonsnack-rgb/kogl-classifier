# -*- coding: utf-8 -*-
"""권리 추론 엔진 — 전달 패키지 소스에서 추출."""
from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer

from schema import (
    DEFAULT_SCHEMA, AUTHORITY_GROUP_KO, STATUS_KO, schema_items,
    _is_checkbox_evidence_segment, _sentence_or_line_bounds, _candidate_is_meaningful,
)

DEFAULT_MAX_LENGTH = 512
DEFAULT_MAX_EVIDENCE = 20
DEFAULT_BASE_MODEL = "klue/roberta-base"
DEFAULT_EVIDENCE_THRESHOLD = 0.70
DEFAULT_TOP_K = 5


def safe_torch_load(path: Path, map_location="cpu") -> Dict[str, Any]:
    try:
        return torch.load(str(path), map_location=map_location, weights_only=False)
    except TypeError:
        return torch.load(str(path), map_location=map_location)


class FinalSchemaGroundedModel(nn.Module):
    def __init__(self, base_model: str, schema: Dict[str, Dict[str, Any]], evidence_label_to_id: Dict[str, int]):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(base_model, add_pooling_layer=False)
        hidden = self.encoder.config.hidden_size
        self.schema = schema
        self.items = schema_items(schema)
        self.evidence_label_to_id = evidence_label_to_id
        self.evidence_head = nn.Linear(hidden, len(evidence_label_to_id))
        self.classifier_heads = nn.ModuleDict({item: nn.Linear(hidden * 2, len(schema[item]["statuses"])) for item in self.items})
        self.dropout = nn.Dropout(0.1)
        self.item_evidence_indices: Dict[str, List[int]] = {}
        for item in self.items:
            idxs = []
            for st in schema[item]["statuses"]:
                if st == "UNKNOWN":
                    continue
                key = f"{item}::{st}"
                if key in evidence_label_to_id:
                    idxs.append(evidence_label_to_id[key])
            self.item_evidence_indices[item] = idxs

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
        logits_by_item: Dict[str, torch.Tensor] = {}
        for item in self.items:
            idxs = self.item_evidence_indices.get(item, [])
            if idxs:
                weights = evidence_probs[:, :, idxs].max(dim=-1).values * mask
            else:
                weights = mask
            denom = weights.sum(dim=1, keepdim=True).clamp_min(1e-6)
            pooled = torch.bmm(weights.unsqueeze(1), hidden).squeeze(1) / denom
            vec = torch.cat([cls, pooled], dim=-1)
            logits_by_item[item] = self.classifier_heads[item](vec)
        return logits_by_item, evidence_logits


class FinalSchemaRightsInferenceEngine:
    def __init__(self, checkpoint_path: Path):
        if not checkpoint_path.exists():
            raise FileNotFoundError(f"체크포인트 파일이 없습니다: {checkpoint_path}")
        ckpt = safe_torch_load(checkpoint_path, "cpu")
        state = ckpt.get("model_state_dict")
        if not isinstance(state, dict):
            raise ValueError("체크포인트에 model_state_dict가 없습니다.")
        self.model_kind = ckpt.get("model_kind", "")
        if "finalschema" not in str(self.model_kind).lower():
            raise ValueError(f"최종 권리유형 모델이 아닙니다. model_kind={self.model_kind}")
        self.checkpoint_path = str(checkpoint_path.resolve())
        self.base_model = ckpt.get("base_model") or DEFAULT_BASE_MODEL
        self.max_length = int(ckpt.get("max_length", DEFAULT_MAX_LENGTH))
        self.schema: Dict[str, Dict[str, Any]] = ckpt.get("authority_schema") or DEFAULT_SCHEMA
        # 출처표시는 공공저작물 기본 적용. 혹시 체크포인트에 없더라도 보정한다.
        if "ATTRIBUTION_REQUIRED" in self.schema:
            self.schema["ATTRIBUTION_REQUIRED"]["default"] = "ALLOW"
            self.schema["ATTRIBUTION_REQUIRED"]["evidence_required"] = False
        self.items = [str(x) for x in ckpt.get("authority_items", schema_items(self.schema))]
        # schema 순서를 authority_items 순서에 맞춘다.
        self.schema = {item: self.schema[item] for item in self.items if item in self.schema}
        self.items = schema_items(self.schema)
        self.evidence_labels = [str(x) for x in ckpt.get("evidence_labels", [])]
        raw_label_to_id = ckpt.get("evidence_label_to_id") or {x: i for i, x in enumerate(self.evidence_labels)}
        self.evidence_label_to_id = {str(k): int(v) for k, v in raw_label_to_id.items()}
        if not self.evidence_label_to_id:
            raise ValueError("체크포인트에 evidence_label_to_id/evidence_labels가 없습니다.")
        self.id_to_evidence_label = {v: k for k, v in self.evidence_label_to_id.items()}
        self.evidence_threshold = float(ckpt.get("evidence_threshold", DEFAULT_EVIDENCE_THRESHOLD))
        self.top_k = int(ckpt.get("top_k", DEFAULT_TOP_K))
        self.metrics = ckpt.get("metrics", {}) if isinstance(ckpt.get("metrics"), dict) else {}
        self.tokenizer = AutoTokenizer.from_pretrained(self.base_model, use_fast=True)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = FinalSchemaGroundedModel(self.base_model, self.schema, self.evidence_label_to_id)
        self.model.load_state_dict(state, strict=True)
        self.model.to(self.device)
        self.model.eval()
        self.info = self._make_info()

    def _make_info(self) -> Dict[str, Any]:
        return {
            "kind": self.model_kind,
            "base": self.base_model,
            "max_length": self.max_length,
            "items": len(self.items),
            "evidence_labels": len(self.evidence_label_to_id),
            "threshold": self.evidence_threshold,
            "top_k": self.top_k,
            "device": str(self.device),
            "path": self.checkpoint_path,
            "metrics": self.metrics,
        }

    def _extract_candidates_for(self, text: str, offsets: List[Tuple[int, int]], mask: List[int], ev_probs: torch.Tensor, item: str, status: str, max_candidates: int) -> List[Dict[str, Any]]:
        key = f"{item}::{status}"
        ev_idx = self.evidence_label_to_id.get(key)
        if ev_idx is None:
            return []
        scores = [float(x) for x in ev_probs[:, ev_idx].detach().cpu().tolist()]
        valid = []
        for i, ((s, e), m) in enumerate(zip(offsets, mask)):
            if int(m) != 1:
                continue
            if i >= len(scores) or e <= s or (s == 0 and e == 0):
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
        authority_ko = str(self.schema.get(item, {}).get("ko", item))
        for g in groups:
            start = min(int(offsets[i][0]) for i in g)
            end = max(int(offsets[i][1]) for i in g)
            if start < 0 or end <= start or end > len(text):
                continue
            raw_text = text[start:end]
            # 체크박스 권리목록은 해당 span 자체를 사용한다. 그 외 항목은 사람이 읽을 수 있는 행/문장 단위로 확장한다.
            if _is_checkbox_evidence_segment(raw_text, item):
                disp_start, disp_end = start, end
            else:
                disp_start, disp_end = _sentence_or_line_bounds(text, start, end)
            cand_text = text[disp_start:disp_end].strip()
            if not cand_text:
                continue
            # 제목/목적 조각 또는 의미 없는 명사구는 확정 근거에서 제외한다.
            if not _candidate_is_meaningful(item, status, cand_text):
                continue
            sc = [scores[i] for i in g]
            cands.append({
                "source": "right",
                "authority": item,
                "authority_ko": authority_ko,
                "status": status,
                "tag": f"{item}:{status}",
                "start_char": disp_start,
                "end_char": disp_end,
                "raw_start_char": start,
                "raw_end_char": end,
                "text": cand_text,
                "confidence": max(sc),
                "mean_confidence": sum(sc) / max(1, len(sc)),
                "token_count": len(g),
            })
        dedup: List[Dict[str, Any]] = []
        seen = set()
        for c in sorted(cands, key=lambda x: (x["confidence"], x["mean_confidence"], x["token_count"]), reverse=True):
            key2 = (c["start_char"], c["end_char"], c["authority"], c["status"])
            if key2 in seen:
                continue
            seen.add(key2); dedup.append(c)
            if len(dedup) >= max_candidates:
                break
        return dedup

    def predict(self, text: str, max_length: int, max_evidence: int) -> Dict[str, Any]:
        text = (text or "").strip()
        if not text:
            raise ValueError("입력 텍스트가 비어 있습니다.")
        if max_length <= 0:
            max_length = self.max_length
        if max_evidence <= 0:
            max_evidence = DEFAULT_MAX_EVIDENCE
        enc = self.tokenizer(text, max_length=max_length, truncation=True, padding="max_length", return_offsets_mapping=True, return_tensors="pt")
        offsets = [(int(s), int(e)) for s, e in enc["offset_mapping"][0].tolist()]
        mask_list = [int(x) for x in enc["attention_mask"][0].tolist()]
        input_ids = enc["input_ids"].to(self.device)
        attention_mask = enc["attention_mask"].to(self.device)
        token_type_ids = enc.get("token_type_ids")
        if token_type_ids is not None:
            token_type_ids = token_type_ids.to(self.device)
        with torch.no_grad():
            logits_by_item, ev_logits = self.model(input_ids, attention_mask, token_type_ids)
            ev_probs = torch.sigmoid(ev_logits)[0]
        results: List[Dict[str, Any]] = []
        all_evidence: List[Dict[str, Any]] = []
        summary = {"safe": 0, "review": 0, "none": 0, "evidence": 0}
        for item in self.items:
            meta = self.schema[item]
            statuses = [str(x) for x in meta.get("statuses", [])]
            if not statuses:
                continue
            probs_t = torch.softmax(logits_by_item[item], dim=-1)[0].detach().cpu()
            pred_id = int(torch.argmax(probs_t).item())
            pred_status = statuses[pred_id] if pred_id < len(statuses) else str(pred_id)
            confidence = float(probs_t[pred_id].item())
            status_probs = {statuses[i]: float(probs_t[i].item()) for i in range(min(len(statuses), len(probs_t)))}
            evidence_required = bool(meta.get("evidence_required", True))
            status_is_none = (pred_status == "UNKNOWN")
            candidates: List[Dict[str, Any]] = []
            evidence_conf = 0.0
            if not status_is_none and evidence_required:
                candidates = self._extract_candidates_for(text, offsets, mask_list, ev_probs, item, pred_status, self.top_k)
                evidence_conf = float(candidates[0]["confidence"]) if candidates else 0.0
            elif not status_is_none and not evidence_required:
                evidence_conf = 1.0
            # confidence gap
            sorted_probs = sorted(status_probs.values(), reverse=True)
            gap = (sorted_probs[0] - sorted_probs[1]) if len(sorted_probs) >= 2 else 1.0
            review_reason = ""
            if status_is_none:
                safe_result = "none"
                display_result = "-"
                row_class = "none"
                summary["none"] += 1
            elif confidence < 0.70:
                safe_result = "REVIEW_REQUIRED_LOW_CONFIDENCE"
                display_result = "확인필요"
                row_class = "check"
                review_reason = "신뢰도 0.70 미만"
                summary["review"] += 1
            elif gap < 0.15:
                safe_result = "REVIEW_REQUIRED_AMBIGUOUS"
                display_result = "확인필요"
                row_class = "check"
                review_reason = "1·2순위 차이 부족"
                summary["review"] += 1
            elif evidence_required and not candidates:
                safe_result = "REVIEW_REQUIRED_EVIDENCE_NOT_FOUND"
                display_result = "확인필요"
                row_class = "check"
                review_reason = f"근거탐색실패: {self.evidence_threshold:.2f} 이상 근거 후보 없음"
                summary["review"] += 1
            else:
                safe_result = pred_status
                display_result = STATUS_KO.get(pred_status, pred_status)
                row_class = "allow" if pred_status in ("ALLOW", "WORLDWIDE", "KOREA", "UNRESTRICTED", "PERPETUAL", "FREE") else ("prohibit" if pred_status == "PROHIBIT" else "allow")
                review_reason = "확정: 기준 이상 근거 있음" if evidence_required else "확정: 기본 적용/근거 불필요"
                summary["safe"] += 1
            if candidates:
                summary["evidence"] += len(candidates)
                all_evidence.extend(candidates)
            results.append({
                "authority": item,
                "authority_ko": str(meta.get("ko", item)),
                "group": AUTHORITY_GROUP_KO.get(item, "기타"),
                "status": pred_status,
                "status_ko": STATUS_KO.get(pred_status, pred_status),
                "display_result": display_result,
                "safe_result": safe_result,
                "row_class": row_class,
                "confidence": confidence,
                "status_probs": status_probs,
                "gap": gap,
                "evidence_required": evidence_required,
                "evidence_confidence": evidence_conf,
                "evidence_threshold": self.evidence_threshold,
                "evidence": candidates,
                "review_reason": review_reason,
            })
        # 전체 근거는 위치와 점수 기준으로 중복 제거 후 제한하고 번호를 부여한다.
        seen_ev = set(); final_ev = []
        for ev in sorted(all_evidence, key=lambda x: (x["start_char"], -x.get("confidence", 0.0))):
            key = (ev["authority"], ev["status"], ev["start_char"], ev["end_char"])
            if key in seen_ev:
                continue
            seen_ev.add(key)
            ev = dict(ev)
            ev["evidence_no"] = len(final_ev) + 1
            final_ev.append(ev)
            if len(final_ev) >= max_evidence:
                break
        ev_no_map = {(ev["authority"], ev["status"], ev["start_char"], ev["end_char"]): ev["evidence_no"] for ev in final_ev}
        for r in results:
            nums = []
            for ev in r.get("evidence", []) or []:
                key = (ev.get("authority"), ev.get("status"), ev.get("start_char"), ev.get("end_char"))
                no = ev_no_map.get(key)
                if no is not None:
                    ev["evidence_no"] = no
                    nums.append(no)
            r["evidence_numbers"] = sorted(set(nums))
        decision_conf = sum(float(r["confidence"]) for r in results if r["safe_result"] not in ("none",)) / max(1, len([r for r in results if r["safe_result"] not in ("none",)]))
        overall_conf = sum(float(r["confidence"]) for r in results) / max(1, len(results))
        return {
            "summary": summary,
            "decision_confidence": decision_conf,
            "overall_confidence": overall_conf,
            "results": results,
            "evidence": final_ev,
            "model_name": self.base_model,
            "checkpoint_path": self.checkpoint_path,
            "model_kind": self.model_kind,
            "threshold": self.evidence_threshold,
            "top_k": self.top_k,
        }
