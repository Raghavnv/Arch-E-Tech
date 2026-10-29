"""
Edit a floor plan from a sentence ("make this door narrower", "extend the north wall by 1 m").

The plan is shown to the LLM in metres with stable ids; it answers with a short list of operations
(update / delete / add), which are validated and applied here. The LLM never rewrites the whole plan,
so everything it was not asked to touch stays exactly as it was.

Canvas units: 20 px = 1 m. Every element is a rectangle drawn from (left, top) along `angle`, with
`top` on its centre line: for walls, doors and windows (left, top) is the start point of the centre
line and width is the length; for rooms the box spans top - height/2 .. top + height/2.
"""
from __future__ import annotations

import json
import math
import os
import random
import string

PX = 20.0
LINEAR = ("wall", "door", "window", "stairs")
FURNITURE_SIZE = {   # metres, the same sizes the Studio uses
    "furniture_bed": (1.8, 2.1), "furniture_sofa": (2.2, 0.9), "furniture_table": (1.6, 0.9),
    "furniture_armchair": (0.8, 0.8), "furniture_bathtub": (1.7, 0.8), "furniture_vanity": (1.2, 0.55),
    "furniture_kitchen": (2.8, 0.65),
}
TYPES = set(LINEAR) | {"room"} | set(FURNITURE_SIZE)
ROOM_KINDS = {"living", "dining", "kitchen", "master_bedroom", "bedroom", "bathroom", "study", "utility", "lounge"}


class EditError(Exception):
    pass


def _r(v: float) -> float:
    return round(v, 2)


def describe(elements: list[dict]) -> list[dict]:
    """The plan as the LLM sees it: metres, rounded, one entry per element."""
    out = []
    for el in elements:
        t = el.get("type")
        if t not in TYPES or not el.get("id"):
            continue
        left, top = float(el.get("left") or 0) / PX, float(el.get("top") or 0) / PX
        w, h = float(el.get("width") or 0) / PX, float(el.get("height") or 0) / PX
        ang = float(el.get("angle") or 0)
        item = {"id": el["id"], "type": t}
        if t == "room":
            item.update(kind=el.get("kind"), name=el.get("name"), x=_r(left), y=_r(top - h / 2), width=_r(w), depth=_r(h))
        elif t in LINEAR:
            a = math.radians(ang)
            item.update(start=[_r(left), _r(top)], end=[_r(left + w * math.cos(a)), _r(top + w * math.sin(a))],
                        length=_r(w), thickness=_r(h), angle=_r(ang))
        else:
            item.update(x=_r(left), y=_r(top - h / 2), width=_r(w), depth=_r(h), angle=_r(ang))
        out.append(item)
    return out


SYSTEM = """You edit an architectural floor plan. Coordinates are metres, x grows right, y grows DOWN (north is up, smaller y).
Walls, doors, windows and stairs are lines: "start" and "end" points of their centre line, "length", "thickness", "angle" in degrees (0 = pointing right/east, 90 = pointing down/south).
Rooms and furniture are boxes: "x","y" is the top-left corner, "width" along x, "depth" along y, plus "angle".
Doors and windows sit on a wall: their line lies on the wall's centre line.

Answer with JSON only: {"ops": [...], "summary": "one short sentence of what you changed"}.
Operations:
  {"op":"update","id":"<id>", ...only the fields that change...}
     lines accept: "start":[x,y], "end":[x,y], "length", "thickness"   (give start+end, or start/length; the angle follows from start->end)
     boxes accept: "x","y","width","depth","angle"; rooms also "name","kind"
  {"op":"delete","id":"<id>"}
  {"op":"add","type":"wall|door|window|stairs|room|furniture_bed|furniture_sofa|furniture_table|furniture_armchair|furniture_bathtub|furniture_vanity|furniture_kitchen", ...the same geometry fields...}
Rules:
- Change only what the request asks for (plus what must move with it); never touch other elements.
- "this", "it", "the selected ..." means the SELECTED elements. If something is selected, prefer it.
- Keep the plan connected: when you lengthen, shorten or move a wall, move the ends of walls joined to it so corners stay closed, and keep doors/windows that were in that wall inside it. When a room's walls move, update the room box too.
- Doors: typical widths 0.8-1.0 m (main entrance 1.0-1.2 m). Windows: 0.9-2.4 m. Walls: 0.15-0.25 m thick.
- "bigger/smaller/wider/narrower/longer/shorter" without a number means a sensible step (about 20-30% or 0.5 m).
- People often give sizes in feet and inches: convert them (1 ft = 0.3048 m, 1 in = 0.0254 m). Mention sizes in feet in the summary.
- Keep a door or window centred where it was when you resize it (move its start so the middle stays put).
- A new door or window must lie on an existing wall line, between that wall's ends.
- If the request is impossible or unclear, return {"ops": [], "summary": "<why, and what to try instead>"}."""


def _new_id(t: str) -> str:
    return f"{t}_{''.join(random.choices(string.ascii_lowercase + string.digits, k=7))}"


def _num(v, lo=None, hi=None):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    if lo is not None:
        f = max(lo, f)
    if hi is not None:
        f = min(hi, f)
    return f


def _point(v):
    if isinstance(v, (list, tuple)) and len(v) == 2:
        x, y = _num(v[0], -500, 500), _num(v[1], -500, 500)
        if x is not None and y is not None:
            return x, y
    return None


def _apply_geometry(el: dict, op: dict):
    """Write the metre-based fields of an op onto a canvas element (in place)."""
    t = el["type"]
    if t in LINEAR:
        a = math.radians(float(el.get("angle") or 0))
        sx, sy = float(el.get("left") or 0) / PX, float(el.get("top") or 0) / PX
        length = float(el.get("width") or 0) / PX
        ex, ey = sx + length * math.cos(a), sy + length * math.sin(a)
        start, end = _point(op.get("start")), _point(op.get("end"))
        new_len = _num(op.get("length"), 0.1, 200)
        if start:
            sx, sy = start
        if end:
            ex, ey = end
        elif new_len is not None or start:
            # keep the direction; a new length runs from the (possibly new) start
            length = new_len if new_len is not None else length
            ex, ey = sx + length * math.cos(a), sy + length * math.sin(a)
        if new_len is not None and end and not start:
            # only an end and a length: the start follows
            sx, sy = ex - new_len * math.cos(a), ey - new_len * math.sin(a)
        dx, dy = ex - sx, ey - sy
        L = math.hypot(dx, dy)
        if L < (0.4 if t in ("door", "window") else 0.3):
            raise EditError(f"{t} would be too short")
        el["left"], el["top"], el["width"] = sx * PX, sy * PX, L * PX
        el["angle"] = round(math.degrees(math.atan2(dy, dx)), 2)
        th = _num(op.get("thickness"), 0.05, 1.0)
        if th is not None:
            el["height"] = th * PX
    else:
        h = float(el.get("height") or 0) / PX
        x = _num(op.get("x"), -500, 500)
        y = _num(op.get("y"), -500, 500)
        w = _num(op.get("width"), 0.2, 100)
        d = _num(op.get("depth"), 0.2, 100)
        top_edge = float(el.get("top") or 0) / PX - h / 2
        if w is not None:
            el["width"] = w * PX
        if d is not None:
            h = d
            el["height"] = d * PX
        if x is not None:
            el["left"] = x * PX
        top_edge = y if y is not None else top_edge
        el["top"] = (top_edge + h / 2) * PX
        ang = _num(op.get("angle"), -360, 360)
        if ang is not None:
            el["angle"] = ang
        if t == "room":
            el["area"] = round((el["width"] / PX) * (el["height"] / PX), 1)
    if t == "room":
        if isinstance(op.get("name"), str) and op["name"].strip():
            el["name"] = op["name"].strip()[:40]
        if op.get("kind") in ROOM_KINDS:
            el["kind"] = op["kind"]


def apply_ops(elements: list[dict], ops: list[dict]) -> tuple[list[dict], int]:
    """Apply validated operations; returns the new element list and how many operations took effect."""
    out = [dict(e) for e in elements]
    by_id = {e.get("id"): e for e in out if e.get("id")}
    done = 0
    for op in ops if isinstance(ops, list) else []:
        if not isinstance(op, dict):
            continue
        kind = op.get("op")
        try:
            if kind == "delete" and op.get("id") in by_id:
                out.remove(by_id.pop(op["id"]))
                done += 1
            elif kind == "update" and op.get("id") in by_id:
                el = by_id[op["id"]]
                before = dict(el)
                try:
                    _apply_geometry(el, op)
                except EditError:
                    el.clear()
                    el.update(before)
                    continue
                done += 1
            elif kind == "add" and op.get("type") in TYPES:
                t = op["type"]
                el = {"id": _new_id(t), "type": t, "left": 0, "top": 0, "angle": 0}
                if t in LINEAR:
                    el["height"] = {"wall": 8, "door": 5, "window": 5, "stairs": 18}[t]
                    el["width"] = 1
                    if t == "door":
                        el.update(swing=1, hinge=1)
                elif t in FURNITURE_SIZE:
                    fw, fd = FURNITURE_SIZE[t]
                    el["width"], el["height"] = fw * PX, fd * PX
                else:
                    el.update(width=3 * PX, height=3 * PX, kind=op.get("kind") if op.get("kind") in ROOM_KINDS else "living",
                              name=(op.get("name") or "Room")[:40])
                    el["top"] = 1.5 * PX
                _apply_geometry(el, op)
                if t in LINEAR and el["width"] < 0.1 * PX:
                    continue
                out.append(el)
                by_id[el["id"]] = el
                done += 1
        except (EditError, TypeError, ValueError):
            continue
    return out, done


def ask(instruction: str, elements: list[dict], selected: list[str], api_key: str | None) -> dict:
    """Ask the LLM for operations, apply them, and return {elements, summary, changed}."""
    from groq import Groq

    if not api_key:
        raise EditError("AI editing needs GROQ_API_KEY on the server.")
    plan = describe(elements)
    if not plan:
        raise EditError("The plan is empty, so there is nothing to edit yet.")
    sel = [p for p in plan if p["id"] in set(selected or [])]
    user = (f"PLAN:\n{json.dumps(plan, separators=(',', ':'))}\n\n"
            f"SELECTED: {json.dumps(sel, separators=(',', ':')) if sel else 'nothing'}\n\n"
            f"REQUEST: {instruction.strip()}")
    client = Groq(api_key=api_key, timeout=60)
    model = os.getenv("LAYOUT_MODEL", "openai/gpt-oss-120b")
    last_error = None
    for _ in range(2):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_completion_tokens=4000,
                reasoning_effort="medium",
            )
            data = json.loads(resp.choices[0].message.content or "{}")
            ops = data.get("ops") or []
            summary = str(data.get("summary") or "").strip()[:300]
            new, changed = apply_ops(elements, ops)
            if changed == 0:
                return {"elements": elements, "summary": summary or "Nothing was changed. Try being more specific.",
                        "changed": 0}
            return {"elements": new, "summary": summary or f"Applied {changed} change(s).", "changed": changed}
        except (json.JSONDecodeError, KeyError) as e:
            last_error = e
    raise EditError(f"The AI's answer couldn't be read ({last_error}). Try again.")
