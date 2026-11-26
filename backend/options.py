"""Plan options: two or three versions of a house kept side by side, and the client's vote on them.

Owner routes (login needed):
  GET    /api/projects/{id}/options                 the saved options and the votes
  POST   /api/projects/{id}/options                 {"name", "elements"} -> a new option
  PUT    /api/projects/{id}/options/{option_id}     {"name"?, "elements"?}
  DELETE /api/projects/{id}/options/{option_id}

Link route (anyone with an active share link):
  POST   /api/shared/{token}/vote                   {"author", "option_id", "note"?}

Options live on the project (`Project.options`): {"items": [{id, name, elements, created_at}], "votes": [...]}.
One vote per person per link: voting again moves it. At most 6 options of 2 MB each.
"""
from __future__ import annotations

import datetime
import json
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

import models

MAX_OPTIONS = 6
MAX_BYTES = 2_000_000
MAX_VOTES = 500


class NewOption(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    elements: list


class OptionPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    elements: list | None = None


class NewVote(BaseModel):
    author: str = Field(min_length=1, max_length=60)
    option_id: str = Field(min_length=1, max_length=40)
    note: str | None = Field(default=None, max_length=600)


def _now() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def _store(project: models.Project) -> dict:
    data = project.options if isinstance(project.options, dict) else {}
    return {"items": list(data.get("items") or []), "votes": list(data.get("votes") or [])}


def _save(db: Session, project: models.Project, data: dict) -> None:
    project.options = data
    flag_modified(project, "options")
    db.commit()


def _check_size(elements: list) -> None:
    if len(json.dumps(elements, separators=(",", ":"))) > MAX_BYTES:
        raise HTTPException(413, "That plan is too large to keep as an option.")
    if not any(isinstance(e, dict) and e.get("type") == "room" for e in elements):
        raise HTTPException(400, "An option needs a plan with rooms.")


def _shape(elements: list) -> list:
    """The layout without its finishes: new paint keeps the votes, a moved wall does not."""
    keep = ("room", "wall", "door", "window", "stairs", "railing")
    return sorted(
        (e.get("type"), e.get("kind") or "", round(e.get("left") or 0), round(e.get("top") or 0), round(e.get("width") or 0),
         round(e.get("height") or 0), round(e.get("angle") or 0), e.get("floor") or 1)
        for e in elements if isinstance(e, dict) and e.get("type") in keep)


def public(data: dict, share_id: int | None = None) -> dict:
    """Options with their tallies. On a share link only that link's voters are named."""
    ids = {o["id"] for o in data["items"]}
    votes = [v for v in data["votes"] if v.get("option_id") in ids]
    tally = {i: sum(1 for v in votes if v["option_id"] == i) for i in ids}
    shown = votes if share_id is None else [v for v in votes if v.get("share_id") == share_id]
    return {
        "items": [{**o, "votes": tally.get(o["id"], 0)} for o in data["items"]],
        "votes": [{k: v.get(k) for k in ("option_id", "author", "note", "created_at", "share_id")} for v in shown],
    }


def make_router(get_db, get_current_user, owned_project) -> APIRouter:
    router = APIRouter(tags=["options"])

    @router.get("/api/projects/{project_id}/options")
    def list_options(project_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
        return public(_store(owned_project(project_id, db, user)))

    @router.post("/api/projects/{project_id}/options")
    def add_option(project_id: int, req: NewOption, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
        project = owned_project(project_id, db, user)
        data = _store(project)
        if len(data["items"]) >= MAX_OPTIONS:
            raise HTTPException(400, f"A project keeps up to {MAX_OPTIONS} options. Delete one first.")
        _check_size(req.elements)
        item = {"id": secrets.token_hex(4), "name": req.name.strip(), "elements": req.elements, "created_at": _now()}
        data["items"].append(item)
        _save(db, project, data)
        return {**item, "votes": 0}

    @router.put("/api/projects/{project_id}/options/{option_id}")
    def edit_option(project_id: int, option_id: str, req: OptionPatch, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
        project = owned_project(project_id, db, user)
        data = _store(project)
        item = next((o for o in data["items"] if o["id"] == option_id), None)
        if not item:
            raise HTTPException(404, "Option not found")
        if req.name is not None:
            item["name"] = req.name.strip()
        if req.elements is not None:
            _check_size(req.elements)
            if _shape(req.elements) != _shape(item["elements"]):
                # the layout changed under the votes: they were for something else
                data["votes"] = [v for v in data["votes"] if v.get("option_id") != option_id]
            item["elements"] = req.elements
        _save(db, project, data)
        return {"ok": True}

    @router.delete("/api/projects/{project_id}/options/{option_id}")
    def delete_option(project_id: int, option_id: str, db: Session = Depends(get_db),
                      user: models.User = Depends(get_current_user)):
        project = owned_project(project_id, db, user)
        data = _store(project)
        data["items"] = [o for o in data["items"] if o["id"] != option_id]
        data["votes"] = [v for v in data["votes"] if v.get("option_id") != option_id]
        _save(db, project, data)
        return {"ok": True}

    @router.post("/api/shared/{token}/vote")
    def vote(token: str, req: NewVote, db: Session = Depends(get_db)):
        share = db.query(models.ProjectShare).filter(models.ProjectShare.token == token,
                                                     models.ProjectShare.active.is_(True)).first()
        project = db.get(models.Project, share.project_id) if share else None
        if not share or not project:
            raise HTTPException(404, "This link isn't active. Ask for a new one.")
        data = _store(project)
        if not any(o["id"] == req.option_id for o in data["items"]):
            raise HTTPException(400, "That option isn't there any more. Reload the page.")
        author = req.author.strip()
        # one vote per person per link: voting again moves it
        data["votes"] = [v for v in data["votes"]
                         if not (v.get("share_id") == share.id and v.get("author", "").lower() == author.lower())]
        if len(data["votes"]) >= MAX_VOTES:
            raise HTTPException(429, "This project has reached its vote limit.")
        data["votes"].append({"option_id": req.option_id, "author": author, "note": (req.note or "").strip() or None,
                              "share_id": share.id, "created_at": _now()})
        _save(db, project, data)
        return public(data, share.id)

    return router
