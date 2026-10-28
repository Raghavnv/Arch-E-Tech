"""
Deterministic floor-plan builder for Arch-E-Tech.

The AI only decides WHAT rooms the house needs (a "room program").  This module
decides WHERE everything goes, so the result is always a closed, connected house
with furniture inside the right rooms.

Output elements follow the conventions of the frontend editor (Canvas2D/Canvas3D):

  * 1 unit = 0.05 m  (20 units = 1 m)
  * every element is a Fabric rect with originX='left', originY='center'
        left/top   -> the middle of the rect's left edge
        width      -> length along the element's direction
        height     -> thickness
        angle      -> degrees, the element extends along (cos a, sin a)
  * walls are 8 units thick, doors/windows lie on a wall's centre line
  * furniture: its "back" (headboard / sofa back) points along (sin a, -cos a)
"""
from __future__ import annotations

import copy
import math
import random
import re
import uuid
from dataclasses import dataclass, field

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------
U = 20                  # units per metre
CELL = 10               # layout grid = 0.5 m
WALL_T = 8
HALF_T = WALL_T // 2
DOOR_T = 5
WIN_T = 5
ORIGIN_X, ORIGIN_Y = 100, 100
CORRIDOR_CELLS = 3      # 1.5 m between wall centre lines
DOOR_W = 30             # 1.5 m: wide enough for the first-person walkthrough
ENTRY_W = 32
WIN_W = 30
SMALL_WIN_W = 20
MARGIN = 8              # openings stay this far from the ends of a wall piece

ROOM_KINDS = [
    "living", "dining", "kitchen", "master_bedroom",
    "bedroom", "bathroom", "study", "utility",
]

# kind: (label, min m2, default m2, max m2, min width m, row)
KIND_SPEC = {
    "living":         ("Living Room",    14, 24, 48, 3.5, "public"),
    "dining":         ("Dining Room",     8, 12, 24, 2.8, "public"),
    "kitchen":        ("Kitchen",         7, 10, 22, 2.8, "public"),
    "utility":        ("Utility",         3,  4,  8, 2.4, "public"),
    "lounge":         ("Lounge",         10, 16, 40, 3.0, "public"),   # open family space, never walled off
    "master_bedroom": ("Master Bedroom", 15, 18, 32, 3.4, "private"),
    "bedroom":        ("Bedroom",        11, 13, 22, 3.0, "private"),
    "study":          ("Study",           6,  9, 16, 2.6, "private"),
    "bathroom":       ("Bathroom",      3.5,  6,  9, 2.4, "private"),
}
PUB_ORDER = {"living": 0, "dining": 1, "kitchen": 2, "utility": 3}
STRETCH_WEIGHT = {"bathroom": 0.25, "utility": 0.4}


class LayoutError(Exception):
    pass


# --------------------------------------------------------------------------
# Room program (what the AI / prompt parser produces)
# --------------------------------------------------------------------------
@dataclass
class Room:
    id: str
    kind: str
    name: str
    area: float
    row: str = "public"
    ensuite: bool = False
    x0: int = 0
    y0: int = 0
    x1: int = 0
    y1: int = 0
    openings: dict = field(default_factory=lambda: {"N": [], "S": [], "E": [], "W": []})


_WORD_NUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "single": 1, "double": 2,
}
_NUM = r"(\d+|one|two|three|four|five|six|seven|eight)"


def _to_int(tok):
    tok = tok.lower()
    return int(tok) if tok.isdigit() else _WORD_NUM.get(tok)


def parse_prompt(prompt: str) -> dict:
    """Cheap regex reading of the prompt. Used as safety net and to enforce counts."""
    t = (prompt or "").lower()
    out = {"bedrooms": None, "bathrooms": None, "area_sqm": None,
           "study": False, "dining": False, "utility": False, "studio": False}

    m = re.search(_NUM + r"\s*[- ]?\s*(?:bhk|bed\s*rooms?|beds\b|br\b)", t)
    if m:
        out["bedrooms"] = _to_int(m.group(1))
    m = re.search(_NUM + r"\s*[- ]?\s*(?:bath(?:room)?s?\b|ba\b|toilets?)", t)
    if m:
        out["bathrooms"] = _to_int(m.group(1))

    m = re.search(
        r"([\d][\d,]*(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|square\s*f(?:ee|oo)t|sft|sq\.?\s*m\b|sqm|m2|m²|square\s*met(?:er|re)s?)",
        t,
    )
    if m:
        val = float(m.group(1).replace(",", ""))
        unit = m.group(2)
        is_sqft = ("ft" in unit) or ("feet" in unit) or ("foot" in unit)
        out["area_sqm"] = val * 0.092903 if is_sqft else val

    out["study"] = bool(re.search(r"\b(study|office|library)\b", t))
    out["dining"] = bool(re.search(r"\bdining\b", t))
    out["utility"] = bool(re.search(r"\b(utility|laundry)\b", t))
    out["studio"] = bool(re.search(r"\bstudio\b", t))
    return out


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def build_program(llm_rooms, llm_total_sqm, prompt: str) -> list[Room]:
    """
    Merge what the AI proposed with what the prompt literally says.
    llm_rooms: list of dicts {"kind": str, "area_sqm": float} (may be empty/None)
    """
    p = parse_prompt(prompt)
    llm_rooms = [r for r in (llm_rooms or []) if r.get("kind") in KIND_SPEC]

    def count(kind):
        return sum(1 for r in llm_rooms if r["kind"] == kind)

    def avg_area(kind):
        vals = [float(r.get("area_sqm") or 0) for r in llm_rooms if r["kind"] == kind]
        vals = [v for v in vals if v > 0]
        return sum(vals) / len(vals) if vals else None

    llm_beds = count("master_bedroom") + count("bedroom")
    beds = p["bedrooms"] if p["bedrooms"] else (llm_beds or 2)
    if p["studio"] and not p["bedrooms"]:
        beds = 1
    beds = int(_clamp(beds, 1, 6))

    if p["bathrooms"]:
        baths = p["bathrooms"]
    elif count("bathroom"):
        baths = count("bathroom")
    else:
        baths = {1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4}[beds]
    baths = int(_clamp(baths, 1, 6))

    want_dining = bool(count("dining")) or p["dining"] or beds >= 2
    want_study = bool(count("study")) or p["study"]
    want_utility = bool(count("utility")) or p["utility"]

    def area_for(kind):
        lo, default, hi = KIND_SPEC[kind][1:4]
        a = avg_area(kind) or default
        return _clamp(a, lo, hi)

    wanted = [("living", area_for("living"))]
    if want_dining:
        wanted.append(("dining", area_for("dining")))
    wanted.append(("kitchen", area_for("kitchen")))
    if want_utility:
        wanted.append(("utility", area_for("utility")))
    wanted.append(("master_bedroom", area_for("master_bedroom")))
    for _ in range(beds - 1):
        wanted.append(("bedroom", area_for("bedroom")))
    if want_study:
        wanted.append(("study", area_for("study")))
    for _ in range(baths):
        wanted.append(("bathroom", area_for("bathroom")))

    target = p["area_sqm"] or (llm_total_sqm if llm_total_sqm and llm_total_sqm > 0 else None)
    if target:
        target = _clamp(target, 25, 600)
        base = sum(a for _, a in wanted)
        s = _clamp((target * 0.88) / base, 0.55, 2.6)
        scaled = []
        for kind, a in wanted:
            lo, _, hi = KIND_SPEC[kind][1:4]
            scaled.append((kind, _clamp(a * s, lo * 0.9, hi * 1.25)))
        wanted = scaled

    rooms: list[Room] = []
    bed_i = 0
    bath_i = 0
    ensuite_for_master = baths >= 2 or beds <= 1
    for kind, area in wanted:
        label = KIND_SPEC[kind][0]
        row = KIND_SPEC[kind][5]
        name = label
        ensuite = False
        if kind == "bedroom":
            bed_i += 1
            name = f"Bedroom {bed_i + 1}"
        elif kind == "master_bedroom":
            name = "Master Bedroom" if beds > 1 else "Bedroom"
        elif kind == "bathroom":
            bath_i += 1
            if bath_i == 1 and ensuite_for_master:
                ensuite = True
                name = "Ensuite Bath"
            else:
                name = "Bathroom" if baths == 1 else f"Bathroom {bath_i}"
        rooms.append(Room(id=f"r{len(rooms)}", kind=kind, name=name, area=float(area),
                          row=row, ensuite=ensuite))
    return rooms


# --------------------------------------------------------------------------
# Small geometry helpers
# --------------------------------------------------------------------------
def _aabb(cx, cy, w, d, a):
    if a % 180 == 0:
        hx, hy = w / 2, d / 2
    else:
        hx, hy = d / 2, w / 2
    return (cx - hx, cy - hy, cx + hx, cy + hy)


def _hit(r1, r2, gap=0.0):
    return not (r1[2] + gap <= r2[0] or r2[2] + gap <= r1[0]
                or r1[3] + gap <= r2[1] or r2[3] + gap <= r1[1])


def _opposite(side):
    return {"N": "S", "S": "N", "E": "W", "W": "E"}[side]


def _angle_from_back(bx, by):
    """Angle for an item whose back must point along (bx, by)."""
    if abs(by) >= abs(bx):
        return 0 if by < 0 else 180
    return 90 if bx > 0 else 270


def _shared_boundary(a: Room, b: Room):
    """(orient, line, lo, hi) of the wall two rooms share, or None."""
    if a.x1 == b.x0 or b.x1 == a.x0:
        line = a.x1 if a.x1 == b.x0 else a.x0
        lo, hi = max(a.y0, b.y0), min(a.y1, b.y1)
        if hi > lo:
            return ("v", line, lo, hi)
    if a.y1 == b.y0 or b.y1 == a.y0:
        line = a.y1 if a.y1 == b.y0 else a.y0
        lo, hi = max(a.x0, b.x0), min(a.x1, b.x1)
        if hi > lo:
            return ("h", line, lo, hi)
    return None


def _side_of(room: Room, orient, line):
    if orient == "h":
        return "N" if line == room.y0 else "S"
    return "W" if line == room.x0 else "E"


_COS = {0: 1, 90: 0, 180: -1, 270: 0}
_SIN = {0: 0, 90: 1, 180: 0, 270: -1}


def _new_id(kind):
    return f"{kind}_{uuid.uuid4().hex[:7]}"


# --------------------------------------------------------------------------
# Furniture placement inside one room
# --------------------------------------------------------------------------
class Placer:
    def __init__(self, room: Room, sink: list):
        self.room = room
        self.sink = sink
        self.ix0, self.iy0 = room.x0 + HALF_T, room.y0 + HALF_T
        self.ix1, self.iy1 = room.x1 - HALF_T, room.y1 - HALF_T
        self.items = []
        self.door_zones = []
        self.win_zones = []
        depth = 12 if room.kind == "bathroom" else 20
        for side, lst in room.openings.items():
            for kind, lo, hi in lst:
                if kind == "door":
                    self.door_zones.append(self._strip(side, lo, hi, depth))
                elif kind == "window":
                    self.win_zones.append(self._strip(side, lo, hi, 8))
                # kind == "open" (open-plan boundary) only influences wall ranking

    # -- geometry --------------------------------------------------------
    def _strip(self, side, lo, hi, depth):
        if side == "N":
            return (lo, self.iy0, hi, self.iy0 + depth)
        if side == "S":
            return (lo, self.iy1 - depth, hi, self.iy1)
        if side == "W":
            return (self.ix0, lo, self.ix0 + depth, hi)
        return (self.ix1 - depth, lo, self.ix1, hi)

    def wall_len(self, side):
        return (self.ix1 - self.ix0) if side in "NS" else (self.iy1 - self.iy0)

    def ranked(self, exclude=()):
        def pen(s):
            return sum({"door": 3, "open": 4}.get(k, 1) for k, _, _ in self.room.openings[s])
        sides = [s for s in "NSEW" if s not in exclude]
        sides.sort(key=lambda s: (pen(s), -self.wall_len(s)))
        return sides

    def _spots(self, w, d, side, corner):
        if side in ("N", "S"):
            a = 0 if side == "N" else 180
            cy = self.iy0 + d / 2 if side == "N" else self.iy1 - d / 2
            lo, hi = self.ix0 + w / 2, self.ix1 - w / 2

            def mk(p):
                return (p, cy, a)
        else:
            a = 270 if side == "W" else 90
            cx = self.ix0 + d / 2 if side == "W" else self.ix1 - d / 2
            lo, hi = self.iy0 + w / 2, self.iy1 - w / 2

            def mk(p):
                return (cx, p, a)
        if hi < lo - 1e-6:
            return
        mid = (lo + hi) / 2
        n = int((hi - lo) // 2) + 1
        ps = [lo + i * 2 for i in range(n)] + [hi]
        ps.sort(key=lambda p: -abs(p - mid) if corner else abs(p - mid))
        for p in ps:
            yield mk(p)

    def _ok(self, rect, avoid_windows, gap):
        if (rect[0] < self.ix0 - 0.5 or rect[1] < self.iy0 - 0.5
                or rect[2] > self.ix1 + 0.5 or rect[3] > self.iy1 + 0.5):
            return False
        for z in self.door_zones:
            if _hit(rect, z):
                return False
        if avoid_windows:
            for z in self.win_zones:
                if _hit(rect, z):
                    return False
        for it in self.items:
            if _hit(rect, it["rect"], gap):
                return False
        return True

    def _commit(self, ftype, cx, cy, a, w, d, rect):
        item = {"type": ftype, "cx": cx, "cy": cy, "a": a, "w": w, "d": d, "rect": rect}
        self.items.append(item)
        self.sink.append(item)
        return item

    # -- public placement API -------------------------------------------
    def place(self, ftype, w, d, sides, avoid_windows=False, gap=2, corner=False):
        for side in sides:
            for cx, cy, a in self._spots(w, d, side, corner):
                rect = _aabb(cx, cy, w, d, a)
                if self._ok(rect, avoid_windows, gap):
                    return self._commit(ftype, cx, cy, a, w, d, rect)
        return None

    def place_at(self, ftype, cx, cy, a, w, d, avoid_windows=False, gap=1):
        rect = _aabb(cx, cy, w, d, a)
        if self._ok(rect, avoid_windows, gap):
            return self._commit(ftype, cx, cy, a, w, d, rect)
        return None

    def center(self):
        return ((self.ix0 + self.ix1) / 2, (self.iy0 + self.iy1) / 2)


def _front(a):
    return (-math.sin(math.radians(a)), math.cos(math.radians(a)))


def _along(a):
    return (math.cos(math.radians(a)), math.sin(math.radians(a)))


def furnish_living(p: Placer):
    sofa = (p.place("furniture_sofa", 40, 18, p.ranked(), gap=2)
            or p.place("furniture_sofa", 32, 16, p.ranked(), gap=2))
    if not sofa:
        return
    fx, fy = _front(sofa["a"])
    ux, uy = _along(sofa["a"])
    tcx = sofa["cx"] + fx * (sofa["d"] / 2 + 7 + 6)
    tcy = sofa["cy"] + fy * (sofa["d"] / 2 + 7 + 6)
    table = p.place_at("furniture_table", tcx, tcy, sofa["a"], 20, 12, gap=1)
    if not table:
        return
    area_m2 = p.room.area
    n_chairs = 2 if area_m2 >= 22 else (1 if area_m2 >= 15 else 0)
    for sign in (1, -1)[:n_chairs]:
        ccx = table["cx"] + ux * sign * 24
        ccy = table["cy"] + uy * sign * 24
        a = _angle_from_back(ux * sign, uy * sign)
        p.place_at("furniture_armchair", ccx, ccy, a, 16, 16, gap=1)


def furnish_dining(p: Placer):
    iw, ih = p.ix1 - p.ix0, p.iy1 - p.iy0
    a = 0 if iw >= ih else 90
    table = None
    cx0, cy0 = p.center()
    for w, d in ((36, 18), (30, 16)):
        # try centred, then nudge along / across the long axis (e.g. away from a door)
        for lat in (0, -4, 4, -8, 8):
            for off in (0, 4, -4, 8, -8, 12, -12):
                cx = cx0 + (off if a == 0 else lat)
                cy = cy0 + (off if a == 90 else lat)
                table = p.place_at("furniture_table", cx, cy, a, w, d, gap=1)
                if table:
                    break
            if table:
                break
        if table:
            break
    if not table:
        table = p.place("furniture_table", 30, 16, p.ranked(), gap=1)
        if not table:
            return
    ux, uy = _along(table["a"])
    px, py = _front(table["a"])
    for along in (-table["w"] / 4, table["w"] / 4):
        for sign in (1, -1):
            off = table["d"] / 2 + 6
            ccx = table["cx"] + ux * along + px * sign * off
            ccy = table["cy"] + uy * along + py * sign * off
            ang = _angle_from_back(px * sign, py * sign)
            p.place_at("furniture_armchair", ccx, ccy, ang, 10, 10, gap=0)


def _kitchen_counter(p: Placer, sides, maxw):
    """Place a counter run on the first wall that can take one; returns (item, side)."""
    for s in sides:
        full = int(min(p.wall_len(s) - 2, maxw))
        for w in dict.fromkeys([full, 44, 36, 28, 22]):
            if 18 <= w <= full:
                it = p.place("furniture_kitchen", w, 13, [s], gap=0, corner=True)
                if it:
                    return it, s
    return None, None


def furnish_kitchen(p: Placer):
    first, first_side = _kitchen_counter(p, p.ranked(), 56)
    if first:
        rest = p.ranked(exclude=(first_side, _opposite(first_side)))
        _kitchen_counter(p, rest, 34)
    iw, ih = p.ix1 - p.ix0, p.iy1 - p.iy0
    if min(iw, ih) >= 72 and p.room.area >= 12:
        cx, cy = p.center()
        a = 0 if iw >= ih else 90
        p.place_at("furniture_kitchen", cx, cy, a, 36, 16, gap=18)


def furnish_bedroom(p: Placer, master: bool):
    door_side = next((s for s in "NSEW" if any(k == "door" for k, _, _ in p.room.openings[s])), None)
    order = []
    if door_side:
        order.append(_opposite(door_side))
    order += [s for s in p.ranked() if s not in order]
    bw, bd = (36, 42) if master else (30, 40)
    bed = p.place("furniture_bed", bw, bd, order, avoid_windows=True, gap=2)
    if not bed:
        bed = p.place("furniture_bed", 30, 40, order, avoid_windows=True, gap=2) or \
              p.place("furniture_bed", 30, 40, order, avoid_windows=False, gap=2)
    if not bed:
        return
    if master and p.room.area >= 14:
        p.place("furniture_armchair", 16, 16, p.ranked(), gap=6, corner=True)
    elif not master and p.room.area >= 11:
        p.place("furniture_table", 24, 12, p.ranked(), gap=6, corner=True)


def furnish_study(p: Placer):
    desk = p.place("furniture_table", 28, 14, p.ranked(), gap=2)
    if not desk:
        return
    fx, fy = _front(desk["a"])
    ccx = desk["cx"] + fx * (desk["d"] / 2 + 8)
    ccy = desk["cy"] + fy * (desk["d"] / 2 + 8)
    p.place_at("furniture_armchair", ccx, ccy, _angle_from_back(fx, fy), 12, 12, gap=0)
    if p.room.area >= 10:
        p.place("furniture_armchair", 16, 16, p.ranked(), gap=6, corner=True)


def furnish_bathroom(p: Placer):
    sides = [s for s in p.ranked() if not p.room.openings[s] or
             all(k != "door" for k, _, _ in p.room.openings[s])]
    sides.sort(key=lambda s: -p.wall_len(s))
    tub = p.place("furniture_bathtub", 34, 16, sides or p.ranked(), gap=1, corner=True)
    p.place("furniture_vanity", 20, 11, p.ranked(), gap=1, corner=True)
    return tub


FURNISHERS = {
    "living": furnish_living,
    "dining": furnish_dining,
    "kitchen": furnish_kitchen,
    "study": furnish_study,
    "bathroom": furnish_bathroom,
    "lounge": furnish_living,
}


# --------------------------------------------------------------------------
# The layout
# --------------------------------------------------------------------------
class Layout:
    def __init__(self, rooms: list[Room], corridor: bool, preplaced: bool = False):
        self.rooms = [copy.deepcopy(r) for r in rooms]
        self.use_corridor = corridor
        self.preplaced = preplaced
        self.hall: Room | None = next((r for r in self.rooms if r.kind == "hallway"), None) if preplaced else None
        self.open_pairs: set = set()
        self.open_kitchen = False
        self.walls: list[dict] = []
        self.doors: list[dict] = []
        self.windows: list[dict] = []
        self.furniture: list[dict] = []
        self.line_ops: dict = {}
        self.bbox = (0, 0, 0, 0)
        self.entrance_room_id = None

    # -- step 1: geometry ----------------------------------------------
    def _private_order(self, priv):
        master = [r for r in priv if r.kind == "master_bedroom"]
        ensuite = [r for r in priv if r.kind == "bathroom" and r.ensuite]
        commons = [r for r in priv if r.kind == "bathroom" and not r.ensuite]
        beds = [r for r in priv if r.kind == "bedroom"]
        study = [r for r in priv if r.kind == "study"]
        others = beds + study
        seq = master + ensuite
        if commons:
            if others:
                others.insert(1 if len(others) > 1 else 1, commons[0])
            else:
                others = [commons[0]]
            others += commons[1:]
        return seq + others

    def plan(self):
        """Lay the rooms out; deepen the rows for big programs so the house isn't a long strip."""
        for f in (1.0, 1.15, 1.3, 1.45):
            self._plan_once(f)
            x0, y0, x1, y1 = self.bbox
            if (x1 - x0) / max(1, (y1 - y0)) <= 1.9:
                break

    def _plan_once(self, f):
        if self.hall is not None:
            self.rooms.remove(self.hall)
            self.hall = None
        pub = sorted([r for r in self.rooms if r.row == "public"], key=lambda r: PUB_ORDER[r.kind])
        priv = self._private_order([r for r in self.rooms if r.row == "private"])
        if not any(r.kind == "living" for r in pub):
            raise LayoutError("no living room")
        rows = []
        if priv:
            rows.append(("priv", priv))
        corridor_needed = self.use_corridor and pub and priv
        if corridor_needed:
            rows.append(("hall", []))
        rows.append(("pub", pub))

        living = next(r for r in pub if r.kind == "living")
        master = next((r for r in priv if r.kind == "master_bedroom"), None)
        depth_m = {
            "pub": _clamp(math.sqrt(living.area / 1.3), 4.0, 6.5) * f,
            "priv": _clamp(math.sqrt((master.area if master else 12) / 1.2), 3.5, 5.5) * f,
        }
        depth_cells = {k: max(7, round(v / 0.5)) for k, v in depth_m.items()}
        depth_cells["hall"] = CORRIDOR_CELLS

        def natural(room, d_cells):
            minw = KIND_SPEC[room.kind][4]
            w = max(math.ceil(minw / 0.5), round((room.area / (d_cells * 0.5)) / 0.5))
            return int(w)

        widths = {}
        for key, lst in rows:
            if key == "hall":
                continue
            widths[key] = [natural(r, depth_cells[key]) for r in lst]
        total_w = max([sum(v) for v in widths.values()] + [14])

        for key, lst in rows:
            if key == "hall":
                continue
            cells = widths[key]
            extra = total_w - sum(cells)
            if extra > 0:
                weights = [STRETCH_WEIGHT.get(r.kind, 1.0) * c for r, c in zip(lst, cells)]
                wsum = sum(weights)
                shares = [extra * w / wsum for w in weights]
                base = [int(math.floor(s)) for s in shares]
                rest = extra - sum(base)
                order = sorted(range(len(shares)), key=lambda i: shares[i] - base[i], reverse=True)
                for i in order[:rest]:
                    base[i] += 1
                cells = [c + b for c, b in zip(cells, base)]
            widths[key] = cells

        y_cells = 0
        for key, lst in rows:
            d = depth_cells[key]
            if key == "hall":
                self.hall = Room(id="hall", kind="hallway", name="Hallway", area=0, row="hall",
                                 x0=ORIGIN_X, x1=ORIGIN_X + total_w * CELL,
                                 y0=ORIGIN_Y + y_cells * CELL, y1=ORIGIN_Y + (y_cells + d) * CELL)
                self.rooms.append(self.hall)
            else:
                x_cells = 0
                for room, wc in zip(lst, widths[key]):
                    room.x0 = ORIGIN_X + x_cells * CELL
                    room.x1 = ORIGIN_X + (x_cells + wc) * CELL
                    room.y0 = ORIGIN_Y + y_cells * CELL
                    room.y1 = ORIGIN_Y + (y_cells + d) * CELL
                    x_cells += wc
            y_cells += d

        self.bbox = (
            min(r.x0 for r in self.rooms), min(r.y0 for r in self.rooms),
            max(r.x1 for r in self.rooms), max(r.y1 for r in self.rooms),
        )

    # -- step 2: connections --------------------------------------------
    def _adjacent(self, a, b):
        return _shared_boundary(a, b) is not None

    def connect(self):
        rooms = self.rooms
        by_kind = lambda k: [r for r in rooms if r.kind == k]  # noqa: E731
        living = by_kind("living")[0]
        dining = (by_kind("dining") or [None])[0]
        kitchen = (by_kind("kitchen") or [None])[0]
        utility = (by_kind("utility") or [None])[0]
        master = (by_kind("master_bedroom") or [None])[0]

        edges = []  # (a, b, kind)
        if dining and self._adjacent(living, dining):
            edges.append((living, dining, "open"))
            if kitchen and self._adjacent(dining, kitchen):
                edges.append((dining, kitchen, "open" if self.open_kitchen else "door"))
        elif kitchen and self._adjacent(living, kitchen):
            edges.append((living, kitchen, "open"))
        if self.open_kitchen and kitchen and self._adjacent(living, kitchen) \
                and not any(kitchen in e[:2] and e[2] == "open" for e in edges):
            edges.append((living, kitchen, "open"))
        for lounge in by_kind("lounge"):         # a lounge is open space: no walls to living / dining
            for o in (living, dining):
                if o and self._adjacent(lounge, o):
                    edges.append((o, lounge, "open"))
            for r in rooms:
                if r.row == "private" and not r.ensuite and self._adjacent(lounge, r):
                    edges.append((lounge, r, "door"))
        if utility and kitchen and self._adjacent(utility, kitchen):
            edges.append((utility, kitchen, "door"))
        for hall in [r for r in rooms if r.kind == "hallway"]:
            edges.append((hall, living, "door"))
            if dining and not self._adjacent(hall, living):
                edges.append((hall, dining, "door"))
            for r in rooms:
                if r.row == "private" and not r.ensuite:
                    edges.append((hall, r, "door"))
        if master:
            for r in rooms:
                if r.ensuite and self._adjacent(master, r):
                    edges.append((master, r, "door"))

        self.graph = {r.id: set() for r in rooms}
        for a, b, kind in edges:
            if kind == "open":
                self.open_pairs.add(frozenset((a.id, b.id)))
                self.graph[a.id].add(b.id)
                self.graph[b.id].add(a.id)
                orient, line, lo, hi = _shared_boundary(a, b)
                for room in (a, b):
                    room.openings[_side_of(room, orient, line)].append(("open", lo, hi))
            else:
                if self._add_door(a, b):
                    self.graph[a.id].add(b.id)
                    self.graph[b.id].add(a.id)

        # make sure every room can be reached from the living room
        for _ in range(len(rooms) + 2):
            seen = self._reach(living.id)
            missing = [r for r in rooms if r.id not in seen]
            if not missing:
                return
            progressed = False
            # a room is entered from circulation / public rooms; only if that is impossible
            # does it open through a neighbouring room (an ensuite via its master first)
            best = None
            for r in missing:
                if r.ensuite and master and master.id not in seen:
                    continue            # an ensuite is reached through its master, once that is reachable
                if r.row == "private":
                    through_ok = {"hallway": 3, "lounge": 3, "living": 2, "dining": 1}
                else:
                    through_ok = {"hallway": 3, "lounge": 3, "living": 2, "dining": 1, "kitchen": 1}
                for o in rooms:
                    if o.id in seen and o is not r:
                        sb = _shared_boundary(r, o)
                        if not sb or (sb[3] - sb[2]) < DOOR_W + 2 * MARGIN:
                            continue
                        if o.kind in through_ok:
                            prio = through_ok[o.kind]
                        elif r.ensuite and o.kind == "master_bedroom":
                            prio = 0
                        elif r.row == "private" and o.row == "private" and o.kind != "bathroom":
                            prio = -1
                        else:
                            continue
                        key = (prio, sb[3] - sb[2])
                        if best is None or key > best[0]:
                            best = (key, r, o)
            if best:
                _, r, o = best
                if self._add_door(r, o):
                    self.graph[r.id].add(o.id)
                    self.graph[o.id].add(r.id)
                    progressed = True
            if not progressed:
                raise LayoutError("could not connect: " + ", ".join(r.name for r in missing))

    def _reach(self, start):
        seen = {start}
        stack = [start]
        while stack:
            cur = stack.pop()
            for nxt in self.graph[cur]:
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        return seen

    # -- openings ---------------------------------------------------------
    def _free(self, orient, line, lo, hi, pad=4):
        for a, b in self.line_ops.get((orient, line), []):
            if lo < b + pad and a < hi + pad:
                return False
        return True

    def _add_opening(self, kind, orient, line, c, width, rooms):
        c = int(round(c))
        lo, hi = c - width // 2, c - width // 2 + width
        thick = DOOR_T if kind == "door" else WIN_T
        if orient == "h":
            el = {"type": kind, "left": lo, "top": line, "width": width, "height": thick, "angle": 0}
        else:
            el = {"type": kind, "left": line, "top": lo, "width": width, "height": thick, "angle": 90}
        el["id"] = _new_id(kind)
        if kind == "door":
            el["swing"], el["hinge"] = self._swing(el, rooms), (1 if int(el["id"][-1], 16) % 2 else -1)
        (self.doors if kind == "door" else self.windows).append(el)
        self.line_ops.setdefault((orient, line), []).append((lo, hi))
        for room in rooms:
            side = _side_of(room, orient, line)
            room.openings[side].append((kind, lo, hi))

    @staticmethod
    def _swing(el, rooms):
        """+1 / -1: which side of the door's local y axis its leaf swings to (into the more private room)."""
        target = next((r for r in rooms if r.row == "private" or r.kind in ("kitchen", "utility", "bathroom")),
                      rooms[-1])
        a = math.radians(el["angle"])
        mx, my = el["left"] + el["width"] / 2 * math.cos(a), el["top"] + el["width"] / 2 * math.sin(a)
        vx, vy = (target.x0 + target.x1) / 2 - mx, (target.y0 + target.y1) / 2 - my
        return 1 if vx * -math.sin(a) + vy * math.cos(a) >= 0 else -1

    def _add_door(self, a, b, width=DOOR_W):
        sb = _shared_boundary(a, b)
        if not sb:
            return False
        orient, line, lo, hi = sb
        if (hi - lo) < width + 2 * MARGIN:
            return False
        c = (lo + hi) / 2
        if not self._free(orient, line, c - width / 2, c + width / 2):
            # try to slide along the wall
            for shift in (10, -10, 20, -20, 30, -30):
                c2 = c + shift
                if (c2 - width / 2 >= lo + MARGIN and c2 + width / 2 <= hi - MARGIN
                        and self._free(orient, line, c2 - width / 2, c2 + width / 2)):
                    c = c2
                    break
            else:
                return False
        self._add_opening("door", orient, line, c, width, [a, b])
        return True

    def _exterior_pieces(self, room):
        """Stretches of this room's walls that face the outside (no other room behind them)."""
        out = []
        sides = (
            ("N", "h", room.y0, room.x0, room.x1),
            ("S", "h", room.y1, room.x0, room.x1),
            ("W", "v", room.x0, room.y0, room.y1),
            ("E", "v", room.x1, room.y0, room.y1),
        )
        for side, orient, line, lo, hi in sides:
            covered = []
            for o in self.rooms:
                if o is room:
                    continue
                if orient == "h":
                    touch = (o.y0 == line) if side == "S" else (o.y1 == line)
                    a, b = max(lo, o.x0), min(hi, o.x1)
                else:
                    touch = (o.x0 == line) if side == "E" else (o.x1 == line)
                    a, b = max(lo, o.y0), min(hi, o.y1)
                if touch and b > a:
                    covered.append((a, b))
            covered.sort()
            cur = lo
            for a, b in covered + [(hi, hi)]:
                if a > cur:
                    out.append((side, orient, line, cur, a))
                cur = max(cur, b)
        return out

    def entrance(self):
        living = next(r for r in self.rooms if r.kind == "living")
        pieces = [p for p in self._exterior_pieces(living) if (p[4] - p[3]) >= ENTRY_W + 2 * MARGIN]
        if not pieces and self.preplaced:       # a zoned house may enter through the dining room instead
            dining = next((r for r in self.rooms if r.kind == "dining"), None)
            if dining:
                pieces = [p for p in self._exterior_pieces(dining) if (p[4] - p[3]) >= ENTRY_W + 2 * MARGIN]
                living = dining
        if not pieces:
            raise LayoutError("no exterior wall for entrance")
        pieces.sort(key=lambda p: (p[0] != "S", -(p[4] - p[3])))
        side, orient, line, lo, hi = pieces[0]
        length = hi - lo
        c = lo + (0.3 * length if length >= 100 else 0.5 * length)
        self._add_opening("door", orient, line, c, ENTRY_W, [living])
        self.entrance_room_id = living.id

    def windows_pass(self):
        for room in self.rooms:
            if room.kind == "hallway":
                continue
            small = room.kind in ("bathroom", "utility")
            width = SMALL_WIN_W if small else WIN_W
            limit = {"living": 3, "master_bedroom": 2, "dining": 2, "kitchen": 2}.get(room.kind, 1)
            pieces = sorted(self._exterior_pieces(room), key=lambda p: -(p[4] - p[3]))
            placed = 0
            for side, orient, line, lo, hi in pieces:
                length = hi - lo
                slots = max(1, int(length // 60))
                for i in range(slots):
                    if placed >= limit:
                        break
                    c = lo + (i + 0.5) * length / slots
                    a, b = c - width / 2, c + width / 2
                    if a < lo + MARGIN or b > hi - MARGIN:
                        continue
                    if not self._free(orient, line, a, b, pad=6):
                        continue
                    self._add_opening("window", orient, line, c, width, [room])
                    placed += 1

    # -- step 3: walls ---------------------------------------------------------
    def build_walls(self):
        rooms = self.rooms
        x_min, y_min, x_max, y_max = self.bbox

        def collect(orient):
            lines = sorted({(r.y0 if orient == "h" else r.x0) for r in rooms} |
                           {(r.y1 if orient == "h" else r.x1) for r in rooms})
            for line in lines:
                if orient == "h":
                    first = [r for r in rooms if r.y1 == line]   # room above the line
                    second = [r for r in rooms if r.y0 == line]  # room below
                    key = lambda r: (r.x0, r.x1)  # noqa: E731
                else:
                    first = [r for r in rooms if r.x1 == line]   # room left of the line
                    second = [r for r in rooms if r.x0 == line]  # room right
                    key = lambda r: (r.y0, r.y1)  # noqa: E731
                pts = sorted({v for r in first + second for v in key(r)})
                segs = []
                for a, b in zip(pts, pts[1:]):
                    ra = next((r for r in first if key(r)[0] <= a and key(r)[1] >= b), None)
                    rb = next((r for r in second if key(r)[0] <= a and key(r)[1] >= b), None)
                    if ra is None and rb is None:
                        continue
                    if ra and rb and frozenset((ra.id, rb.id)) in self.open_pairs:
                        continue
                    ext = ra is None or rb is None
                    if segs and segs[-1]["b"] == a and segs[-1]["ext"] == ext:
                        segs[-1]["b"] = b
                    else:
                        segs.append({"a": a, "b": b, "ext": ext})
                for s in segs:
                    a, b = s["a"], s["b"]
                    if orient == "h":
                        if s["ext"]:
                            a -= HALF_T
                            b += HALF_T
                        self.walls.append({"type": "wall", "id": _new_id("wall"), "left": a, "top": line,
                                           "width": b - a, "height": WALL_T, "angle": 0})
                    else:
                        self.walls.append({"type": "wall", "id": _new_id("wall"), "left": line, "top": a,
                                           "width": b - a, "height": WALL_T, "angle": 90})

        collect("h")
        collect("v")

    # -- step 4: furniture -------------------------------------------------------
    def furnish(self):
        for room in self.rooms:
            sink = []
            p = Placer(room, sink)
            if room.kind == "master_bedroom":
                furnish_bedroom(p, True)
            elif room.kind == "bedroom":
                furnish_bedroom(p, False)
            elif room.kind in FURNISHERS:
                FURNISHERS[room.kind](p)
            self.furniture.extend(sink)

    # -- output ----------------------------------------------------------------
    def build(self):
        if self.preplaced:
            self.bbox = (
                min(r.x0 for r in self.rooms), min(r.y0 for r in self.rooms),
                max(r.x1 for r in self.rooms), max(r.y1 for r in self.rooms),
            )
        else:
            self.plan()
        self.connect()
        self.entrance()
        self.windows_pass()
        self.build_walls()
        self.furnish()
        return self

    def elements(self):
        out = []
        for r in self.rooms:        # floors + labels first so everything else is drawn on top
            if r.kind == "hallway":
                continue
            out.append({
                "id": _new_id("room"), "type": "room", "kind": r.kind, "name": r.name,
                "area": round(((r.x1 - r.x0) / U) * ((r.y1 - r.y0) / U), 1),
                "left": r.x0, "top": (r.y0 + r.y1) // 2, "width": r.x1 - r.x0, "height": r.y1 - r.y0, "angle": 0,
            })
        out += self.walls
        out += self.doors
        out += self.windows
        for it in self.furniture:
            a = it["a"]
            left = it["cx"] - (it["w"] / 2) * _COS[a]
            top = it["cy"] - (it["w"] / 2) * _SIN[a]
            out.append({
                "id": _new_id(it["type"]),
                "type": it["type"],
                "left": int(round(left)),
                "top": int(round(top)),
                "width": int(round(it["w"])),
                "height": int(round(it["d"])),
                "angle": a,
            })
        return out

    def summary(self):
        res = []
        for r in self.rooms:
            res.append({
                "name": r.name,
                "kind": r.kind,
                "area_sqm": round(((r.x1 - r.x0) / U) * ((r.y1 - r.y0) / U), 1),
            })
        return res


# --------------------------------------------------------------------------
# Zoned planner: a day zone plus one or two bedroom wings, like a real house plan
# --------------------------------------------------------------------------
NEEDS_WINDOW = ("living", "dining", "kitchen", "master_bedroom", "bedroom", "study")
HALL_W = 7                      # cells: a 3.5 m open lounge between two bedroom stacks, never a corridor
HALL_MAX = 18                   # cells: the lounge stays under 9 m long
OPEN_MAX_ASPECT = 2.5            # the open living area is never longer than 2.5x its width
MIN_DOOR_CELLS = 5              # a bedroom must share >= 4.6 cells with the room it opens into
_MIN_H = {"master_bedroom": 8, "bedroom": 7, "study": 6, "bathroom": 5}
_MIN_SHORT = {"bathroom": 1.9, "utility": 1.9, "kitchen": 2.3, "dining": 2.5, "study": 2.2}
STYLES = ("wing", "split", "compact")


def _public_row(rooms, rng, dp):
    """Day zone laid along x: living/dining/kitchen(+utility) as full-depth columns."""
    by = {r.kind: r for r in rooms}
    # living always sits at one end of the day zone so it keeps an outside wall for light and the entrance
    tags = rng.choice([("K", "D", "L"), ("L", "D", "K"), ("D", "K", "L"), ("L", "K", "D")])
    rects, spans, x = {}, {}, 0
    for tag in tags:
        col = {"L": [by["living"]], "D": [by["dining"]] if "dining" in by else [],
               "K": [by["kitchen"]] + ([by["utility"]] if "utility" in by else [])}[tag]
        if not col:
            continue
        tot = sum(r.area for r in col)
        w = max(int(math.ceil(max(KIND_SPEC[r.kind][4] for r in col) / 0.5)),
                int(round(tot / (dp * 0.25))))
        if tot < w * dp * 0.25 / 1.4:       # a narrow room must still be a sensible size
            f = (w * dp * 0.25 / 1.4) / tot
            for r in col:
                r.area *= f
            tot *= f
        y = 0
        for i, r in enumerate(col):
            h = dp - y if i == len(col) - 1 else max(4, int(round(dp * r.area / tot)))
            rects[r.id] = (x, y, w, h)
            y += h
        spans[tag] = (x, x + w)
        x += w
    return rects, spans, x


def _cluster(units, rng):
    """Bedroom wing: two stacks of rooms either side of a short lobby. Rooms hang from y = 0."""
    left, right = [], []
    sums = [0, 0]
    master_unit = next((u for u in units if u[0].kind == "master_bedroom"), None)
    rest = [u for u in units if u is not master_unit]
    rng.shuffle(rest)
    if master_unit:
        side = rng.randint(0, 1)
        (left, right)[side].append(master_unit)
        sums[side] += sum(_MIN_H.get(r.kind, 6) for r in master_unit)
    for u in rest:
        side = 0 if sums[0] < sums[1] else 1
        if rng.random() < 0.15:
            side = 1 - side
        (left, right)[side].append(u)
        sums[side] += sum(_MIN_H.get(r.kind, 6) for r in u)
    if not left or not right:
        movable = [u for u in (left or right) if u is not master_unit]
        if not movable:
            return None
        (right if not right else left).append((left or right).pop((left or right).index(movable[-1])))
    rng.shuffle(left)
    rng.shuffle(right)
    big = _clamp(math.sqrt(sum(r.area for u in units for r in u) / len(units) / 12), 1.0, 1.5)
    wl, wr = (int(rng.randint(8, 11) * big) for _ in range(2))
    stacks = []
    for units_, ws in ((left, wl), (right, wr)):
        rs = [r for u in units_ for r in u]
        hs = [max(_MIN_H.get(r.kind, 6), int(round(r.area / (ws * 0.25)))) for r in rs]
        stacks.append((rs, hs, ws))
    H = max(sum(hs) for _, hs, _ in stacks)
    if H > HALL_MAX:
        return None
    for i, (rs, hs, ws) in enumerate(stacks):       # the shorter side gets a different width, not oversized rooms
        if sum(hs) < H:
            w2 = int(_clamp(round(sum(r.area for r in rs) / (H * 0.25)), 7, 18))
            h2 = [max(_MIN_H.get(r.kind, 6), int(round(r.area / (w2 * 0.25)))) for r in rs]
            if sum(h2) <= H:
                stacks[i] = (rs, h2, w2)
    wl, wr = stacks[0][2], stacks[1][2]
    for rs, hs, _ in stacks:
        grow = [i for i, r in enumerate(rs) if r.kind != "bathroom"] or list(range(len(rs)))
        for k in range(H - sum(hs)):
            hs[grow[k % len(grow)]] += 1
    rects = {}
    for (rs, hs, ws), x0 in zip(stacks, (0, wl + HALL_W)):
        y = 0
        for r, h in zip(rs, hs):
            rects[r.id] = (x0, y, ws, h)
            y += h
    return {"rects": rects, "hall": (wl, 0, HALL_W, H), "hx": wl, "W": wl + HALL_W + wr, "H": H}


def _flip_cluster_y(c):
    H = c["H"]
    out = dict(c)
    out["rects"] = {k: (x, H - y - h, w, h) for k, (x, y, w, h) in c["rects"].items()}
    x, y, w, h = c["hall"]
    out["hall"] = (x, H - y - h, w, h)
    return out


def _units(priv):
    """Rooms that must stay together: a master and its ensuite share a stack."""
    master = [r for r in priv if r.kind == "master_bedroom"]
    ensuite = [r for r in priv if r.ensuite]
    units = []
    if master:
        units.append(master + ensuite[:1])
    units += [[r] for r in priv if r.kind != "master_bedroom" and not r.ensuite]
    return units


def _pick_style(units, want, rng):
    n = sum(len(u) for u in units) - sum(1 for u in units for r in u if r.ensuite)
    options = []
    if n <= 3 and not any(u[0].kind == "bathroom" for u in units):
        options.append("compact")
    if len(units) >= 2 and n <= 5:
        options.append("wing")
    if len(units) >= 4:
        options.append("split")
    if not options:
        options = ["wing"]
    return want if want in options else rng.choice(options)


def _zoned_candidate(rooms, rng, want="auto"):
    rooms = [copy.deepcopy(r) for r in rooms]
    for r in rooms:     # vary sizes so every house is a little different and roomier
        r.area *= rng.uniform(1.0, 1.3) if r.kind in ("living", "dining", "master_bedroom", "bedroom") \
            else rng.uniform(0.95, 1.1)
    beds = [r.area for r in rooms if r.kind == "bedroom"]
    for r in rooms:
        if r.kind == "master_bedroom" and beds:
            r.area = max(r.area, 1.25 * max(beds))
    pub = [r for r in rooms if r.row == "public"]
    priv = [r for r in rooms if r.row == "private"]
    units = _units(priv)
    if not units:
        return None
    style = _pick_style(units, want, rng)
    dp = rng.randint(11, 14)
    rects, spans, wp = _public_row(pub, rng, dp)
    halls = []
    rng.shuffle(units)

    def hall_x(c, kind_pref):
        tags = [t for t in ("L", "D") if t in spans]
        tag = tags[0] if (kind_pref and rng.random() < 0.65) else rng.choice(tags)
        x0, x1 = spans[tag]
        return x0 + rng.randint(0, max(0, x1 - x0 - HALL_W)) - c["hx"]

    if style == "compact":
        row_units = sorted(units, key=lambda u: u[0].kind != "master_bedroom") if rng.random() < 0.5 else units
        ws = [rng.randint(9, 12) for _ in row_units]
        hs = [sum(max(_MIN_H.get(r.kind, 6), int(round(r.area / (w * 0.25)))) for r in u)
              for u, w in zip(row_units, ws)]
        H = max(hs)
        lo, hi = spans["L"]
        x = rng.randint(max(-8, lo - ws[0] + MIN_DOOR_CELLS), max(lo, hi - MIN_DOOR_CELLS))
        for u, w in zip(row_units, ws):
            y = dp
            hh = [max(_MIN_H.get(r.kind, 6), int(round(r.area / (w * 0.25)))) for r in u]
            hh[0] += H - sum(hh)
            for r, h in zip(u, hh):
                rects[r.id] = (x, y, w, h)
                y += h
            x += w
    else:
        if style == "split":
            cut = max(2, min(len(units) - 2, rng.randint(2, max(2, len(units) // 2 + 1))))
            groups = [units[:cut], units[cut:]]
            if not any(u[0].kind == "master_bedroom" for u in groups[0]):
                groups.reverse()
        else:
            groups = [units]
        for gi, g in enumerate(groups):
            c = _cluster(g, rng)
            if not c:
                return None
            above = style == "split" and gi == 1
            if above:
                c = _flip_cluster_y(c)
            dx = hall_x(c, gi == 0)
            dy = -c["H"] if above else dp
            for k, (x, y, w, h) in c["rects"].items():
                rects[k] = (x + dx, y + dy, w, h)
            hx, hy, hw, hh = c["hall"]
            rects[f"hall{gi}"] = (hx + dx, hy + dy, hw, hh)
            halls.append(f"hall{gi}")

    # to absolute units, then a random rotation / mirroring so no two houses share an outline
    xs0 = min(x for x, y, w, h in rects.values())
    ys0 = min(y for x, y, w, h in rects.values())
    rects = {k: (x - xs0, y - ys0, w, h) for k, (x, y, w, h) in rects.items()}
    W = max(x + w for x, y, w, h in rects.values())
    H = max(y + h for x, y, w, h in rects.values())
    if rng.random() < 0.5:
        rects = {k: (y, x, h, w) for k, (x, y, w, h) in rects.items()}
        W, H = H, W
    if rng.random() < 0.5:
        rects = {k: (W - x - w, y, w, h) for k, (x, y, w, h) in rects.items()}
    if rng.random() < 0.5:
        rects = {k: (x, H - y - h, w, h) for k, (x, y, w, h) in rects.items()}

    out = []
    for r in rooms:
        x, y, w, h = rects[r.id]
        r.x0, r.y0 = ORIGIN_X + x * CELL, ORIGIN_Y + y * CELL
        r.x1, r.y1 = r.x0 + w * CELL, r.y0 + h * CELL
        out.append(r)
    for gi, hid in enumerate(halls):
        x, y, w, h = rects[hid]
        out.append(Room(id=hid, kind="lounge", name="Lounge", area=w * h * 0.25, row="public",
                        x0=ORIGIN_X + x * CELL, y0=ORIGIN_Y + y * CELL,
                        x1=ORIGIN_X + (x + w) * CELL, y1=ORIGIN_Y + (y + h) * CELL))
    return out


def _zone_fail(rooms):
    """Why a candidate's room shapes are unacceptable, or None if they are fine."""
    for r in rooms:
        wm, dm = (r.x1 - r.x0) / U, (r.y1 - r.y0) / U
        short, long_ = min(wm, dm), max(wm, dm)
        if r.kind == "hallway":
            if short < 1.45 or long_ > HALL_MAX * 0.5:
                return "hall"
            continue
        spec = KIND_SPEC[r.kind]
        if r.kind in ("bedroom", "master_bedroom"):
            if short < spec[4] * 0.95 or wm * dm < spec[1] * 0.97:
                return f"small:{r.kind}"
        if short < _MIN_SHORT.get(r.kind, spec[4] * 0.85) - 0.01:
            return f"short:{r.kind}"
        lim = {"bathroom": 3.2, "utility": 3.2, "living": 2.8, "kitchen": 3.0, "dining": 3.0, "lounge": 3.0}.get(r.kind, 2.5)
        if long_ / short > lim:
            return f"aspect:{r.kind}"
        ratio = (wm * dm) / r.area
        hi = 2.6 if r.kind in ("bathroom", "utility") else (2.0 if r.kind in ("living", "master_bedroom", "bedroom", "study") else 1.8)
        if ratio < 0.6:
            return f"small:{r.kind}"
        if ratio > hi:
            return f"big:{r.kind}"
    return None


def _zone_ok(rooms):
    return _zone_fail(rooms) is None


_NEED_FURN = {"living": "furniture_sofa", "dining": "furniture_table", "kitchen": "furniture_kitchen",
              "master_bedroom": "furniture_bed", "bedroom": "furniture_bed"}


def _post_fail(lay: Layout):
    """Why a built layout is unacceptable, or None if it is fine."""
    for r in lay.rooms:
        # a dining room open to the living room borrows its light
        open_dining = r.kind == "dining" and any(r.id in pair for pair in lay.open_pairs)
        if r.kind in NEEDS_WINDOW and not open_dining:
            if not any(o[0] == "window" for side in r.openings.values() for o in side):
                return f"window:{r.kind}"
        need = _NEED_FURN.get(r.kind)
        if need and not any(it["type"] == need and r.x0 <= it["cx"] <= r.x1 and r.y0 <= it["cy"] <= r.y1
                            for it in lay.furniture):
            return f"furniture:{r.kind}"
    living = next(r for r in lay.rooms if r.kind == "living")
    dining = next((r for r in lay.rooms if r.kind == "dining"), None)
    area = lambda r: (r.x1 - r.x0) / U * (r.y1 - r.y0) / U  # noqa: E731
    # the master bedroom is the biggest bedroom
    masters = [r for r in lay.rooms if r.kind == "master_bedroom"]
    beds = [r for r in lay.rooms if r.kind == "bedroom"]
    if masters and beds and area(masters[0]) < 1.08 * max(area(b) for b in beds):
        return "master-not-biggest"
    # the open living space (living + dining + lounge) must be a room, not a long spine with doors down both sides
    parent = {r.id: r.id for r in lay.rooms}

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for pair in lay.open_pairs:
        x, y = tuple(pair)
        parent[find(x)] = find(y)
    groups: dict = {}
    for r in lay.rooms:
        if r.kind in ("living", "dining", "lounge"):
            groups.setdefault(find(r.id), []).append(r)
    for g in groups.values():
        gw = max(r.x1 for r in g) - min(r.x0 for r in g)
        gh = max(r.y1 for r in g) - min(r.y0 for r in g)
        if max(gw, gh) / max(1, min(gw, gh)) > OPEN_MAX_ASPECT:
            return "open-space-spine"
    # lounges are open living space: they must hang off the living/dining area and serve few doors
    for lg in [r for r in lay.rooms if r.kind in ("lounge", "hallway")]:
        adj = sum(1 for r in lay.rooms if r.row == "private" and lay._adjacent(lg, r))
        if adj > 6:
            return "lounge-doors"
        if not (lay._adjacent(lg, living) or (dining and lay._adjacent(lg, dining))):
            return "lounge-public"
    # every bedroom opens straight off an open living area (living / dining / lounge)
    access = ("living", "dining", "lounge", "hallway")
    for r in lay.rooms:
        if r.row == "private" and not r.ensuite and r.kind != "bathroom":
            if not any(o.id in lay.graph[r.id] and o.kind in access for o in lay.rooms):
                return "bedroom-access"
    return None


def _post_ok(lay: Layout):
    return _post_fail(lay) is None


def generate_layout(rooms: list[Room], tries: int = 2500, rng=None, style: str = "auto") -> Layout:
    """Architect-style plan: pick a house type, build day zone + bedroom wings, validate, retry."""
    rng = rng or random.Random()
    for attempt in range(tries):
        try:
            cand = _zoned_candidate(rooms, rng, style if attempt < tries // 2 else "auto")
            if not cand or not _zone_ok(cand):
                continue
            lay = Layout(cand, False, preplaced=True)
            lay.open_kitchen = rng.random() < 0.3
            lay.build()
            if _post_ok(lay):
                return lay
        except LayoutError:
            continue
    return _generate_rows(rooms)


def _generate_rows(rooms: list[Room]) -> Layout:
    """Try the layout with and without a hallway; return the first one that works."""
    n_private = sum(1 for r in rooms if r.row == "private")
    order = (True, False) if n_private >= 4 else (False, True)
    last = None
    for corridor in order:
        try:
            return Layout(rooms, corridor).build()
        except LayoutError as e:
            last = e
    raise last or LayoutError("layout failed")


# --------------------------------------------------------------------------
# Plans given as room rectangles (from the LLM or from a reference house)
# --------------------------------------------------------------------------
_SIZE_LIMITS = {   # kind: (min m2, max m2) a believable room can have
    "living": (12, 70), "dining": (7, 36), "kitchen": (6, 40), "utility": (2.5, 12),
    "master_bedroom": (15, 46), "bedroom": (11, 34), "study": (6, 26), "bathroom": (3.5, 18),
    "lounge": (8, 50),
}


def rooms_from_rects(rects: list[dict]) -> list[Room]:
    """[{"kind","x","y","w","h"}] in grid cells -> Room objects (names, ensuite, rows)."""
    rooms: list[Room] = []
    counts: dict[str, int] = {}
    for rc in rects:
        kind = rc["kind"]
        if kind not in KIND_SPEC:
            raise LayoutError(f"unknown room kind {kind}")
        x, y, w, h = (int(round(rc[k])) for k in ("x", "y", "w", "h"))
        if w < 2 or h < 2 or x < 0 or y < 0:
            raise LayoutError("bad rectangle")
        counts[kind] = counts.get(kind, 0) + 1
        room = Room(id=f"r{len(rooms)}", kind=kind, name=KIND_SPEC[kind][0],
                    area=w * h * 0.25, row=KIND_SPEC[kind][5],
                    x0=ORIGIN_X + x * CELL, y0=ORIGIN_Y + y * CELL,
                    x1=ORIGIN_X + (x + w) * CELL, y1=ORIGIN_Y + (y + h) * CELL)
        rooms.append(room)
    # overlaps are fatal
    for i, a in enumerate(rooms):
        for b in rooms[i + 1:]:
            if a.x0 < b.x1 and b.x0 < a.x1 and a.y0 < b.y1 and b.y0 < a.y1:
                raise LayoutError("rooms overlap")
    for kind in ("living", "kitchen"):
        if not any(r.kind == kind for r in rooms):
            raise LayoutError(f"no {kind}")
    # the bathroom touching a master bedroom is its ensuite; extra baths get numbered
    masters = [r for r in rooms if r.kind == "master_bedroom"]
    baths = [r for r in rooms if r.kind == "bathroom"]
    for m in masters[:1]:
        for b in sorted(baths, key=lambda r: -(_shared_boundary(m, r) or (0, 0, 0, 0))[3] + (_shared_boundary(m, r) or (0, 0, 0, 0))[2]):
            sb = _shared_boundary(m, b)
            if sb and (sb[3] - sb[2]) >= DOOR_W + 2 * MARGIN:
                b.ensuite, b.name = True, "Ensuite Bath"
                break
    n_bed = n_bath = 0
    multi_bath = sum(1 for r in baths if not r.ensuite) > 1
    for r in rooms:
        if r.kind == "bedroom":
            n_bed += 1
            r.name = f"Bedroom {n_bed + 1}" if masters else f"Bedroom {n_bed}"
        elif r.kind == "bathroom" and not r.ensuite:
            n_bath += 1
            r.name = f"Bathroom {n_bath}" if multi_bath else "Bathroom"
    return rooms


def _size_fail(rooms: list[Room]):
    for r in rooms:
        lo, hi = _SIZE_LIMITS[r.kind]
        if not (lo <= r.area <= hi):
            return f"size:{r.kind}:{r.area:.0f}"
    return None


def layout_from_rects(rects: list[dict], open_kitchen: bool | None = None) -> Layout:
    """Validate and build a plan given as rectangles. Raises LayoutError when it is not a good house."""
    rooms = rooms_from_rects(rects)
    why = _size_fail(rooms) or _zone_fail(rooms)
    if why:
        raise LayoutError(why)
    lay = Layout(rooms, False, preplaced=True)
    lay.open_kitchen = (random.random() < 0.35) if open_kitchen is None else open_kitchen
    lay.build()
    why = _post_fail(lay)
    if why:
        raise LayoutError(why)
    return lay
