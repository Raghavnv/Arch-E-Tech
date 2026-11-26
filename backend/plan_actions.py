"""
High-level plan edits, carried out exactly.

The AI (or the sentence parser in edit_intents.py) only decides *what* to do: "make the master bedroom
1 m wider on its east side", "add a balcony off bedroom 2", "put a door between the kitchen and the
dining room". This module does the geometry, the way a draughtsman would:

  * moving a room's edge moves the wall on it, stretches the walls that meet it so corners stay closed,
    grows the room and shrinks the one on the other side, and carries doors, windows and the furniture
    standing against that wall along with it;
  * new rooms get walls where none exist yet, a door from the room they open off, windows on their
    outside walls and furniture; outdoor spaces (patio, balcony, terrace, deck) get railings instead of
    walls and a wide door from the house;
  * doors and windows are placed on real walls, in free stretches, clear of other openings.

Plan units: 20 = 1 m. Rooms are boxes measured to wall centre lines: x from `left` to `left + width`,
y from `top - height/2` to `top + height/2`. Walls, doors, windows and railings are lines drawn from
(left, top) along `angle`. Furniture is a box whose (left, top) is the middle of its start edge with
its back to -y at angle 0 (so angle 0 backs onto a north wall, 90 east, 180 south, 270 west).
"""
from __future__ import annotations

import copy
import math
import random
import re
import string

U = 20.0
T = 3.0                                           # how close (plan units) counts as "on the same line"
SIDES = ("N", "S", "E", "W")
OPP = {"N": "S", "S": "N", "E": "W", "W": "E"}
OUT = {"N": -1, "S": 1, "W": -1, "E": 1}          # which way is outward, along the edge's normal axis
SIDE_WORD = {"N": "north", "S": "south", "E": "east", "W": "west"}

OUTDOOR = {"patio", "balcony", "terrace", "deck"}
KINDS = {"living", "dining", "kitchen", "master_bedroom", "bedroom", "bathroom", "study", "utility", "lounge",
         "closet", "hallway"} | OUTDOOR
KIND_NAME = {"living": "Living Room", "dining": "Dining Room", "kitchen": "Kitchen", "master_bedroom": "Master Bedroom",
             "bedroom": "Bedroom", "bathroom": "Bathroom", "study": "Study", "utility": "Utility", "lounge": "Lounge",
             "closet": "Walk-in Closet", "hallway": "Hallway", "patio": "Patio", "balcony": "Balcony",
             "terrace": "Terrace", "deck": "Deck"}
MIN_SHORT = {"living": 2.7, "lounge": 2.4, "dining": 2.1, "kitchen": 1.8, "master_bedroom": 2.7, "bedroom": 2.4,
             "bathroom": 1.2, "study": 2.0, "utility": 1.0, "closet": 1.0, "hallway": 0.9}
DEFAULT_SIZE = {"living": (4.2, 4.5), "lounge": (3.6, 3.6), "dining": (3.2, 3.4), "kitchen": (2.8, 3.2),
                "master_bedroom": (4.0, 4.2), "bedroom": (3.3, 3.5), "bathroom": (1.8, 2.4), "study": (2.8, 3.0),
                "utility": (1.8, 2.0), "closet": (1.8, 2.2), "hallway": (1.2, 3.0),
                "patio": (4.5, 3.0), "balcony": (3.2, 1.5), "terrace": (5.0, 3.2), "deck": (4.5, 3.0)}
# what counts for a room that gives up space when its neighbour grows (higher = keep it as it is)
KEEP = {"bathroom": 3.0, "kitchen": 2.5, "master_bedroom": 2.2, "bedroom": 2.0, "closet": 1.5, "study": 1.4,
        "utility": 1.2, "dining": 1.0, "living": 1.2, "lounge": 0.8, "hallway": 0.6}
MIN_OUTDOOR_W = {"balcony": 1.8, "patio": 2.4, "terrace": 2.4, "deck": 2.4}
HABITABLE = {"living", "dining", "kitchen", "master_bedroom", "bedroom", "study", "lounge"}

# furniture sizes (m), the same catalogue the Studio draws from
FURNITURE = {
    "furniture_sofa": ("Sofa, 3-seater", 2.2, 0.9), "furniture_sofa2": ("Sofa, 2-seater", 1.6, 0.88),
    "furniture_sectional": ("L-shaped sofa", 2.7, 1.7), "furniture_armchair": ("Armchair", 0.8, 0.8),
    "furniture_recliner": ("Recliner", 0.95, 1.0), "furniture_diwan": ("Diwan / day bed", 1.9, 0.8),
    "furniture_coffee_table": ("Coffee table", 1.2, 0.6), "furniture_side_table": ("Side table", 0.5, 0.5),
    "furniture_tv_unit": ("TV unit", 1.8, 0.45), "furniture_tv": ("TV, wall-mounted", 1.25, 0.08),
    "furniture_bookshelf": ("Bookshelf", 1.0, 0.35), "furniture_console": ("Console table", 1.2, 0.35),
    "furniture_pouf": ("Pouf / ottoman", 0.5, 0.5), "furniture_dining4": ("Dining table, 4 seats", 1.2, 0.8),
    "furniture_table": ("Dining table, 6 seats", 1.6, 0.9), "furniture_dining8": ("Dining table, 8 seats", 2.2, 1.0),
    "furniture_dining_round": ("Round dining table", 1.1, 1.1), "furniture_chair": ("Dining chair", 0.45, 0.5),
    "furniture_sideboard": ("Sideboard / crockery unit", 1.6, 0.45), "furniture_crockery_tall": ("Crockery cabinet, tall", 1.0, 0.45),
    "furniture_bar_stool": ("Bar stool", 0.4, 0.4), "furniture_bed": ("King bed", 1.8, 2.1),
    "furniture_bed_queen": ("Queen bed", 1.6, 2.05), "furniture_bed_single": ("Single bed", 0.95, 2.0),
    "furniture_bedside": ("Bedside table", 0.5, 0.4), "furniture_wardrobe2": ("Wardrobe, 2 doors", 1.2, 0.6),
    "furniture_wardrobe3": ("Wardrobe, 3 doors", 1.8, 0.6), "furniture_wardrobe_sliding": ("Sliding wardrobe", 2.4, 0.65),
    "furniture_dresser": ("Dressing table", 1.0, 0.45), "furniture_drawers": ("Chest of drawers", 0.9, 0.45),
    "furniture_bench": ("Bed-end bench", 1.2, 0.4), "furniture_bunk_bed": ("Bunk bed", 1.0, 2.0),
    "furniture_crib": ("Crib", 1.3, 0.7), "furniture_toy_storage": ("Toy storage", 0.9, 0.4),
    "furniture_kids_desk": ("Kids study table", 0.9, 0.55), "furniture_desk": ("Study desk", 1.2, 0.6),
    "furniture_office_chair": ("Office chair", 0.6, 0.6), "furniture_filing": ("Filing cabinet", 0.45, 0.6),
    "furniture_kitchen": ("Counter with hob and sink", 2.8, 0.65), "furniture_base_cabinet": ("Base cabinet", 0.6, 0.6),
    "furniture_sink_unit": ("Sink unit", 0.9, 0.6), "furniture_hob_unit": ("Hob unit", 0.9, 0.6),
    "furniture_tall_unit": ("Tall pantry unit", 0.6, 0.6), "furniture_oven_tower": ("Oven and microwave tower", 0.6, 0.6),
    "furniture_fridge": ("Refrigerator, double door", 0.9, 0.75), "furniture_fridge_single": ("Refrigerator, single door", 0.6, 0.65),
    "furniture_island": ("Kitchen island", 1.8, 0.9), "furniture_dishwasher": ("Dishwasher", 0.6, 0.6),
    "furniture_wc": ("WC (toilet)", 0.4, 0.65), "furniture_vanity": ("Vanity with basin", 1.2, 0.55),
    "furniture_basin": ("Wash basin", 0.55, 0.45), "furniture_shower": ("Shower enclosure", 0.9, 0.9),
    "furniture_bathtub": ("Bathtub", 1.7, 0.8), "furniture_washing_machine": ("Washing machine", 0.6, 0.6),
    "furniture_pooja": ("Pooja unit (mandir)", 0.9, 0.45), "furniture_shoe_rack": ("Shoe rack", 0.9, 0.35),
    "furniture_storage_shelf": ("Storage shelf", 1.0, 0.4), "furniture_outdoor_chair": ("Outdoor chair", 0.65, 0.65),
    "furniture_outdoor_table": ("Outdoor side table", 0.6, 0.6), "furniture_swing": ("Swing (jhula)", 1.4, 0.8),
    "furniture_planter": ("Planter box", 1.0, 0.35), "furniture_rug": ("Rug", 2.0, 1.4),
    "furniture_plant": ("Plant in a pot", 0.5, 0.5), "furniture_floor_lamp": ("Floor lamp", 0.4, 0.4),
    "furniture_wall_art": ("Wall art", 1.0, 0.04), "furniture_mirror": ("Standing mirror", 0.6, 0.3),
}
CENTRED = {"furniture_coffee_table", "furniture_table", "furniture_dining4", "furniture_dining8", "furniture_dining_round",
           "furniture_island", "furniture_rug", "furniture_outdoor_table", "furniture_pouf"}
TALL = {"furniture_wardrobe2", "furniture_wardrobe3", "furniture_wardrobe_sliding", "furniture_bookshelf", "furniture_fridge",
        "furniture_fridge_single", "furniture_tall_unit", "furniture_oven_tower", "furniture_crockery_tall", "furniture_storage_shelf"}
DEFAULT_SET = {
    "living": ["furniture_sofa", "furniture_tv_unit", "furniture_coffee_table", "furniture_armchair"],
    "lounge": ["furniture_sofa2", "furniture_tv_unit", "furniture_armchair"],
    "dining": ["furniture_table", "furniture_sideboard"],
    "kitchen": ["furniture_kitchen", "furniture_fridge"],
    "master_bedroom": ["furniture_bed", "furniture_wardrobe3", "furniture_dresser"],
    "bedroom": ["furniture_bed_queen", "furniture_wardrobe2", "furniture_bedside"],
    "bathroom": ["furniture_wc", "furniture_vanity", "furniture_shower"],
    "study": ["furniture_desk", "furniture_office_chair", "furniture_bookshelf"],
    "utility": ["furniture_washing_machine", "furniture_storage_shelf"],
    "closet": ["furniture_wardrobe_sliding"],
    "patio": ["furniture_outdoor_table", "furniture_outdoor_chair", "furniture_outdoor_chair", "furniture_planter"],
    "deck": ["furniture_outdoor_table", "furniture_outdoor_chair", "furniture_outdoor_chair", "furniture_plant"],
    "balcony": ["furniture_outdoor_chair", "furniture_outdoor_chair", "furniture_planter"],
    "terrace": ["furniture_outdoor_table", "furniture_outdoor_chair", "furniture_outdoor_chair", "furniture_swing", "furniture_planter"],
}


class ActionError(Exception):
    pass


def new_id(t: str) -> str:
    return f"{t}_{''.join(random.choices(string.ascii_lowercase + string.digits, k=7))}"


def fl(e) -> int:
    return int(e.get("floor") or 1)


def rbox(r):
    return (r["left"], r["top"] - r["height"] / 2, r["left"] + r["width"], r["top"] + r["height"] / 2)


def set_box(r, x0, y0, x1, y1):
    r["left"], r["width"] = x0, x1 - x0
    r["height"], r["top"] = y1 - y0, (y0 + y1) / 2
    r["area"] = round((r["width"] / U) * (r["height"] / U), 1)


def ends(e):
    a = math.radians(e.get("angle") or 0)
    ax, ay = e["left"], e["top"]
    return ax, ay, ax + e["width"] * math.cos(a), ay + e["width"] * math.sin(a)


def horiz(e):
    ax, ay, bx, by = ends(e)
    return abs(ay - by) < 1 and abs(ax - bx) >= 1


def vert(e):
    ax, ay, bx, by = ends(e)
    return abs(ax - bx) < 1 and abs(ay - by) >= 1


def mid(e):
    ax, ay, bx, by = ends(e)
    return (ax + bx) / 2, (ay + by) / 2


def edge(r, side):
    """(orientation, line coordinate, span start, span end) of one side of a room box."""
    x0, y0, x1, y1 = rbox(r)
    return {"N": ("h", y0, x0, x1), "S": ("h", y1, x0, x1), "W": ("v", x0, y0, y1), "E": ("v", x1, y0, y1)}[side]


def on_line(e, orient, c):
    """Is this linear element lying on the line (horizontal y = c, or vertical x = c)?"""
    ax, ay, bx, by = ends(e)
    if orient == "h":
        return horiz(e) and abs(ay - c) < T
    return vert(e) and abs(ax - c) < T


def extent(e, orient):
    ax, ay, bx, by = ends(e)
    return (min(ax, bx), max(ax, bx)) if orient == "h" else (min(ay, by), max(ay, by))


def overlap(a0, a1, b0, b1):
    return min(a1, b1) - max(a0, b0)


def boxes_clash(a, b, tol=T):
    return overlap(a[0], a[2], b[0], b[2]) > tol and overlap(a[1], a[3], b[1], b[3]) > tol


def make_line(t, orient, c, a0, a1, floor, **extra):
    if orient == "h":
        e = {"id": new_id(t), "type": t, "left": a0, "top": c, "width": a1 - a0, "angle": 0, "floor": floor}
    else:
        e = {"id": new_id(t), "type": t, "left": c, "top": a0, "width": a1 - a0, "angle": 90, "floor": floor}
    e["height"] = {"wall": 8, "door": 5, "window": 5, "railing": 4}.get(t, 5)
    e.update(extra)
    return e


def piece_of(e, orient, v0, v1, keep_id=False):
    """The part of a straight linear element between two coordinates along its axis, finishes kept in place."""
    ax, ay, bx, by = ends(e)
    start = ax if orient == "h" else ay
    end = bx if orient == "h" else by
    d = 1 if end >= start else -1
    t0, t1 = sorted(((v0 - start) * d, (v1 - start) * d))
    t0, t1 = max(0.0, t0), min(e["width"], t1)
    if t1 - t0 < 1:
        return None
    p = copy.deepcopy(e)
    if not keep_id:
        p["id"] = new_id(e["type"])
    a = math.radians(e.get("angle") or 0)
    p["left"], p["top"] = ax + t0 * math.cos(a), ay + t0 * math.sin(a)
    p["width"] = t1 - t0
    if isinstance(e.get("sides"), dict):
        sides = {}
        for s, v in e["sides"].items():
            items = v if isinstance(v, list) else [v]
            out = []
            for f in items:
                if not isinstance(f, dict):
                    continue
                if "from" in f and "to" in f:
                    fr, to = max(f["from"] - t0 / U, 0), min(f["to"] - t0 / U, (t1 - t0) / U)
                    if to - fr > 0.02:
                        out.append(dict(f, **{"from": round(fr, 2), "to": round(to, 2)}))
                else:
                    out.append(f)
            if out:
                sides[s] = out if isinstance(v, list) else out[0]
        p["sides"] = sides or None
        if not sides:
            p.pop("sides", None)
    return p


def fbox(e):
    """Furniture footprint (x0, y0, x1, y1)."""
    a = math.radians(e.get("angle") or 0)
    w, d = e["width"], e["height"]
    cx, cy = e["left"] + w / 2 * math.cos(a), e["top"] + w / 2 * math.sin(a)
    hx = abs(w / 2 * math.cos(a)) + abs(d / 2 * math.sin(a))
    hy = abs(w / 2 * math.sin(a)) + abs(d / 2 * math.cos(a))
    return cx - hx, cy - hy, cx + hx, cy + hy


def is_furniture(e):
    return str(e.get("type", "")).startswith("furniture_")


def furniture_piece(t, cx, cy, back, floor, w_m=None, d_m=None):
    name, w0, d0 = FURNITURE.get(t, (t, 1.0, 0.6))
    w, d = round((w_m or w0) * U), max(1, round((d_m or d0) * U))
    a = {"N": 0, "S": 180, "E": 90, "W": 270}[back]
    r = math.radians(a)
    return {"id": new_id(t), "type": t, "left": round(cx - w / 2 * math.cos(r)), "top": round(cy - w / 2 * math.sin(r)),
            "width": w, "height": d, "angle": a, "floor": floor}


# ----------------------------------------------------------------------------------------------
class Plan:
    def __init__(self, elements: list[dict], floor: int = 1):
        self.els = [copy.deepcopy(e) for e in elements if isinstance(e, dict) and e.get("type")]
        for e in self.els:
            e.setdefault("id", new_id(e["type"]))
            for k in ("left", "top", "width", "height"):
                e[k] = float(e.get(k) or 0)
        self.floor = floor
        self.notes: list[str] = []

    # ---- lookups -----------------------------------------------------------------------------
    def of(self, floor, *types):
        return [e for e in self.els if fl(e) == floor and (not types or e["type"] in types)]

    def rooms(self, floor=None):
        return [e for e in self.els if e["type"] == "room" and (floor is None or fl(e) == floor)]

    def by_id(self, i):
        return next((e for e in self.els if e.get("id") == i), None)

    def name(self, r):
        return r.get("name") or KIND_NAME.get(r.get("kind"), "room")

    def across(self, r, side, lo=None, hi=None):
        """Rooms on the other side of one edge of r, overlapping the given stretch of it."""
        o, c, a0, a1 = edge(r, side)
        lo, hi = (a0, a1) if lo is None else (lo, hi)
        out = []
        for q in self.rooms(fl(r)):
            if q is r:
                continue
            o2, c2, b0, b1 = edge(q, OPP[side])
            if abs(c2 - c) < T and overlap(lo, hi, b0, b1) > T:
                out.append(q)
        return out

    def outside_stretches(self, r, side):
        """Parts of an edge of r with no room on the other side: [(lo, hi)]."""
        o, c, a0, a1 = edge(r, side)
        cuts = sorted((max(a0, edge(q, OPP[side])[2]), min(a1, edge(q, OPP[side])[3])) for q in self.across(r, side))
        out, at = [], a0
        for lo, hi in cuts:
            if lo - at > T:
                out.append((at, lo))
            at = max(at, hi)
        if a1 - at > T:
            out.append((at, a1))
        return out

    def walls_on(self, floor, orient, c, types=("wall",)):
        return [e for e in self.of(floor, *types) if on_line(e, orient, c)]

    def covered(self, floor, orient, c, lo, hi, types=("wall", "railing")):
        """Stretches of the line between lo and hi with no wall (or railing) on them."""
        spans = sorted(extent(w, orient) for w in self.walls_on(floor, orient, c, types))
        gaps, at = [], lo
        for a, b in spans:
            if b <= at or a >= hi:
                continue
            if a - at > T:
                gaps.append((at, a))
            at = max(at, b)
        if hi - at > T:
            gaps.append((at, hi))
        return gaps

    def openings_on(self, floor, orient, c, lo, hi, types=("door", "window")):
        out = []
        for e in self.of(floor, *types):
            if on_line(e, orient, c):
                a, b = extent(e, orient)
                if overlap(a, b, lo, hi) > 1:
                    out.append(e)
        return out

    def room_of_point(self, floor, x, y, outdoor=True):
        for r in self.rooms(floor):
            x0, y0, x1, y1 = rbox(r)
            if x0 < x < x1 and y0 < y < y1 and (outdoor or r.get("kind") not in OUTDOOR):
                return r
        return None

    def furniture_in(self, r):
        x0, y0, x1, y1 = rbox(r)
        out = []
        for e in self.of(fl(r)):
            if is_furniture(e):
                b = fbox(e)
                cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
                if x0 < cx < x1 and y0 < cy < y1:
                    out.append(e)
        return out

    def remove(self, items):
        ids = {id(e) for e in items}
        self.els = [e for e in self.els if id(e) not in ids]

    # ---- moving one edge of a room ----------------------------------------------------------------
    def move_edge(self, r, side, d):
        """Move side `side` of room r outward by d plan units (negative = inward). Returns the rooms that changed."""
        if abs(d) < 1:
            return []
        f = fl(r)
        orient, c, lo, hi = edge(r, side)
        s = OUT[side]
        c2 = c + s * d
        same, far = [r], []
        changed = True
        while changed:
            changed = False
            for q in self.rooms(f):
                for lst, sd in ((same, side), (far, OPP[side])):
                    if q in same or q in far:
                        continue
                    o2, cq, b0, b1 = edge(q, sd)
                    if abs(cq - c) < T and overlap(lo, hi, b0, b1) > T:
                        lst.append(q)
                        lo, hi = min(lo, b0), max(hi, b1)
                        changed = True
        if len(same) + len(far) > 7:
            raise ActionError("that wall runs along too many rooms to move it on its own")
        # the new boxes
        new = {}
        for q in same:
            x0, y0, x1, y1 = rbox(q)
            b = {"N": (x0, c2, x1, y1), "S": (x0, y0, x1, c2), "W": (c2, y0, x1, y1), "E": (x0, y0, c2, y1)}[side]
            new[id(q)] = (q, b)
        for q in far:
            x0, y0, x1, y1 = rbox(q)
            sd = OPP[side]
            b = {"N": (x0, c2, x1, y1), "S": (x0, y0, x1, c2), "W": (c2, y0, x1, y1), "E": (x0, y0, c2, y1)}[sd]
            new[id(q)] = (q, b)
        for q, b in new.values():
            short = min(b[2] - b[0], b[3] - b[1]) / U
            need = MIN_SHORT.get(q.get("kind"), 1.0)
            if b[2] - b[0] < 0.6 * U or b[3] - b[1] < 0.6 * U or (short < need - 0.01 and short < min(q["width"], q["height"]) / U):
                raise ActionError(f"{self.name(q)} would be only {short:.1f} m across (it needs at least {need} m)")
        others = [q for q in self.rooms(f) if id(q) not in new]
        for q, b in new.values():
            for o in others:
                if boxes_clash(b, rbox(o)):
                    raise ActionError(f"{self.name(q)} would run into {self.name(o)}")
        # walls and railings on the line: the stretch that moves, split from what stays
        moved_lines, kept = [], []
        for w in self.walls_on(f, orient, c, ("wall", "railing")):
            a, b = extent(w, orient)
            if overlap(a, b, lo, hi) <= T:
                continue
            parts = []
            if a < lo - T:
                parts.append(piece_of(w, orient, a, lo))
            midp = piece_of(w, orient, max(a, lo), min(b, hi), keep_id=True)
            if b > hi + T:
                parts.append(piece_of(w, orient, hi, b))
            self.remove([w])
            for p in parts:
                if p:
                    self.els.append(p)
                    kept.append(p)
            if midp:
                if orient == "h":
                    midp["top"] += c2 - c
                else:
                    midp["left"] += c2 - c
                self.els.append(midp)
                moved_lines.append(midp)
        # openings on the moving stretch go with it
        for o in self.of(f, "door", "window"):
            if on_line(o, orient, c):
                a, b = extent(o, orient)
                m = (a + b) / 2
                if lo - T <= m <= hi + T:
                    if orient == "h":
                        o["top"] += c2 - c
                    else:
                        o["left"] += c2 - c
        # walls meeting the line: their end on the line follows it
        other = "v" if orient == "h" else "h"
        for w in self.of(f, "wall", "railing"):
            if w in moved_lines or w in kept or not (vert(w) if orient == "h" else horiz(w)):
                continue
            ax, ay, bx, by = ends(w)
            cross = ax if orient == "h" else ay        # where it crosses our axis
            if not (lo - T <= cross <= hi + T):
                continue
            pa = ay if orient == "h" else ax
            pb = by if orient == "h" else bx
            if abs(pa - c) < T:
                pa = c2
            elif abs(pb - c) < T:
                pb = c2
            else:
                continue
            lo2, hi2 = min(pa, pb), max(pa, pb)
            if hi2 - lo2 < 2:
                self.remove([w])
                continue
            if orient == "h":
                w.update(left=cross, top=lo2, width=hi2 - lo2, angle=90)
            else:
                w.update(left=lo2, top=cross, width=hi2 - lo2, angle=0)
            # openings on a wall that got shorter stay on it
            for o in self.openings_on(f, other, cross, -1e9, 1e9):
                a, b = extent(o, other)
                if b <= lo2 or a >= hi2:
                    continue
                L = b - a
                if L > hi2 - lo2 - 2:
                    self.remove([o])
                    continue
                shift = min(max(a, lo2 + 1), hi2 - 1 - L) - a
                if other == "v":
                    o["top"] += shift
                else:
                    o["left"] += shift
        # jogs where the line used to carry on past the moved stretch
        for v in (lo, hi):
            if not any(abs(extent(k, orient)[0] - v) < T or abs(extent(k, orient)[1] - v) < T for k in kept):
                continue
            joined = False
            for w in self.of(f, "wall", "railing"):
                if not (vert(w) if orient == "h" else horiz(w)):
                    continue
                ax, ay, bx, by = ends(w)
                cross = ax if orient == "h" else ay
                a, b = extent(w, other)
                if abs(cross - v) < T and a <= min(c, c2) + T and b >= max(c, c2) - T:
                    joined = True
                    break
            if not joined:
                self.els.append(make_line("wall", other, v, min(c, c2), max(c, c2), f))
        # furniture standing against the moved wall goes with it; the rest stays inside its room
        for q, b in new.values():
            for e in self.furniture_in(q):
                fb = fbox(e)
                near = min(abs(fb[0] - c), abs(fb[2] - c)) if orient == "v" else min(abs(fb[1] - c), abs(fb[3] - c))
                if near < 0.5 * U:
                    if orient == "v":
                        e["left"] += c2 - c
                    else:
                        e["top"] += c2 - c
        for q, b in new.values():
            fur = self.furniture_in(q)
            set_box(q, *b)
            for e in fur:
                self.keep_inside(e, b)
        return [q for q, _ in new.values()]

    def keep_inside(self, e, b):
        fb = fbox(e)
        if fb[2] - fb[0] > b[2] - b[0] - 2 or fb[3] - fb[1] > b[3] - b[1] - 2:
            self.remove([e])
            return
        dx = max(0, b[0] + 1 - fb[0]) - max(0, fb[2] - (b[2] - 1))
        dy = max(0, b[1] + 1 - fb[1]) - max(0, fb[3] - (b[3] - 1))
        e["left"] += dx
        e["top"] += dy

    # ---- resizing a room ------------------------------------------------------------------------------
    def _try(self, fn):
        """Run fn on a copy; (copy, result) or (None, error)."""
        trial = Plan.__new__(Plan)
        trial.els, trial.floor, trial.notes = copy.deepcopy(self.els), self.floor, []
        try:
            return trial, fn(trial)
        except ActionError as e:
            return None, str(e)

    def resize_room(self, r, side=None, by_m=None, to_width_m=None, to_depth_m=None, to_area_m2=None, grow=True):
        w, h = r["width"] / U, r["height"] / U
        jobs = []                                    # (sides allowed, delta m)
        if to_width_m:
            jobs.append((["E", "W"] if not side else [side], float(to_width_m) - w))
        if to_depth_m:
            jobs.append((["N", "S"] if not side else [side], float(to_depth_m) - h))
        if to_area_m2 and not jobs:
            target = float(to_area_m2)
            if side:
                along = h if side in ("E", "W") else w
                jobs.append(([side], (target - w * h) / along))
            else:
                jobs.append((None, target))
        if not jobs:
            area = w * h
            step = by_m if by_m else max(0.4, min(1.5, round(0.22 * area / max(w, h) / 0.05) * 0.05))
            step = abs(float(step)) * (1 if grow else -1)
            jobs.append(([side] if side else list(SIDES), step))
        done_rooms, said = set(), []
        for sides, delta in jobs:
            if sides is None:                       # an area: the side that gets closest
                best = None
                for sd in SIDES:
                    along = h if sd in ("E", "W") else w
                    dm = (delta - w * h) / along
                    best = self._best_side(r, [sd], dm, best)
                if best[0] is None:
                    raise ActionError(best[2])
            else:
                best = self._best_side(r, sides, delta, None)
                if best[0] is None:
                    raise ActionError(best[2])
            trial, sd, info, dm, _ = best
            self.els = trial.els
            r = self.by_id(r["id"])
            for q in info:
                done_rooms.add(q)
            said.append(f"{'moved' if dm > 0 else 'pulled in'} its {SIDE_WORD[sd]} wall {abs(dm):.2f} m")
        others = [n for n in done_rooms if n != self.name(r)]
        msg = f"{self.name(r)} is now {r['width'] / U:.1f} × {r['height'] / U:.1f} m ({r['area']:.1f} m²): " + ", ".join(said)
        if others:
            msg += f"; {', '.join(sorted(others))} {'gives' if len(others) == 1 else 'give'} up or take the difference"
        return msg

    def _best_side(self, r, sides, delta_m, best):
        """Try moving each allowed side by delta_m; keep the least disruptive that works.
        best / the result: (plan copy, side, changed room names, delta m, cost) or (None, None, error, 0, 0)."""
        last_err = best[2] if best and best[0] is None else "no side of it can move that far"
        for sd in sides:
            d = round(delta_m * U)
            if abs(d) < 1:
                continue
            rid = r["id"]
            trial, res = self._try(lambda p, sd=sd, d=d: p.move_edge(p.by_id(rid), sd, d))
            if trial is None:
                last_err = res
                continue
            # cost: how much the other rooms lose, weighted by how much they matter; outside growth is cheap
            cost, names = 0.0, []
            for q in res:
                names.append(trial.name(q))
                if q["id"] == rid:
                    continue
                before = self.by_id(q["id"])
                if before is None:
                    continue
                loss = (before["width"] * before["height"] - q["width"] * q["height"]) / max(1, before["width"] * before["height"])
                cost += KEEP.get(q.get("kind"), 1.0) * max(0, loss) + 0.1 * abs(loss)
            cost += 0.02 * len(trial.els)
            if best is None or best[0] is None or cost < best[4]:
                best = (trial, sd, names, delta_m, cost)
        if best is None or best[0] is None:
            return (None, None, last_err, 0, 0)
        return best

    # ---- openings ---------------------------------------------------------------------------------------
    def free_spot(self, f, orient, c, lo, hi, width, prefer=None, margin=0.15 * U):
        """Centre of a free stretch of `width` on a walled line between lo and hi, clear of other openings."""
        gaps = self.covered(f, orient, c, lo, hi, ("wall",))
        walled = []
        at = lo
        for a, b in gaps:
            if a - at > 1:
                walled.append((at, a))
            at = b
        if hi - at > 1:
            walled.append((at, hi))
        taken = sorted(extent(o, orient) for o in self.openings_on(f, orient, c, lo, hi))
        best = None
        target = prefer if prefer is not None else (lo + hi) / 2
        for a, b in walled:
            free, at = [], a + margin
            for oa, ob in taken:
                if ob < at or oa > b:
                    continue
                if oa - margin - at >= width:
                    free.append((at, oa - margin))
                at = max(at, ob + margin)
            if b - margin - at >= width:
                free.append((at, b - margin))
            for fa, fb in free:
                m = min(max(target, fa + width / 2), fb - width / 2)
                if best is None or abs(m - target) < abs(best - target):
                    best = m
        return best

    def add_opening(self, t, f, orient, c, m, width, **extra):
        e = make_line(t, orient, c, m - width / 2, m + width / 2, f, **extra)
        if t == "door":
            e.setdefault("swing", 1)
            e.setdefault("hinge", 1)
        self.els.append(e)
        return e

    def add_door(self, r, to=None, width_m=None, side=None):
        f = fl(r)
        if to is not None and to != "outside":
            if not any(to in self.across(r, sd) for sd in SIDES):
                raise ActionError(f"{self.name(r)} and {self.name(to)} don't share a wall")
            if not width_m:
                last = None
                for w in (0.9, 0.8, 0.75):
                    try:
                        return self.add_door(r, to, w, side)
                    except ActionError as e:
                        last = e
                raise last
            width = width_m * U
            for sd in ([side] if side else SIDES):
                if to not in self.across(r, sd):
                    continue
                o, c, a0, a1 = edge(r, sd)
                o2, c2, b0, b1 = edge(to, OPP[sd])
                lo, hi = max(a0, b0), min(a1, b1)
                m = self.free_spot(f, o, c, lo, hi, width)
                if m is not None:
                    self.add_opening("door", f, o, c, m, width)
                    return f"a {width / U:.1f} m door between {self.name(r)} and {self.name(to)}"
            if not any(to in self.across(r, sd) for sd in SIDES):
                raise ActionError(f"{self.name(r)} and {self.name(to)} don't share a wall")
            raise ActionError(f"there's no free stretch of wall between {self.name(r)} and {self.name(to)} for a door")
        if not width_m:
            last = None
            for w in (1.0, 0.9, 0.8):
                try:
                    return self.add_door(r, to, w, side)
                except ActionError as e:
                    last = e
            raise last
        width = width_m * U
        for sd in ([side] if side else SIDES):
            o, c, a0, a1 = edge(r, sd)
            for lo, hi in sorted(self.outside_stretches(r, sd), key=lambda s: s[0] - s[1]):
                m = self.free_spot(f, o, c, lo, hi, width)
                if m is not None:
                    self.add_opening("door", f, o, c, m, width)
                    return f"a {width / U:.1f} m door from {self.name(r)} to the outside on its {SIDE_WORD[sd]} side"
        raise ActionError(f"{self.name(r)} has no free outside wall for a door")

    def add_window(self, r, side=None, width_m=None, count=1):
        if not width_m:
            last = None
            for w in ((0.6, 0.45) if r.get("kind") == "bathroom" else (1.5, 1.2, 0.9, 0.6)):
                try:
                    return self.add_window(r, side, w, count)
                except ActionError as e:
                    last = e
            raise last
        f = fl(r)
        width = width_m * U
        made = 0
        order = [side] if side else sorted(SIDES, key=lambda s: -sum(b - a for a, b in self.outside_stretches(r, s)))
        for _ in range(max(1, int(count))):
            placed = False
            for sd in order:
                o, c, a0, a1 = edge(r, sd)
                for lo, hi in self.outside_stretches(r, sd):
                    m = self.free_spot(f, o, c, lo, hi, width)
                    if m is not None:
                        self.add_opening("window", f, o, c, m, width)
                        made += 1
                        placed = True
                        break
                if placed:
                    break
            if not placed:
                break
        if not made:
            raise ActionError(f"{self.name(r)} has no free outside wall for a{' ' + SIDE_WORD[side] if side else 'nother'} window")
        return f"{made} window{'s' if made > 1 else ''} ({width / U:.1f} m) in {self.name(r)}"

    def openings_of(self, r, t, to=None, side=None):
        f = fl(r)
        out = []
        for sd in ([side] if side else SIDES):
            o, c, a0, a1 = edge(r, sd)
            for e in self.openings_on(f, o, c, a0, a1, (t,)):
                if to is not None:
                    if to == "outside":
                        m = mid(e)
                        mm = m[0] if o == "h" else m[1]
                        if not any(lo <= mm <= hi for lo, hi in self.outside_stretches(r, sd)):
                            continue
                    elif to not in self.across(r, sd):
                        continue
                    else:
                        o2, c2, b0, b1 = edge(to, OPP[sd])
                        a, b = extent(e, o)
                        if overlap(a, b, b0, b1) <= 1:
                            continue
                out.append(e)
        return out

    def remove_openings(self, r, t, to=None, side=None, all_=False):
        found = self.openings_of(r, t, to, side)
        if not found:
            raise ActionError(f"no {t} found {self._where(r, to, side)}")
        gone = found if all_ else found[:1]
        self.remove(gone)
        return f"removed {len(gone)} {t}{'s' if len(gone) > 1 else ''} {self._where(r, to, side)}"

    def resize_openings(self, r, t, width_m, to=None, side=None, all_=True):
        found = self.openings_of(r, t, to, side)
        if not found:
            raise ActionError(f"no {t} found {self._where(r, to, side)}")
        for e in (found if all_ else found[:1]):
            self.set_opening_width(e, width_m * U)
        return f"{t}{'s' if len(found) > 1 else ''} {self._where(r, to, side)} now {width_m:.2f} m wide"

    def set_opening_width(self, e, width):
        f = fl(e)
        orient = "h" if horiz(e) else "v"
        c = e["top"] if orient == "h" else e["left"]
        a, b = extent(e, orient)
        m = (a + b) / 2
        # stay on the wall it sits in
        wall = next((w for w in self.walls_on(f, orient, c) if extent(w, orient)[0] - 1 <= m <= extent(w, orient)[1] + 1), None)
        if wall:
            wa, wb = extent(wall, orient)
            width = min(width, wb - wa - 4)
            m = min(max(m, wa + 2 + width / 2), wb - 2 - width / 2)
        ax, ay, bx, by = ends(e)
        rev = (bx < ax) if orient == "h" else (by < ay)
        start = m + width / 2 if rev else m - width / 2
        if orient == "h":
            e["left"] = start
        else:
            e["top"] = start
        e["width"] = width

    def _where(self, r, to, side):
        if to == "outside":
            return f"on {self.name(r)}'s outside walls"
        if to is not None:
            return f"between {self.name(r)} and {self.name(to)}"
        if side:
            return f"on {self.name(r)}'s {SIDE_WORD[side]} wall"
        return f"in {self.name(r)}"

    # ---- furniture ------------------------------------------------------------------------------------
    def place(self, r, t, w_m=None, d_m=None, back=None):
        f = fl(r)
        x0, y0, x1, y1 = rbox(r)
        name, w0, d0 = FURNITURE.get(t, (t, 1.0, 0.6))
        w, d = (w_m or w0) * U, (d_m or d0) * U
        taken = [fbox(e) for e in self.furniture_in(r) if e.get("type") != "furniture_rug"]
        taken += [fbox(e) for e in self.of(f, "stairs")]
        # door swings and a walking strip in front of doors
        for o in self.of(f, "door"):
            ax, ay, bx, by = ends(o)
            L = o["width"]
            if horiz(o) and (abs(ay - y0) < T or abs(ay - y1) < T) and x0 - T < (ax + bx) / 2 < x1 + T:
                taken.append((min(ax, bx), ay - L, max(ax, bx), ay + L))
            elif vert(o) and (abs(ax - x0) < T or abs(ax - x1) < T) and y0 - T < (ay + by) / 2 < y1 + T:
                taken.append((ax - L, min(ay, by), ax + L, max(ay, by)))
        windows = []
        if t in TALL:
            for o in self.of(f, "window"):
                ax, ay, bx, by = ends(o)
                windows.append((min(ax, bx) - 2, min(ay, by) - 8, max(ax, bx) + 2, max(ay, by) + 8))
        inset = 3

        def ok(b):
            if b[0] < x0 + inset - 0.5 or b[1] < y0 + inset - 0.5 or b[2] > x1 - inset + 0.5 or b[3] > y1 - inset + 0.5:
                return False
            return not any(boxes_clash(b, q, 0.5) for q in taken + windows)

        cands = []
        if t in CENTRED:
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            for dx in (0, -10, 10, -20, 20):
                for dy in (0, -10, 10, -20, 20):
                    for bk in ("N", "E"):
                        e = furniture_piece(t, cx + dx, cy + dy, bk, f, w / U, d / U)
                        cands.append((abs(dx) + abs(dy) + (0 if (bk == "N") == (x1 - x0 >= y1 - y0) else 5), e))
        sides = [back] if back else list(SIDES)
        for bk in sides:
            horiz_wall = bk in ("N", "S")
            a0, a1 = (x0, x1) if horiz_wall else (y0, y1)
            midv = (a0 + a1) / 2
            line = {"N": y0 + inset + d / 2, "S": y1 - inset - d / 2, "W": x0 + inset + d / 2, "E": x1 - inset - d / 2}[bk]
            v = a0 + inset + w / 2
            while v <= a1 - inset - w / 2 + 0.01:
                cx, cy = (v, line) if horiz_wall else (line, v)
                e = furniture_piece(t, cx, cy, bk, f, w / U, d / U)
                score = abs(v - midv) * (0.2 if t in ("furniture_plant", "furniture_planter", "furniture_floor_lamp") else 1)
                if t in ("furniture_plant", "furniture_floor_lamp"):
                    score = min(abs(v - a0), abs(a1 - v))
                cands.append((score + (40 if t in CENTRED else 0), e))
                v += 5
        cands.sort(key=lambda p: p[0])
        for _, e in cands:
            if ok(fbox(e)):
                self.els.append(e)
                return e
        raise ActionError(f"there's no free space in {self.name(r)} for a {name.lower()}")

    def furnish(self, r, types=None):
        made = []
        name = (r.get("name") or "").lower()
        if types is None and re.search(r"pooja|puja|prayer|mandir", name):
            types = ["furniture_pooja"]
        elif types is None and re.search(r"store|pantry", name):
            types = ["furniture_storage_shelf", "furniture_storage_shelf"]
        for t in types or DEFAULT_SET.get(r.get("kind"), []):
            try:
                made.append(self.place(r, t))
            except ActionError:
                pass
        return made

    # ---- rooms --------------------------------------------------------------------------------------------
    def add_room(self, kind, next_to, side=None, width_m=None, depth_m=None, name=None, furnish=True, rng=None,
                 avoid_sides=()):
        """A new room (or outdoor space) built against one side of next_to, outside the house's walls there."""
        if kind not in KINDS:
            raise ActionError(f"unknown room type {kind}")
        f = fl(next_to)
        rng = rng or random
        dw, dd = DEFAULT_SIZE[kind]
        depth = (depth_m or dd) * U
        best = None
        for sd in ([side] if side else SIDES):
            if sd in avoid_sides and not side:
                continue
            o, c, a0, a1 = edge(next_to, sd)
            for lo, hi in self.outside_stretches(next_to, sd):
                span = hi - lo
                # an outdoor space has to be wide enough to use; a room can run past a short stretch
                if not width_m and kind in OUTDOOR and span < MIN_OUTDOOR_W.get(kind, 2.4) * U:
                    continue
                if width_m:
                    want = width_m * U
                elif kind in OUTDOOR:
                    want = min(span, (4.0 if kind == "balcony" else 7.0) * U)
                else:
                    want = dw * U
                want = max(want, 1.2 * U)
                ctr = (lo + hi) / 2
                b0 = min(max(ctr - want / 2, lo), hi - want) if want <= span else ctr - want / 2
                b1 = b0 + want
                if o == "h":
                    box = (b0, min(c, c + OUT[sd] * depth), b1, max(c, c + OUT[sd] * depth))
                else:
                    box = (min(c, c + OUT[sd] * depth), b0, max(c, c + OUT[sd] * depth), b1)
                if any(boxes_clash(box, rbox(q)) for q in self.rooms(f)):
                    continue
                # nothing in the way (stairs, other floors' outdoor spaces don't matter)
                score = min(want, span) + rng.random() * 8
                if best is None or score > best[0]:
                    best = (score, sd, box, (max(lo, b0), min(hi, b1)))
        if not best:
            raise ActionError(f"there's no free outside wall on {self.name(next_to)} to build a {kind.replace('_', ' ')} against"
                              + (f" on its {SIDE_WORD[side]} side" if side else ""))
        _, sd, box, shared = best
        o, c, a0, a1 = edge(next_to, sd)
        room = {"id": new_id("room"), "type": "room", "kind": kind, "name": name or self._fresh_name(kind),
                "angle": 0, "floor": f}
        set_box(room, *box)
        self.els.append(room)
        outdoor = kind in OUTDOOR
        # the edges of the new room: walls (rooms) or railings (balconies and terraces upstairs)
        edges = {s: edge(room, s) for s in SIDES}
        for s, (o2, c2, l2, h2) in edges.items():
            if s == OPP[sd]:
                # the side against the old room: wall any part that isn't walled yet (a wider room)
                if not outdoor:
                    for g0, g1 in self.covered(f, o2, c2, l2, h2, ("wall",)):
                        self.els.append(make_line("wall", o2, c2, g0, g1, f))
                continue
            if outdoor:
                if kind in ("balcony", "terrace") or f > 1 or kind == "deck":
                    for g0, g1 in self.covered(f, o2, c2, l2, h2):
                        # no railing where another room is on the other side
                        if not any(abs(edge(q, OPP[s])[1] - c2) < T and overlap(g0, g1, edge(q, OPP[s])[2], edge(q, OPP[s])[3]) > T
                                   for q in self.rooms(f) if q is not room):
                            self.els.append(make_line("railing", o2, c2, g0, g1, f))
                continue
            for g0, g1 in self.covered(f, o2, c2, l2, h2, ("wall",)):
                self.els.append(make_line("wall", o2, c2, g0, g1, f))
        # the shared wall: windows there now look into the new room
        so, sc, s0, s1 = edges[OPP[sd]]
        for e in self.openings_on(f, so, sc, s0, s1, ("window",)):
            if not outdoor:
                self.remove([e])
        # a door from the old room (wide and glazed onto outdoor spaces), unless one already opens there
        dwid = (1.5 if outdoor else 0.9) * U
        if self.openings_on(f, so, sc, shared[0], shared[1], ("door",)):
            mpos = "existing"
        elif outdoor:
            # a window where the door goes makes way for it
            mpos = self.free_spot(f, so, sc, shared[0], shared[1], dwid)
            if mpos is None:
                for e in self.openings_on(f, so, sc, shared[0], shared[1], ("window",)):
                    self.remove([e])
                    break
                mpos = self.free_spot(f, so, sc, shared[0], shared[1], dwid) or self.free_spot(f, so, sc, shared[0], shared[1], 0.9 * U)
                dwid = dwid if self.free_spot(f, so, sc, shared[0], shared[1], dwid) is not None else 0.9 * U
        else:
            mpos = self.free_spot(f, so, sc, shared[0], shared[1], dwid)
        if mpos == "existing":
            pass
        elif mpos is not None:
            self.add_opening("door", f, so, sc, mpos, dwid, **({"sliding": True} if outdoor else {}))
        else:
            self.notes.append(f"No room for a door between {self.name(next_to)} and the new {kind.replace('_', ' ')}: add one where you want it.")
        if kind in HABITABLE or kind in ("bathroom", "utility"):
            try:
                self.add_window(room)
            except ActionError:
                pass
        if furnish:
            self.furnish(room)
        return room, sd

    def _fresh_name(self, kind):
        base = KIND_NAME.get(kind, "Room")
        names = {(q.get("name") or "").lower() for q in self.rooms()}
        if base.lower() not in names:
            return base
        if kind == "bedroom":
            n = 2
            while f"bedroom {n}" in names:
                n += 1
            return f"Bedroom {n}"
        n = 2
        while f"{base} {n}".lower() in names:
            n += 1
        return f"{base} {n}"

    def remove_room(self, r):
        f = fl(r)
        self.remove(self.furniture_in(r))
        for sd in SIDES:
            o, c, a0, a1 = edge(r, sd)
            for lo, hi in self.outside_stretches(r, sd):
                for w in self.walls_on(f, o, c, ("wall", "railing")):
                    a, b = extent(w, o)
                    if overlap(a, b, lo, hi) <= T:
                        continue
                    parts = [piece_of(w, o, a, lo) if a < lo - T else None, piece_of(w, o, hi, b) if b > hi + T else None]
                    self.remove([w])
                    self.els.extend(p for p in parts if p)
                self.remove(self.openings_on(f, o, c, lo, hi))
        self.remove([r])
        return f"removed {self.name(r)}"

    def merge_rooms(self, a, b):
        if b["width"] * b["height"] > a["width"] * a["height"]:
            a, b = b, a
        f = fl(a)
        for sd in SIDES:
            if b in self.across(a, sd):
                o, c, a0, a1 = edge(a, sd)
                o2, c2, b0, b1 = edge(b, OPP[sd])
                lo, hi = max(a0, b0), min(a1, b1)
                for w in self.walls_on(f, o, c):
                    wa, wb = extent(w, o)
                    if overlap(wa, wb, lo, hi) <= T:
                        continue
                    parts = [piece_of(w, o, wa, lo) if wa < lo - T else None, piece_of(w, o, hi, wb) if wb > hi + T else None]
                    self.remove([w])
                    self.els.extend(p for p in parts if p)
                self.remove(self.openings_on(f, o, c, lo, hi))
                ba, bb = rbox(a), rbox(b)
                if abs(a0 - b0) < T and abs(a1 - b1) < T:
                    set_box(a, min(ba[0], bb[0]), min(ba[1], bb[1]), max(ba[2], bb[2]), max(ba[3], bb[3]))
                    self.remove([b])
                    return f"joined {self.name(b)} into {self.name(a)} ({a['area']:.1f} m²)"
                return f"opened up the wall between {self.name(a)} and {self.name(b)} (they aren't the same width, so both keep their names)"
        raise ActionError(f"{self.name(a)} and {self.name(b)} don't share a wall")

    def split_room(self, r, kind, name=None, direction=None, fraction=None, part=None):
        x0, y0, x1, y1 = rbox(r)
        need_new, need_old = MIN_SHORT.get(kind, 1.0), MIN_SHORT.get(r.get("kind"), 1.0)
        dirs = [direction] if direction else (["v", "h"] if (x1 - x0) >= (y1 - y0) else ["h", "v"])
        last = None
        for dr in dirs:
            L = ((x1 - x0) if dr == "v" else (y1 - y0)) / U
            if fraction:
                fr = float(fraction)
            else:
                # the new room gets a fair share, never less than it needs, and the old room keeps what it needs
                new_len = min(max(need_new, L * 0.45), L - need_old)
                fr = 1 - new_len / L
            try:
                return self._split(r, kind, name, dr, fr, part)
            except ActionError as e:
                last = e
        raise last

    def _split(self, r, kind, name, direction, fraction, part):
        f = fl(r)
        x0, y0, x1, y1 = rbox(r)
        fraction = min(0.85, max(0.15, fraction))
        if direction == "v":
            cut = round(x0 + (x1 - x0) * fraction)
            first, second = (x0, y0, cut, y1), (cut, y0, x1, y1)
            wall = make_line("wall", "v", cut, y0, y1, f)
        else:
            cut = round(y0 + (y1 - y0) * fraction)
            first, second = (x0, y0, x1, cut), (x0, cut, x1, y1)
            wall = make_line("wall", "h", cut, x0, x1, f)
        new_box = second if part in (None, "E", "S") else first
        old_box = first if new_box == second else second
        for b, k in ((new_box, kind), (old_box, r.get("kind"))):
            if min(b[2] - b[0], b[3] - b[1]) / U < MIN_SHORT.get(k, 1.0) - 0.01:
                raise ActionError(f"{self.name(r)} is too small to split: a {KIND_NAME.get(k, k).lower()} would be only {min(b[2] - b[0], b[3] - b[1]) / U:.1f} m across")
        for e in self.furniture_in(r):
            b = fbox(e)
            if (direction == "v" and b[0] < cut < b[2]) or (direction == "h" and b[1] < cut < b[3]):
                self.remove([e])
        self.els.append(wall)
        set_box(r, *old_box)
        nr = {"id": new_id("room"), "type": "room", "kind": kind, "name": name or self._fresh_name(kind), "angle": 0, "floor": f}
        set_box(nr, *new_box)
        self.els.append(nr)
        o = "v" if direction == "v" else "h"
        lo, hi = (y0, y1) if direction == "v" else (x0, x1)
        m = self.free_spot(f, o, cut, lo, hi, 0.9 * U, prefer=lo + 0.8 * U)
        if m is not None:
            self.add_opening("door", f, o, cut, m, 0.9 * U)
        self.furnish(nr)
        return nr

    def swap_rooms(self, a, b):
        for r in (a, b):
            self.remove([e for e in self.furniture_in(r)])
        a["kind"], b["kind"] = b.get("kind"), a.get("kind")
        a["name"], b["name"] = b.get("name"), a.get("name")
        a.pop("ceiling", None), b.pop("ceiling", None)
        self.furnish(a)
        self.furnish(b)
        return f"swapped {b['name']} and {a['name']}, and furnished both for their new use"

    # ---- outdoor spaces from what's free ---------------------------------------------------------------------
    def open_roof_pieces(self, floor):
        """Rectangles of the floor below that nothing on `floor` covers (free roof to turn into a terrace)."""
        below = [rbox(q) for q in self.rooms(floor - 1) if q.get("kind") not in OUTDOOR]
        here = [rbox(q) for q in self.rooms(floor)]
        pieces = []
        for b in below:
            parts = [b]
            for h in here:
                nxt = []
                for p in parts:
                    if not boxes_clash(p, h, 0.5):
                        nxt.append(p)
                        continue
                    x0, y0, x1, y1 = p
                    hx0, hy0, hx1, hy1 = max(x0, h[0]), max(y0, h[1]), min(x1, h[2]), min(y1, h[3])
                    for q in ((x0, y0, x1, hy0), (x0, hy1, x1, y1), (x0, hy0, hx0, hy1), (hx1, hy0, x1, hy1)):
                        if q[2] - q[0] > 1 and q[3] - q[1] > 1:
                            nxt.append(q)
                parts = nxt
            pieces.extend(parts)
        # merge pieces that line up into bigger rectangles
        merged = True
        while merged:
            merged = False
            for i in range(len(pieces)):
                for j in range(i + 1, len(pieces)):
                    a, b = pieces[i], pieces[j]
                    if abs(a[1] - b[1]) < T and abs(a[3] - b[3]) < T and (abs(a[2] - b[0]) < T or abs(b[2] - a[0]) < T):
                        pieces[i] = (min(a[0], b[0]), a[1], max(a[2], b[2]), a[3])
                    elif abs(a[0] - b[0]) < T and abs(a[2] - b[2]) < T and (abs(a[3] - b[1]) < T or abs(b[3] - a[1]) < T):
                        pieces[i] = (a[0], min(a[1], b[1]), a[2], max(a[3], b[3]))
                    else:
                        continue
                    pieces.pop(j)
                    merged = True
                    break
                if merged:
                    break
        return [p for p in pieces if (p[2] - p[0]) >= 1.5 * U and (p[3] - p[1]) >= 1.5 * U]

    def terrace_on_roof(self, floor, name="Terrace"):
        """Turn the biggest piece of open roof below `floor` into a terrace reached from a room next to it."""
        for p in sorted(self.open_roof_pieces(floor), key=lambda b: -(b[2] - b[0]) * (b[3] - b[1])):
            room = {"id": new_id("room"), "type": "room", "kind": "terrace", "name": name, "angle": 0, "floor": floor}
            set_box(room, *p)
            hosts = []
            for sd in SIDES:
                o, c, a0, a1 = edge(room, sd)
                for q in self.rooms(floor):
                    o2, c2, b0, b1 = edge(q, OPP[sd])
                    if abs(c2 - c) < T and overlap(a0, a1, b0, b1) > 1.0 * U and q.get("kind") not in OUTDOOR | {"bathroom", "closet"}:
                        hosts.append((overlap(a0, a1, b0, b1), sd, q, max(a0, b0), min(a1, b1)))
            if not hosts:
                continue
            hosts.sort(key=lambda h: (-(h[2].get("kind") in ("lounge", "hallway", "living", "master_bedroom")), -h[0]))
            _, sd, host, lo, hi = hosts[0]
            self.els.append(room)
            for s in SIDES:
                o2, c2, l2, h2 = edge(room, s)
                for g0, g1 in self.covered(floor, o2, c2, l2, h2):
                    if not any(abs(edge(q, OPP[s])[1] - c2) < T and overlap(g0, g1, edge(q, OPP[s])[2], edge(q, OPP[s])[3]) > T
                               for q in self.rooms(floor) if q is not room):
                        self.els.append(make_line("railing", o2, c2, g0, g1, floor))
            o, c, a0, a1 = edge(room, sd)
            w = 1.5 * U if hi - lo >= 1.9 * U else 0.9 * U
            m = self.free_spot(floor, o, c, lo, hi, w)
            if m is None:
                for e in self.openings_on(floor, o, c, lo, hi, ("window",)):
                    self.remove([e])
                    break
                m = self.free_spot(floor, o, c, lo, hi, w)
            if m is not None:
                self.add_opening("door", floor, o, c, m, w, sliding=True)
            self.furnish(room)
            return room
        return None


def front_side(plan: Plan):
    """The side of the ground floor the main entrance is on, or None."""
    rooms = plan.rooms(1)
    for d in plan.of(1, "door"):
        mx, my = mid(d)
        inside = [r for r in rooms if r.get("kind") not in OUTDOOR and rbox(r)[0] - T <= mx <= rbox(r)[2] + T
                  and rbox(r)[1] - T <= my <= rbox(r)[3] + T]
        if len(inside) != 1:
            continue
        r = inside[0]
        for sd in SIDES:
            o, c, a0, a1 = edge(r, sd)
            v = my if o == "h" else mx
            along = mx if o == "h" else my
            if abs(v - c) < T and any(lo - T <= along <= hi + T for lo, hi in plan.outside_stretches(r, sd)):
                return sd
    return None


def add_outdoor_spaces(elements: list[dict], wants: dict, rng: random.Random) -> tuple[list[dict], list[str]]:
    """Patio, balconies and a terrace for a freshly generated house, where the owner asked for them."""
    plan = Plan(elements)
    floors = sorted({fl(e) for e in plan.els}) or [1]
    top = floors[-1]
    notes = []
    front = front_side(plan)

    def hosts(floor, kinds):
        rs = [r for r in plan.rooms(floor) if r.get("kind") in kinds]
        rng.shuffle(rs)
        return sorted(rs, key=lambda r: kinds.index(r["kind"]))

    if wants.get("patio") or (wants.get("terrace") and top == 1):
        kind, name = ("patio", "Patio") if wants.get("patio") else ("terrace", "Terrace")
        done = False
        for h in hosts(1, ["living", "dining", "lounge", "kitchen"]):
            try:
                plan.add_room(kind, h, depth_m=rng.choice([2.4, 2.7, 3.0, 3.3]), name=name, rng=rng,
                              avoid_sides=(front,) if front else ())
                done = True
                break
            except ActionError:
                continue
        if not done:
            notes.append(f"There was no free outside wall by the living areas for a {name.lower()}.")
    if wants.get("balcony"):
        if top == 1:
            notes.append("A one-storey house has no balcony; ask for two floors to get one, or add a patio.")
        for f in floors[1:]:
            if any(r.get("kind") == "balcony" for r in plan.rooms(f)):
                continue
            for h in hosts(f, ["master_bedroom", "bedroom", "lounge"]):
                try:
                    plan.add_room("balcony", h, depth_m=rng.choice([1.2, 1.5, 1.8]), width_m=rng.choice([2.4, 3.0, 3.6]),
                                  name="Balcony" if not any(r.get("kind") == "balcony" for r in plan.rooms()) else None, rng=rng)
                    break
                except ActionError:
                    continue
    if wants.get("terrace") and top > 1:
        if not any(r.get("kind") == "terrace" for r in plan.rooms(top)):
            if not plan.terrace_on_roof(top):
                for h in hosts(top, ["lounge", "hallway", "master_bedroom", "bedroom"]):
                    try:
                        plan.add_room("terrace", h, depth_m=rng.choice([2.7, 3.0, 3.6]), name="Terrace", rng=rng)
                        break
                    except ActionError:
                        continue
                else:
                    notes.append("There was no free outside wall upstairs for a terrace.")
    return plan.els, notes
