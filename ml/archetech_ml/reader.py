"""Read a floor plan drawing end to end: file -> image -> labels (model) + text (OCR) -> plan elements.

    reader = PlanReader("runs/resplan_r34_v1/best.pt")
    result = reader.read(open("plan.pdf", "rb").read(), "application/pdf")

result = {"elements": [...], "info": {...}, "texts": [...], "image": {"width", "height"}}
info["image_to_plan"] maps pixels of the *uploaded* image (first page, for a PDF) to plan units.
"""
from __future__ import annotations

import base64
import io
import time

import numpy as np
import torch
from PIL import Image, ImageOps

from .evaluate import load, predict
from .ocr import read_text
from .vectorize import vectorize

MAX_PIXELS = 40_000_000         # refuse decompression bombs
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def load_image(data: bytes, content_type: str = "") -> Image.Image:
    """An RGB image from PNG / JPEG / WebP bytes, or the first page of a PDF rendered at ~150 dpi."""
    if content_type == "application/pdf" or data[:5] == b"%PDF-":
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(data)
        try:
            page = pdf[0]
            w, h = page.get_size()                      # points (1/72 inch)
            scale = min(150 / 72, 2600 / max(w, h))
            return page.render(scale=scale).to_pil().convert("RGB")
        finally:
            pdf.close()
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)                  # phone photos come rotated
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img)
    return img.convert("RGB")


class PlanReader:
    def __init__(self, checkpoint: str, device: str | None = None, work_size: int = 768):
        if device is None:
            device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.device = torch.device(device)
        self.model, ck = load(checkpoint, self.device)
        self.version = f"{ck['encoder']}-epoch{ck['epoch']}"
        self.work_size = work_size

    def read(self, data: bytes, content_type: str = "", px_per_m: float | None = None, use_ocr: bool = True):
        t0 = time.time()
        img = load_image(data, content_type)
        W, H = img.size
        s = min(1.0, self.work_size / max(W, H))           # the model reads a smaller copy
        small = img.resize((max(1, round(W * s)), max(1, round(H * s))), Image.LANCZOS) if s < 1 else img
        mask = predict(self.model, small, self.device)
        texts = read_text(img) if use_ocr else []
        texts_small = [{**t, "x": t["x"] * s, "y": t["y"] * s} for t in texts]
        elements, info = vectorize(mask, px_per_m=px_per_m * s if px_per_m else None, texts=texts_small)
        if "image_to_plan" in info:
            m = info["image_to_plan"]                       # from small-copy pixels to original pixels
            for key in ("a", "b", "c", "d"):
                m[key] *= s
            info["px_per_m"] = round(info["px_per_m"] / s, 3)
        info.update({"model": self.version, "seconds": round(time.time() - t0, 2), "work_scale": round(s, 4)})
        info.pop("origin_px", None)
        return {"elements": elements, "info": info, "texts": [t["text"] for t in texts],
                "image": {"width": W, "height": H, "preview": _preview(img)},
                "mask_counts": np.bincount(mask.ravel(), minlength=10).tolist()}


def _preview(img: Image.Image, longest: int = 1200) -> str:
    """A small JPEG of the drawing as a data URL, shown under the detected plan for checking.
    It is drawn at the original width and height, so image_to_plan applies to it unchanged."""
    small = img.copy()
    small.thumbnail((longest, longest))
    buf = io.BytesIO()
    small.save(buf, "JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
