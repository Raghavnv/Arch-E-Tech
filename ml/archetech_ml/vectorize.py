"""Turn a label image (one class per pixel, see render.CLASSES) into Arch-E-Tech plan elements.

    elements, info = vectorize(mask, px_per_m=None)

* Walls: wall, door and window pixels together form the wall lines (openings sit inside walls).
  Long horizontal and vertical bands are found with morphological opening, each band becomes a
  wall along its centre line, and ends are stretched to meet the walls they nearly touch.
  Diagonal walls are not recovered yet.
* Doors and windows: each blob is placed on the nearest wall, along it, as wide as the blob.
* Rooms: the open space between walls is split into regions; each region takes the room type
  most of its pixels have, and is stored as its bounding rectangle (the app's rooms are
  rectangles) with its true area.
* Text (optional, from ocr.read_text): a room name inside a room sets its type ("TOI." -> bathroom,
  "M. BEDROOM" -> master bedroom, "STUDY", "DINING" ...), and room dimensions ("12'0\" x 10'6\"")
  give the scale.
* Scale: pixels per metre come from the caller (calibration), else from dimension text, else from
  the wall thickness, assuming walls are WALL_M thick.

Output uses the app's conventions: 20 units = 1 m, walls 8 units thick, doors / windows lie on
the wall centre line, rooms are {left, top = centre y, width, height}.
"""
from __future__ import annotations

import math
import uuid

import cv2
import numpy as np

from .ocr import NAMES as TEXT_NAMES
from .ocr import parse_dimensions, room_kind
from .render import CLASSES

C = {name: i for i, name in enumerate(CLASSES)}
ROOM_CLASSES = ("living", "bedroom", "kitchen", "bathroom", "balcony", "other_room")
U = 20                  # app units per metre
ORIGIN = 100            # app units: where the plan's top-left corner goes
WALL_M = 0.23           # assumed wall thickness (a 9" brick wall) when nothing better is known
TEXT_PRIORITY = ("living", "dining", "master_bedroom", "bedroom", "kitchen", "study", "bathroom", "balcony",
                 "utility", "hallway")
NAMES = {"living": "Living Room", "kitchen": "Kitchen", "bathroom": "Bathroom", "balcony": "Balcony",
         "dining": "Dining Room", "hallway": "Hallway", "utility": "Utility"}


def _id(kind):
    return f"{kind}_{uuid.uuid4().hex[:7]}"


def wall_thickness(wall: np.ndarray) -> float:
    """Typical wall thickness in pixels: twice the median distance-to-edge along the wall middles."""
    if wall.sum() < 20:
        return 0.0
    dist = cv2.distanceTransform(wall.astype(np.uint8), cv2.DIST_L2, 3)
    # local maxima of the distance map lie on the middle of each wall
    ridge = (dist >= cv2.dilate(dist, np.ones((3, 3), np.uint8))) & (dist > 0.5)
    return float(np.median(dist[ridge]) * 2) if ridge.any() else 0.0


def dominant_angle(wall: np.ndarray) -> float:
    """The drawing's tilt in degrees (-45..45), from the long straight lines along its walls.

    Each line's direction is folded onto 0..90 degrees (walls meet at right angles), the most common
    direction is found, and the lines near it are averaged, weighted by length."""
    img = (wall > 0).astype(np.uint8) * 255
    h, w = img.shape
    edges = cv2.Canny(img, 50, 150)
    min_len = max(25, int(0.06 * min(h, w)))
    lines = cv2.HoughLinesP(edges, 1, np.pi / 720, threshold=30, minLineLength=min_len, maxLineGap=4)
    if lines is None or len(lines) < 3:
        return 0.0
    lines = np.asarray(lines).reshape(-1, 4).astype(np.float64)
    x0, y0, x1, y1 = lines[:, 0], lines[:, 1], lines[:, 2], lines[:, 3]
    length = np.hypot(x1 - x0, y1 - y0)
    ang = np.degrees(np.arctan2(y1 - y0, x1 - x0)) % 90
    ang = np.where(ang >= 45, ang - 90, ang)                    # -45..45, 0 = axis-aligned
    hist, edges_ = np.histogram(ang, bins=180, range=(-45, 45), weights=length)
    hist = np.convolve(np.concatenate([hist[-2:], hist, hist[:2]]), np.ones(5), mode="valid")
    mode = edges_[int(np.argmax(hist))] + 0.25
    near = np.abs(((ang - mode) + 45) % 90 - 45) <= 1.0
    if not near.any():
        return 0.0
    diff = ((ang[near] - mode) + 45) % 90 - 45
    return float(mode + np.average(diff, weights=length[near]))


def straighten(mask: np.ndarray, angle: float) -> tuple[np.ndarray, np.ndarray]:
    """Rotate a label image by -angle (nearest neighbour, so labels stay labels), growing the canvas.
    Returns (straightened mask, the 2x3 matrix taking original pixels to straightened ones)."""
    h, w = mask.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    c, s_ = abs(m[0, 0]), abs(m[0, 1])
    W, H = int(h * s_ + w * c) + 2, int(h * c + w * s_) + 2
    m[0, 2] += W / 2 - w / 2
    m[1, 2] += H / 2 - h / 2
    return cv2.warpAffine(mask, m, (W, H), flags=cv2.INTER_NEAREST, borderValue=0), m


def _bands(solid: np.ndarray, t: float, horizontal: bool):
    """Wall segments (x0, y0, x1, y1) in pixels along one axis, on their centre lines."""
    min_len = max(4, int(round(t * 2.2)))
    kernel = np.ones((1, min_len), np.uint8) if horizontal else np.ones((min_len, 1), np.uint8)
    runs = cv2.morphologyEx(solid, cv2.MORPH_OPEN, kernel)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(runs, connectivity=4)
    segs = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        along, across = (w, h) if horizontal else (h, w)
        if along < min_len or across > max(3 * t, t + 6):
            continue            # too short for a wall, or a solid blob much thicker than one
        ys, xs = np.nonzero(labels == i)
        if horizontal:
            cy = float(np.median(ys))
            segs.append((float(xs.min()), cy, float(xs.max() + 1), cy))
        else:
            cx = float(np.median(xs))
            segs.append((cx, float(ys.min()), cx, float(ys.max() + 1)))
    return segs


def _snap_ends(h_segs, v_segs, t):
    """Stretch wall ends to the centre line of a perpendicular wall they nearly reach."""
    reach = max(3.0, t * 1.2)
    h_out, v_out = [list(s) for s in h_segs], [list(s) for s in v_segs]
    for h in h_out:
        for v in v_out:
            vx, vy0, _, vy1 = v
            hx0, hy, hx1, _ = h
            if vy0 - reach <= hy <= vy1 + reach:
                if abs(hx0 - vx) <= reach + t / 2:
                    h[0] = vx
                if abs(hx1 - vx) <= reach + t / 2:
                    h[2] = vx
            if hx0 - reach <= vx <= hx1 + reach:
                if abs(vy0 - hy) <= reach + t / 2:
                    v[1] = hy
                if abs(vy1 - hy) <= reach + t / 2:
                    v[3] = hy
    return h_out, v_out


def _merge_collinear(segs, horizontal, t):
    """Join pieces of the same wall line whose gap is small (leftovers of noisy pixels)."""
    key = 1 if horizontal else 0
    lo, hi = (0, 2) if horizontal else (1, 3)
    segs = sorted(segs, key=lambda s: (round(s[key] / max(1.0, t / 2)), s[lo]))
    out = []
    for s in segs:
        if out and abs(out[-1][key] - s[key]) <= t / 2 and s[lo] - out[-1][hi] <= t:
            prev = out[-1]
            prev[hi] = max(prev[hi], s[hi])
            prev[key] = prev[key] if (prev[hi] - prev[lo]) >= (s[hi] - s[lo]) else s[key]
        else:
            out.append(list(s))
    return out


def _openings(mask, cls, walls, t):
    """Door / window blobs placed on their nearest wall: (x0, y0, x1, y1, wall) in pixels."""
    blob = (mask == cls).astype(np.uint8)
    n, labels, stats, cent = cv2.connectedComponentsWithStats(blob, connectivity=8)
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < max(4, t * t * 0.5):
            continue
        cx, cy = cent[i]
        best = None
        for wseg in walls:
            x0, y0, x1, y1 = wseg
            if y0 == y1:            # horizontal wall
                d = abs(cy - y0) + max(0, x0 - cx, cx - x1)
            else:
                d = abs(cx - x0) + max(0, y0 - cy, cy - y1)
            if best is None or d < best[0]:
                best = (d, wseg)
        if best is None or best[0] > 2 * t + 4:
            continue
        x0, y0, x1, y1 = best[1]
        if y0 == y1:
            a, b = max(x0, x), min(x1, x + w)
            if b - a > 1:
                out.append((a, y0, b, y0))
        else:
            a, b = max(y0, y), min(y1, y + h)
            if b - a > 1:
                out.append((x0, a, x0, b))
    return out


def _rooms(mask, wall_any, t=4.0):
    """Regions of open floor between walls: [(class name, x, y, w, h, pixel area, component id)], labels."""
    roomish = np.isin(mask, [C[k] for k in ROOM_CLASSES]).astype(np.uint8)
    roomish[wall_any > 0] = 0
    # floor only counts inside the building: paper around the drawing is sometimes read as "room",
    # and an open side (a balcony, an archway) would otherwise let a room spill out to the page edge
    pts = cv2.findNonZero(wall_any)
    if pts is not None and len(pts) >= 3:
        inside = np.zeros_like(roomish)
        cv2.fillPoly(inside, [cv2.convexHull(pts)], 1)
        r = max(3, int(round(t * 8)))           # ~2 m beyond the walls, for balconies and terraces
        inside = cv2.dilate(inside, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
        roomish &= inside
    n, labels, stats, _ = cv2.connectedComponentsWithStats(roomish, connectivity=4)
    H, W = mask.shape
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 30:
            continue
        vals = mask[labels == i]
        counts = np.bincount(vals, minlength=len(CLASSES))
        kind = CLASSES[int(np.argmax([counts[C[k]] if k in ROOM_CLASSES else 0 for k in CLASSES]))]
        out.append((kind, int(x), int(y), int(w), int(h), int(area), i))
    return out, labels


def _drop_stubs(walls, t, px_per_m, max_len_m=1.2):
    """Remove short walls that touch no other wall: furniture or text strokes read as wall."""
    def touches(a, b):
        ax0, ay0, ax1, ay1 = min(a[0], a[2]), min(a[1], a[3]), max(a[0], a[2]), max(a[1], a[3])
        bx0, by0, bx1, by1 = min(b[0], b[2]), min(b[1], b[3]), max(b[0], b[2]), max(b[1], b[3])
        gap = t * 1.5
        return ax0 - gap <= bx1 and bx0 - gap <= ax1 and ay0 - gap <= by1 and by0 - gap <= ay1
    out = []
    for w in walls:
        length = max(abs(w[2] - w[0]), abs(w[3] - w[1]))
        if length < max_len_m * px_per_m and not any(o is not w and touches(w, o) for o in walls):
            continue
        out.append(w)
    return out


def _text_in_rooms(texts, labels, m):
    """{component id: [text items]} for OCR lines whose centre falls inside a room."""
    out: dict = {}
    H, W = labels.shape
    for t in texts or []:
        x, y = t["x"], t["y"]
        if m is not None:
            x, y = m[0, 0] * x + m[0, 1] * y + m[0, 2], m[1, 0] * x + m[1, 1] * y + m[1, 2]
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < W and 0 <= yi < H and labels[yi, xi] > 0:
            out.setdefault(int(labels[yi, xi]), []).append(t)
    return out


def _scale_from_text(rooms, texts_by_room, fallback=None):
    """Pixels per metre from room dimension labels, or None if there are none or they can't be trusted.

    A label only counts when its room holds a single dimension label and the room's shape and floor
    area both match the stated size (so a label sitting in two rooms merged by a gap in a wall is
    ignored). Several labels must agree; a single one must be near the wall-thickness estimate."""
    cands = []
    for kind, x, y, w, h, area, comp in rooms:
        dims = [d for d in (parse_dimensions(t["text"]) for t in texts_by_room.get(comp, [])) if d]
        if len(dims) != 1:
            continue
        a, b = sorted(dims[0])
        pw, ph = sorted((w, h))
        if pw < 8:
            continue
        c1, c2 = pw / a, ph / b
        c = (c1 + c2) / 2
        if abs(c1 / c2 - 1) > 0.2 or not 0.65 <= area / (a * b * c * c) <= 1.15:
            continue
        cands.append(c)
    if not cands:
        return None
    med = float(np.median(cands))
    good = [c for c in cands if abs(c / med - 1) < 0.15]
    if len(good) < max(1, (len(cands) + 1) // 2):
        return None
    est = float(np.mean(good))
    if len(good) == 1 and fallback and not 0.6 <= est / fallback <= 1.6:
        return None
    return est


def vectorize(mask: np.ndarray, px_per_m: float | None = None, wall_m: float = WALL_M, deskew: bool = True,
              texts: list | None = None):
    """App elements for a label image.

    texts: OCR lines ({"text", "x", "y"} in the same pixels as `mask`) used for room names and scale.
    Returns (elements, info). info has the scale and where it came from, the rotation applied to
    straighten the drawing, counts, and "image_to_plan": the affine map {a, b, c, d, e, f} taking a
    pixel (x, y) of the input to plan units (x' = a x + c y + e, y' = b x + d y + f), so the original
    drawing can be shown under the plan."""
    mask = np.asarray(mask, dtype=np.uint8)
    angle = dominant_angle(np.isin(mask, [C["wall"], C["door"], C["window"]])) if deskew else 0.0
    m = None
    if abs(angle) >= 0.4:
        mask, m = straighten(mask, angle)
    else:
        angle = 0.0
    wall_any = np.isin(mask, [C["wall"], C["door"], C["window"]]).astype(np.uint8)
    t = wall_thickness(wall_any)
    if t <= 0:
        return [], {"error": "no walls found"}
    info = {"wall_px": round(t, 2), "rotation_deg": round(angle, 2)}

    rooms, room_labels = _rooms(mask, wall_any, t)
    texts_by_room = _text_in_rooms(texts, room_labels, m)
    if px_per_m:
        info["scale"] = "given"
    else:
        px_per_m = _scale_from_text(rooms, texts_by_room, fallback=t / wall_m)
        if px_per_m:
            info["scale"] = "dimension text"
        else:
            px_per_m = t / wall_m
            info["scale"] = "wall thickness"
    info["px_per_m"] = round(px_per_m, 3)

    h = _merge_collinear(_bands(wall_any, t, True), True, t)
    v = _merge_collinear(_bands(wall_any, t, False), False, t)
    h, v = _snap_ends(h, v, t)
    walls = _drop_stubs([tuple(s) for s in h + v if max(abs(s[2] - s[0]), abs(s[3] - s[1])) >= t], t, px_per_m)
    if not walls:
        return [], {"error": "no walls found"}

    k = U / px_per_m                                            # pixels -> app units
    x_min = min(min(s[0], s[2]) for s in walls)
    y_min = min(min(s[1], s[3]) for s in walls)

    def ux(x):
        return int(round(ORIGIN + (x - x_min) * k))

    def uy(y):
        return int(round(ORIGIN + (y - y_min) * k))

    def line(kind, seg, thick, **extra):
        x0, y0, x1, y1 = seg
        if y0 == y1:
            return {"id": _id(kind), "type": kind, "left": ux(x0), "top": uy(y0), "width": max(1, ux(x1) - ux(x0)),
                    "height": thick, "angle": 0, **extra}
        return {"id": _id(kind), "type": kind, "left": ux(x0), "top": uy(y0), "width": max(1, uy(y1) - uy(y0)),
                "height": thick, "angle": 90, **extra}

    # room types: a readable name inside the room wins; otherwise the model's majority class
    typed = []
    for r in rooms:
        kind, x, y, w, hgt, area, comp = r
        # an open-plan region can hold several names ("LIVING", "DINING", "KITCHEN"): the main room wins
        kinds = {room_kind(tx["text"]) for tx in texts_by_room.get(comp, [])} - {None}
        named = next((k for k in TEXT_PRIORITY if k in kinds), None)
        if named:
            app_kind = named
        elif kind == "other_room":
            long_, short = max(w, hgt), max(1, min(w, hgt))
            app_kind = "hallway" if long_ / short > 2.5 or area / px_per_m ** 2 < 4 else "dining"
        else:
            app_kind = kind
        typed.append([app_kind, r, bool(named)])
    # one master bedroom: the biggest of those labelled master, else the biggest bedroom
    beds = [tp for tp in typed if tp[0] in ("bedroom", "master_bedroom")]
    masters = [tp for tp in beds if tp[0] == "master_bedroom"]
    for tp in beds:
        tp[0] = "bedroom"
    pool = masters or (beds if len(beds) > 1 else [])
    if pool:
        max(pool, key=lambda tp: tp[1][5])[0] = "master_bedroom"
    n_beds = sum(tp[0] == "bedroom" for tp in typed)

    elements = []
    counters: dict = {}
    for app_kind, (kind, x, y, w, hgt, area, comp), named in typed:
        counters[app_kind] = counters.get(app_kind, 0) + 1
        if app_kind == "bedroom":
            first = 2 if any(tp[0] == "master_bedroom" for tp in typed) else 1
            name = f"Bedroom {counters['bedroom'] + first - 1}" if n_beds > 1 or first == 2 else "Bedroom"
        else:
            name = TEXT_NAMES.get(app_kind) or NAMES.get(app_kind, app_kind.replace("_", " ").title())
            if counters[app_kind] > 1:
                name += f" {counters[app_kind]}"
        elements.append({"id": _id("room"), "type": "room", "kind": app_kind, "name": name,
                         "area": round(area / px_per_m ** 2, 1), "left": ux(x),
                         "top": int(round((uy(y) + uy(y + hgt)) / 2)),
                         "width": max(1, ux(x + w) - ux(x)), "height": max(1, uy(y + hgt) - uy(y)), "angle": 0})
    elements += [line("wall", s, 8) for s in walls]
    for seg in _openings(mask, C["door"], walls, t):
        elements.append(line("door", seg, 5, swing=1, hinge=1))
    for seg in _openings(mask, C["window"], walls, t):
        elements.append(line("window", seg, 5))

    # input pixel -> plan units: straighten (if any), then shift and scale
    mm = m if m is not None else np.array([[1.0, 0, 0], [0, 1.0, 0]])
    a_, c_, e_ = (k * mm[0, 0], k * mm[0, 1], k * (mm[0, 2] - x_min) + ORIGIN)
    b_, d_, f_ = (k * mm[1, 0], k * mm[1, 1], k * (mm[1, 2] - y_min) + ORIGIN)
    info.update({"origin_px": (x_min, y_min), "walls": len(walls), "rooms": len(rooms),
                 "rooms_named_from_text": sum(tp[2] for tp in typed),
                 "doors": sum(e["type"] == "door" for e in elements),
                 "windows": sum(e["type"] == "window" for e in elements),
                 "image_to_plan": {"a": a_, "b": b_, "c": c_, "d": d_, "e": e_, "f": f_}})
    return elements, info


def rasterize(elements, shape, px_per_m, origin_px=(0.0, 0.0), wall_px=None):
    """Draw elements back into a label image (for checking vectorize against the truth)."""
    out = np.zeros(shape, np.uint8)
    k = px_per_m / U
    ox, oy = origin_px

    def px(v, o):
        return (v - ORIGIN) * k + o

    for e in elements:
        if e["type"] == "room":
            kind = {"master_bedroom": "bedroom", "dining": "other_room", "hallway": "other_room"}.get(e["kind"], e["kind"])
            if kind in C:
                x0, x1 = px(e["left"], ox), px(e["left"] + e["width"], ox)
                y0, y1 = px(e["top"] - e["height"] / 2, oy), px(e["top"] + e["height"] / 2, oy)
                cv2.rectangle(out, (int(x0), int(y0)), (int(x1), int(y1)), int(C[kind]), -1)
    for typ, cls in (("wall", "wall"), ("window", "window"), ("door", "door")):
        for e in elements:
            if e["type"] != typ:
                continue
            a = math.radians(e["angle"])
            x0, y0 = px(e["left"], ox), px(e["top"], oy)
            x1, y1 = x0 + e["width"] * k * math.cos(a), y0 + e["width"] * k * math.sin(a)
            thick = max(1, int(round(wall_px if wall_px else 8 * k)))
            cv2.line(out, (int(x0), int(y0)), (int(x1), int(y1)), int(C[cls]), thick)
    return out
