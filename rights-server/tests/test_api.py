from fastapi.testclient import TestClient
import app as app_module

class FakeEngine:
    info = {"kind": "authority_finalschema_multilabel_grounded_v4",
            "base": "klue/roberta-base", "threshold": 0.7, "top_k": 5,
            "device": "cpu", "path": "fake.pt"}
    base_model = "klue/roberta-base"
    model_kind = "authority_finalschema_multilabel_grounded_v4"
    checkpoint_path = "fake.pt"
    evidence_threshold = 0.7
    top_k = 5
    def predict(self, text, max_length, max_evidence):
        return {
            "summary": {"safe": 1, "review": 0, "none": 0, "evidence": 1},
            "results": [{
                "authority": "RIGHT_REPRODUCTION", "authority_ko": "복제권",
                "group": "저작재산권", "status": "ALLOW", "display_result": "허용",
                "confidence": 0.98, "evidence_numbers": [1], "review_reason": "",
                "safe_result": "ALLOW",
            }],
            "evidence": [{"evidence_no": 1, "authority": "RIGHT_REPRODUCTION",
                          "authority_ko": "복제권", "status": "ALLOW", "text": "☑ 복제권",
                          "start_char": 0, "end_char": 5, "confidence": 0.93}],
            "model_name": "klue/roberta-base", "checkpoint_path": "fake.pt",
            "model_kind": "authority_finalschema_multilabel_grounded_v4",
            "threshold": 0.7, "top_k": 5,
        }

def setup_module(_):
    app_module.RIGHT_ENGINE = FakeEngine()

def test_health_ok():
    c = TestClient(app_module.app)
    r = c.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["right_loaded"] is True

def test_predict_returns_rights_schema():
    c = TestClient(app_module.app)
    r = c.post("/api/v1/rights/predict", json={
        "document_id": "DOC-1", "file_name": "a.txt", "text": "☑ 복제권",
        "options": {"max_length": 512, "max_evidence": 20},
    })
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["document_id"] == "DOC-1"
    assert body["summary"]["safe"] == 1
    assert body["rights_results"][0]["authority_ko"] == "복제권"
    assert body["rights_results"][0]["display_result"] == "허용"
    assert body["evidence"][0]["evidence_no"] == 1

def test_predict_empty_text_400():
    c = TestClient(app_module.app)
    r = c.post("/api/v1/rights/predict", json={"text": "  "})
    assert r.status_code == 400
