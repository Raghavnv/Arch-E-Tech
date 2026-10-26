"""
Reference house plans drawn on a 0.5 m grid (1 character = 1 cell = 0.5 m).

Each plan is an ASCII drawing. Every letter is one room and must be a solid
rectangle; '.' is outside the house (so L / U shaped footprints are possible).
The legend maps each letter to a room kind.  These are shown to the LLM as
examples of how real houses are organised and are also stretched / mirrored
by the backend when it needs a plan without the LLM.

Conventions that make a plan read as a house and not a hotel:
  * living / dining / kitchen form one day zone with the entrance on the living room
  * bedrooms sit in a wing of their own, reached from a short lobby ("H", <= 5 doors)
    or directly from the living area, never along a long corridor
  * a master bedroom has its own ensuite, bathrooms sit next to bedrooms
"""
from __future__ import annotations

PLANS = [
    {
        "name": "studio_1bhk",
        "style": "compact",
        "legend": {"K": "kitchen", "L": "living", "M": "master_bedroom", "E": "bathroom"},
        "grid": [
            "KKKKKKLLLLLLLLLL",
            "KKKKKKLLLLLLLLLL",
            "KKKKKKLLLLLLLLLL",
            "KKKKKKLLLLLLLLLL",
            "KKKKKKLLLLLLLLLL",
            "KKKKKKLLLLLLLLLL",
            "KKKKKKLLLLLLLLLL",
            "KKKKKKLLLLLLLLLL",
            "KKKKKKLLLLLLLLLL",
            "MMMMMMMMMMMEEEEE",
            "MMMMMMMMMMMEEEEE",
            "MMMMMMMMMMMEEEEE",
            "MMMMMMMMMMMEEEEE",
            "MMMMMMMMMMMEEEEE",
            "MMMMMMMMMMMEEEEE",
            "MMMMMMMMMMMEEEEE",
        ],
    },
    {
        "name": "twobhk_lobby",
        "style": "wing",
        "legend": {"K": "kitchen", "D": "dining", "L": "living", "B": "bedroom", "M": "master_bedroom",
                   "E": "bathroom", "T": "bathroom", "H": "hallway"},
        "grid": [
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "KKKKKKKDDDDDDDLLLLLLLLLLLL",
            "BBBBBBBBBHHHHHMMMMMMMMEEEE",
            "BBBBBBBBBHHHHHMMMMMMMMEEEE",
            "BBBBBBBBBHHHHHMMMMMMMMEEEE",
            "BBBBBBBBBHHHHHMMMMMMMMEEEE",
            "BBBBBBBBBHHHHHMMMMMMMMEEEE",
            "BBBBBBBBBTTTTTMMMMMMMMEEEE",
            "BBBBBBBBBTTTTTMMMMMMMMEEEE",
            "BBBBBBBBBTTTTTMMMMMMMMEEEE",
            "BBBBBBBBBTTTTTMMMMMMMMEEEE",
            "BBBBBBBBBTTTTTMMMMMMMMEEEE",
        ],
    },
    {
        "name": "threebhk_l_bungalow",
        "style": "wing",
        "legend": {"K": "kitchen", "D": "dining", "L": "living", "M": "master_bedroom", "E": "bathroom",
                   "B": "bedroom", "C": "bedroom", "T": "bathroom", "H": "hallway"},
        "grid": [
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "KKKKKKKKKDDDDDDDDLLLLLLLLLLLLLLL",
            "MMMMMMMMMHHHHHBBBBBBBBB.........",
            "MMMMMMMMMHHHHHBBBBBBBBB.........",
            "MMMMMMMMMHHHHHBBBBBBBBB.........",
            "MMMMMMMMMHHHHHBBBBBBBBB.........",
            "MMMMMMMMMHHHHHBBBBBBBBB.........",
            "MMMMMMMMMHHHHHBBBBBBBBB.........",
            "MMMMMMMMMHHHHHBBBBBBBBB.........",
            "MMMMMMMMMHHHHHCCCCCCCCC.........",
            "MMMMMMMMMHHHHHCCCCCCCCC.........",
            "EEEEEEEEETTTTTCCCCCCCCC.........",
            "EEEEEEEEETTTTTCCCCCCCCC.........",
            "EEEEEEEEETTTTTCCCCCCCCC.........",
            "EEEEEEEEETTTTTCCCCCCCCC.........",
            "EEEEEEEEETTTTTCCCCCCCCC.........",
        ],
    },
    {
        "name": "threebhk_central_living",
        "style": "compact",
        "legend": {"K": "kitchen", "D": "dining", "L": "living", "M": "master_bedroom", "E": "bathroom",
                   "B": "bedroom", "C": "bedroom", "S": "study", "U": "utility", "T": "bathroom"},
        "grid": [
            "EEEEEMMMMMMMMMMBBBBBBBBCCCCCCC",
            "EEEEEMMMMMMMMMMBBBBBBBBCCCCCCC",
            "EEEEEMMMMMMMMMMBBBBBBBBCCCCCCC",
            "EEEEEMMMMMMMMMMBBBBBBBBCCCCCCC",
            "EEEEEMMMMMMMMMMBBBBBBBBCCCCCCC",
            "EEEEEMMMMMMMMMMBBBBBBBBCCCCCCC",
            "EEEEEMMMMMMMMMMBBBBBBBBCCCCCCC",
            "EEEEEMMMMMMMMMMBBBBBBBBCCCCCCC",
            "KKKKKKKKDDDDDDDDLLLLLLLLLLLLLL",
            "KKKKKKKKDDDDDDDDLLLLLLLLLLLLLL",
            "KKKKKKKKDDDDDDDDLLLLLLLLLLLLLL",
            "KKKKKKKKDDDDDDDDLLLLLLLLLLLLLL",
            "KKKKKKKKDDDDDDDDLLLLLLLLLLLLLL",
            "KKKKKKKKDDDDDDDDLLLLLLLLLLLLLL",
            "KKKKKKKKDDDDDDDDLLLLLLLLLLLLLL",
            "KKKKKKKKDDDDDDDDLLLLLLLLLLLLLL",
            "UUUUUUSSSSSSSS..........TTTTTT",
            "UUUUUUSSSSSSSS..........TTTTTT",
            "UUUUUUSSSSSSSS..........TTTTTT",
            "UUUUUUSSSSSSSS..........TTTTTT",
            "UUUUUUSSSSSSSS..........TTTTTT",
            "UUUUUUSSSSSSSS..........TTTTTT",
        ],
    },
    {
        "name": "fourbhk_villa_wings",
        "style": "split",
        "legend": {"K": "kitchen", "D": "dining", "L": "living", "M": "master_bedroom", "E": "bathroom",
                   "B": "bedroom", "C": "bedroom", "F": "bedroom", "H": "hallway", "G": "hallway",
                   "S": "study", "U": "bathroom", "V": "bathroom"},
        "grid": [
            "MMMMMMMMMHHHHHBBBBBBBBB...............",
            "MMMMMMMMMHHHHHBBBBBBBBB...............",
            "MMMMMMMMMHHHHHBBBBBBBBB...............",
            "MMMMMMMMMHHHHHBBBBBBBBB...............",
            "MMMMMMMMMHHHHHBBBBBBBBB...............",
            "MMMMMMMMMHHHHHBBBBBBBBB...............",
            "MMMMMMMMMHHHHHCCCCCCCCC...............",
            "EEEEEEEEEHHHHHCCCCCCCCC...............",
            "EEEEEEEEEHHHHHCCCCCCCCC...............",
            "EEEEEEEEEHHHHHCCCCCCCCC...............",
            "EEEEEEEEEHHHHHCCCCCCCCC...............",
            "EEEEEEEEEHHHHHCCCCCCCCC...............",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "KKKKKKKKKDDDDDDDDDLLLLLLLLLLLLLLLL....",
            "...............FFFFFFFFFGGGGGSSSSSSSSS",
            "...............FFFFFFFFFGGGGGSSSSSSSSS",
            "...............FFFFFFFFFGGGGGSSSSSSSSS",
            "...............FFFFFFFFFGGGGGSSSSSSSSS",
            "...............FFFFFFFFFGGGGGSSSSSSSSS",
            "...............FFFFFFFFFGGGGGSSSSSSSSS",
            "...............FFFFFFFFFGGGGGSSSSSSSSS",
            "...............UUUUUUUUUGGGGGVVVVVVVVV",
            "...............UUUUUUUUUGGGGGVVVVVVVVV",
            "...............UUUUUUUUUGGGGGVVVVVVVVV",
            "...............UUUUUUUUUGGGGGVVVVVVVVV",
            "...............UUUUUUUUUGGGGGVVVVVVVVV",
        ],
    },
]


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
