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


# ------------------------------------------------------------------------------------------------
# High-level actions: what the AI answers with now, and what the sentence parser produces
# ------------------------------------------------------------------------------------------------
ACTIONS_HELP = """You change a house plan by answering with ACTIONS. You never compute coordinates for rooms, doors or
windows: the Studio moves the walls, keeps corners joined, adjusts the neighbouring rooms and carries doors,
windows and furniture along. Refer to rooms by their id (or exact name). Sizes are metres (1 ft = 0.3048 m).
Sides are compass sides of the room on the drawing: "N" (up), "S", "E" (right), "W".

Answer JSON only: {"actions": [...], "summary": "one or two plain sentences of what you changed"}.

Room size and shape
  {"do":"resize_room","room":ID,"grow":true|false,"by_m":N?,"side":"N|S|E|W"?,"sides":["E","W"]?}   bigger / smaller (by_m optional)
  {"do":"resize_room","room":ID,"to_width_m":N?,"to_depth_m":N?,"to_area_m2":N?,"side":S?}           exact sizes (width = E-W, depth = N-S)
  {"do":"add_room","kind":K,"next_to":ID,"side":S?,"width_m":N?,"depth_m":N?,"name":"..."?}           a new room or outdoor space built against next_to
  {"do":"add_terrace","floor":F}                                                                     turn open roof on floor F into a terrace (or add one)
  {"do":"remove_room","room":ID}
  {"do":"merge_rooms","room":ID,"with":ID}           remove the wall between two rooms
  {"do":"split_room","room":ID,"kind":K,"name":"..."?,"fraction":0.5?}   a new wall cuts off part of the room for a new room
  {"do":"rename_room","room":ID,"name":"..."?,"kind":K?}   new name or a new use
  {"do":"swap_rooms","room":ID,"with":ID}
Kinds K: living, dining, kitchen, master_bedroom, bedroom, bathroom, study, utility (also pooja / store / laundry rooms, named so),
         lounge, closet, hallway, and outdoor spaces: patio (ground level), balcony (upper floors), terrace, deck.
Doors and windows
  {"do":"add_door","room":ID,"to":ID|"outside","width_m":N?,"side":S?}
  {"do":"add_window","room":ID,"side":S?,"width_m":N?,"count":N?}
  {"do":"remove_door"|"remove_window","room":ID,"to":ID|"outside"?,"side":S?,"all":bool?}
  {"do":"resize_door"|"resize_window","room":ID,"to":ID|"outside"?,"side":S?,"width_m":N}
  {"do":"resize_element","id":ELEMENT_ID,"width_m":N}      one particular door or window (e.g. the selected one)
Furniture
  {"do":"add_furniture","room":ID,"item":TYPE,"count":N?}   {"do":"remove_furniture","room":ID,"item":TYPE|null}
  {"do":"furnish_room","room":ID}   {"do":"move_furniture","id":ELEMENT_ID,"room":ID}   {"do":"rotate","id":ELEMENT_ID,"by":DEGREES}
Finishes (rooms: a list of ids, or "all")
  {"do":"paint_walls","rooms":[..],"material":"#hex" or a wall finish id,"isColor":bool,"feature":bool?}   feature = only one accent wall
  {"do":"set_floor","rooms":[..],"finish":FLOOR_ID}
  {"do":"set_ceiling","rooms":[..],"style":CEILING_ID?,"light":LIGHT_ID?}
  {"do":"set_windows","rooms":[..],"frame":FRAME_ID?,"treatment":TREATMENT_ID?,"fabric":"#hex"?}
  {"do":"apply_style","style":STYLE_ID}
  {"do":"set_exterior","paint":"#hex"?,"roof":"#hex"?,"roofStyle":"pitched|flat"?,"railing":"glass|metal|wood"?}
Anything else, as a last resort, on one element: {"do":"raw","ops":[{"op":"update","id":ID,...}|{"op":"delete","id":ID}]}

Rules: do exactly what was asked, nothing more. "This"/"it" means the SELECTED item (or the room it is in).
Several changes in one request -> several actions, in order. "Bigger" without a number: just grow=true.
A balcony goes on an upper floor, off a bedroom or lounge; a patio on the ground floor off the living or dining room.
If something can't be done (no such room, unclear), return no actions and say why in the summary."""


def house_summary(plan, active_floor, selected):
    """The house as the AI reads it: every room with its size, neighbours, doors, windows and furniture."""
    import plan_actions as pa
    lines = []
    floors = sorted({pa.fl(e) for e in plan.els}) or [1]
    for f in floors:
        lines.append(f"FLOOR {f}{' (the one on screen)' if f == active_floor else ''}{' (ground)' if f == 1 else ''}:")
        for r in plan.rooms(f):
            x0, y0, x1, y1 = pa.rbox(r)
            sides = []
            for sd in pa.SIDES:
                nb = [plan.name(q) for q in plan.across(r, sd)]
                out = plan.outside_stretches(r, sd)
                o, c, a0, a1 = pa.edge(r, sd)
                doors = len(plan.openings_on(f, o, c, a0, a1, ("door",)))
                wins = len(plan.openings_on(f, o, c, a0, a1, ("window",)))
                desc = ", ".join(nb) + (" + outside" if out and nb else "outside" if out else "")
                extra = (f"; {doors} door" if doors else "") + (f"; {wins} window" if wins else "")
                sides.append(f"{sd}: {desc or '-'}{extra}")
            furn = [e["type"].replace("furniture_", "") for e in plan.furniture_in(r)]
            lines.append(f"  [{r['id']}] {plan.name(r)} ({r.get('kind')}) {r['width'] / pa.U:.1f} x {r['height'] / pa.U:.1f} m"
                         f" at x {x0 / pa.U:.1f}-{x1 / pa.U:.1f}, y {y0 / pa.U:.1f}-{y1 / pa.U:.1f} | " + " | ".join(sides)
                         + (f" | furniture: {', '.join(furn)}" if furn else ""))
    sel = [plan.by_id(i) for i in selected or [] if plan.by_id(i)]
    if sel:
        lines.append("SELECTED: " + "; ".join(f"[{e['id']}] {e['type']}" + (f" {e['width'] / pa.U:.2f} m" if e["type"] in ("door", "window", "wall") else "")
                                         for e in sel))
    else:
        lines.append("SELECTED: nothing")
    return "\n".join(lines)


def catalog_text(catalog):
    if not catalog:
        return ""
    parts = []
    for key, label in (("paints", "PAINT COLOURS (name, #hex)"), ("wall_finishes", "WALL FINISH ids"), ("floors", "FLOOR ids"),
                       ("ceilings", "CEILING ids"), ("lights", "LIGHT ids"), ("frames", "WINDOW FRAME ids"),
                       ("treatments", "WINDOW TREATMENT ids"), ("styles", "STYLE ids")):
        items = catalog.get(key) or []
        if items:
            parts.append(f"{label}: " + ", ".join(f"{a}={b}" if key != "paints" else f"{a} {b}" for a, b in
                                                  ([i[0], i[1]] for i in items if isinstance(i, (list, tuple)) and len(i) >= 2))[:2500])
    parts.append("FURNITURE TYPES: " + ", ".join(__import__("plan_actions").FURNITURE.keys()))
    return "\n".join(parts)


CLIENT_OPS = {"paint_walls", "set_floor", "set_ceiling", "set_windows", "apply_style", "set_exterior"}


def run(actions, elements, active_floor=1, selected=None):
    """Carry out actions. Returns (elements, done sentences, problems, client ops for the Studio)."""
    import plan_actions as pa
    from edit_intents import Rooms
    plan = pa.Plan(elements, active_floor)
    finder = Rooms(plan, active_floor, selected or [])
    done, problems, client = [], [], []

    def room(ref, required=True):
        if isinstance(ref, dict):
            ref = ref.get("id")
        if ref in (None, "", "this", "it"):
            r = finder.this()
            if r is None and required:
                raise pa.ActionError("which room? Name it, or select something in it first")
            return r
        r = plan.by_id(ref) if isinstance(ref, str) else None
        if r is not None and r["type"] == "room":
            return r
        if isinstance(ref, str):
            text = ref.lower().strip()
            hits = finder.find(text)
            for h in hits:
                if h[2] is not None:
                    return h[2]
            r = next((q for q in plan.rooms() if (q.get("name") or "").lower() == text), None)
            if r:
                return r
        if required:
            raise pa.ActionError(f"there's no room called '{ref}'")
        return None

    def other(ref):
        if ref in (None, "", "outside", "outdoors", "garden"):
            return "outside" if ref else None
        return room(ref)

    for a in actions if isinstance(actions, list) else []:
        if not isinstance(a, dict):
            continue
        do = a.get("do")
        try:
            if do in CLIENT_OPS:
                op = dict(a)
                if "rooms" in op and op["rooms"] != "all":
                    ids = op["rooms"] if isinstance(op["rooms"], list) else [op["rooms"]]
                    op["rooms"] = [room(x)["id"] for x in ids] if ids else "all"
                client.append(op)
                continue
            if do == "resize_room":
                r = room(a.get("room"))
                sides = a.get("sides")
                if sides and not a.get("side") and not (a.get("to_width_m") or a.get("to_depth_m") or a.get("to_area_m2")):
                    # bigger along one axis: try both ends of it
                    best = plan._best_side(r, [s for s in sides if s in pa.SIDES], (1 if a.get("grow", True) else -1) * float(
                        a.get("by_m") or max(0.4, min(1.5, 0.22 * r["width"] * r["height"] / pa.U / pa.U / max(r["width"], r["height"]) * pa.U))), None)
                    if best[0] is None:
                        raise pa.ActionError(best[2])
                    plan.els = best[0].els
                    r2 = plan.by_id(r["id"])
                    done.append(f"{plan.name(r2)} is now {r2['width'] / pa.U:.1f} × {r2['height'] / pa.U:.1f} m ({r2['area']:.1f} m²)")
                    continue
                done.append(plan.resize_room(r, a.get("side") if a.get("side") in pa.SIDES else None, a.get("by_m"),
                                             a.get("to_width_m"), a.get("to_depth_m"), a.get("to_area_m2"), a.get("grow", True)))
            elif do == "add_room":
                kind = a.get("kind") if a.get("kind") in pa.KINDS else None
                if kind is None:
                    raise pa.ActionError(f"unknown room type {a.get('kind')}")
                host = room(a.get("next_to"), required=False) or finder.pick("living", active_floor) or (plan.rooms(active_floor) or [None])[0]
                if host is None:
                    raise pa.ActionError("there's no room to build it against")
                if kind == "balcony" and pa.fl(host) == 1 and len({pa.fl(e) for e in plan.els}) == 1:
                    kind = "patio"
                    plan.notes.append("A one-storey house has no balcony, so this is a ground-level patio.")
                r, sd = plan.add_room(kind, host, a.get("side") if a.get("side") in pa.SIDES else None, a.get("width_m"), a.get("depth_m"), a.get("name"))
                done.append(f"added {r['name']} ({r['width'] / pa.U:.1f} × {r['height'] / pa.U:.1f} m) on the {pa.SIDE_WORD[sd]} side of {plan.name(host)}, with a door from it")
            elif do == "add_terrace":
                f = int(a.get("floor") or max(pa.fl(e) for e in plan.els))
                t = plan.terrace_on_roof(f) if f > 1 else None
                if t is None:
                    host = next((q for k in ("lounge", "hallway", "master_bedroom", "bedroom", "living") for q in plan.rooms(f) if q.get("kind") == k), None)
                    if host is None:
                        raise pa.ActionError("there's no room on that floor to open a terrace from")
                    t, sd = plan.add_room("terrace", host, depth_m=3.0, name="Terrace")
                done.append(f"added a {t['width'] / pa.U:.1f} × {t['height'] / pa.U:.1f} m terrace on floor {f}")
            elif do == "remove_room":
                done.append(plan.remove_room(room(a.get("room"))))
            elif do == "merge_rooms":
                done.append(plan.merge_rooms(room(a.get("room")), room(a.get("with"))))
            elif do == "split_room":
                r = room(a.get("room"))
                kind = a.get("kind") if a.get("kind") in pa.KINDS else r.get("kind")
                nr = plan.split_room(r, kind, a.get("name"), fraction=a.get("fraction"))
                done.append(f"split {plan.name(r)} to make {nr['name']} ({nr['width'] / pa.U:.1f} × {nr['height'] / pa.U:.1f} m)")
            elif do == "rename_room":
                r = room(a.get("room"))
                old = plan.name(r)
                if a.get("kind") in pa.KINDS and a["kind"] != r.get("kind"):
                    r["kind"] = a["kind"]
                    plan.remove([e for e in plan.furniture_in(r)])
                    plan.furnish(r)
                if a.get("name"):
                    r["name"] = str(a["name"])[:40]
                elif a.get("kind"):
                    r["name"] = plan._fresh_name(r["kind"])
                done.append(f"{old} is now {r['name']}")
            elif do == "swap_rooms":
                done.append(plan.swap_rooms(room(a.get("room")), room(a.get("with"))))
            elif do == "add_door":
                done.append(plan.add_door(room(a.get("room")), other(a.get("to")), a.get("width_m"), a.get("side") if a.get("side") in pa.SIDES else None))
            elif do == "add_window":
                done.append(plan.add_window(room(a.get("room")), a.get("side") if a.get("side") in pa.SIDES else None, a.get("width_m"), a.get("count") or 1))
            elif do in ("remove_door", "remove_window"):
                done.append(plan.remove_openings(room(a.get("room")), do.split("_")[1], other(a.get("to")),
                                                 a.get("side") if a.get("side") in pa.SIDES else None, bool(a.get("all"))))
            elif do in ("resize_door", "resize_window"):
                w = float(a.get("width_m") or 0)
                if w <= 0.3:
                    raise pa.ActionError("how wide should it be?")
                done.append(plan.resize_openings(room(a.get("room")), do.split("_")[1], w, other(a.get("to")),
                                                 a.get("side") if a.get("side") in pa.SIDES else None))
            elif do == "resize_element":
                e = plan.by_id(a.get("id"))
                if not e or e["type"] not in ("door", "window"):
                    raise pa.ActionError("pick a door or window to resize")
                plan.set_opening_width(e, float(a["width_m"]) * pa.U)
                done.append(f"the {e['type']} is now {e['width'] / pa.U:.2f} m wide")
            elif do == "add_furniture":
                r = room(a.get("room"))
                t = a.get("item")
                if t not in pa.FURNITURE:
                    t = "furniture_" + str(t).replace("furniture_", "") if "furniture_" + str(t).replace("furniture_", "") in pa.FURNITURE else None
                if not t:
                    raise pa.ActionError(f"there's no '{a.get('item')}' in the furniture catalogue")
                n = 0
                for _ in range(max(1, min(8, int(a.get("count") or 1)))):
                    try:
                        plan.place(r, t)
                        n += 1
                    except pa.ActionError as e:
                        if not n:
                            raise
                        break
                done.append(f"added {'a ' + pa.FURNITURE[t][0].lower() if n == 1 else str(n) + ' × ' + pa.FURNITURE[t][0].lower()} to {plan.name(r)}")
            elif do == "remove_furniture":
                r = room(a.get("room"))
                t = a.get("item")
                items = [e for e in plan.furniture_in(r) if not t or e["type"] == t or e["type"] == "furniture_" + str(t)]
                if not items:
                    raise pa.ActionError(f"no {pa.FURNITURE.get(t, (t or 'furniture',))[0].lower()} in {plan.name(r)}")
                plan.remove(items)
                what = pa.FURNITURE.get(t, ("furniture",))[0].lower() if t else "furniture"
                done.append(f"removed the {what} from {plan.name(r)}" + (f" ({len(items)} pieces)" if len(items) > 1 else ""))
            elif do == "furnish_room":
                r = room(a.get("room"))
                made = plan.furnish(r)
                done.append(f"furnished {plan.name(r)} ({len(made)} piece{'s' if len(made) != 1 else ''})")
            elif do == "move_furniture":
                e = plan.by_id(a.get("id"))
                r = room(a.get("room"))
                if not e or not pa.is_furniture(e):
                    raise pa.ActionError("select the piece of furniture to move")
                plan.remove([e])
                nw = plan.place(r, e["type"], e["width"] / pa.U, e["height"] / pa.U)
                for k in ("colors", "gloss", "color"):
                    if k in e:
                        nw[k] = e[k]
                done.append(f"moved the {pa.FURNITURE.get(e['type'], (e['type'],))[0].lower()} to {plan.name(r)}")
            elif do == "rotate":
                e = plan.by_id(a.get("id"))
                if not e:
                    raise pa.ActionError("select what to rotate")
                b = pa.fbox(e) if pa.is_furniture(e) else None
                e["angle"] = ((e.get("angle") or 0) + float(a.get("by") or 90)) % 360
                if b:
                    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
                    r_ = math.radians(e["angle"])
                    e["left"], e["top"] = cx - e["width"] / 2 * math.cos(r_), cy - e["width"] / 2 * math.sin(r_)
                done.append(f"rotated it {float(a.get('by') or 90):.0f}°")
            elif do == "raw":
                new, n = apply_ops(plan.els, a.get("ops") or [])
                if n:
                    plan.els = new
                    done.append(f"made {n} direct change{'s' if n > 1 else ''}")
            else:
                problems.append(f"I don't know how to '{do}'")
        except pa.ActionError as e:
            problems.append(str(e))
        except (TypeError, ValueError, KeyError) as e:
            problems.append(f"couldn't do '{do}' ({e})")
    return plan.els, done, problems + plan.notes, client


def _sentence(done, problems, client, summary=None, names=None):
    parts = []
    if done:
        text = "; ".join(done)
        parts.append(text[0].upper() + text[1:] + ".")
    for op in client:
        label = op.get("label")
        what = {"paint_walls": "walls", "set_floor": "floor", "set_ceiling": "ceiling", "set_windows": "windows",
                "apply_style": "style", "set_exterior": "exterior"}[op["do"]]
        rooms = op.get("rooms")
        who = "Every room's" if rooms == "all" else ", ".join((names or {}).get(i, "the room") for i in (rooms or [])) if rooms else "The"
        if op["do"] in ("apply_style", "set_exterior"):
            who = "The house's"
        parts.append(f"{who} {what}: {label}." if label else f"Updated {who.lower()} {what}.")
    if problems:
        parts.append("Couldn't: " + "; ".join(p.rstrip(". ") for p in problems) + ".")
    return " ".join(parts) or (summary or "Nothing changed.")


def ask(instruction: str, elements: list[dict], selected: list[str], api_key: str | None,
        active_floor: int = 1, catalog: dict | None = None) -> dict:
    """Understand the request (AI first, then the built-in parser), carry it out, and report what happened."""
    import plan_actions as pa
    import edit_intents
    elements = [e for e in elements if isinstance(e, dict) and e.get("type")]
    if not any(e["type"] == "room" for e in elements) and not elements:
        raise EditError("The plan is empty, so there is nothing to edit yet.")
    plan = pa.Plan(elements, active_floor)
    actions, summary, source = None, None, "rules"
    if api_key:
        try:
            from groq import Groq
            client = Groq(api_key=api_key, timeout=60)
            model = os.getenv("LAYOUT_MODEL", "openai/gpt-oss-120b")
            user = (f"{house_summary(plan, active_floor, selected)}\n\n{catalog_text(catalog)}\n\nREQUEST: {instruction.strip()}")
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": ACTIONS_HELP}, {"role": "user", "content": user}],
                response_format={"type": "json_object"}, temperature=0.1, max_completion_tokens=3000, reasoning_effort="medium")
            data = json.loads(resp.choices[0].message.content or "{}")
            actions = data.get("actions") or []
            summary = str(data.get("summary") or "").strip()[:300]
            source = "ai"
        except Exception as e:                               # the parser below still understands most requests
            print(f"AI edit fell back to the parser: {e}")
            actions = None
    if not actions:
        parsed = edit_intents.parse(instruction, plan, active_floor, selected, catalog)
        if parsed:
            actions, source = parsed, "rules"
    if not actions:
        return {"elements": elements, "changed": 0, "client_ops": [], "source": source,
                "summary": summary or ("I couldn't tell what to change. Try naming the room and the change, e.g. "
                                       "\"make the kitchen 1 m wider\", \"add a balcony to the master bedroom\", "
                                       "\"put a door between the study and the hallway\" or \"paint the living room sage\".")}
    new, done, problems, client_ops = run(actions, elements, active_floor, selected)
    changed = len(done)
    return {"elements": new if changed else elements, "changed": changed + len(client_ops), "client_ops": client_ops,
            "summary": _sentence(done, problems, client_ops, summary, {e["id"]: e.get("name") or e.get("kind") for e in new if e.get("type") == "room"}),
            "problems": problems, "source": source}
