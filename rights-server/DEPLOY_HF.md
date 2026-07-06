# HuggingFace Space 배포 가이드 (Docker SDK)

이 문서는 `rights-server/`를 HuggingFace Space(Docker SDK)에 배포해서
온라인 데모로 공개하는 절차를 설명합니다. 모델 체크포인트
(`권리추정_260610.pt`, ~440MB)는 이 저장소(git)에 포함되어 있지 않으므로,
아래 두 옵션 중 하나로 별도 확보해야 합니다.

- **옵션 1 (권장)**: 체크포인트를 프라이빗 HuggingFace 모델 저장소에
  올려두고, Space가 기동 시 다운로드하게 함
- **옵션 2**: 체크포인트를 git-lfs로 Space 저장소에 직접 커밋

---

## 0. 공통 준비

1. HuggingFace 계정 및 Access Token 발급
   - https://huggingface.co/settings/tokens 에서 `Write` 권한 토큰 생성
   - 이 토큰이 이후 `HF_TOKEN`으로 쓰입니다.
2. `huggingface_hub` CLI 로그인 (로컬 PC에서, 업로드용)
   ```bash
   pip install huggingface_hub
   huggingface-cli login
   ```

---

## 옵션 1 (권장): HuggingFace Hub에서 모델 다운로드

### 1-1. 프라이빗 모델 저장소 생성 및 업로드

```bash
huggingface-cli repo create kogl-rights-model --type model --private
# 로컬 체크포인트 업로드
huggingface-cli upload <your-username>/kogl-rights-model \
  "rights-server/model/권리추정_260610.pt" "권리추정_260610.pt"
```

또는 huggingface_hub 파이썬 API:

```python
from huggingface_hub import HfApi
api = HfApi()
api.create_repo("kogl-rights-model", repo_type="model", private=True)
api.upload_file(
    path_or_fileobj="rights-server/model/권리추정_260610.pt",
    path_in_repo="권리추정_260610.pt",
    repo_id="<your-username>/kogl-rights-model",
)
```

### 1-2. Space 생성

1. https://huggingface.co/new-space 에서 Space 생성
   - SDK: **Docker**
   - Visibility: Public(데모 공개) 또는 Private
2. 로컬에서 `rights-server/` 내용을 Space 저장소로 push
   ```bash
   git clone https://huggingface.co/spaces/<your-username>/<space-name>
   cd <space-name>
   # rights-server/ 내 파일 전체 복사 (model/ 디렉터리는 제외)
   cp -r ../rights-server/* .
   rm -rf model   # 옵션 1은 로컬 모델 디렉터리가 필요 없음
   git add .
   git commit -m "Deploy KOGL rights estimation API"
   git push
   ```
   `README.md`(Space 메타데이터 front-matter 포함), `Dockerfile`,
   `.dockerignore`, `app.py`, `rights_engine.py`, `schema.py`,
   `requirements.txt`, `README_LOCAL.md`, `DEPLOY_HF.md`가 모두 포함되어야
   합니다. `tests/`는 배포에 불필요하지만 포함해도 무방합니다(이미지
   빌드에는 `.dockerignore`로 제외됩니다).

### 1-3. Space Secrets 설정

Space 페이지 → **Settings → Variables and secrets** 에서 아래 항목을
**Secret**으로 등록합니다.

| Key | Value | 설명 |
|---|---|---|
| `HF_TOKEN` | 발급받은 토큰 | 프라이빗 모델 저장소 다운로드 인증 |
| `RIGHTS_MODEL_REPO` | `<your-username>/kogl-rights-model` | 모델이 업로드된 저장소 ID |
| `RIGHTS_MODEL_FILE` | `권리추정_260610.pt` | (선택) 저장소 내 파일명. 생략 시 `RIGHTS_MODEL_PATH`의 basename 사용 |

`app.py`의 startup 로직은 `RIGHTS_MODEL_REPO`가 설정되어 있으면
`huggingface_hub.hf_hub_download(repo_id=RIGHTS_MODEL_REPO, filename=RIGHTS_MODEL_FILE, token=HF_TOKEN)`
로 체크포인트를 내려받아 그 경로에서 모델을 로드합니다.

### 1-4. 빌드 대기 및 확인

- Secrets 저장 시 Space가 자동으로 재빌드됩니다. **Logs** 탭에서 빌드
  진행 상황을 확인하세요 (torch 등 설치로 수 분 소요될 수 있음).
- 빌드 완료 후 헬스체크:
  ```bash
  curl https://<space-name>.hf.space/api/v1/health
  # {"ok": true, "right_loaded": true, "right_error": null, "model": {...}}
  ```

---

## 옵션 2: git-lfs로 체크포인트를 Space 저장소에 직접 커밋

모델을 별도 저장소로 분리하고 싶지 않을 때 사용합니다.

### 2-1. Space 생성 및 클론

옵션 1의 1-2와 동일하게 Docker SDK Space를 만들고 클론합니다.

### 2-2. git-lfs로 체크포인트 추가

```bash
cd <space-name>
git lfs install
git lfs track "*.pt"
git add .gitattributes

cp -r ../rights-server/* .
mkdir -p model
cp "../rights-server/model/권리추정_260610.pt" "model/권리추정_260610.pt"

git add model/권리추정_260610.pt README.md Dockerfile .dockerignore \
  app.py rights_engine.py schema.py requirements.txt README_LOCAL.md DEPLOY_HF.md
git commit -m "Deploy KOGL rights estimation API with bundled checkpoint"
git push
```

> 주의: 이 옵션은 프라이빗 저장소로 두지 않으면 모델 가중치가 외부에
> 노출됩니다. 데모 목적이라도 민감한 모델이라면 Space를 Private으로
> 설정하세요.

### 2-3. 환경변수 설정 (선택)

기본값 `RIGHTS_MODEL_PATH=./model/권리추정_260610.pt`를 그대로 쓰면 되므로
별도 Secret 설정이 필요 없습니다. 경로를 바꾸고 싶다면 Space Variables에
`RIGHTS_MODEL_PATH`를 지정하세요. `RIGHTS_MODEL_REPO`는 설정하지 않아야
로컬 경로 로딩 로직이 사용됩니다.

### 2-4. 빌드 대기 및 확인

옵션 1의 1-4와 동일하게 Logs에서 빌드를 확인하고 `/api/v1/health`로
헬스체크합니다.

---

## 프론트엔드 연결

Space가 정상적으로 뜨면, 웹앱(Next.js) 쪽 환경변수에 Space URL을
설정합니다.

```
NEXT_PUBLIC_RIGHTS_API_URL=https://<space-name>.hf.space
```

설정 후 프론트엔드를 재배포/재시작하면 `/api/v1/rights/predict` 요청이
Space로 전달됩니다.

---

## 참고

- 로컬 개발/테스트 방법: [`README_LOCAL.md`](./README_LOCAL.md)
- Space 메타데이터(`title`, `sdk: docker`, `app_port: 7860` 등)는
  `README.md` 상단 YAML front-matter에 정의되어 있습니다.
- 무료 Space CPU 인스턴스는 리소스가 제한적이므로, 응답이 느리면
  유료 하드웨어(Space Settings → Hardware)로 업그레이드를 고려하세요.
