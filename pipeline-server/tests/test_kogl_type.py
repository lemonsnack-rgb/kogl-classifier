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
