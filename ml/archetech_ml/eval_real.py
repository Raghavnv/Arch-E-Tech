"""Run the reader on real floor plans (data/real_test) and save a report.

    python -m archetech_ml.eval_real runs/<name>/best.pt [--set modern]

There are no hand labels for these plans, so this reports what can be checked automatically
(walls / rooms / doors / windows found, room names read, where the scale came from) and saves
overlay pictures (runs/<name>/real_<set>.png: drawing | detected plan over the drawing) to judge by eye.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

from .reader import PlanReader
from .resplan import DATA

REAL = DATA.parent.parent / "real_test"
COLORS = {"wall": (20, 20, 20), "door": (230, 50, 50), "window": (40, 120, 230)}


def overlay(img: Image.Image, elements, m) -> Image.Image:
    """Draw plan elements back onto the drawing using the inverse of image_to_plan."""
    a, b, c, d, e, f = m["a"], m["b"], m["c"], m["d"], m["e"], m["f"]
    det = a * d - b * c
    def to_px(x, y):
        x, y = x - e, y - f
        return ((d * x - c * y) / det, (-b * x + a * y) / det)
    out = img.convert("RGB").copy()
    dr = ImageDraw.Draw(out, "RGBA")
    k = math.sqrt(abs(det))
    for el in elements:
        if el["type"] == "room":
            x0, y0 = to_px(el["left"], el["top"] - el["height"] / 2)
            x1, y1 = to_px(el["left"] + el["width"], el["top"] + el["height"] / 2)
            dr.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], fill=(255, 190, 90, 50))
            cx, cy = to_px(el["left"] + el["width"] / 2, el["top"])
            dr.text((cx, cy), el["name"], fill=(150, 60, 0, 255), anchor="mm")
    for el in elements:
        if el["type"] in COLORS:
            ang = math.radians(el["angle"])
            p0 = to_px(el["left"], el["top"])
            p1 = to_px(el["left"] + el["width"] * math.cos(ang), el["top"] + el["width"] * math.sin(ang))
            dr.line([p0, p1], fill=COLORS[el["type"]] + (230,), width=max(2, int(4 / k)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ckpt")
    ap.add_argument("--set", default="modern", choices=["modern", "older", "all"])
    a = ap.parse_args()
    reader = PlanReader(a.ckpt)
    manifest = json.loads((REAL / "manifest.json").read_text())
    rows, report = [], []
    for item in manifest:
        if a.set != "all" and item["set"] != a.set:
            continue
        data = (REAL / item["file"]).read_bytes()
        try:
            res = reader.read(data, "image/jpeg")
        except Exception as ex:
            report.append({"file": item["file"], "error": repr(ex)})
            continue
        info = res["info"]
        report.append({"file": item["file"], **{k: info.get(k) for k in
                       ("walls", "rooms", "doors", "windows", "rooms_named_from_text", "scale", "rotation_deg", "seconds")}})
        img = Image.open(REAL / item["file"]).convert("RGB")
        if res["elements"]:
            ov = overlay(img, res["elements"], info["image_to_plan"])
        else:
            ov = img
        for im in (img, ov):
            im.thumbnail((520, 520))
        rows.append((img, ov))
    run = Path(a.ckpt).parent
    (run / f"real_{a.set}.json").write_text(json.dumps(report, indent=1))
    if rows:
        W = 1040
        H = sum(max(r[0].height, r[1].height) for r in rows)
        sheet = Image.new("RGB", (W, H), "white")
        y = 0
        for img, ov in rows:
            sheet.paste(img, (0, y))
            sheet.paste(ov, (520, y))
            y += max(img.height, ov.height)
        sheet.save(run / f"real_{a.set}.png")
    for r in report:
        print(r)
    print("saved", run / f"real_{a.set}.png")


if __name__ == "__main__":
    main()
