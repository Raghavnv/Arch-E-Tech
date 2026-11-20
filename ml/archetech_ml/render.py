"""Render a vector floor plan (ResPlan format) into a drawing plus a per-pixel label mask.

Each call picks a random drawing style, so one plan yields many different-looking training
images: paper / blueprint / listing-style colour fills, solid / outlined / hatched walls, door
swings, window symbols, room names, dimensions, furniture symbols, and scan artefacts (blur,
noise, JPEG, tilt). The mask is drawn from the same geometry, so labels are exact.
"""
from __future__ import annotations

import io
import math
import random
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, box

# ---------------------------------------------------------------------------------------------
# Classes the model predicts
# ---------------------------------------------------------------------------------------------
CLASSES = ["background", "wall", "door", "window", "living", "bedroom", "kitchen", "bathroom",
           "balcony", "other_room"]
CLS = {name: i for i, name in enumerate(CLASSES)}
ROOM_KEYS = {"living": "living", "bedroom": "bedroom", "kitchen": "kitchen", "bathroom": "bathroom",
             "balcony": "balcony", "storage": "other_room", "stair": "other_room"}

LABELS = {
    "living": ["LIVING", "Living Room", "LIVING ROOM", "DRAWING", "Lounge", "HALL", "LIVING/DINING", "Family"],
    "bedroom": ["BEDROOM", "Bedroom", "BED RM", "M. BEDROOM", "BEDROOM 2", "Bed 3", "MASTER BED", "KIDS ROOM"],
    "kitchen": ["KITCHEN", "Kitchen", "KIT.", "KITCHEN/DINING"],
    "bathroom": ["TOILET", "BATH", "Bath", "WC", "W.C.", "TOI.", "BATHROOM", "Powder"],
    "balcony": ["BALCONY", "Balcony", "BALC.", "SIT OUT", "Terrace"],
    "storage": ["STORE", "Store", "STORAGE", "UTILITY"],
    "stair": ["STAIR", "UP", "DN"],
}
FONT_DIR = Path("/System/Library/Fonts/Supplemental")
FONTS = [p for p in ("Arial.ttf", "Arial Bold.ttf", "Arial Narrow.ttf", "Verdana.ttf", "Tahoma.ttf",
                     "Courier New.ttf", "Georgia.ttf", "Trebuchet MS.ttf")
         if (FONT_DIR / p).exists()]
HAND_FONTS = [p for p in ("Bradley Hand Bold.ttf", "Chalkboard.ttc", "Comic Sans MS.ttf", "Noteworthy.ttc",
                          "Marker Felt.ttc") if (FONT_DIR / p).exists()]
_font_cache: dict = {}


def _font(rng, size, hand=False):
    pool = HAND_FONTS if hand and HAND_FONTS else FONTS
    name = rng.choice(pool) if pool else None
    key = (name, size)
    if key not in _font_cache:
        _font_cache[key] = (ImageFont.truetype(str(FONT_DIR / name), size) if name
                            else ImageFont.load_default(size=size))
    return _font_cache[key]


def polys(geom) -> list[Polygon]:
    if geom is None or getattr(geom, "is_empty", True):
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, (MultiPolygon, GeometryCollection)):
        out = []
        for g in geom.geoms:
            out += polys(g)
        return out
    return []


def _plan_polys(plan, key):
    v = plan.get(key)
    if isinstance(v, tuple):
        out = []
        for g in v:
            out += polys(g)
        return out
    return polys(v)


# ---------------------------------------------------------------------------------------------
# Geometry -> pixel transform
# ---------------------------------------------------------------------------------------------
class _Xf:
    def __init__(self, bounds, size, rng):
        x0, y0, x1, y1 = bounds
        self.cx, self.cy = (x0 + x1) / 2, (y0 + y1) / 2
        self.rot = rng.choice((0, 90, 180, 270)) + (rng.uniform(-4, 4) if rng.random() < 0.25 else 0)
        self.flip = rng.random() < 0.5
        a = math.radians(self.rot)
        self.c, self.s = math.cos(a), math.sin(a)
        # extent after rotation
        pts = [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]
        rx = [self._rot(px, py)[0] for px, py in pts]
        ry = [self._rot(px, py)[1] for px, py in pts]
        span = max(max(rx) - min(rx), max(ry) - min(ry))
        self.k = size * rng.uniform(0.55, 0.9) / span
        self.ox = size / 2 + rng.uniform(-0.08, 0.08) * size
        self.oy = size / 2 + rng.uniform(-0.08, 0.08) * size

    def _rot(self, x, y):
        x, y = x - self.cx, y - self.cy
        if self.flip:
            x = -x
        return x * self.c - y * self.s, x * self.s + y * self.c

    def pt(self, x, y):
        rx, ry = self._rot(x, y)
        return self.ox + rx * self.k, self.oy + ry * self.k

    def ring(self, coords):
        return [self.pt(x, y) for x, y in coords]


# ---------------------------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------------------------
def _fill_poly(draw, xf, poly, fill, hole_fill):
    draw.polygon(xf.ring(poly.exterior.coords), fill=fill)
    for hole in poly.interiors:
        draw.polygon(xf.ring(hole.coords), fill=hole_fill)


def _outline_poly(draw, xf, poly, color, width):
    for ring in [poly.exterior, *poly.interiors]:
        pts = xf.ring(ring.coords)
        draw.line(pts + pts[:1], fill=color, width=width)


def _rect_axes(poly, xf):
    """(centre, unit vector along the long side, long length, short length) in pixels."""
    mrr = poly.minimum_rotated_rectangle
    if mrr.geom_type != "Polygon":
        return None
    pts = [xf.pt(x, y) for x, y in list(mrr.exterior.coords)[:4]]
    e1 = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
    e2 = (pts[2][0] - pts[1][0], pts[2][1] - pts[1][1])
    l1, l2 = math.hypot(*e1), math.hypot(*e2)
    if l1 < 1e-6 or l2 < 1e-6:
        return None
    cx = sum(p[0] for p in pts) / 4
    cy = sum(p[1] for p in pts) / 4
    if l1 >= l2:
        return (cx, cy), (e1[0] / l1, e1[1] / l1), l1, l2
    return (cx, cy), (e2[0] / l2, e2[1] / l2), l2, l1


def _draw_door(draw, poly, xf, rng, style):
    ax = _rect_axes(poly, xf)
    if not ax:
        return
    (cx, cy), (ux, uy), length, thick = ax
    nx, ny = -uy, ux
    if rng.random() < 0.5:
        nx, ny = -nx, -ny
    draw.polygon(xf.ring(poly.exterior.coords), fill=style["bg"])        # the gap in the wall
    if style["door"] == "gap":
        return
    hx, hy = cx - ux * length / 2, cy - uy * length / 2                    # hinge
    if rng.random() < 0.5:
        hx, hy, ux, uy = cx + ux * length / 2, cy + uy * length / 2, -ux, -uy
    w = max(1, style["line_w"] - 1)
    leaf = (hx + nx * length, hy + ny * length)
    draw.line([(hx, hy), leaf], fill=style["ink"], width=w)
    if style["door"] == "arc":
        a0 = math.degrees(math.atan2(ny, nx))
        a1 = math.degrees(math.atan2(uy, ux))
        lo, hi = (a0, a1) if (a1 - a0) % 360 <= 180 else (a1, a0)
        draw.arc([hx - length, hy - length, hx + length, hy + length], lo, hi if hi > lo else hi + 360,
                 fill=style["ink"], width=1)


def _draw_window(draw, poly, xf, style):
    ax = _rect_axes(poly, xf)
    draw.polygon(xf.ring(poly.exterior.coords), fill=style["win_fill"])
    if not ax:
        return
    (cx, cy), (ux, uy), length, thick = ax
    nx, ny = -uy, ux
    n = style["win_lines"]
    for i in range(n):
        off = (i - (n - 1) / 2) * thick / max(n, 2)
        p0 = (cx - ux * length / 2 + nx * off, cy - uy * length / 2 + ny * off)
        p1 = (cx + ux * length / 2 + nx * off, cy + uy * length / 2 + ny * off)
        draw.line([p0, p1], fill=style["ink"], width=1)
    _outline_poly(draw, xf, poly, style["ink"], 1)


# (name, width m, depth m): placed with its back against a wall of the room
FURNITURE = {
    "bedroom": [("bed", 1.6, 2.0), ("wardrobe", 1.8, 0.6), ("side", 0.45, 0.45), ("desk", 1.2, 0.55)],
    "bathroom": [("wc", 0.4, 0.65), ("basin", 0.55, 0.45), ("shower", 0.9, 0.9)],
    "kitchen": [("counter", 2.4, 0.6), ("counter", 1.5, 0.6), ("fridge", 0.7, 0.7)],
    "living": [("sofa", 2.1, 0.9), ("tv", 1.6, 0.4), ("chair", 0.8, 0.8), ("table", 1.6, 0.9)],
}


def _furniture(draw, kind, poly, xf, rng, style):
    """Furniture symbols with their backs against the room's walls, the way plans draw them.
    They are drawn on the floor, so in the label image they stay part of the room."""
    minx, miny, maxx, maxy = poly.bounds
    u = RESPLAN_UNITS_PER_M
    placed = []
    ink, fill = style["furn"], style["furn_fill"]
    for name, wm, dm in FURNITURE.get(kind, []):
        if rng.random() < 0.3:
            continue
        w, dpt = wm * u * rng.uniform(0.85, 1.15), dm * u * rng.uniform(0.85, 1.15)
        gap = rng.uniform(0, 0.06) * u
        for _ in range(8):
            side = rng.choice("NSEW")
            if side in "NS":
                if w > maxx - minx - 2:
                    continue
                x0 = rng.uniform(minx + 1, maxx - 1 - w)
                y0 = miny + gap if side == "N" else maxy - gap - dpt
                r, back = box(x0, y0, x0 + w, y0 + dpt), side
            else:
                if w > maxy - miny - 2:
                    continue
                y0 = rng.uniform(miny + 1, maxy - 1 - w)
                x0 = minx + gap if side == "W" else maxx - gap - dpt
                r, back = box(x0, y0, x0 + dpt, y0 + w), side
            if not poly.buffer(u * 0.05).contains(r) or any(r.intersects(o) for o in placed):
                continue
            placed.append(r)
            _symbol(draw, name, r, back, xf, ink, fill)
            break


def _symbol(draw, name, r, back, xf, ink, fill):
    x0, y0, x1, y1 = r.bounds
    pts = lambda coords: [xf.pt(x, y) for x, y in coords]  # noqa: E731
    draw.polygon(pts(r.exterior.coords), outline=ink, fill=fill)
    # local frame: "back" edge against the wall, depth pointing into the room
    def at(fa, fd):     # fraction along the back edge, fraction of depth from the back
        if back == "N":
            return xf.pt(x0 + fa * (x1 - x0), y0 + fd * (y1 - y0))
        if back == "S":
            return xf.pt(x0 + fa * (x1 - x0), y1 - fd * (y1 - y0))
        if back == "W":
            return xf.pt(x0 + fd * (x1 - x0), y0 + fa * (y1 - y0))
        return xf.pt(x1 - fd * (x1 - x0), y0 + fa * (y1 - y0))
    def quad(a0, d0, a1, d1):
        draw.polygon([at(a0, d0), at(a1, d0), at(a1, d1), at(a0, d1)], outline=ink)
    def oval(ca, cd, ra, rd):
        draw.polygon([at(ca + ra * math.cos(t), cd + rd * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 18)],
                     outline=ink)
    if name == "bed":
        quad(0.08, 0.04, 0.46, 0.2)
        quad(0.54, 0.04, 0.92, 0.2)
        draw.line([at(0, 0.32), at(1, 0.32)], fill=ink)
    elif name == "wardrobe":
        draw.line([at(0, 0), at(1, 1)], fill=ink)
        draw.line([at(0.5, 0), at(0.5, 1)], fill=ink)
    elif name == "wc":
        quad(0.1, 0.0, 0.9, 0.3)
        oval(0.5, 0.65, 0.4, 0.33)
    elif name == "basin":
        oval(0.5, 0.5, 0.35, 0.32)
    elif name == "shower":
        draw.line([at(0, 0), at(1, 1)], fill=ink)
        draw.line([at(1, 0), at(0, 1)], fill=ink)
    elif name == "counter":
        oval(0.25, 0.5, 0.08, 0.28)
        oval(0.7, 0.5, 0.1, 0.3)
    elif name == "fridge":
        draw.line([at(0, 0.85), at(1, 0.85)], fill=ink)
    elif name == "sofa":
        quad(0.0, 0.0, 1.0, 0.25)
        quad(0.0, 0.25, 0.12, 1.0)
        quad(0.88, 0.25, 1.0, 1.0)
    elif name == "chair":
        quad(0.1, 0.0, 0.9, 0.2)
    elif name == "desk":
        quad(0.35, 0.75, 0.65, 1.0)


def _style(rng):
    kind = rng.choices(["paper", "listing", "blueprint", "grey", "sketch", "cad"], [0.3, 0.27, 0.07, 0.1, 0.13, 0.13])[0]
    if kind == "blueprint":
        bg, ink = (rng.randint(15, 40), rng.randint(50, 80), rng.randint(110, 150)), (235, 240, 250)
    elif kind == "grey":
        g = rng.randint(200, 235)
        bg, ink = (g, g, g), (rng.randint(20, 60),) * 3
    else:
        t = rng.randint(238, 255)
        bg, ink = (t, t - rng.randint(0, 8), t - rng.randint(0, 14)), (rng.randint(0, 50),) * 3
    wall_color = ink if rng.random() < 0.7 else rng.choice([(60, 60, 60), (120, 120, 120), (90, 70, 60), (40, 50, 90)])
    wall = rng.choices(["solid", "outline", "hatch"], [0.6, 0.28, 0.12])[0]
    if kind == "sketch":
        wall = "sketch"
        ink = (rng.randint(40, 110),) * 3                  # pencil
    elif kind == "cad":
        wall = rng.choice(["outline", "outline", "hatch"])
    return {
        "kind": kind, "bg": bg, "ink": ink, "wall_color": wall_color,
        "wall": wall,
        "line_w": 1 if kind == "cad" else rng.choice((1, 1, 2, 2, 3)),
        "door": rng.choices(["arc", "leaf", "gap"], [0.7, 0.15, 0.15])[0],
        "win_lines": rng.choice((0, 1, 2, 2, 3)),
        "win_fill": bg if rng.random() < 0.7 else (200, 225, 245),
        "fills": kind == "listing" or (kind == "paper" and rng.random() < 0.15),
        "labels": rng.random() < 0.75,
        "dims": rng.random() < (0.8 if kind == "cad" else 0.35),
        "chains": kind == "cad" or rng.random() < 0.12,     # dimension chains and grid markers outside
        "furniture": rng.random() < 0.6,
        "furn": (tuple(min(255, c + rng.randint(30, 110)) for c in ink) if kind != "blueprint" else (170, 185, 220)),
        "furn_fill": None if rng.random() < 0.6 else ((235, 235, 235) if kind != "blueprint" else None),
        "hand": kind == "sketch",
        "photo": rng.random() < 0.15,
    }


FILL = {
    "living": [(250, 235, 205), (240, 230, 210), (255, 244, 220)],
    "bedroom": [(210, 225, 245), (225, 215, 240), (215, 235, 225)],
    "kitchen": [(250, 215, 190), (245, 225, 200)],
    "bathroom": [(200, 235, 240), (210, 225, 235)],
    "balcony": [(220, 240, 210), (230, 230, 230)],
    "storage": [(230, 225, 215)], "stair": [(225, 225, 225)],
}


RESPLAN_UNITS_PER_M = 19.8      # measured: ~392 plan units^2 per m^2 of net area


def render(plan: dict, size: int = 512, rng: random.Random | None = None, with_meta: bool = False):
    """(RGB PIL image, uint8 mask of CLASSES indices) for one plan; with_meta adds {"px_per_m": ...}."""
    rng = rng or random.Random()
    style = _style(rng)
    walls = _plan_polys(plan, "wall")
    if not walls:
        raise ValueError("plan has no walls")
    # a few plans have an "inner" outline outside their walls: keep only the part the walls enclose
    hull = MultiPolygon(walls).convex_hull
    inner = [q for p in _plan_polys(plan, "inner") for q in polys(p.intersection(hull))]
    shapes = walls + inner + _plan_polys(plan, "balcony")
    xs = [b for p in shapes for b in (p.bounds[0], p.bounds[2])]
    ys = [b for p in shapes for b in (p.bounds[1], p.bounds[3])]
    xf = _Xf((min(xs), min(ys), max(xs), max(ys)), size, rng)

    # ---- mask ------------------------------------------------------------------------------
    mask = Image.new("L", (size, size), CLS["background"])
    md = ImageDraw.Draw(mask)
    for p in inner:
        _fill_poly(md, xf, p, CLS["other_room"], None)
    for key, cls in ((k, CLS[v]) for k, v in ROOM_KEYS.items()):
        for p in _plan_polys(plan, key):
            _fill_poly(md, xf, p, cls, None)
    # walls have holes (the rooms): draw them on their own layer so the holes keep the room labels
    for key, cls in (("wall", CLS["wall"]), ("window", CLS["window"]), ("door", CLS["door"]),
                     ("front_door", CLS["door"])):
        layer = Image.new("L", (size, size), 0)
        ld = ImageDraw.Draw(layer)
        for p in _plan_polys(plan, key):
            _fill_poly(ld, xf, p, 255, 0)
        mask.paste(cls, mask=layer)

    # ---- drawing -----------------------------------------------------------------------------
    img = Image.new("RGB", (size, size), style["bg"])
    d = ImageDraw.Draw(img)
    if style["fills"]:
        for key in ROOM_KEYS:
            for p in _plan_polys(plan, key):
                _fill_poly(d, xf, p, rng.choice(FILL[key]), None)
    if style["furniture"]:
        for key in ("bedroom", "bathroom", "living", "kitchen"):
            for p in _plan_polys(plan, key):
                if rng.random() < 0.7 and p.area > 0:
                    _furniture(d, key, p, xf, rng, style)
    if style["wall"] in ("solid", "hatch"):
        # walls have holes (the rooms), so paint them through a mask
        layer = Image.new("L", (size, size), 0)
        ld = ImageDraw.Draw(layer)
        for p in walls:
            _fill_poly(ld, xf, p, 255, 0)
        if style["wall"] == "solid":
            paint = Image.new("RGB", (size, size), style["wall_color"])
        else:
            paint = Image.new("RGB", (size, size), style["bg"])
            hd = ImageDraw.Draw(paint)
            step = rng.choice((3, 4, 5))
            for k in range(-size, size, step):
                hd.line([(k, 0), (k + size, size)], fill=style["ink"], width=1)
        img = Image.composite(paint, img, layer)
        d = ImageDraw.Draw(img)
    if style["wall"] == "sketch":
        for p in walls:
            for ring in [p.exterior, *p.interiors]:
                for _ in range(rng.choice((1, 2))):
                    _wobbly(d, xf.ring(ring.coords), style["ink"], rng.choice((1, 2)), rng)
    elif style["wall"] != "solid":
        for p in walls:
            _outline_poly(d, xf, p, style["ink"], style["line_w"])
    for p in _plan_polys(plan, "window"):
        _draw_window(d, p, xf, style)
    for key in ("door", "front_door"):
        for p in _plan_polys(plan, key):
            _draw_door(d, p, xf, rng, style)

    if style["labels"]:
        for key in ROOM_KEYS:
            for p in _plan_polys(plan, key):
                if p.area <= 0 or rng.random() < 0.15:
                    continue
                c = p.representative_point()
                px, py = xf.pt(c.x, c.y)
                fs = max(7, int(math.sqrt(p.area) * xf.k * rng.uniform(0.09, 0.16)))
                text = rng.choice(LABELS[key])
                if style["dims"] and key != "stair" and rng.random() < 0.6:
                    b = p.bounds
                    w_m, h_m = (b[2] - b[0]) / 20, (b[3] - b[1]) / 20
                    if rng.random() < 0.5:
                        text += f"\n{int(w_m * 3.281)}'{rng.randint(0, 11)}\" x {int(h_m * 3.281)}'{rng.randint(0, 11)}\""
                    else:
                        text += f"\n{w_m:.2f} x {h_m:.2f}"
                d.multiline_text((px, py), text, fill=style["ink"], font=_font(rng, fs, style["hand"]),
                                 anchor="mm", align="center")
    if style["dims"] and rng.random() < 0.6:
        # an overall dimension line along the top
        bx = [xf.pt(x, y) for p in walls for x, y in p.exterior.coords]
        x0, x1 = min(p[0] for p in bx), max(p[0] for p in bx)
        y0 = min(p[1] for p in bx) - rng.randint(10, 22)
        if y0 > 12:
            d.line([(x0, y0), (x1, y0)], fill=style["ink"], width=1)
            for x in (x0, x1):
                d.line([(x, y0 - 4), (x, y0 + 4)], fill=style["ink"], width=1)
            d.text(((x0 + x1) / 2, y0 - 3), f"{(x1 - x0) / xf.k / 20 * 3.281:.0f}'-0\"",
                   fill=style["ink"], font=_font(rng, 10), anchor="mb")

    if style["chains"]:
        _dimension_chains(d, walls, xf, rng, style)

    img = _degrade(img, rng, style)
    mask = np.asarray(mask, dtype=np.uint8)
    if style["photo"]:
        img, mask = _phone_photo(img, mask, rng)
    if with_meta:
        return img, mask, {"px_per_m": xf.k * RESPLAN_UNITS_PER_M}
    return img, mask


def _wobbly(draw, pts, color, width, rng):
    """A hand-drawn line through the points: short steps with a little drift."""
    pts = list(pts) + [pts[0]]
    out = []
    drift = (0.0, 0.0)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(bx - ax, by - ay) / 6))
        for i in range(n):
            t = i / n
            drift = (drift[0] * 0.7 + rng.gauss(0, 0.45), drift[1] * 0.7 + rng.gauss(0, 0.45))
            out.append((ax + (bx - ax) * t + drift[0], ay + (by - ay) * t + drift[1]))
    out.append(pts[-1])
    draw.line(out, fill=color, width=width)


def _dimension_chains(d, walls, xf, rng, style):
    """CAD-style chains of dimensions along the top and left, with grid bubbles at the wall lines."""
    pts = [xf.pt(x, y) for p in walls for x, y in p.exterior.coords]
    xs = sorted({round(p[0]) for p in pts})
    ys = sorted({round(p[1]) for p in pts})
    def thin(vals, gap=14):
        out = []
        for v in vals:
            if not out or v - out[-1] >= gap:
                out.append(v)
        return out
    xs, ys = thin(xs), thin(ys)
    if len(xs) < 2 or len(ys) < 2:
        return
    top, left = ys[0] - rng.randint(12, 20), xs[0] - rng.randint(12, 20)
    font = _font(rng, rng.choice((7, 8, 9)), style["hand"])
    ink = style["ink"]
    if top > 22:
        d.line([(xs[0], top), (xs[-1], top)], fill=ink)
        for a, b in zip(xs, xs[1:]):
            d.line([(a, top - 3), (a, top + 3)], fill=ink)
            d.text(((a + b) / 2, top - 2), f"{(b - a) / xf.k / RESPLAN_UNITS_PER_M:.2f}", fill=ink, font=font, anchor="mb")
        d.line([(xs[-1], top - 3), (xs[-1], top + 3)], fill=ink)
        if rng.random() < 0.6:
            for i, x in enumerate(xs[:: max(1, len(xs) // 6)]):
                d.ellipse([x - 6, top - 22, x + 6, top - 10], outline=ink)
                d.text((x, top - 16), str(i + 1), fill=ink, font=font, anchor="mm")
    if left > 22:
        d.line([(left, ys[0]), (left, ys[-1])], fill=ink)
        for a in ys:
            d.line([(left - 3, a), (left + 3, a)], fill=ink)


def _phone_photo(img, mask, rng):
    """The drawing photographed at an angle on a table: perspective, a border, uneven light."""
    w, h = img.size
    j = 0.07
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([[rng.uniform(0, j) * w, rng.uniform(0, j) * h], [w - rng.uniform(0, j) * w, rng.uniform(0, j) * h],
                      [w - rng.uniform(0, j) * w, h - rng.uniform(0, j) * h], [rng.uniform(0, j) * w, h - rng.uniform(0, j) * h]])
    m = cv2.getPerspectiveTransform(src, dst)
    table = tuple(int(c) for c in rng.choice([(120, 95, 70), (90, 90, 95), (160, 150, 135), (60, 50, 45)]))
    arr = cv2.warpPerspective(np.asarray(img), m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
                              borderValue=table)
    mask = cv2.warpPerspective(mask, m, (w, h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = rng.uniform(0.2, 0.8) * w, rng.uniform(0.2, 0.8) * h
    light = 1.05 - 0.35 * (np.hypot(xx - cx, yy - cy) / math.hypot(w, h))
    arr = np.clip(arr.astype(np.float32) * light[..., None], 0, 255).astype(np.uint8)
    return Image.fromarray(arr), mask


def _degrade(img, rng, style):
    """Scanner / phone-photo artefacts."""
    if rng.random() < 0.3:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.1)))
    arr = np.asarray(img).astype(np.float32)
    if rng.random() < 0.35:
        arr += np.random.default_rng(rng.randint(0, 2**31)).normal(0, rng.uniform(2, 9), arr.shape)
    if rng.random() < 0.3:              # uneven lighting
        h, w = arr.shape[:2]
        gx = np.linspace(rng.uniform(0.85, 1.0), rng.uniform(0.9, 1.05), w)[None, :, None]
        arr *= gx
    if rng.random() < 0.15:
        arr = arr.mean(axis=2, keepdims=True).repeat(3, axis=2)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    if rng.random() < 0.4:
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=rng.randint(35, 90))
        img = Image.open(io.BytesIO(buf.getvalue())).convert("RGB")
    return img


# mask colours for previews
PALETTE = np.array([(255, 255, 255), (0, 0, 0), (220, 40, 40), (40, 120, 230), (245, 215, 150),
                    (160, 200, 240), (240, 160, 110), (140, 220, 220), (170, 220, 140), (200, 200, 200)],
                   dtype=np.uint8)


def colorize(mask: np.ndarray) -> Image.Image:
    return Image.fromarray(PALETTE[mask])
