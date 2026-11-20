"""Turn shared user imports (exported by backend/export_plan_imports.py) into training pairs.

    python -m archetech_ml.user_data data/user_imports [--use project_now|accepted]

For each import, the plan the owner ended up with (by default the project's ground floor as it is
now, i.e. with their corrections; or the plan as accepted) is drawn back onto their drawing with the
inverse of the image -> plan mapping, giving a label image for a real-world drawing. Pairs are
written to data/rendered/train/u<id>.png (+ _mask.png), so the next training run includes them.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from .make_dataset import OUT
from .reader import load_image
from .render import CLS

KIND = {"living": "living", "dining": "living", "lounge": "living", "master_bedroom": "bedroom", "bedroom": "bedroom",
        "kitchen": "kitchen", "bathroom": "bathroom", "balcony": "balcony", "hallway": "other_room",
        "study": "other_room", "utility": "other_room"}
LONGEST = 768           # the size the reader works at


def label_image(elements, size, m, wall_px):
    """Label image (CLS indices) of the plan elements on a drawing of `size`, via the inverse of m."""
    a, b, c, d, e, f = m["a"], m["b"], m["c"], m["d"], m["e"], m["f"]
    det = a * d - b * c

    def px(x, y):
        x, y = x - e, y - f
        return ((d * x - c * y) / det, (-b * x + a * y) / det)

    mask = Image.new("L", size, CLS["background"])
    dr = ImageDraw.Draw(mask)
    for el in elements:
        if el.get("type") == "room" and el.get("kind") in KIND:
            corners = [px(el["left"], el["top"] - el["height"] / 2), px(el["left"] + el["width"], el["top"] - el["height"] / 2),
                       px(el["left"] + el["width"], el["top"] + el["height"] / 2), px(el["left"], el["top"] + el["height"] / 2)]
            dr.polygon(corners, fill=CLS[KIND[el["kind"]]])
    for typ in ("wall", "window", "door"):
        for el in elements:
            if el.get("type") != typ:
                continue
            ang = math.radians(el.get("angle") or 0)
            p0 = px(el["left"], el["top"])
            p1 = px(el["left"] + el["width"] * math.cos(ang), el["top"] + el["width"] * math.sin(ang))
            dr.line([p0, p1], fill=CLS[typ], width=max(1, int(round(wall_px))))
    return mask


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--use", default="project_now", choices=["project_now", "accepted"])
    a = ap.parse_args()
    (OUT / "train").mkdir(parents=True, exist_ok=True)
    n = 0
    for d in sorted(Path(a.folder).glob("import_*")):
        info = json.loads((d / "info.json").read_text())
        labels = d / f"{a.use}.json"
        if not labels.exists():
            labels = d / "accepted.json"
        elements = json.loads(labels.read_text())
        m = info.get("image_to_plan_accepted") or info.get("image_to_plan")
        drawing = next(d.glob("drawing.*"), None)
        if not elements or not m or drawing is None:
            continue
        img = load_image(drawing.read_bytes(), info.get("content_type", ""))
        wall_px = (info.get("wall_px") or 6) / (info.get("work_scale") or 1)
        mask = label_image(elements, img.size, m, wall_px)
        s = min(1.0, LONGEST / max(img.size))
        if s < 1:
            new = (round(img.width * s), round(img.height * s))
            img, mask = img.resize(new, Image.LANCZOS), mask.resize(new, Image.NEAREST)
        # training crops are 384 px: pad small drawings with paper
        W, H = max(img.width, 512), max(img.height, 512)
        canvas, mcanvas = Image.new("RGB", (W, H), (255, 255, 255)), Image.new("L", (W, H), CLS["background"])
        canvas.paste(img, (0, 0))
        mcanvas.paste(mask, (0, 0))
        name = d.name.replace("import_", "u")
        canvas.save(OUT / "train" / f"{name}_0.png")
        mcanvas.save(OUT / "train" / f"{name}_0_mask.png")
        n += 1
        counts = np.bincount(np.asarray(mcanvas).ravel(), minlength=len(CLS))
        print(d.name, "->", name, "label pixels:", {k: int(counts[v]) for k, v in CLS.items() if counts[v]})
    print(f"{n} user drawings added to {OUT / 'train'}")


if __name__ == "__main__":
    main()
