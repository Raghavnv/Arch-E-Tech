"""Saved interior styles, the front elevation, and construction progress.

  GET    /api/styles                          the user's saved styles
  POST   /api/styles                          {"name", "data"} -> a saved style
  DELETE /api/styles/{id}
  PUT    /api/projects/{id}/facade            {"facade": {...}}
  GET    /api/projects/{id}/progress          the build's progress
  PUT    /api/projects/{id}/progress          {"progress": {...}}

Sizes are capped: a style 64 KB, a facade 16 KB, progress 12 MB (site photos are small JPEGs).
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models

MAX_STYLES = 40


class NewStyle(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    data: dict


class FacadeIn(BaseModel):
    facade: dict


class ProgressIn(BaseModel):
    progress: dict


def _size(obj) -> int:
    return len(json.dumps(obj, separators=(",", ":")))


def make_router(get_db, get_current_user, owned_project) -> APIRouter:
    router = APIRouter(tags=["extras"])

    @router.get("/api/styles")
    def list_styles(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
        rows = db.query(models.UserStyle).filter(models.UserStyle.owner_id == user.id).order_by(models.UserStyle.created_at.desc()).all()
        return [{"id": r.id, "name": r.name, "data": r.data} for r in rows]

    @router.post("/api/styles")
    def save_style(req: NewStyle, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
        if _size(req.data) > 64_000:
            raise HTTPException(413, "That style is too large to save.")
        if db.query(models.UserStyle).filter(models.UserStyle.owner_id == user.id).count() >= MAX_STYLES:
            raise HTTPException(429, f"You can keep up to {MAX_STYLES} styles; delete one first.")
        row = models.UserStyle(owner_id=user.id, name=req.name.strip(), data=req.data)
        db.add(row)
        db.commit()
        return {"id": row.id, "name": row.name, "data": row.data}

    @router.delete("/api/styles/{style_id}")
    def delete_style(style_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
        row = db.get(models.UserStyle, style_id)
        if not row or row.owner_id != user.id:
            raise HTTPException(404, "Style not found")
        db.delete(row)
        db.commit()
        return {"status": "deleted"}

    @router.put("/api/projects/{project_id}/facade")
    def set_facade(project_id: int, req: FacadeIn, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
        project = owned_project(project_id, db, user)
        if _size(req.facade) > 16_000:
            raise HTTPException(413, "That facade is too large.")
        project.facade = req.facade
        db.commit()
        return {"status": "success"}

    @router.get("/api/projects/{project_id}/progress")
    def get_progress(project_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
        project = owned_project(project_id, db, user)
        return project.progress or {}

    @router.put("/api/projects/{project_id}/progress")
    def set_progress(project_id: int, req: ProgressIn, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
        project = owned_project(project_id, db, user)
        if _size(req.progress) > 12_000_000:
            raise HTTPException(413, "Too many photos: remove some before adding more.")
        project.progress = req.progress
        db.commit()
        return {"status": "success"}

    return router
