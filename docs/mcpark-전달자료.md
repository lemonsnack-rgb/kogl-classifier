# FastAPI 연동 가이드 (mcpark님 전달용)

## 1. 프로젝트 개요

공공저작물 권리유형 자동분류 서비스의 프론트엔드입니다.
- **GitHub**: https://github.com/lemonsnack-rgb/kogl-classifier
- **라이브 데모**: https://kogl-classifier.vercel.app
- **기술스택**: Next.js 14 + TypeScript + Tailwind CSS

---

## 2. 정적 HTML 파일 받는 방법

### 방법 A: GitHub에서 직접 빌드
```bash
git clone https://github.com/lemonsnack-rgb/kogl-classifier.git
cd kogl-classifier
npm install
npm run export
```
→ `out/` 폴더에 정적 HTML/CSS/JS 생성됩니다.

### 방법 B: out 폴더 직접 전달
필요 시 빌드된 `out/` 폴더를 별도 전달합니다.

---

## 3. FastAPI에서 서빙하는 방법

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

# ====== API 엔드포인트 (HMC 분류 엔진) ======
@app.post("/api/classify")
async def classify():
    # 분류 로직
    pass

@app.get("/api/classify/{file_id}")
async def get_result(file_id: str):
    # 결과 조회
    pass

# ====== 프론트엔드 정적 파일 서빙 ======
# out/ 폴더를 서버 루트에 배치
app.mount("/", StaticFiles(directory="out", html=True), name="frontend")
```

### 서버 디렉토리 구조
```
서버루트/
├── main.py              # FastAPI 서버
├── outOcr/              # OCR 결과 파일
│   └── 파일명.pdf.ocr
├── out/                 # 프론트엔드 (npm run export 결과물)
│   ├── index.html
│   ├── login/
│   ├── works/
│   │   ├── index.html
│   │   ├── new/
│   │   ├── contract-001/
│   │   └── ...
│   ├── _next/static/    # JS, CSS 번들
│   └── images/kogl/     # 공공누리마크 이미지
└── requirements.txt
```

### 실행
```bash
pip install fastapi uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000
```
→ http://localhost:8000 에서 프론트엔드 접속 가능

---

## 4. API 연동 스펙 요청

프론트엔드에서 FastAPI를 호출하기 위해 아래 스펙이 필요합니다.
현재는 Mock 데이터로 동작 중이며, API 스펙이 확정되면 연동합니다.

### 필요한 API 엔드포인트

#### 4-1. 분류 요청
```
POST /api/classify
Content-Type: multipart/form-data

요청:
  - contract_file: 계약서 PDF 파일
  - work_files[]: 저작물 파일(들)
  - inspection_title: 검사명칭

응답 (JSON):
{
  "id": "uuid",
  "status": "processing",
  "message": "분류 요청이 접수되었습니다"
}
```

#### 4-2. 분류 결과 조회
```
GET /api/classify/{id}

응답 (JSON):
{
  "id": "uuid",
  "status": "completed",
  "gongnuri_type": "KOGL-1",
  "confidence": 0.92,
  "clauses": [
    {
      "type": "OWNERSHIP",
      "text": "저작권 일체는 발주기관에 귀속한다",
      "page": 3
    }
  ],
  "works": [
    {
      "filename": "보고서.pdf",
      "metadata": {
        "work_name": "연구결과 보고서",
        "work_type": "text",
        "creator": "홍길동",
        ...
      }
    }
  ]
}
```

#### 4-3. OCR 결과 (숭실대)
```
OCR 출력 위치: ./outOcr/파일명.pdf.ocr
형식: 텍스트 파일
```

### 참고: 현재 프론트엔드의 표준 산출물 구조

분류 결과 (classification.json):
```json
{
  "fileId": "uuid",
  "predictedClass": "KOGL-1",
  "confidence": 0.92,
  "topK": [
    {"label": "KOGL-1", "score": 0.92},
    {"label": "KOGL-2", "score": 0.05}
  ],
  "rationale": ["metadata:creator-null"],
  "modelVersion": "v1.0"
}
```

근거 조항 (contract_evidence.json):
```json
{
  "contractId": "uuid",
  "clauses": [
    {
      "type": "OWNERSHIP",
      "text": "저작권 일체는 발주기관에 귀속한다",
      "score": 0.93,
      "page": 3,
      "charStart": 421,
      "charEnd": 452
    }
  ]
}
```

---

## 5. 스펙 변경 시

API 입출력 형식이 변경되어도 프론트엔드 어댑터만 수정하면 되므로 부담 없이 진행하시면 됩니다.
변경 시 **샘플 JSON 응답**만 공유해주시면 바로 반영 가능합니다.

---

## 6. 문의

- 프론트엔드 관련: 왕일 (iwang@muhayu.com)
- GitHub Issues: https://github.com/lemonsnack-rgb/kogl-classifier/issues
