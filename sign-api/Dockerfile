# ── Stage 1: build deps ────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# System deps for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy app source
COPY . .

# ── Runtime env vars ──────────────────────────────────────────────────────
# MODEL_PATH: path to the .pth checkpoint inside the container.
# If absent, the API starts in DEMO mode (safe for hackathon testing).
ENV MODEL_PATH="wlasl_model.pth"
ENV ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,https://signpulse-backend-973006952011.us-central1.run.app,https://signpulse-ai-om4pzzzkja-uc.a.run.app"

# Cloud Run injects PORT automatically; default to 8080
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
