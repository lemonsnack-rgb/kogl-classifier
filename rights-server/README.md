---
title: KOGL Rights Estimation API
emoji: 📄
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# KOGL 권리추정 API (Demo Space)

문서 텍스트에서 저작권 관련 권리(복제권/배포권 등) 보유 및 허용 여부를
추정하는 FastAPI 서버의 데모용 HuggingFace Space입니다. 파인튜닝된
권리추정 모델(`klue/roberta-base` 기반)로 추론을 수행합니다.

이 Space는 Docker SDK로 빌드되며, 컨테이너는 포트 `7860`에서
서비스를 제공합니다 (`app_port: 7860`).

## 엔드포인트

- `GET /api/v1/health` — 모델 로드 상태 확인
- `POST /api/v1/rights/predict` — 권리추정 실행
  - body: `{ "text": "...", "file_name"?: "...", "document_id"?: "...", "options"?: { ... } }`

예시:

```bash
curl https://<space-name>.hf.space/api/v1/health

curl -X POST https://<space-name>.hf.space/api/v1/rights/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "☑ 복제권"}'
```

## 모델 체크포인트

이 저장소에는 파인튜닝된 체크포인트(`.pt`, ~440MB)가 포함되어 있지
않습니다. Space가 기동될 때 아래 두 방식 중 하나로 모델을 확보합니다.

1. **HuggingFace Hub 다운로드** (권장) — Space Secrets에 `RIGHTS_MODEL_REPO`
   (+선택적으로 `RIGHTS_MODEL_FILE`), `HF_TOKEN`을 설정하면 기동 시
   `huggingface_hub.hf_hub_download`로 프라이빗 모델 저장소에서 체크포인트를
   내려받습니다.
2. **저장소에 직접 포함** — git-lfs로 `model/권리추정_260610.pt`를 이 Space
   저장소에 커밋하고, 로컬 경로(`RIGHTS_MODEL_PATH`)를 그대로 사용합니다.

두 옵션의 상세 절차는 [`DEPLOY_HF.md`](./DEPLOY_HF.md)를 참고하세요.

## 로컬 개발

로컬에서 서버를 실행/테스트하는 방법은
[`README_LOCAL.md`](./README_LOCAL.md)를 참고하세요.
