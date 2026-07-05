from schema import (
    DEFAULT_SCHEMA, AUTHORITY_GROUP_KO, STATUS_KO, schema_items,
    _compact_text, _contains_any, _is_checkbox_evidence_segment,
)

def test_default_schema_has_core_rights():
    assert "RIGHT_REPRODUCTION" in DEFAULT_SCHEMA
    assert DEFAULT_SCHEMA["RIGHT_REPRODUCTION"]["ko"] == "복제권"
    assert "UNKNOWN" in DEFAULT_SCHEMA["RIGHT_REPRODUCTION"]["statuses"]

def test_group_mapping():
    assert AUTHORITY_GROUP_KO["RIGHT_REPRODUCTION"] == "저작재산권"
    assert AUTHORITY_GROUP_KO["COMMERCIAL_USE"] == "이용조건"

def test_status_ko():
    assert STATUS_KO["ALLOW"] == "허용"
    assert STATUS_KO["PROHIBIT"] == "금지"

def test_schema_items_returns_keys():
    assert schema_items(DEFAULT_SCHEMA) == list(DEFAULT_SCHEMA.keys())

def test_compact_text_collapses_whitespace():
    assert _compact_text("가  나\n다") == "가 나 다"

def test_checkbox_evidence_detected():
    assert _is_checkbox_evidence_segment("☑ 복제권", "RIGHT_REPRODUCTION") is True
    assert _is_checkbox_evidence_segment("복제권", "RIGHT_REPRODUCTION") is False
