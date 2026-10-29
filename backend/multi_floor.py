"""
Two- and three-storey homes from one brief.

The single-floor program (rooms and sizes) is shared out between the floors: the ground floor keeps
the day zone (living, dining, kitchen) and some bedrooms, upper floors get the rest of the bedrooms
around a family lounge. Each floor is drawn by the normal plan generator, then the floors are lined
up over each other and joined by a staircase that lands in an open room on every floor.

Element conventions (2D canvas, 20 px = 1 m): every element is a rectangle drawn from (left, top)
along `angle` with `top` on its centre line. Rooms span top - height/2 .. top + height/2.
"""
from __future__ import annotations

import math
import random
import re
import uuid

import floorplan_builder as fb

STAIR_L, STAIR_W = 64, 22          # a straight flight: 3.2 m run, 1.1 m wide
INSET = 8                          # keep the stairs this far off walls
OPEN_GROUND = ("living", "dining", "lounge")
OPEN_UPPER = ("lounge", "living", "dining")

_FLOOR_WORDS = [
    (3, r"\b(?:3|three)[- ]?(?:floors?|stor(?:e)?ys?|levels?)\b|\bg\s*\+\s*2\b|\btriplex\b"),
    (2, r"\b(?:2|two|double)[- ]?(?:floors?|stor(?:e)?ys?|levels?)\b|\bg\s*\+\s*1\b|\bduplex\b|\bground (?:and|\+|&) first floor\b|\bupstairs\b"),
]


def parse_floors(prompt: str) -> int:
    t = (prompt or "").lower()
    for n, pat in _FLOOR_WORDS:
        if re.search(pat, t):
            return n
    return 1


def wants_balcony(prompt: str) -> bool:
    return bool(re.search(r"\b(balcon(?:y|ies)|terrace|sit[- ]?out|deck)\b", (prompt or "").lower()))


def split_bedrooms(beds: int, floors: int, rng: random.Random) -> list[int]:
    """Bedrooms per floor, ground first. Several sensible splits are possible; one is picked at random
    (3 bedrooms on 2 floors -> 1+2 or 2+1; 4 -> 2+2 or 1+3; ...). Every floor gets at least one."""
    if floors == 2:
        options = [(g, beds - g) for g in range(1, beds) if beds - g >= 1 and abs(beds - 2 * g) <= 2]
        return list(rng.choice(options))
    # three floors: a bedroom or two downstairs, the rest shared between the two upper floors
    options = []
    for g in range(1, beds - 1):
        rest = beds - g
        a = rest // 2
        for up in {(a, rest - a), (rest - a, a)}:
            if min(up) >= 1:
                options.append((g, *up))
    return list(rng.choice(options))


def _room(kind: str, area: float, ensuite: bool = False) -> fb.Room:
    spec = fb.KIND_SPEC[kind]
    return fb.Room(id=f"r{uuid.uuid4().hex[:6]}", kind=kind, name=spec[0], area=float(area),
                   row=spec[5], ensuite=ensuite)


def floor_programs(program: list[fb.Room], split: list[int], baths_total: int, powders: int):
    """Share the whole-house program out between the floors. Returns (programs, master_floor)."""
    by_kind: dict[str, list[float]] = {}
    for r in program:
        by_kind.setdefault(r.kind, []).append(r.area)
    area = lambda k, d: (sum(by_kind[k]) / len(by_kind[k])) if by_kind.get(k) else d   # noqa: E731
    master_floor = max(range(len(split)), key=lambda i: (split[i], i))    # the floor with most bedrooms

    # bathrooms: one per floor with bedrooms, two where there are two or more bedrooms, extras downstairs
    baths = [2 if b >= 2 else 1 for b in split]
    while sum(baths) > baths_total and max(baths) > 1:
        baths[baths.index(max(baths))] -= 1
    baths[0] += max(0, baths_total - sum(baths))

    programs = []
    for f, beds in enumerate(split):
        rooms: list[fb.Room] = []
        if f == 0:
            rooms.append(_room("living", area("living", 24)))
            if by_kind.get("dining"):
                rooms.append(_room("dining", area("dining", 12)))
            rooms.append(_room("kitchen", area("kitchen", 10)))
            for k in ("utility", "study"):
                if by_kind.get(k):
                    rooms.append(_room(k, area(k, 6)))
        else:
            # a family lounge at the top of the stairs; the generator needs a kitchen-sized room too,
            # which becomes a balcony or a study afterwards
            rooms.append(_room("living", max(14.0, area("living", 24) * 0.65)))
            rooms.append(_room("kitchen", 8.0))
        # the generator expects one master per floor; it is renamed to a plain bedroom off the master floor
        for i in range(beds):
            kind = "master_bedroom" if i == 0 else "bedroom"
            rooms.append(_room(kind, area("master_bedroom", 18) if i == 0 and f == master_floor else area("bedroom", 13)))
        for i in range(baths[f]):
            rooms.append(_room("bathroom", area("bathroom", 6), ensuite=(i == 0 and (baths[f] >= 2 or beds == 1))))
        if f == 0:
            for _ in range(powders):
                rooms.append(_room("bathroom", 3.6))
        programs.append(rooms)
    return programs, master_floor


# --------------------------------------------------------------------------
# Geometry helpers on finished elements
# --------------------------------------------------------------------------
def _box(e):
    if e["type"] == "room":
        return e["left"], e["top"] - e["height"] / 2, e["left"] + e["width"], e["top"] + e["height"] / 2
    a = math.radians(e.get("angle") or 0)
    x1, y1 = e["left"] + e["width"] * math.cos(a), e["top"] + e["width"] * math.sin(a)
    h = e["height"] / 2
    if abs(math.sin(a)) < 0.5:     # horizontal-ish
        return min(e["left"], x1), e["top"] - h, max(e["left"], x1), e["top"] + h
    return e["left"] - h, min(e["top"], y1), e["left"] + h, max(e["top"], y1)


def _overlap(a, b) -> float:
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return w * h if w > 0 and h > 0 else 0.0


def _bbox(els):
    boxes = [_box(e) for e in els if e["type"] == "room"]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def _shift(els, dx, dy):
    for e in els:
        e["left"] += dx
        e["top"] += dy


# --------------------------------------------------------------------------
# Upper-floor touches: family lounge, balcony / study, railings
# --------------------------------------------------------------------------
def _furnish_swap(els, room, balcony: bool):
    """Replace kitchen fittings in the placeholder room with balcony seating or a study desk."""
    rb = _box(room)
    keep = [e for e in els if not (e["type"].startswith("furniture_") and _overlap(_box(e), rb) > 0)]
    cx, cy = (rb[0] + rb[2]) / 2, (rb[1] + rb[3]) / 2
    def add(t, w, h, x, y):
        keep.append({"id": f"{t}_{uuid.uuid4().hex[:7]}", "type": t, "left": x - w / 2, "top": y, "width": w, "height": h, "angle": 0})
    if balcony:
        add("furniture_armchair", 16, 16, cx - 12, cy)
        add("furniture_armchair", 16, 16, cx + 12, cy)
    else:
        add("furniture_table", 28, 14, cx, cy - 6)
        add("furniture_armchair", 14, 14, cx, cy + 12)
    els[:] = keep


def _railings_for(els, room):
    """Turn the balcony's outside walls into railings (splitting walls that run past it)."""
    rx0, ry0, rx1, ry1 = _box(room)
    rooms = [e for e in els if e["type"] == "room" and e is not room]

    def shared(edge):
        (x0, y0), (x1, y1) = edge
        for o in rooms:
            ox0, oy0, ox1, oy1 = _box(o)
            if y0 == y1 and (abs(oy0 - y0) < 2 or abs(oy1 - y0) < 2) and min(x1, ox1) - max(x0, ox0) > 4:
                return True
            if x0 == x1 and (abs(ox0 - x0) < 2 or abs(ox1 - x0) < 2) and min(y1, oy1) - max(y0, oy0) > 4:
                return True
        return False

    edges = [((rx0, ry0), (rx1, ry0)), ((rx0, ry1), (rx1, ry1)), ((rx0, ry0), (rx0, ry1)), ((rx1, ry0), (rx1, ry1))]
    outside = [e for e in edges if not shared(e)]
    out = []
    for w in els:
        if w["type"] != "wall":
            out.append(w)
            continue
        horiz = abs(math.sin(math.radians(w.get("angle") or 0))) < 0.5
        a0 = w["left"] if horiz else w["top"]
        a1 = a0 + w["width"]
        pieces = [(a0, a1, "wall")]
        for (x0, y0), (x1, y1) in outside:
            if horiz and y0 == y1 and abs(w["top"] - y0) < 2:
                lo, hi = x0, x1
            elif not horiz and x0 == x1 and abs(w["left"] - x0) < 2:
                lo, hi = y0, y1
            else:
                continue
            nxt = []
            for p0, p1, kind in pieces:
                if kind != "wall" or hi <= p0 or lo >= p1:
                    nxt.append((p0, p1, kind))
                    continue
                if lo > p0:
                    nxt.append((p0, lo, "wall"))
                nxt.append((max(p0, lo), min(p1, hi), "railing"))
                if hi < p1:
                    nxt.append((hi, p1, "wall"))
            pieces = nxt
        for p0, p1, kind in pieces:
            if p1 - p0 < 2:
                continue
            piece = dict(w, id=f"{kind}_{uuid.uuid4().hex[:7]}", type=kind, width=p1 - p0,
                         height=w["height"] if kind == "wall" else 4)
            if horiz:
                piece["left"] = p0
            else:
                piece["top"] = p0
            piece.pop("material", None) if kind == "railing" else None
            out.append(piece)
    # no windows in a railing
    rails = [_box(e) for e in out if e["type"] == "railing"]
    els[:] = [e for e in out if not (e["type"] == "window" and any(_overlap(_box(e), r) > 0 for r in rails))]


# --------------------------------------------------------------------------
# Stairs
# --------------------------------------------------------------------------
def _stair_spots(room):
    """Candidate stair rectangles along the inside of a room's walls: (box, left, top, angle)."""
    x0, y0, x1, y1 = _box(room)
    spots = []
    if x1 - x0 >= STAIR_L + 2 * INSET and y1 - y0 >= STAIR_W + 2 * INSET:
        for y in (y0 + INSET, y1 - INSET - STAIR_W):
            for x in range(int(x0 + INSET), int(x1 - INSET - STAIR_L) + 1, 10):
                spots.append(((x, y, x + STAIR_L, y + STAIR_W), x, y + STAIR_W / 2, 0))
    if y1 - y0 >= STAIR_L + 2 * INSET and x1 - x0 >= STAIR_W + 2 * INSET:
        for x in (x0 + INSET, x1 - INSET - STAIR_W):
            for y in range(int(y0 + INSET), int(y1 - INSET - STAIR_L) + 1, 10):
                spots.append(((x, y, x + STAIR_W, y + STAIR_L), x + STAIR_W / 2, y, 90))
    return spots


def _clutter(els, box) -> float:
    """How much furniture and door swing a stair box would sit on."""
    score = 0.0
    for e in els:
        if e["type"].startswith("furniture_"):
            score += _overlap(_box(e), box)
        elif e["type"] == "door":
            b = _box(e)
            grown = (b[0] - 30, b[1] - 30, b[2] + 30, b[3] + 30)     # keep clear of the swing
            score += 3 * _overlap(grown, box)
    return score


def _overhang(up_boxes, ground_boxes, dx, dy) -> float:
    """Upper-floor area (px²) that would have nothing under it after shifting by (dx, dy)."""
    total = 0.0
    for b in up_boxes:
        sb = (b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy)
        area = (sb[2] - sb[0]) * (sb[3] - sb[1])
        total += max(0.0, area - sum(_overlap(sb, g) for g in ground_boxes))
    return total


def place_stairs(floors_els: list[list[dict]]) -> float | None:
    """Line every upper floor up over the ground floor so one staircase lands in an open room on each,
    keeping as much of each upper floor as possible over the floor below. Returns the share of upper
    floor area left overhanging (0 is best), or None if no staircase fits."""
    ground = floors_els[0]
    g_open = [e for e in ground if e["type"] == "room" and e["kind"] in OPEN_GROUND]
    g_boxes = [_box(e) for e in ground if e["type"] == "room"]

    spots = []
    for room in g_open:
        for spot in _stair_spots(room):
            spots.append((_clutter(ground, spot[0]), spot))
    spots.sort(key=lambda s: s[0])
    spots = [s for _, s in spots[:24]]

    best = None
    for spot in spots:
        sx0, sy0, sx1, sy1 = spot[0]
        shifts, cost, hang_total, area_total = [], _clutter(ground, spot[0]), 0.0, 0.0
        for up in floors_els[1:]:
            u_boxes = [_box(e) for e in up if e["type"] == "room"]
            area_total += sum((b[2] - b[0]) * (b[3] - b[1]) for b in u_boxes)
            choice = None
            for u in (e for e in up if e["type"] == "room" and e["kind"] in OPEN_UPPER):
                ux0, uy0, ux1, uy1 = _box(u)
                lo_x, hi_x = sx1 + INSET - ux1, sx0 - INSET - ux0
                lo_y, hi_y = sy1 + INSET - uy1, sy0 - INSET - uy0
                if lo_x > hi_x or lo_y > hi_y:
                    continue
                # any shift in this range keeps the stairs inside the lounge: take the one that overhangs least
                xs = sorted({lo_x, hi_x, *range(int(lo_x), int(hi_x) + 1, 20)})
                ys = sorted({lo_y, hi_y, *range(int(lo_y), int(hi_y) + 1, 20)})
                for tx in xs:
                    for ty in ys:
                        h = _overhang(u_boxes, g_boxes, tx, ty)
                        if choice is None or h < choice[0]:
                            choice = (h, tx, ty)
            if choice is None:
                break
            hang_total += choice[0]
            shifts.append(choice[1:])
        else:
            cost += hang_total
            if best is None or cost < best[0]:
                best = (cost, spot, shifts, hang_total / max(area_total, 1))
    if best is None:
        return None

    _, (box, left, top, angle), shifts, hang_share = best
    for up, (tx, ty) in zip(floors_els[1:], shifts):
        _shift(up, round(tx / 5) * 5, round(ty / 5) * 5)
    # nothing may stand where the stairs are, on any floor
    for els in floors_els:
        els[:] = [e for e in els if not (e["type"].startswith("furniture_") and _overlap(_box(e), box) > 0)]
    for f, els in enumerate(floors_els):
        top_floor = f == len(floors_els) - 1
        els.append({"id": f"stairs_{uuid.uuid4().hex[:7]}", "type": "stairs", "left": left, "top": top,
                    "width": STAIR_L, "height": STAIR_W, "angle": angle,
                    # the top floor only shows where the stairs arrive
                    **({"arrival": True} if top_floor else {})})
    return hang_share


# --------------------------------------------------------------------------
# Putting it together
# --------------------------------------------------------------------------
def finish(floor_layouts: list, master_floor: int, balcony: bool) -> tuple[list[dict], float | None]:
    """Elements of every floor, named consistently across the house, aligned and joined by stairs."""
    floors_els = [lay.elements() for lay in floor_layouts]

    bed_n, bath_n = 1, 0
    for f, els in enumerate(floors_els):
        for e in els:
            if e["type"] != "room":
                continue
            if e["kind"] == "master_bedroom":
                if f == master_floor:
                    e["name"] = "Master Bedroom"
                else:
                    e["kind"] = "bedroom"
            if f > 0 and e["kind"] in ("living", "dining"):
                e["kind"], e["name"] = "lounge", "Family Lounge" if e["kind"] == "living" else "Lounge"
        for e in sorted((e for e in els if e["type"] == "room" and e["kind"] == "bedroom"), key=lambda r: (r["top"], r["left"])):
            bed_n += 1
            e["name"] = f"Bedroom {bed_n}"
        for e in els:
            if e["type"] == "room" and e["kind"] == "bathroom":
                if e.get("name") == "Ensuite Bath" and f != master_floor:
                    e["name"] = "Attached Bath"
                elif e.get("name") not in ("Ensuite Bath", "Powder Room"):
                    bath_n += 1
                    e["name"] = f"Bathroom {bath_n}"
        if f > 0:
            spare = next((e for e in els if e["type"] == "room" and e["kind"] == "kitchen"), None)
            if spare:
                spare["kind"], spare["name"] = ("balcony", "Balcony") if balcony else ("study", "Study")
                _furnish_swap(els, spare, balcony)
                if balcony:
                    _railings_for(els, spare)

    overhang = place_stairs(floors_els)
    out = []
    for f, els in enumerate(floors_els, start=1):
        for e in els:
            e["floor"] = f
            out.append(e)
    return out, overhang
