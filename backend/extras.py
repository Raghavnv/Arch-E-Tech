"""Saved interior styles, the front elevation, and construction progress.

  GET    /api/styles                          the user's saved styles
  POST   /api/styles                          {"name", "data"} -> a saved style
  DELETE /api/styles/{id}
  PUT    /api/projects/{id}/facade            {"facade": {...}}
  GET    /api/projects/{id}/progress          the build's progress
  PUT    /api/projects/{id}/progress          {"progress": {...}}
  PUT    /api/projects/{id}/materials         {"materials": [...]}  materials scanned from photos
  POST   /api/ai/identify-material            {"image"} -> what the material is, when an AI key is set

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


class ScannedMaterial(BaseModel):
    id: str = Field(pattern=r"^scan_[a-z0-9]{4,16}$")
    name: str = Field(min_length=1, max_length=60)
    kind: str = Field(max_length=20)
    color: str = Field(default="#999999", max_length=9)
    image: str = Field(max_length=400_000)
    tile_m: float = Field(default=0.8, ge=0.1, le=5)
    price: float | None = Field(default=None, ge=0, le=2000)


class MaterialsIn(BaseModel):
    materials: list[ScannedMaterial] = Field(max_length=30)


class IdentifyIn(BaseModel):
    image: str = Field(max_length=400_000)


MATERIAL_KINDS = ["wood", "marble", "granite", "terrazzo", "stone", "brick", "terracotta", "concrete", "tile", "other"]


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

    @router.put("/api/projects/{project_id}/materials")
    def set_materials(project_id: int, req: MaterialsIn, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
        project = owned_project(project_id, db, user)
        for m in req.materials:
            if not m.image.startswith("data:image/jpeg;base64,") and not m.image.startswith("data:image/png;base64,"):
                raise HTTPException(400, "A material's picture must be a JPEG or PNG.")
        project.materials = [m.model_dump() for m in req.materials]
        db.commit()
        return {"status": "success", "count": len(req.materials)}

    @router.post("/api/ai/identify-material")
    def identify_material(req: IdentifyIn):
        """What a photographed material is, from a vision model. Without a GROQ_API_KEY it answers
        {"source": "none"} and the Studio uses its own colour-and-texture reading."""
        import os
        key = os.getenv("GROQ_API_KEY")
        if not key or not req.image.startswith("data:image/"):
            return {"source": "none"}
        try:
            from groq import Groq
            client = Groq(api_key=key, timeout=30)
            res = client.chat.completions.create(
                model=os.getenv("VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": (
                        "This is a close-up photo of a building material sample. Answer with JSON only: "
                        '{"kind": one of ' + json.dumps(MATERIAL_KINDS) + ', "name": a short shop-style name such as '
                        '"Statuario marble", "Teak wood", "Black galaxy granite", "Kota stone", "Red wire-cut brick" '
                        '(at most 4 words), "confidence": 0 to 1, "alternatives": up to 2 other likely kinds from the list}')},
                    {"type": "image_url", "image_url": {"url": req.image}},
                ]}],
                response_format={"type": "json_object"}, temperature=0.1, max_tokens=200,
            )
            out = json.loads(res.choices[0].message.content or "{}")
            kind = out.get("kind") if out.get("kind") in MATERIAL_KINDS else "other"
            alts = [k for k in (out.get("alternatives") or []) if k in MATERIAL_KINDS and k != kind][:2]
            return {"source": "ai", "kind": kind, "name": str(out.get("name") or "")[:60],
                    "confidence": float(out.get("confidence") or 0), "alternatives": alts}
        except Exception as e:                      # the Studio falls back to its own reading
            print(f"identify-material failed: {e}")
            return {"source": "none"}

    return router
