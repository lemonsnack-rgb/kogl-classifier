import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from main import resolve_kogl_type

def test_work_for_hire_no_portrait_is_type0():
    r = resolve_kogl_type({"work_for_hire": "예", "portrait_rights": "없음"}, "KOGL-1")
    assert r["resolved_type"] == "KOGL-0"
    assert r["ai_candidate"] is False
    assert "업무상저작물" in r["reason"]

def test_work_for_hire_with_portrait_keeps_hmc():
    r = resolve_kogl_type({"work_for_hire": "예", "portrait_rights": "포함"}, "KOGL-1")
    assert r["resolved_type"] == "KOGL-1"

def test_non_protected_is_type0():
    r = resolve_kogl_type({"non_protected_work": "예"}, "KOGL-3")
    assert r["resolved_type"] == "KOGL-0"

def test_expired_string_is_type0():
    r = resolve_kogl_type({"non_protected_work": "보호기간 만료"}, "KOGL-2")
    assert r["resolved_type"] == "KOGL-0"

def test_other_with_consent_sets_ai_candidate():
    r = resolve_kogl_type({"co_author_consent": "동의함"}, "KOGL-2")
    assert r["resolved_type"] == "KOGL-2"
    assert r["ai_candidate"] is True

def test_type0_never_ai_candidate():
    r = resolve_kogl_type({"non_protected_work": "예", "co_author_consent": "동의함"}, "KOGL-1")
    assert r["resolved_type"] == "KOGL-0"
    assert r["ai_candidate"] is False

def test_all_empty_low_confidence():
    r = resolve_kogl_type({}, None)
    assert r["resolved_type"] is None
    assert r["low_confidence"] is True

def test_negated_consent_not_ai_candidate():
    # "미동의"는 "동의"를 부분포함하지만 AI 후보로 잡히면 안 된다.
    for v in ("미동의", "부동의", "동의하지 않음", "동의 안함"):
        r = resolve_kogl_type({"co_author_consent": v}, "KOGL-2")
        assert r["ai_candidate"] is False, v

def test_negated_portrait_is_type0():
    # 업무상저작물 + "미포함"(초상권 없음)은 제0유형이어야 한다.
    r = resolve_kogl_type({"work_for_hire": "예", "portrait_rights": "미포함"}, "KOGL-1")
    assert r["resolved_type"] == "KOGL-0"

def test_work_for_hire_with_portrait_no_hmc_is_low_confidence():
    # 유형 미판정(resolved=None)이면 low_confidence여야 한다.
    r = resolve_kogl_type({"work_for_hire": "예", "portrait_rights": "포함"}, None)
    assert r["resolved_type"] is None
    assert r["low_confidence"] is True
