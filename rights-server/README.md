# 권리추정 API 서버

전달 패키지의 권리추정 모델을 서빙하는 독립 FastAPI 서버.

## 설치
```
cd rights-server
python -m venv .venv && . .venv/Scripts/activate   # Windows
pip install -r requirements.txt
```

## 모델 배치
`model/권리추정_260610.pt` 위치에 전달받은 권리 모델을 둔다.
경로 변경 시 `RIGHTS_MODEL_PATH` 환경변수 사용.

## 실행
```
set RIGHTS_MODEL_PATH=./model/권리추정_260610.pt   # Windows
uvicorn app:app --host 0.0.0.0 --port 8080
```

## 엔드포인트
- `GET /api/v1/health`
- `POST /api/v1/rights/predict` — body: `{ text, file_name?, document_id?, options? }`

## 테스트
```
python -m pytest -v
```
