"""Text on floor plans: room names and room dimensions.

read_text(image)            -> [{"text", "x", "y", "w", "h", "score"}] in image pixels
room_kind(text)             -> app room kind for a label like "M. BEDROOM", "TOI.", "SIT OUT" (or None)
parse_dimensions(text)      -> (a_m, b_m) for "12'0\" x 10'6\"", "10.17 X 5.41", "3600 x 3000" (or None)

OCR is RapidOCR (Apache 2.0) with its bundled PP-OCR models, run on CPU.
"""
from __future__ import annotations

import re
from functools import lru_cache

import numpy as np

# order matters: the first match wins ("MASTER BED" is a master bedroom, "KITCHEN/DINING" a kitchen)
KIND_WORDS = [
    ("master_bedroom", r"\bmaster\b|\bm\.?\s*bed|\bm\.?\s*b\.?r\b|\bmbr\b"),
    ("bedroom", r"\bbed|\bb\.?r\b|\bkids?\b|\bguest\b|\bchild"),
    ("kitchen", r"\bkit|\bkitchen|\bpantry"),
    ("bathroom", r"\btoi|\btoilet|\bbath|\bw\.?c\b|\bpowder|\bwash\s*room|\bshower|\bensuite"),
    ("living", r"\bliv|\bdrawing|\blounge|\bfamily|\bhall\b|\bsitting"),
    ("dining", r"\bdin(?:ing)?\b"),
    ("balcony", r"\bbalc|\bsit\s*out|\bterrace|\bverandah?|\bdeck|\bporch"),
    ("study", r"\bstudy|\boffice|\blibrary|\bpooja|\bpuja|\bprayer"),
    ("utility", r"\butility|\blaundry|\bstore|\bstorage|\bwash\b|\bdress"),
    ("hallway", r"\bpassage|\bcorridor|\blobby|\bfoyer|\bentr|\bstair|\bup\b|\bdn\b"),
]
NAMES = {"master_bedroom": "Master Bedroom", "bedroom": "Bedroom", "kitchen": "Kitchen", "bathroom": "Bathroom",
         "dining": "Dining Room", "living": "Living Room", "balcony": "Balcony", "study": "Study",
         "utility": "Utility", "hallway": "Hallway"}

_FT_IN = r"(\d{1,3})\s*['’′]\s*-?\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:\"|”|″|''))?"
_NUM = r"(\d{1,5}(?:[.,]\d{1,3})?)"
_X = r"\s*[xX×*]\s*"


def room_kind(text: str) -> str | None:
    t = text.lower()
    for kind, pat in KIND_WORDS:
        if re.search(pat, t):
            return kind
    return None


def _feet(ft, inch):
    return (float(ft) + (float(inch) if inch else 0.0) / 12) * 0.3048


def parse_dimensions(text: str) -> tuple[float, float] | None:
    """Room dimensions in metres from a label, or None. Plausible rooms only (0.8 m to 30 m a side)."""
    t = text.replace(",", ".")
    m = re.search(_FT_IN + _X + _FT_IN, t)
    if m:
        a, b = _feet(m.group(1), m.group(2)), _feet(m.group(3), m.group(4))
    else:
        m = re.search(_NUM + r"\s*(mm|cm|m)?" + _X + _NUM + r"\s*(mm|cm|m)?", t)
        if not m:
            return None
        a, b = float(m.group(1)), float(m.group(3))
        whole = "." not in m.group(1) and "." not in m.group(3)
        unit = (m.group(2) or m.group(4) or "").lower()
        if unit == "mm" or (not unit and min(a, b) >= 500):
            a, b = a / 1000, b / 1000
        elif unit == "cm" or (not unit and min(a, b) >= 60):
            a, b = a / 100, b / 100
        elif not unit and (max(a, b) > 30 or (whole and min(a, b) >= 6)):
            # whole numbers like "12 x 14" are feet on house plans; metres come with decimals
            a, b = a * 0.3048, b * 0.3048
    if not (0.8 <= a <= 30 and 0.8 <= b <= 30):
        return None
    return a, b


@lru_cache(maxsize=1)
def _engine():
    import logging

    from rapidocr import RapidOCR
    logging.getLogger("RapidOCR").setLevel(logging.WARNING)
    return RapidOCR()


def read_text(image) -> list[dict]:
    """Every line of text found, with its box centre and size in pixels."""
    arr = np.asarray(image.convert("RGB")) if hasattr(image, "convert") else np.asarray(image)
    out = _engine()(arr)
    items = []
    if out is None or out.boxes is None:
        return items
    for box, txt, score in zip(out.boxes, out.txts, out.scores):
        box = np.asarray(box)
        x0, y0 = box.min(0)
        x1, y1 = box.max(0)
        items.append({"text": str(txt).strip(), "x": float((x0 + x1) / 2), "y": float((y0 + y1) / 2),
                      "w": float(x1 - x0), "h": float(y1 - y0), "score": float(score)})
    return items
