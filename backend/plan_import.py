"""Plan import: upload a floor plan drawing, get an editable plan.

The drawing is sent to the plan reader service (ml/serve.py, at PLAN_READER_URL), which runs the
trained model and OCR. The backend never loads the model itself: it is too big for this host.

Routes (all need a login):
  GET  /api/plan-imports/status         -> {"configured": bool}
  POST /api/plan-imports                multipart: file, consent ("true"/"false")
                                        -> {"id", "elements", "info", "texts", "image"}
  POST /api/plan-imports/{id}/accept    {"project_id", "elements", "image_to_plan"} -> {"ok": true}
"""
from __future__ import annotations

import os

import requests
from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models

READER_URL = (os.getenv("PLAN_READER_URL") or "").rstrip("/")
READER_TOKEN = os.getenv("PLAN_READER_TOKEN", "")
MAX_BYTES = 15 * 1024 * 1024
TYPES = {"image/png", "image/jpeg", "image/webp", "application/pdf"}


class AcceptImport(BaseModel):
    project_id: int
    elements: list
    image_to_plan: dict | None = None     # the drawing -> plan mapping after any rescaling in review


def make_router(get_db, get_current_user, owned_project) -> APIRouter:
    router = APIRouter(prefix="/api/plan-imports", tags=["plan import"])

    @router.get("/status")
    def status(current_user: models.User = Depends(get_current_user)):
        return {"configured": bool(READER_URL)}

    @router.post("")
    async def create(file: UploadFile = File(...), consent: bool = Form(False), db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
        if not READER_URL:
            raise HTTPException(503, "Plan import isn't set up on this server yet (PLAN_READER_URL).")
        if file.content_type not in TYPES:
            raise HTTPException(415, "Upload a PNG, JPEG, WebP or PDF of the floor plan.")
        data = await file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "That file is larger than 15 MB.")
        def call():
            # a free Hugging Face Space sleeps when unused and answers 502/503 while it wakes (up to a
            # minute or so): keep asking for about 90 s before giving up
            import time
            deadline = time.monotonic() + 90
            while True:
                try:
                    resp = requests.post(f"{READER_URL}/read", timeout=180,
                                         headers={"Authorization": f"Bearer {READER_TOKEN}"} if READER_TOKEN else {},
                                         files={"file": (file.filename or "plan", data, file.content_type)})
                    if resp.status_code not in (502, 503, 504) or time.monotonic() > deadline:
                        return resp
                except requests.RequestException:
                    if time.monotonic() > deadline:
                        raise
                time.sleep(8)
        try:
            r = await run_in_threadpool(call)          # off the event loop: other requests keep flowing
        except requests.RequestException:
            raise HTTPException(502, "The plan reader didn't answer. It may be waking up: try again in a minute.")
        if r.status_code in (502, 503, 504):
            raise HTTPException(502, "The plan reader is still waking up. Try again in a minute.")
        if r.status_code != 200:
            try:
                detail = r.json().get("detail")
            except ValueError:
                detail = None
            raise HTTPException(422 if r.status_code in (413, 415, 422) else 502,
                                detail or "The plan reader couldn't read that file.")
        result = r.json()
        row = models.PlanImport(owner_id=current_user.id, file_name=(file.filename or "")[:200],
                                content_type=file.content_type, consent=consent, info=result.get("info"),
                                image=data if consent else None,
                                predicted=result.get("elements") if consent else None)
        db.add(row)
        db.commit()
        return {"id": row.id, **result}

    @router.post("/{import_id}/accept")
    def accept(import_id: int, req: AcceptImport, db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):
        row = db.query(models.PlanImport).filter(models.PlanImport.id == import_id,
                                                 models.PlanImport.owner_id == current_user.id).first()
        if not row:
            raise HTTPException(404, "Import not found")
        owned_project(req.project_id, db, current_user)
        row.project_id = req.project_id
        row.status = "accepted"
        if row.consent:
            row.accepted = req.elements
            if req.image_to_plan:
                row.info = {**(row.info or {}), "image_to_plan_accepted": req.image_to_plan}
        db.commit()
        return {"ok": True}

    return router
