"""Score a trained reader on the held-out test plans and save side-by-side previews.

    python -m archetech_ml.evaluate runs/<name>/best.pt [--images more/*.png]

Prints per-class IoU on data/rendered/test and writes runs/<name>/test.json and
runs/<name>/preview.png (drawing | correct labels | prediction). --images also runs the model on
any other drawings (e.g. real scans) and saves drawing | prediction pairs to preview_extra.png.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import segmentation_models_pytorch as smp
import torch
from PIL import Image
from torch.utils.data import DataLoader

from .render import colorize
from .train import MEAN, STD, Rendered, evaluate


def load(ckpt_path, dev):
    ck = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    model = smp.Unet(ck["encoder"], encoder_weights=None, classes=len(ck["classes"]))
    model.load_state_dict(ck["model"])
    return model.to(dev).eval(), ck


@torch.no_grad()
def predict(model, img: Image.Image, dev) -> np.ndarray:
    """Label image (class index per pixel) for a drawing of any size."""
    w, h = img.size
    W, H = (w + 31) // 32 * 32, (h + 31) // 32 * 32        # the U-Net needs multiples of 32
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(img.convert("RGB"), (0, 0))
    x = torch.from_numpy(np.array(canvas)).permute(2, 0, 1).float() / 255
    x = ((x - MEAN) / STD)[None].to(dev)
    with torch.autocast("mps", dtype=torch.float16, enabled=dev.type == "mps"):
        out = model(x)
    return out.argmax(1)[0, :h, :w].cpu().numpy().astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ckpt")
    ap.add_argument("--images", nargs="*", default=[])
    ap.add_argument("--n_preview", type=int, default=6)
    a = ap.parse_args()
    dev = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    model, ck = load(a.ckpt, dev)
    run = Path(a.ckpt).parent

    test = Rendered("test")
    m = evaluate(model, DataLoader(test, batch_size=8, num_workers=4), dev)
    (run / "test.json").write_text(json.dumps({"epoch": ck["epoch"], **m}, indent=2))
    print(f"test ({len(test)} plans): pixel accuracy {m['pixel_acc']:.4f}, mean IoU {m['miou']:.4f}")
    for k, v in m["iou"].items():
        print(f"  {k:<11} {v:.3f}")

    rows = []
    for p in test.items[:: max(1, len(test.items) // a.n_preview)][: a.n_preview]:
        img = Image.open(p).convert("RGB")
        truth = colorize(np.array(Image.open(p.with_name(p.stem + "_mask.png"))))
        pred = colorize(predict(model, img, dev))
        rows.append([img, truth, pred])
    _sheet(rows, run / "preview.png")
    if a.images:
        rows = []
        for f in a.images:
            img = Image.open(f).convert("RGB")
            img.thumbnail((768, 768))
            rows.append([img, colorize(predict(model, img, dev))])
        _sheet(rows, run / "preview_extra.png")
    print("previews in", run)


def _sheet(rows, path):
    w = max(sum(i.width for i in r) for r in rows)
    h = sum(max(i.height for i in r) for r in rows)
    sheet = Image.new("RGB", (w, h), "white")
    y = 0
    for r in rows:
        x = 0
        for im in r:
            sheet.paste(im, (x, y))
            x += im.width
        y += max(i.height for i in r)
    sheet.save(path)


if __name__ == "__main__":
    main()
