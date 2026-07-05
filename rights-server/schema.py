# -*- coding: utf-8 -*-
"""권리추정 스키마/상수/근거필터 — 전달 패키지 소스에서 추출."""
from __future__ import annotations
from typing import Any, Dict, List, Tuple

STATUS_KO = {
    "UNKNOWN": "none",
    "ALLOW": "허용",
    "PROHIBIT": "금지",
    "KOREA": "국내",
    "WORLDWIDE": "전세계",
    "LIMITED": "제한",
    "UNRESTRICTED": "제한없음",
    "PERPETUAL": "영구",
    "FIXED": "기간제한",
    "UNSPECIFIED": "기간미정",
    "ROYALTY": "로열티",
    "LUMP_SUM": "일시금",
    "FREE": "무상",
}

AUTHORITY_GROUP_KO = {
    "RIGHT_REPRODUCTION": "저작재산권",
    "RIGHT_PERFORMANCE": "저작재산권",
    "RIGHT_PUBLIC_TRANSMISSION": "저작재산권",
    "RIGHT_EXHIBITION": "저작재산권",
    "RIGHT_DISTRIBUTION": "저작재산권",
    "RIGHT_RENTAL": "저작재산권",
    "DERIVATIVE_MODIFICATION": "이용조건",
    "RIGHT_TRANSFER": "계약성격",
    "LICENSE_GRANT": "계약성격",
    "EXCLUSIVITY": "계약성격",
    "SUBLICENSE": "계약성격",
    "ATTRIBUTION_REQUIRED": "이용조건",
    "COMMERCIAL_USE": "이용조건",
    "TERRITORY_SCOPE": "이용범위",
    "TERM_SCOPE": "이용범위",
    "PAYMENT_TYPE": "대가조건",
}

DEFAULT_SCHEMA: Dict[str, Dict[str, Any]] = {
    "RIGHT_REPRODUCTION": {"ko": "복제권", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "RIGHT_PERFORMANCE": {"ko": "공연권", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "RIGHT_PUBLIC_TRANSMISSION": {"ko": "공중송신권", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "RIGHT_EXHIBITION": {"ko": "전시권", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "RIGHT_DISTRIBUTION": {"ko": "배포권", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "RIGHT_RENTAL": {"ko": "대여권", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "DERIVATIVE_MODIFICATION": {"ko": "변경·가공/2차적저작물작성", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "RIGHT_TRANSFER": {"ko": "권리양도", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "LICENSE_GRANT": {"ko": "이용허락", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "EXCLUSIVITY": {"ko": "독점성", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "SUBLICENSE": {"ko": "재허락", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "ATTRIBUTION_REQUIRED": {"ko": "출처표시", "statuses": ["ALLOW", "PROHIBIT"], "default": "ALLOW", "evidence_required": False},
    "COMMERCIAL_USE": {"ko": "상업적 이용", "statuses": ["UNKNOWN", "ALLOW", "PROHIBIT"]},
    "TERRITORY_SCOPE": {"ko": "이용지역", "statuses": ["UNKNOWN", "KOREA", "WORLDWIDE", "LIMITED", "UNRESTRICTED"]},
    "TERM_SCOPE": {"ko": "이용기간", "statuses": ["UNKNOWN", "PERPETUAL", "FIXED", "UNSPECIFIED"]},
    "PAYMENT_TYPE": {"ko": "대가조건", "statuses": ["UNKNOWN", "ROYALTY", "LUMP_SUM", "FREE"]},
}

# 화면 표시용 그룹 순서. 표에서는 그룹명을 한 행 전체로 묶어서 표시한다.
AUTHORITY_GROUP_ORDER = ["저작재산권", "이용조건", "계약성격", "이용범위", "대가조건", "기타"]

CHECKBOX_MARKERS = ["☑", "☒", "■", "▣", "✓", "✔", "[x]", "[X]", "□", "☐", "[ ]"]
RIGHT_CUE_BY_ITEM = {
    "RIGHT_REPRODUCTION": ["복제권", "복제"],
    "RIGHT_PERFORMANCE": ["공연권", "공연"],
    "RIGHT_PUBLIC_TRANSMISSION": ["공중송신권", "공중송신", "방송", "전송", "디지털음성송신"],
    "RIGHT_EXHIBITION": ["전시권", "전시"],
    "RIGHT_DISTRIBUTION": ["배포권", "배포"],
    "RIGHT_RENTAL": ["대여권", "대여"],
    "DERIVATIVE_MODIFICATION": ["2차적저작물작성권", "2차적", "이차적", "변경", "가공", "수정", "편집", "개작", "각색", "번역"],
}
POSITIVE_CUES = ["할 수 있다", "이용할 수", "사용할 수", "활용할 수", "허용", "가능", "부여", "허락", "승낙", "행사할 수", "이전한다", "양도한다", "지급한다", "무상"]
NEGATIVE_CUES = ["할 수 없다", "이용할 수 없다", "사용할 수 없다", "허용되지", "허용하지", "금지", "제외", "아니한다", "않는다", "불가", "제한된다"]
TITLE_OR_PURPOSE_CUES = ["계약서", "제1조", "제2조", "목적", "제목", "부속 내용", "보완 사항", "절차", "자료 처리", "저작재산권의 이전", "이용 조건과 관련하여"]

def _compact_text(value: str) -> str:
    return " ".join(str(value or "").replace("\r", " ").replace("\n", " ").split()).strip()

def _contains_any(value: str, cues: List[str]) -> bool:
    return any(cue in str(value or "") for cue in cues)

def _line_bounds(text: str, start: int, end: int) -> Tuple[int, int]:
    s = max(0, int(start)); e = min(len(text), int(end))
    ls = text.rfind("\n", 0, s) + 1
    le = text.find("\n", e)
    if le < 0:
        le = len(text)
    return ls, le

def _sentence_or_line_bounds(text: str, start: int, end: int) -> Tuple[int, int]:
    # 계약서/OCR은 문장부호가 불규칙하므로 줄 범위를 기본으로 하되, 같은 줄의 문장부호까지만 확장한다.
    ls, le = _line_bounds(text, start, end)
    s = ls
    for i in range(max(ls, start - 1), ls - 1, -1):
        if text[i] in ".!?。？！":
            s = i + 1
            break
    e = le
    for i in range(end, le):
        if text[i] in ".!?。？！":
            e = i + 1
            break
    return max(0, s), min(len(text), e)

def _is_checkbox_evidence_segment(segment: str, item: str) -> bool:
    seg = str(segment or "")
    if not _contains_any(seg, CHECKBOX_MARKERS):
        return False
    cues = RIGHT_CUE_BY_ITEM.get(item, [])
    return bool(cues and _contains_any(seg, cues))

def _is_title_or_purpose_fragment(segment: str) -> bool:
    seg = _compact_text(segment)
    if not seg:
        return True
    if len(seg) <= 6:
        return True
    # 체크박스 권리목록은 짧아도 근거가 될 수 있으므로 여기서는 제외하지 않는다.
    if _contains_any(seg, TITLE_OR_PURPOSE_CUES) and not (_contains_any(seg, POSITIVE_CUES) or _contains_any(seg, NEGATIVE_CUES) or _contains_any(seg, CHECKBOX_MARKERS)):
        return True
    # 명사구 단독 근거 방지: '저작재산권의 이전', '권리 이전' 같은 조각은 확정 근거로 쓰지 않는다.
    if len(seg) <= 24 and not (_contains_any(seg, POSITIVE_CUES) or _contains_any(seg, NEGATIVE_CUES) or _contains_any(seg, CHECKBOX_MARKERS)):
        return True
    return False

def _candidate_is_meaningful(item: str, status: str, segment: str) -> bool:
    seg = _compact_text(segment)
    status = str(status or "").upper()
    if status == "UNKNOWN":
        return False
    # 체크박스 권리목록은 권리명 + 체크박스 자체가 근거가 될 수 있다.
    if item in RIGHT_CUE_BY_ITEM and _is_checkbox_evidence_segment(seg, item):
        return True
    # 출처표시는 기본 적용 항목이므로 일반적으로 근거가 없어도 된다. 표시해야 한다/하지 않아도 된다가 명시될 때만 후보 인정.
    if item == "ATTRIBUTION_REQUIRED":
        return _contains_any(seg, ["출처", "저작자", "표시", "명시"]) and (_contains_any(seg, POSITIVE_CUES) or _contains_any(seg, NEGATIVE_CUES))
    if _is_title_or_purpose_fragment(seg):
        return False
    if status in ("ALLOW", "KOREA", "WORLDWIDE", "LIMITED", "UNRESTRICTED", "PERPETUAL", "FIXED", "UNSPECIFIED", "ROYALTY", "LUMP_SUM", "FREE"):
        if item == "RIGHT_TRANSFER":
            return _contains_any(seg, ["양수인에게 이전", "권리를 이전", "저작재산권을 이전", "양도한다", "양도인은 양수인에게"]) and not _contains_any(seg, ["목적으로 한다", "명확히 정함", "관련하여"] )
        if item == "LICENSE_GRANT":
            return _contains_any(seg, ["이용을 허락", "사용을 허락", "이용할 수", "사용할 수", "활용할 수", "이용 권한"])
        if item == "COMMERCIAL_USE":
            return _contains_any(seg, ["상업", "영리", "유상", "수익", "판매", "사업", "영업"]) and _contains_any(seg, POSITIVE_CUES + NEGATIVE_CUES)
        if item == "TERRITORY_SCOPE":
            return _contains_any(seg, ["대한민국", "국내", "전세계", "국내외", "지역", "플랫폼", "범위", "제한"]) and _contains_any(seg, POSITIVE_CUES + NEGATIVE_CUES + ["한정", "제한", "전 지역"])
        if item == "TERM_SCOPE":
            return _contains_any(seg, ["기간", "영구", "년", "월", "일까지", "계약기간"]) and _contains_any(seg, POSITIVE_CUES + NEGATIVE_CUES + ["정한다", "한다"])
        if item == "PAYMENT_TYPE":
            return _contains_any(seg, ["대가", "사용료", "로열티", "일시금", "무상", "지급", "정산", "총액"])
        return _contains_any(seg, POSITIVE_CUES) and not _contains_any(seg, ["허용되지", "허용하지", "불가", "금지", "할 수 없다"])
    if status == "PROHIBIT":
        if item == "RIGHT_TRANSFER":
            return _contains_any(seg, ["이전하지", "양도하지", "이전 대상에서 제외", "양도 대상에서 제외", "이전되지"])
        return _contains_any(seg, NEGATIVE_CUES)
    return True


def schema_items(schema: Dict[str, Dict[str, Any]]) -> List[str]:
    return list(schema.keys())
