"""Sharing a project with clients: view-only links, comments and approval.

Owner routes (login needed):
  POST   /api/projects/{id}/shares                    {"label"} -> a new link
  GET    /api/projects/{id}/shares                    links, comments and decisions for the project
  DELETE /api/projects/{id}/shares/{share_id}         turn a link off
  POST   /api/projects/{id}/comments/{comment_id}     {"resolved": bool}

Link routes (anyone with the token, no login):
  GET  /api/shared/{token}                           the plan, its comments and decisions
  POST /api/shared/{token}/comments                  {"author", "body", "room_id"?}
  POST /api/shared/{token}/decision                  {"author", "decision", "note"?}

Tokens are 24 random URL-safe characters. A link only ever exposes its own project's plan, never the
owner's account; turned-off links answer 404. Comments and decisions are capped in length and number.
"""
from __future__ import annotations

import hashlib
import json
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models

MAX_COMMENTS_PER_LINK = 300


class NewShare(BaseModel):
    label: str | None = Field(default=None, max_length=80)


class NewComment(BaseModel):
    author: str = Field(min_length=1, max_length=60)
    body: str = Field(min_length=1, max_length=1500)
    room_id: str | None = Field(default=None, max_length=80)


class NewDecision(BaseModel):
    author: str = Field(min_length=1, max_length=60)
    decision: Literal["approved", "changes_requested"]
    note: str | None = Field(default=None, max_length=1500)


class Resolve(BaseModel):
    resolved: bool = True


def plan_version(elements) -> str:
    """A short fingerprint of a plan, so an approval names exactly what was approved."""
    return hashlib.sha256(json.dumps(elements or [], sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:12]


def _comment(c: models.ShareComment) -> dict:
    return {"id": c.id, "author": c.author, "body": c.body, "room_id": c.room_id, "room_name": c.room_name,
            "resolved": bool(c.resolved), "created_at": c.created_at.isoformat() + "Z" if c.created_at else None,
            "share_id": c.share_id}


def _decision(d: models.ShareDecision, current: str | None = None) -> dict:
    return {"id": d.id, "author": d.author, "decision": d.decision, "note": d.note, "plan_version": d.plan_version,
            "current": current is not None and d.plan_version == current, "share_id": d.share_id,
            "created_at": d.created_at.isoformat() + "Z" if d.created_at else None}


def make_router(get_db, get_current_user, owned_project) -> APIRouter:
    router = APIRouter(tags=["sharing"])

    # ---- owner -------------------------------------------------------------------------------------
    @router.post("/api/projects/{project_id}/shares")
    def create_share(project_id: int, req: NewShare, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
        owned_project(project_id, db, current_user)
        share = models.ProjectShare(project_id=project_id, token=secrets.token_urlsafe(18),
                                    label=(req.label or "").strip() or None)
        db.add(share)
        db.commit()
        return {"id": share.id, "token": share.token, "label": share.label, "active": True}

    @router.get("/api/projects/{project_id}/shares")
    def list_shares(project_id: int, db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):
        project = owned_project(project_id, db, current_user)
        current = plan_version(project.elements_data)
        shares = db.query(models.ProjectShare).filter(models.ProjectShare.project_id == project_id) \
            .order_by(models.ProjectShare.created_at.desc()).all()
        comments = db.query(models.ShareComment).filter(models.ShareComment.project_id == project_id) \
            .order_by(models.ShareComment.created_at.desc()).all()
        decisions = db.query(models.ShareDecision).filter(models.ShareDecision.project_id == project_id) \
            .order_by(models.ShareDecision.created_at.desc()).all()
        return {"plan_version": current,
                "shares": [{"id": s.id, "token": s.token, "label": s.label, "active": bool(s.active),
                            "created_at": s.created_at.isoformat() + "Z" if s.created_at else None} for s in shares],
                "comments": [_comment(c) for c in comments],
                "decisions": [_decision(d, current) for d in decisions]}

    @router.delete("/api/projects/{project_id}/shares/{share_id}")
    def turn_off(project_id: int, share_id: int, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
        owned_project(project_id, db, current_user)
        share = db.query(models.ProjectShare).filter(models.ProjectShare.id == share_id,
                                                     models.ProjectShare.project_id == project_id).first()
        if not share:
            raise HTTPException(404, "Link not found")
        share.active = False
        db.commit()
        return {"ok": True}

    @router.post("/api/projects/{project_id}/comments/{comment_id}")
    def resolve(project_id: int, comment_id: int, req: Resolve, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
        owned_project(project_id, db, current_user)
        c = db.query(models.ShareComment).filter(models.ShareComment.id == comment_id,
                                                 models.ShareComment.project_id == project_id).first()
        if not c:
            raise HTTPException(404, "Comment not found")
        c.resolved = req.resolved
        db.commit()
        return _comment(c)

    # ---- people with the link ------------------------------------------------------------------------
    def _share(token: str, db: Session) -> tuple[models.ProjectShare, models.Project]:
        share = db.query(models.ProjectShare).filter(models.ProjectShare.token == token,
                                                     models.ProjectShare.active.is_(True)).first()
        project = db.get(models.Project, share.project_id) if share else None
        if not share or not project:
            raise HTTPException(404, "This link isn't active. Ask for a new one.")
        return share, project

    @router.get("/api/shared/{token}")
    def view(token: str, db: Session = Depends(get_db)):
        share, project = _share(token, db)
        current = plan_version(project.elements_data)
        owner = db.get(models.User, project.owner_id)
        comments = db.query(models.ShareComment).filter(models.ShareComment.share_id == share.id) \
            .order_by(models.ShareComment.created_at.asc()).all()
        decisions = db.query(models.ShareDecision).filter(models.ShareDecision.share_id == share.id) \
            .order_by(models.ShareDecision.created_at.desc()).all()
        return {"name": project.name, "elements": project.elements_data or [], "site": project.site,
                "facade": project.facade, "progress": project.progress,
                "shared_by": (owner.full_name or "").split(" ")[0] if owner else None,
                "plan_version": current, "comments": [_comment(c) for c in comments],
                "decisions": [_decision(d, current) for d in decisions]}

    @router.post("/api/shared/{token}/comments")
    def comment(token: str, req: NewComment, db: Session = Depends(get_db)):
        share, project = _share(token, db)
        if db.query(models.ShareComment).filter(models.ShareComment.share_id == share.id).count() >= MAX_COMMENTS_PER_LINK:
            raise HTTPException(429, "This link has reached its comment limit. Ask the owner for a new one.")
        room_name = None
        if req.room_id:
            room = next((e for e in project.elements_data or [] if e.get("type") == "room" and e.get("id") == req.room_id), None)
            if room is None:
                raise HTTPException(400, "That room isn't on the plan any more.")
            room_name = room.get("name")
        c = models.ShareComment(share_id=share.id, project_id=project.id, author=req.author.strip(),
                                body=req.body.strip(), room_id=req.room_id, room_name=room_name)
        db.add(c)
        db.commit()
        return _comment(c)

    @router.post("/api/shared/{token}/decision")
    def decide(token: str, req: NewDecision, db: Session = Depends(get_db)):
        share, project = _share(token, db)
        version = plan_version(project.elements_data)
        d = models.ShareDecision(share_id=share.id, project_id=project.id, author=req.author.strip(),
                                 decision=req.decision, note=(req.note or "").strip() or None,
                                 plan_version=version, elements=project.elements_data)
        db.add(d)
        db.commit()
        return _decision(d, version)

    return router
