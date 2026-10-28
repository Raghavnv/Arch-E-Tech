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
    _plan("twobhk_front_back", "wing", [
        (10, "K7 D8 L11"),
        (9, "E5 M11 B10"),
        (5, ".16 T5 .5"),
    ]),
    _plan("twobhk_side_by_side", "wing", [
        (10, "E5 M10 L10 K7"),
        (8, "T5 B10 L10 D7"),
    ]),
    _plan("twobhk_sandwich", "compact", [
        (8, "E5 M10 B9"),
        (9, "K7 D7 L10"),
        (5, ".14 T5 .5"),
    ]),
    _plan("twobhk_wing_right", "wing", [
        (9, "K7 D7 L12"),
        (9, ".2 T5 B7 M12"),
        (5, ".14 E5 .7"),
    ]),
    # ---- 3 bedrooms ------------------------------------------------------------------------
    _plan("threebhk_central_living", "compact", [
        (8, "E5 M10 B8 C7"),
        (9, "K8 D8 L14"),
        (6, "W6 S8 .10 T6"),
    ]),
    _plan("threebhk_l_lounge", "wing", [
        (10, "K8 D8 L17"),
        (9, "M10 N7 B9 .7"),
        (8, "E5 T5 N7 C9 .7"),
    ]),
    _plan("threebhk_bungalow_row", "wing", [
        (12, "K8 D8 L16"),
        (9, "E5 M11 B10 C6"),
        (5, ".16 T5 .11"),
    ]),
    _plan("threebhk_sandwich", "compact", [
        (9, "E5 M11 B8 C8"),
        (10, "K8 D8 L16"),
        (6, "W8 S8 T5 .11"),
    ]),
    _plan("threebhk_three_columns", "wing", [
        (9, "E5 M10 L12 K8"),
        (8, "T5 B10 L12 D8"),
        (8, ".10 V5 C10 .10"),
    ]),
    # ---- 4 bedrooms ------------------------------------------------------------------------
    _plan("fourbhk_sandwich", "split", [
        (9, "E5 M11 B9 C9"),
        (11, "K8 D9 L17"),
        (8, ".3 U5 F10 S8 .8"),
    ]),
    _plan("fourbhk_z_lounge", "split", [
        (9, "M12 N7 B9 .13"),
        (8, "E6 T6 N7 C9 .13"),
        (12, "K8 D9 L19 .5"),
        (8, ".18 F10 S9 .4"),
        (5, ".18 V5 .18"),
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
