"""Check vectorize() on correct label images: how much of the truth survives the trip to elements.

    python -m archetech_ml.check_vectorize [--n 200]

Renders test plans, vectorizes their true label images, draws the elements back, and compares.
"""
from __future__ import annotations

import argparse
import random
import statistics

import cv2
import numpy as np

from .render import CLASSES, render
from .resplan import load_plans, load_splits
from .vectorize import C, rasterize, straighten, vectorize


def _iou(a, b):
    return (a & b).sum() / max(1, (a | b).sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=200)
    a = ap.parse_args()
    plans = {p["id"]: p for p in load_plans()}
    ids = load_splits()["test"][: a.n]
    res = {"wall_iou": [], "room_px_acc": [], "door_ratio": [], "window_ratio": [], "scale_err": [],
           "room_ratio": []}
    for pid in ids:
        _, mask, meta = render(plans[pid], 512, random.Random(pid), with_meta=True)
        els, info = vectorize(mask)
        if not els:
            continue
        if info["rotation_deg"]:
            mask, _ = straighten(mask, info["rotation_deg"])   # compare in the straightened frame
        back = rasterize(els, mask.shape, info["px_per_m"], info["origin_px"], wall_px=info["wall_px"])
        wall_t = np.isin(mask, [C["wall"], C["door"], C["window"]])
        wall_p = np.isin(back, [C["wall"], C["door"], C["window"]])
        k = np.ones((3, 3), np.uint8)       # 1 px tolerance either way
        res["wall_iou"].append(_iou(cv2.dilate(wall_t.astype(np.uint8), k) > 0, cv2.dilate(wall_p.astype(np.uint8), k) > 0))
        inside = np.isin(mask, [C[c] for c in CLASSES[4:]])
        res["room_px_acc"].append(float((back[inside] == mask[inside]).mean()) if inside.any() else 1.0)
        for cls, key in (("door", "door_ratio"), ("window", "window_ratio")):
            n_true = cv2.connectedComponents((mask == C[cls]).astype(np.uint8))[0] - 1
            n_found = sum(e["type"] == cls for e in els)
            if n_true:
                res[key].append(n_found / n_true)
        n_rooms = cv2.connectedComponents((inside & ~wall_t).astype(np.uint8), connectivity=4)[0] - 1
        res["room_ratio"].append(info["rooms"] / max(1, n_rooms))
        res["scale_err"].append(abs(info["px_per_m"] / meta["px_per_m"] - 1))
    print(f"{len(res['wall_iou'])} plans")
    for k, v in res.items():
        print(f"  {k:<13} median {statistics.median(v):.3f}  mean {statistics.mean(v):.3f}")


if __name__ == "__main__":
    main()
