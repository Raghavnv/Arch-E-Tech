"""
Reference house plans drawn on a 0.5 m grid (1 cell = 0.5 m).

A plan is a stack of horizontal bands.  Each band has a height in cells and a list of
"<letter><width>" tokens laid out left to right; ".<width>" is outside the house, so
L / T / Z shaped footprints are possible.  A letter that repeats in the same columns of
consecutive bands is one taller room.  Every letter must end up a solid rectangle.

Rules every reference follows (they are what make a plan read as a house, not a hotel):
  * no corridors or lobbies: living, dining and lounge are one open space with no walls
    between them, and every bedroom opens straight off that open space
  * only the rooms that were asked for are enclosed (bedrooms, bathrooms, kitchen,
    study, utility); everything else stays open
  * the master bedroom has an ensuite and is bigger than every other bedroom
  * bedrooms are at least ~14 m2; bathrooms sit next to a bedroom or the living area
  * the entrance is on the living room; every habitable room has an outside wall
  * bedrooms are spread around the house: the master suite has its own side and never
    shares a wall with another bedroom, and bedrooms are never lined up in one long row
"""
from __future__ import annotations

LEGEND = {
    "K": "kitchen", "D": "dining", "L": "living", "N": "lounge", "W": "utility", "S": "study",
    "M": "master_bedroom", "B": "bedroom", "C": "bedroom", "F": "bedroom", "G": "bedroom", "H": "bedroom",
    "E": "bathroom", "T": "bathroom", "U": "bathroom", "V": "bathroom",
}


def _grid(bands):
    rows = []
    for h, spec in bands:
        row = ""
        for tok in spec.split():
            row += tok[0] * int(tok[1:])
        rows += [row] * h
    return rows


def _plan(name, style, bands):
    return {"name": name, "style": style, "legend": LEGEND, "grid": _grid(bands)}


PLANS = [
    # ---- 1 bedroom -------------------------------------------------------------------------
    _plan("studio_1bhk", "compact", [
        (9, "K6 L10"),
        (7, "M11 E5"),
    ]),
    _plan("onebhk_corner", "compact", [
        (9, "K6 D6 L10"),
        (8, "M12 E5 .5"),
    ]),
    # ---- 2 bedrooms ------------------------------------------------------------------------
    # master suite and second bedroom on opposite sides of the living room
    _plan("twobhk_split", "split", [
        (8, "E5 M10 L12 B8"),
        (7, ".15 K6 D6 T5 .3"),
    ]),
    # second bedroom at the front, master suite at the back
    _plan("twobhk_front_back_split", "wing", [
        (8, "B8 L13 K9"),
        (9, "T5 .3 D7 M10 E5"),
    ]),
    # the split plan with a study behind the dining room
    _plan("twobhk_split_study", "split", [
        (8, "E5 M10 L12 B8"),
        (7, ".15 K6 D6 T5 .3"),
        (6, ".21 S6 .8"),
    ]),
    # ---- 3 bedrooms ------------------------------------------------------------------------
    # master wing on one side of the day zone, children's wing on the other
    _plan("threebhk_split_wings", "split", [
        (8, "E5 M10 L14 B8"),
        (8, ".15 K7 D7 C8"),
        (5, ".29 T6 .2"),
    ]),
    # two bedrooms flank the living room at the front, master suite behind the dining room
    _plan("threebhk_master_rear", "split", [
        (8, "B8 L14 C8"),
        (6, "T5 .3 D7 K7 .8"),
        (9, ".8 M10 E4 .8"),
    ]),
    # staggered footprint: one bedroom at the front, master off the living room, one behind dining
    _plan("threebhk_staggered", "wing", [
        (8, "B8 L14 K8"),
        (8, "T5 .3 D8 M10 E4"),
        (8, ".8 C8 .14"),
    ]),
    _plan("threebhk_split_study", "split", [
        (8, "E5 M10 L14 B8"),
        (8, ".15 K7 D7 C8"),
        (6, ".22 S7 T6 .2"),
    ]),
    _plan("threebhk_l_lounge", "wing", [
        (10, "K8 D8 L17"),
        (9, "M10 N7 B9 .7"),
        (8, "E5 T5 N7 C9 .7"),
    ]),
    # ---- 4 bedrooms ------------------------------------------------------------------------
    # master suite alone at one end; two bedrooms at the other end, one behind the dining room
    _plan("fourbhk_split", "split", [
        (8, "E5 M11 L16 B8"),
        (8, ".16 K7 D9 C8"),
        (8, ".23 F8 T5 .4"),
    ]),
    # ---- 5 bedrooms ------------------------------------------------------------------------
    _plan("fivebhk_z_lounge", "split", [
        (9, "M12 N7 B9 .13"),
        (8, "E6 T6 N7 C9 .13"),
        (12, "K8 D9 L19 .5"),
        (8, ".18 F9 G9 V5"),
    ]),
]


PLANS.append(_plan("sixbhk_sandwich", "split", [
    (9, "E5 M12 B10 C9 .7"),
    (12, "K9 D9 L18 .7"),
    (8, ".3 T5 F10 G10 H8 V5 .2"),
]))


def parse(plan: dict) -> list[dict]:
    """ASCII -> [{"kind", "letter", "x", "y", "w", "h"}]; raises ValueError if a room is not a rectangle."""
    grid = plan["grid"]
    width = len(grid[0])
    if any(len(r) != width for r in grid):
        raise ValueError(f"{plan['name']}: ragged rows")
    boxes: dict[str, list[int]] = {}
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            b = boxes.setdefault(ch, [x, y, x, y])
            b[0], b[1], b[2], b[3] = min(b[0], x), min(b[1], y), max(b[2], x), max(b[3], y)
    out = []
    for ch, (x0, y0, x1, y1) in boxes.items():
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if grid[y][x] != ch:
                    raise ValueError(f"{plan['name']}: room {ch} is not a rectangle at ({x},{y})")
        if ch not in plan["legend"]:
            raise ValueError(f"{plan['name']}: letter {ch} missing from legend")
        out.append({"kind": plan["legend"][ch], "letter": ch, "x": x0, "y": y0,
                    "w": x1 - x0 + 1, "h": y1 - y0 + 1})
    return out
