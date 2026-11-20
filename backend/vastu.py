"""Vastu Shastra checks for a floor plan.

The house is divided into a 3 x 3 grid of directions (NW N NE / W centre E / SW S SE) and each
room is placed by its centre. The common residential guidelines are checked:

  kitchen          south-east (Agni); north-west is the accepted alternative
  master bedroom   south-west; south or west are acceptable
  toilets / baths  never north-east, never the centre
  centre           open (Brahmasthan): living, dining or circulation, not a toilet, kitchen or bedroom
  entrance         north, east or north-east
  living room      north, east, north-east or north-west
  pooja / study    north-east

Works on any plan: rooms as {kind, name, x0, y0, x1, y1} in plan units, `north` says which way north
points on the drawing ("up", "right", "down", "left"). evaluate() returns a 0-100 score, a penalty the
layout generator minimises, and a checklist written for the owner.
"""
from __future__ import annotations

ZONE_NAMES = {"NW": "north-west", "N": "north", "NE": "north-east", "W": "west", "C": "the centre",
              "E": "east", "SW": "south-west", "S": "south", "SE": "south-east"}
_GRID = [["NW", "N", "NE"], ["W", "C", "E"], ["SW", "S", "SE"]]
WET = ("bathroom",)
SIDE_OF = {"N": "north", "E": "east", "S": "south", "W": "west"}


def _to_north_up(x, y, north):
    """Rotate plan coordinates so north is up (y small = north, x large = east)."""
    if north == "right":
        return -y, x
    if north == "down":
        return -x, -y
    if north == "left":
        return y, -x
    return x, y


def side_to_compass(side: str, north: str = "up") -> str:
    """Which compass side ("N", "E", ...) a plan side ("N" = top of the drawing) faces."""
    order = ["N", "E", "S", "W"]
    turn = {"up": 0, "right": 3, "down": 2, "left": 1}[north]
    return order[(order.index(side) + turn) % 4]


def evaluate(rooms: list[dict], entrance: tuple | None = None, north: str = "up", entrance_side: str | None = None):
    """rooms: [{kind, name, x0, y0, x1, y1}]; entrance: (x, y) of the front door, or entrance_side
    ("N"/"E"/"S"/"W" in compass terms) when the side is known. Returns {score, penalty, checks}."""
    pts = []
    for r in rooms:
        x0, y0 = _to_north_up(r["x0"], r["y0"], north)
        x1, y1 = _to_north_up(r["x1"], r["y1"], north)
        pts.append({**r, "x0": min(x0, x1), "y0": min(y0, y1), "x1": max(x0, x1), "y1": max(y0, y1)})
    if not pts:
        return {"score": None, "penalty": 0.0, "checks": []}
    X0, Y0 = min(r["x0"] for r in pts), min(r["y0"] for r in pts)
    X1, Y1 = max(r["x1"] for r in pts), max(r["y1"] for r in pts)
    W, H = max(1e-6, X1 - X0), max(1e-6, Y1 - Y0)

    def zone(px, py):
        col = min(2, max(0, int(3 * (px - X0) / W)))
        row = min(2, max(0, int(3 * (py - Y0) / H)))
        return _GRID[row][col]

    for r in pts:
        r["zone"] = zone((r["x0"] + r["x1"]) / 2, (r["y0"] + r["y1"]) / 2)

    checks, penalty = [], 0.0

    def add(rule, status, detail, cost):
        nonlocal penalty
        checks.append({"rule": rule, "status": status, "detail": detail})
        penalty += cost

    def where(r):
        return ZONE_NAMES[r["zone"]]

    kitchens = [r for r in pts if r["kind"] == "kitchen"]
    for k in kitchens:
        if k["zone"] == "SE":
            add("Kitchen", "pass", "In the south-east (Agni corner).", 0)
        elif k["zone"] == "NW":
            add("Kitchen", "warn", "In the north-west: the accepted alternative to the south-east.", 0.5)
        else:
            add("Kitchen", "fail", f"In the {where(k)}; Vastu places it in the south-east (or north-west).", 2)

    masters = [r for r in pts if r["kind"] == "master_bedroom"] or \
        sorted((r for r in pts if r["kind"] == "bedroom"), key=lambda r: -(r["x1"] - r["x0"]) * (r["y1"] - r["y0"]))[:1]
    for m in masters:
        if m["zone"] == "SW":
            add("Master bedroom", "pass", "In the south-west.", 0)
        elif m["zone"] in ("S", "W"):
            add("Master bedroom", "warn", f"In the {where(m)}; the south-west is ideal.", 0.5)
        else:
            add("Master bedroom", "fail", f"In the {where(m)}; Vastu places it in the south-west.", 2)

    wet = [r for r in pts if r["kind"] in WET]
    bad_ne = [r for r in wet if r["zone"] == "NE"]
    bad_c = [r for r in wet if r["zone"] == "C"]
    if bad_ne:
        add("Toilets and bathrooms", "fail", f"{', '.join(r['name'] for r in bad_ne)} in the north-east, which should stay clean and light.",
            2 * len(bad_ne))
    if bad_c:
        add("Toilets and bathrooms", "fail", f"{', '.join(r['name'] for r in bad_c)} in the centre of the house.", 1.5 * len(bad_c))
    if wet and not bad_ne and not bad_c:
        add("Toilets and bathrooms", "pass", "None in the north-east or the centre.", 0)

    centre = [r for r in pts if r["zone"] == "C" and r["kind"] in ("kitchen", "bedroom", "master_bedroom")]
    if centre:
        add("Centre (Brahmasthan)", "warn", f"{', '.join(r['name'] for r in centre)} in the centre, which should stay open.", len(centre))
    else:
        add("Centre (Brahmasthan)", "pass", "The centre is open space.", 0)

    side = entrance_side
    if side is None and entrance is not None:
        ex, ey = _to_north_up(entrance[0], entrance[1], north)
        d = {"N": abs(ey - Y0), "S": abs(ey - Y1), "W": abs(ex - X0), "E": abs(ex - X1)}
        side = min(d, key=d.get)
    if side:
        if side in ("N", "E"):
            add("Entrance", "pass", f"The front door faces {SIDE_OF[side]}.", 0)
        else:
            add("Entrance", "warn", f"The front door faces {SIDE_OF[side]}; north or east entrances are preferred "
                                    "(on a south- or west-facing plot, place it towards the east or north end).", 1)

    living = [r for r in pts if r["kind"] == "living"]
    for lv in living[:1]:
        if lv["zone"] in ("N", "E", "NE", "NW", "C"):
            add("Living room", "pass", f"In the {where(lv)}.", 0)
        else:
            add("Living room", "warn", f"In the {where(lv)}; the north, east or north-east is preferred.", 0.5)

    pooja = [r for r in pts if r["kind"] == "study" or "pooja" in (r.get("name") or "").lower()]
    for pj in pooja[:1]:
        if pj["zone"] == "NE":
            add("Pooja / study", "pass", "In the north-east.", 0)
        else:
            add("Pooja / study", "warn", f"In the {where(pj)}; the north-east suits a pooja room or study.", 0.5)

    score = max(0, round(100 - 10 * penalty))
    return {"score": score, "penalty": penalty, "checks": checks}


def rooms_from_elements(elements: list[dict]):
    """(rooms, entrance point) from plan elements; the entrance is the door on the outline nearest the living room."""
    rooms = [{"kind": e.get("kind"), "name": e.get("name") or e.get("kind"), "x0": e["left"],
              "y0": e["top"] - e["height"] / 2, "x1": e["left"] + e["width"], "y1": e["top"] + e["height"] / 2}
             for e in elements if e.get("type") == "room" and e.get("kind") and (e.get("floor") or 1) == 1]
    if not rooms:
        return rooms, None
    X0, Y0 = min(r["x0"] for r in rooms), min(r["y0"] for r in rooms)
    X1, Y1 = max(r["x1"] for r in rooms), max(r["y1"] for r in rooms)
    living = next((r for r in rooms if r["kind"] == "living"), rooms[0])
    lc = ((living["x0"] + living["x1"]) / 2, (living["y0"] + living["y1"]) / 2)
    best = None
    import math
    for e in elements:
        if e.get("type") != "door" or (e.get("floor") or 1) != 1:
            continue
        a = math.radians(e.get("angle") or 0)
        cx, cy = e["left"] + e["width"] / 2 * math.cos(a), e["top"] + e["width"] / 2 * math.sin(a)
        edge = min(abs(cx - X0), abs(cx - X1), abs(cy - Y0), abs(cy - Y1))
        if edge > 12:
            continue                                    # an inside door
        d = math.hypot(cx - lc[0], cy - lc[1])
        if best is None or d < best[0]:
            best = (d, (cx, cy))
    return rooms, best[1] if best else None
