"""Plan reader service: POST a floor plan image or PDF, get Arch-E-Tech plan elements back.

    PLAN_READER_MODEL=runs/resplan_r34_v1/best.pt PLAN_READER_TOKEN=... \\
        .venv/bin/uvicorn serve:app --port 8100

Endpoints
  GET  /health   -> {"status": "ok", "model": "..."}
  POST /read     multipart: file (PNG / JPEG / WebP / PDF), optional px_per_m, ocr (true/false)
                 header Authorization: Bearer <PLAN_READER_TOKEN> when a token is configured
                 -> {"elements": [...], "info": {...}, "texts": [...], "image": {"width", "height"}}

The Arch-E-Tech backend calls this; browsers never do. It runs separately from the backend
because the model and PyTorch are far too big for the backend's host.
"""
from __future__ import annotations

import hmac
import os
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from archetech_ml.reader import PlanReader

MODEL = os.getenv("PLAN_READER_MODEL", str(Path(__file__).parent / "runs" / "resplan_r34_v1" / "best.pt"))
TOKEN = os.getenv("PLAN_READER_TOKEN", "")
MAX_BYTES = int(os.getenv("PLAN_READER_MAX_MB", "15")) * 1024 * 1024
TYPES = {"image/png", "image/jpeg", "image/webp", "application/pdf"}

app = FastAPI(title="Arch-E-Tech plan reader")
_reader: PlanReader | None = None


def reader() -> PlanReader:
    global _reader
    if _reader is None:
        _reader = PlanReader(MODEL, device=os.getenv("PLAN_READER_DEVICE") or None)
    return _reader


@app.get("/health")
def health():
    return {"status": "ok", "model": reader().version}


@app.post("/read")
async def read(file: UploadFile = File(...), px_per_m: float | None = Form(None), ocr: bool = Form(True),
               authorization: str = Header("")):
    if TOKEN and not hmac.compare_digest(authorization, f"Bearer {TOKEN}"):
        raise HTTPException(401, "bad token")
    if file.content_type not in TYPES:
        raise HTTPException(415, "Upload a PNG, JPEG, WebP or PDF.")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"The file is larger than {MAX_BYTES // (1024 * 1024)} MB.")
    if px_per_m is not None and not 1 <= px_per_m <= 5000:
        raise HTTPException(400, "px_per_m out of range")
    try:
        result = await run_in_threadpool(reader().read, data, file.content_type, px_per_m, ocr)
    except Exception as e:                       # unreadable file, corrupt PDF, ...
        raise HTTPException(422, f"Could not read that file as a floor plan ({type(e).__name__}).") from e
    if not result["elements"]:
        raise HTTPException(422, "No walls were found in that image. Is it a floor plan?")
    return result
