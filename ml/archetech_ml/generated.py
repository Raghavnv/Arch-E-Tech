"""Training drawings from Arch-E-Tech's own layout generator (backend/layout_generator.py).

    python -m archetech_ml.generated --count 3000 [--variants 2]

Random briefs (1-6 bedrooms, 450-4200 sq ft, optional study / utility / powder room) are laid out by
the generator, converted to the ResPlan polygon format and rendered like the ResPlan plans, into
data/rendered/train/g<i>_<variant>.png. This adds layouts ResPlan lacks (hallways, lobbies, wings,
big houses) with exact labels and no licensing questions.
"""
from __future__ import annotations

import argparse
import random
import sys
from multiprocessing import Pool
from pathlib import Path

from PIL import Image
from shapely.geometry import LineString, MultiPolygon, box
from shapely.ops import unary_union

from .make_dataset import OUT
from .render import render

BACKEND = Path(__file__).resolve().parents[2] / "backend"
# app room kinds -> ResPlan keys (dining and lounge are part of the open living area there)
KIND = {"living": "living", "dining": "living", "lounge": "living", "master_bedroom": "bedroom",
        "bedroom": "bedroom", "kitchen": "kitchen", "bathroom": "bathroom", "balcony": "balcony",
        "hallway": "storage", "study": "storage", "utility": "storage"}


def _brief(rng: random.Random) -> str:
    beds = rng.choices([1, 2, 3, 4, 5, 6], [8, 25, 30, 20, 10, 7])[0]
    sqft = int(rng.uniform(380, 750) * beds ** 0.8 + rng.uniform(0, 400))
    parts = [f"{beds} bedroom house", f"{sqft} sq ft"]
    for word, p in (("with a study", 0.25), ("utility", 0.25), ("powder room", 0.2), ("open kitchen", 0.3)):
        if rng.random() < p:
            parts.append(word)
    return ", ".join(parts)


def _segment(e):
    import math
    a = math.radians(e.get("angle") or 0)
    return LineString([(e["left"], e["top"]), (e["left"] + e["width"] * math.cos(a), e["top"] + e["width"] * math.sin(a))])


def to_plan(elements, rng: random.Random) -> dict:
    """App elements -> a ResPlan-style dict of shapely geometry (20 units = 1 m in both)."""
    t = rng.uniform(0.15, 0.3) * 20                      # wall thickness in plan units
    walls = unary_union([_segment(e).buffer(t / 2, cap_style=3) for e in elements if e["type"] == "wall"])
    plan = {"wall": walls}
    for typ in ("door", "window"):
        plan[typ] = unary_union([_segment(e).buffer(t / 2 + 0.5, cap_style=2) for e in elements
                                 if e["type"] == typ and e["width"] > 2])
    rooms: dict = {}
    for e in elements:
        if e["type"] != "room" or e.get("kind") not in KIND:
            continue
        r = box(e["left"], e["top"] - e["height"] / 2, e["left"] + e["width"], e["top"] + e["height"] / 2)
        rooms.setdefault(KIND[e["kind"]], []).append(r)
    for key, rs in rooms.items():
        plan[key] = unary_union(rs)
    plan["inner"] = unary_union([r for rs in rooms.values() for r in rs]) if rooms else MultiPolygon()
    return plan


_ready = False


def _setup():
    global _ready
    if not _ready:
        sys.path.insert(0, str(BACKEND))
        _ready = True


def _job(args):
    i, variants, size = args
    _setup()
    import floorplan_builder as fb
    import layout_generator as lg
    rng = random.Random(f"gen-{i}")
    if all((OUT / "train" / f"g{i}_{v}.png").exists() for v in range(variants)):
        return 1
    try:
        program = fb.build_program([], 0, _brief(rng))
        lay = lg.generate(program, random.Random(rng.random()), budget_s=0.4, want=8)
        if lay is None:
            return 0
        plan = to_plan(lay.elements(), rng)
        for v in range(variants):
            img, mask = render(plan, size, random.Random(f"gen-{i}-{v}"))
            img.save(OUT / "train" / f"g{i}_{v}.png")
            Image.fromarray(mask).save(OUT / "train" / f"g{i}_{v}_mask.png")
        return 1
    except Exception:
        return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=3000)
    ap.add_argument("--variants", type=int, default=2)
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    (OUT / "train").mkdir(parents=True, exist_ok=True)
    with Pool(a.workers) as pool:
        done = sum(pool.imap_unordered(_job, [(i, a.variants, a.size) for i in range(a.count)], chunksize=8))
    print(f"generated {done}/{a.count} plans ({done * a.variants} drawings) into {OUT / 'train'}")


if __name__ == "__main__":
    main()
