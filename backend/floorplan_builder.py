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
    "master_bedroom": ("Master Bedroom", 12, 16, 30, 3.0, "private"),
    "bedroom":        ("Bedroom",         9, 12, 20, 2.8, "private"),
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
        baths = 1 if beds <= 2 else 2
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
}


# --------------------------------------------------------------------------
# The layout
# --------------------------------------------------------------------------
class Layout:
    def __init__(self, rooms: list[Room], corridor: bool):
        self.rooms = [copy.deepcopy(r) for r in rooms]
        self.use_corridor = corridor
        self.hall: Room | None = None
        self.open_pairs: set = set()
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
                edges.append((dining, kitchen, "door"))
        elif kitchen and self._adjacent(living, kitchen):
            edges.append((living, kitchen, "open"))
        if utility and kitchen and self._adjacent(utility, kitchen):
            edges.append((utility, kitchen, "door"))
        if self.hall:
            edges.append((self.hall, living, "door"))
            for r in rooms:
                if r.row == "private" and not r.ensuite:
                    edges.append((self.hall, r, "door"))
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
            # a room may only be entered from circulation / public rooms, never
            # through another bedroom or bathroom (except an ensuite via its master)
            for r in missing:
                if r.row == "private":
                    through_ok = {"hallway": 3, "living": 2}
                else:
                    through_ok = {"hallway": 3, "living": 2, "dining": 1, "kitchen": 1}
                cands = []
                for o in rooms:
                    if o.id in seen and o is not r:
                        sb = _shared_boundary(r, o)
                        if not sb or (sb[3] - sb[2]) < DOOR_W + 2 * MARGIN:
                            continue
                        if o.kind in through_ok:
                            cands.append((through_ok[o.kind], sb[3] - sb[2], o))
                        elif r.ensuite and o.kind == "master_bedroom":
                            cands.append((0, sb[3] - sb[2], o))
                if cands:
                    cands.sort(key=lambda t: (t[0], t[1]), reverse=True)
                    o = cands[0][2]
                    if self._add_door(r, o):
                        self.graph[r.id].add(o.id)
                        self.graph[o.id].add(r.id)
                        progressed = True
                        break
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
        (self.doors if kind == "door" else self.windows).append(el)
        self.line_ops.setdefault((orient, line), []).append((lo, hi))
        for room in rooms:
            side = _side_of(room, orient, line)
            room.openings[side].append((kind, lo, hi))

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
        x0, y0, x1, y1 = self.bbox
        out = []
        if room.y0 == y0:
            out.append(("N", "h", room.y0, room.x0, room.x1))
        if room.y1 == y1:
            out.append(("S", "h", room.y1, room.x0, room.x1))
        if room.x0 == x0:
            out.append(("W", "v", room.x0, room.y0, room.y1))
        if room.x1 == x1:
            out.append(("E", "v", room.x1, room.y0, room.y1))
        return out

    def entrance(self):
        living = next(r for r in self.rooms if r.kind == "living")
        pieces = [p for p in self._exterior_pieces(living) if (p[4] - p[3]) >= ENTRY_W + 2 * MARGIN]
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
                        if s["ext"] and a == x_min:
                            a -= HALF_T
                        if s["ext"] and b == x_max:
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
        self.plan()
        self.connect()
        self.entrance()
        self.windows_pass()
        self.build_walls()
        self.furnish()
        return self

    def elements(self):
        out = []
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


def generate_layout(rooms: list[Room]) -> Layout:
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