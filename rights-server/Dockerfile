# KOGL 권리추정 API - HuggingFace Space (Docker SDK)
FROM python:3.11-slim

# torch/transformers 빌드에 필요한 최소 도구
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성부터 설치해서 소스 변경 시 캐시를 재사용
COPY requirements.txt .
RUN pip install --no-cache-dir \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements.txt

# 애플리케이션 소스 복사 (model/*.pt는 .dockerignore로 제외)
COPY . .

# HF Spaces는 uid 1000으로 컨테이너를 실행하므로 non-root 유저 생성
RUN useradd -m -u 1000 appuser
ENV HF_HOME=/app/.cache/huggingface
RUN mkdir -p "$HF_HOME" && chown -R appuser:appuser /app
USER appuser

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
