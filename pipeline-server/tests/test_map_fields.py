import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from main import map_ssu_to_work_fields

def test_candidate_keys_and_types():
    meta = {
        "work_title": "경복궁 야경",
        "digital_format": "JPG",
        "keyword": "문화유산",
        "language": "한국어",
        "production_date": "2026-02-10",
        "rights_holder": "한국문화정보원",
        "commercial_use": "허용",
        "economic_rights": "양도",
    }
    out = map_ssu_to_work_fields(meta)
    assert out["work_name"] == "경복궁 야경"
    assert out["work_type"] is None
    assert out["digital_format"] == "JPG"
    assert out["keywords"] == ["문화유산"]
    assert out["language"] == "한국어"
    assert out["created_date"] == "2026-02-10"
    assert out["creator"] == "한국문화정보원"
    assert out["copyright_holder"] == "한국문화정보원"
    assert out["commercial_use"] == "허용"
    assert out["property_rights"] == "양도"
    assert out["usage_scope"] == "허용"
    assert out["portrait_rights"] is None
    assert out["co_authors"] is None
    assert len(out) == 22

def test_object_value_is_json_stringified():
    meta = {"work_title": {"ko": "제목"}}
    out = map_ssu_to_work_fields(meta)
    assert out["work_name"] == '{"ko": "제목"}'
