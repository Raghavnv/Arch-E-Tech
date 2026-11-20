"""
Procedural house layouts: a different plan for (almost) every request.

A house is assembled from zones:
  * a day zone: the living room, with the dining room, kitchen, utility (and sometimes the
    study or powder room) each grown onto a random side of a room already placed
  * a master suite zone and one to three bedroom zones, each built in a random pattern:
      direct   rooms open straight off the living / dining room
      hall     a hallway (1.5-2 m wide) leads away from the living area, rooms along one side
      double   a hallway with rooms on both sides
      lobby    a small lobby with a room on each of its three sides
  * each zone is attached to a random exposed wall of the living or dining room, so the
    footprint comes out as a rectangle, L, T, U, Z, a pinwheel or a courtyard-less cluster

Many candidates are drawn; those that make a sound house (every room reachable, windows, an
entrance, believable sizes, no holes or narrow slots in the outline) are scored on area,
compactness and proportions, and one of the best few is picked at random. Rooms are sized
from the program one by one, so a bathroom stays bathroom-sized whatever is next to it.

Grid: 1 cell = 0.5 m. A zone is built in local coordinates with the edge that meets the
living space at y = 0 and the zone extending towards +y.
"""
from __future__ import annotations

import dataclasses
import math
import random
import time

import floorplan_builder as fb
import vastu
from plan_designer import bedroom_spread_fail

OPEN_KINDS = ("living", "dining", "lounge")
# shortest side in cells for each kind of room
MIN_SIDE = {"living": 7, "dining": 6, "kitchen": 5, "utility": 4, "lounge": 6, "master_bedroom": 7,
            "bedroom": 6, "study": 5, "bathroom": 4}
DOOR_SIDE = 5           # 2.5 m of shared wall leaves room for a door and its clearances
HALL_MAX = 18           # cells (9 m), as floorplan_builder's validation allows


def _cells(room, s):
    lo = fb.KIND_SPEC[room.kind][1]
    return max(lo, room.area * s) / 0.25


def _dims(room, rng, s, along_min=0):
    """(along, depth) in cells; along runs beside the hallway / room it opens off."""
    a = _cells(room, s)
    lo = MIN_SIDE[room.kind]
    if room.kind == "bathroom":
        along = max(along_min or 4, rng.choice((4, 5, 5, 6)))
        depth = max(4, round(a / along))
        return along, depth
    ratio = rng.uniform(1.0, 1.5)
    short = max(lo, round(math.sqrt(a / ratio)))
    long_ = max(lo, round(a / short))
    along, depth = (short, long_) if rng.random() < 0.5 else (long_, short)
    return max(along, along_min), depth


def _dims_at_depth(room, depth, s, along_min=0):
    """(along, depth) with the depth given, so rooms in a row line up; None if that misshapes the room."""
    a = _cells(room, s)
    lo = MIN_SIDE[room.kind]
    along = max(along_min, lo, round(a / depth))
    lim = 2.6 if room.kind in ("bathroom", "utility") else 1.8
    if depth < lo or max(along, depth) / min(along, depth) > lim:
        return None
    if along * depth > a * 1.35:            # e.g. a bathroom stretched to bedroom depth
        return None
    return along, depth


def _hall_room(n, w, h):
    return fb.Room(id=f"hall{n}", kind="hallway", name="Hallway", area=w * h * 0.25, row="hall")


def _overlaps(boxes):
    for i, (_, x, y, w, h) in enumerate(boxes):
        for _, x2, y2, w2, h2 in boxes[i + 1:]:
            if x < x2 + w2 and x2 < x + w and y < y2 + h2 and y2 < y + h:
                return True
    return False


def _touch_len(a, b):
    _, ax, ay, aw, ah = a
    _, bx, by, bw, bh = b
    if ax + aw == bx or bx + bw == ax:
        return max(0, min(ay + ah, by + bh) - max(ay, by))
    if ay + ah == by or by + bh == ay:
        return max(0, min(ax + aw, bx + bw) - max(ax, bx))
    return 0


# --------------------------------------------------------------------------
# Zone patterns. Each returns (boxes, ports): boxes are [room, x, y, w, h]; a port (index, cells)
# names a box that must share at least that much wall with the living / dining room.
# --------------------------------------------------------------------------
def _unit_boxes(unit, rng, s, x, y, outward, along_axis, depth=None, along_min=0):
    """Lay out a unit (a room, or a master bedroom with its ensuite) starting at (x, y).

    along_axis: the axis the units are strung along; outward (+1/-1) points away from the
    hallway / living room. depth: the row's common depth, if the room can take it.
    Returns (boxes, length along the string)."""
    main = unit[0]
    dims = _dims_at_depth(main, depth, s, along_min) if depth else None
    al, dp = dims or _dims(main, rng, s, along_min)
    boxes = []

    def put(room, a0, d0, al_, dp_):
        # a0: offset along the string, d0: offset away from the hallway (>= 0)
        if along_axis == "y":
            bx = x + d0 if outward > 0 else x - d0 - dp_
            boxes.append([room, bx, y + a0, dp_, al_])
        else:
            by = y + d0 if outward > 0 else y - d0 - dp_
            boxes.append([room, x + a0, by, al_, dp_])

    put(main, 0, 0, al, dp)
    length = al
    if len(unit) > 1:
        ens = unit[1]
        behind = rng.random() < 0.3
        eal, edp = _dims(ens, rng, s)
        if behind and eal <= al:
            put(ens, rng.choice((0, al - eal)), dp, eal, edp)
        else:
            # beside the master, as deep as it when that keeps the bathroom a sensible size
            fit = _dims_at_depth(ens, dp, s, 4)
            eal, edp = fit or (eal, max(edp, DOOR_SIDE))
            put(ens, al, 0, eal, edp)
            length += eal
    return boxes, length


def _row_depth(units, rng, s):
    beds = [u[0] for u in units if u[0].kind in ("bedroom", "master_bedroom", "study")]
    if not beds or rng.random() < 0.15:
        return None
    avg = sum(_cells(r, s) for r in beds) / len(beds)
    return max(6, round(math.sqrt(avg) * rng.uniform(0.85, 1.2)))


def zone_direct(units, rng, s):
    boxes, ports, x = [], [], 0
    depth = _row_depth(units, rng, s)
    for u in units:
        door = u[0].kind != "bathroom"
        bs, length = _unit_boxes(u, rng, s, x, 0, +1, "x", depth, DOOR_SIDE if door else 0)
        if door:
            ports.append((len(boxes), DOOR_SIDE))
        boxes += bs
        x += length
    return boxes, ports


def zone_hall(units, rng, s, double, n):
    hw = rng.choice((3, 3, 4))
    sides = [[], []]
    if double:
        for i, u in enumerate(units):
            sides[i % 2].append(u)
        if not sides[0] or not sides[1]:
            return None
    else:
        sides[0] = list(units)
    boxes = []
    longest = 0
    for k, us in enumerate(sides):
        depth = _row_depth(us, rng, s)
        y = 0
        for u in us:
            bs, length = _unit_boxes(u, rng, s, hw if k == 0 else 0, y, +1 if k == 0 else -1, "y",
                                     depth, DOOR_SIDE)
            boxes += bs
            y += length
        longest = max(longest, y)
    if longest > HALL_MAX:
        return None
    boxes.insert(0, [_hall_room(n, hw, longest), 0, 0, hw, longest])
    if rng.random() < 0.5:            # mirror, so a single hallway can run on either side of its rooms
        for b in boxes:
            b[1] = -b[1] - b[3]
    return boxes, [(0, hw)]


def zone_lobby(units, rng, s, n):
    if not 2 <= len(units) <= 3:
        return None
    lw, lh = rng.randint(5, 7), rng.randint(5, 7)
    boxes = [[_hall_room(n, lw, lh), 0, 0, lw, lh]]
    spots = ["left", "right", "back"]
    rng.shuffle(spots)
    for u, spot in zip(units, spots):
        if spot == "left":
            bs, _ = _unit_boxes(u, rng, s, 0, 0, -1, "y", None, DOOR_SIDE)
        elif spot == "right":
            bs, _ = _unit_boxes(u, rng, s, lw, 0, +1, "y", None, DOOR_SIDE)
        else:
            al, _ = _dims(u[0], rng, s, DOOR_SIDE)
            x0 = rng.choice((0, lw - al, (lw - al) // 2))
            bs, _ = _unit_boxes(u, rng, s, x0, lh, +1, "x", None, DOOR_SIDE)
        boxes += bs
    if _overlaps(boxes):
        return None
    return boxes, [(0, lw)]


# --------------------------------------------------------------------------
# Day zone: the living room first, then each public room grown onto a room already placed
# --------------------------------------------------------------------------
ANCHORS = {"dining": ("living",), "kitchen": ("dining", "living"), "utility": ("kitchen",),
           "study": ("living", "dining"), "bathroom": ("living", "dining"), "lounge": ("living", "dining")}
DAY_ORDER = ("dining", "kitchen", "utility", "lounge", "study", "bathroom")


def _attach(anchor, side, room, along, depth, align, rng):
    """A box for `room` against `side` of the anchor box; along runs along that side."""
    _, x, y, w, h = anchor
    span = w if side in "NS" else h
    if align == "start":
        off = 0
    elif align == "end":
        off = span - along
    elif align == "center":
        off = (span - along) // 2
    else:
        off = rng.randint(min(0, span - along), max(0, span - along))
    if side == "S":
        return [room, x + off, y + h, along, depth]
    if side == "N":
        return [room, x + off, y - depth, along, depth]
    if side == "E":
        return [room, x + w, y + off, depth, along]
    return [room, x - depth, y + off, depth, along]


def day_zone(rooms, rng, s):
    living = next(r for r in rooms if r.kind == "living")
    order = sorted((r for r in rooms if r is not living), key=lambda r: DAY_ORDER.index(r.kind))
    for _ in range(30):
        lw, lh = _dims(living, rng, s)
        boxes = [[living, 0, 0, lw, lh]]
        for room in order:
            for _try in range(12):
                anchors = [b for b in boxes if b[0].kind in ANCHORS.get(room.kind, ("living",))] or boxes[:1]
                anchor = rng.choice(anchors)
                side = rng.choice("NSEW")
                span = anchor[3] if side in "NS" else anchor[4]
                # mostly make the room exactly as long as the wall it meets, for a tidy outline
                fit = _dims_at_depth(room, round(_cells(room, s) / span), s) if rng.random() < 0.65 else None
                if fit and fit[0] == span:
                    box = _attach(anchor, side, room, span, fit[1], "start", rng)
                else:
                    along, depth = _dims(room, rng, s, DOOR_SIDE if room.kind != "bathroom" else 0)
                    box = _attach(anchor, side, room, along, depth,
                                  rng.choice(("start", "end", "center", "any")), rng)
                if _touch_len(box, anchor) >= 4 and not _overlaps(boxes + [box]):
                    boxes.append(box)
                    break
            else:
                break
        else:
            return boxes
    return None


# --------------------------------------------------------------------------
# Putting the zones together
# --------------------------------------------------------------------------
def _place(zone_boxes, side, offset, line):
    """A zone from local coordinates into plan coordinates, against a wall line."""
    out = []
    for room, x, y, w, h in zone_boxes:
        if side == "S":
            out.append([room, offset + x, line + y, w, h])
        elif side == "N":
            out.append([room, offset + x, line - (y + h), w, h])
        elif side == "E":
            out.append([room, line + y, offset + x, h, w])
        else:
            out.append([room, line - (y + h), offset + x, h, w])
    return out


def _wall(box, side):
    """(line, lo, hi) of one side of a box."""
    _, x, y, w, h = box
    return {"S": (y + h, x, x + w), "N": (y, x, x + w), "E": (x + w, y, y + h), "W": (x, y, y + h)}[side]


def _group_units(program, rng):
    """Split the private rooms into zones. Returns (rooms for the day zone, zones as lists of units)."""
    master = next((r for r in program if r.kind == "master_bedroom"), None)
    ensuite = next((r for r in program if r.kind == "bathroom" and r.ensuite), None)
    beds = [r for r in program if r.kind == "bedroom"]
    baths = [r for r in program if r.kind == "bathroom" and not r.ensuite]
    study = [r for r in program if r.kind == "study"]
    rng.shuffle(beds)

    if not beds:
        k = 0
    elif len(beds) <= 2:
        k = 1
    elif len(beds) <= 4:
        k = rng.choice((1, 2, 2))
    else:
        k = rng.choice((2, 2, 3))
    groups = [[] for _ in range(k)]
    for i, b in enumerate(beds):
        groups[i % k].append([b])

    zones = []
    if master:
        unit = [master] + ([ensuite] if ensuite else [])
        if groups and rng.random() < 0.2:
            groups[0].append(unit)                    # the master shares a wing with other bedrooms
        else:
            zones.append([unit])
    zones += groups
    day_extra = []
    for b in baths:
        if b.name == "Powder Room" or not zones or rng.random() < 0.15:
            day_extra.append(b)
        else:
            # common bathrooms go to the bedroom wings that have none yet
            z = min(zones, key=lambda z: (sum(u[0].kind == "bathroom" for u in z), -len(z), rng.random()))
            z.append([b])
    for st in study:
        if rng.random() < 0.4 or not zones:
            day_extra.append(st)
        else:
            rng.choice(zones).append([st])
    for z in zones:
        rng.shuffle(z)
    return day_extra, [z for z in zones if z]


def _build_zone(units, rng, s, n):
    count = len(units)
    if count == 1:
        pats = ["direct"]               # a hallway to a single room is wasted floor
    elif count == 2:
        pats = ["direct", "hall", "hall", "lobby", "lobby"]
    elif count == 3:
        pats = ["direct", "hall", "double", "double", "lobby", "lobby"]
    else:
        pats = ["double", "double", "hall"]
    pat = rng.choice(pats)
    if pat == "direct":
        return zone_direct(units, rng, s)
    if pat == "lobby":
        return zone_lobby(units, rng, s, n)
    return zone_hall(units, rng, s, pat == "double", n)


def _candidate(program, rng):
    """One random house as [room, x, y, w, h] boxes (cells), or None."""
    s = rng.uniform(0.9, 1.02)
    day_extra, zones = _group_units(program, rng)
    public = [r for r in program if r.row == "public"] + day_extra
    day = day_zone(public, rng, s)
    if not day:
        return None
    boxes = [list(b) for b in day]
    open_boxes = [b for b in day if b[0].kind in OPEN_KINDS]
    used = set()
    for i, units in enumerate(zones):
        built = _build_zone(units, rng, s, i)
        if not built:
            return None
        zb, ports = built
        for _try in range(12):
            anchor = rng.choice(open_boxes)
            side = rng.choice("NSEW")
            if (id(anchor), side) in used and rng.random() < 0.7:
                continue                 # spread the wings around the house rather than along one wall
            line, lo, hi = _wall(anchor, side)
            pi, need = ports[0]
            px, pw = zb[pi][1], zb[pi][3]
            slack = max(0, pw - need)
            a, b = lo - px - slack, hi - px - pw + slack
            if a > b:
                continue
            placed = _place(zb, side, rng.randint(a, b), line)
            if _overlaps(boxes + placed):
                continue
            # every port shares a doorway's worth of wall with the open living space
            if not all(any(_touch_len(placed[idx], d) >= nd for d in open_boxes) for idx, nd in ports):
                continue
            boxes += placed
            used.add((id(anchor), side))
            break
        else:
            return None
    return boxes


def _footprint(boxes):
    """(filled cells, outline length, bounding-box cells), or a reason the outline is unbuildable:
    a hole inside the house, or a slot 1-2 cells wide between rooms."""
    x0 = min(b[1] for b in boxes) - 1
    y0 = min(b[2] for b in boxes) - 1
    W = max(b[1] + b[3] for b in boxes) + 1 - x0
    H = max(b[2] + b[4] for b in boxes) + 1 - y0
    grid = [[False] * W for _ in range(H)]
    for _, x, y, w, h in boxes:
        for yy in range(y - y0, y - y0 + h):
            row = grid[yy]
            for xx in range(x - x0, x - x0 + w):
                row[xx] = True
    seen = [[False] * W for _ in range(H)]
    seen[0][0] = True
    stack = [(0, 0)]
    while stack:
        cx, cy = stack.pop()
        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and not grid[ny][nx]:
                seen[ny][nx] = True
                stack.append((nx, ny))
    filled = perim = 0
    for yy in range(H):
        for xx in range(W):
            if grid[yy][xx]:
                filled += 1
                perim += sum(not grid[ny][nx] for nx, ny in ((xx + 1, yy), (xx - 1, yy), (xx, yy + 1), (xx, yy - 1)))
            elif not seen[yy][xx]:
                return "hole"
    for lines in (grid, list(zip(*grid))):
        for line in lines:
            i, n = 0, len(line)
            while i < n:
                if line[i]:
                    i += 1
                    continue
                j = i
                while j < n and not line[j]:
                    j += 1
                if i > 0 and j < n and j - i <= 2:
                    return "slot"
                i = j
    return filled, perim, (W - 2) * (H - 2)


class GenLayout(fb.Layout):
    """The builder's Layout, with hallways open to the living space and drawn as rooms."""

    def _add_door(self, a, b, width=fb.DOOR_W):
        kinds = {a.kind, b.kind}
        if "hallway" in kinds and kinds & set(OPEN_KINDS):
            pair = frozenset((a.id, b.id))
            if pair in self.open_pairs:
                return True
            sb = fb._shared_boundary(a, b)
            if not sb:
                return False
            orient, line, lo, hi = sb
            self.open_pairs.add(pair)
            for room in (a, b):
                room.openings[fb._side_of(room, orient, line)].append(("open", lo, hi))
            return True
        return super()._add_door(a, b, width)

    def elements(self):
        halls = [{
            "id": fb._new_id("room"), "type": "room", "kind": "hallway", "name": "Hallway",
            "area": round(((r.x1 - r.x0) / fb.U) * ((r.y1 - r.y0) / fb.U), 1),
            "left": r.x0, "top": (r.y0 + r.y1) // 2, "width": r.x1 - r.x0, "height": r.y1 - r.y0, "angle": 0,
        } for r in self.rooms if r.kind == "hallway"]
        return halls + super().elements()


def _to_rooms(boxes):
    x0 = min(b[1] for b in boxes)
    y0 = min(b[2] for b in boxes)
    return [dataclasses.replace(
        room, openings={"N": [], "S": [], "E": [], "W": []},
        name="Ensuite Bath" if room.ensuite and room.name == "Bathroom" else room.name,
        x0=fb.ORIGIN_X + (x - x0) * fb.CELL, y0=fb.ORIGIN_Y + (y - y0) * fb.CELL,
        x1=fb.ORIGIN_X + (x - x0 + w) * fb.CELL, y1=fb.ORIGIN_Y + (y - y0 + h) * fb.CELL)
        for room, x, y, w, h in boxes]


def _score(boxes, target_m2, filled, perim, bbox_area):
    """Lower is better: near the asked-for area, little hallway, a calm outline, well-shaped rooms."""
    total = filled * 0.25
    hall = sum(b[3] * b[4] for b in boxes if b[0].kind == "hallway") * 0.25
    score = 8 * abs(total / target_m2 - 1)
    score += 6 * max(0.0, hall / total - 0.06)
    score += 6 * max(0.0, perim / (4 * math.sqrt(filled)) - 1.1)       # 1.0 is a square
    score += 3 * max(0.0, 0.7 - filled / bbox_area)
    for b in boxes:
        room, _, _, w, h = b
        if room.kind not in ("hallway", "bathroom", "utility"):
            score += 0.6 * max(0.0, max(w, h) / min(w, h) - 1.6)
        # a room stuck onto the outside with outside walls on three sides reads as an afterthought
        shared = sum(_touch_len(b, o) for o in boxes if o is not b)
        outside = 1 - shared / (2 * (w + h))
        score += (2.0 if room.kind in ("bathroom", "utility", "hallway") else 1.0) * max(0.0, outside - 0.55)
    rects = [{"kind": b[0].kind, "x": b[1], "y": b[2], "w": b[3], "h": b[4]} for b in boxes]
    if bedroom_spread_fail(rects):
        score += 1.0
    return score


@dataclasses.dataclass
class Site:
    """Where the house has to go. Plan coordinates have north at the top.

    width_m / depth_m: the buildable area (the plot minus its setbacks), east-west by north-south.
    road: the compass side ("N", "E", "S", "W") the plot faces; the front door goes on it.
    vastu: prefer layouts that follow Vastu."""
    width_m: float
    depth_m: float
    road: str = "S"
    vastu: bool = False


def _variants(boxes):
    """The candidate turned to each of its 8 orientations (4 rotations, each optionally mirrored)."""
    out, cur = [], boxes
    for _ in range(4):
        out.append(cur)
        out.append([[r, -(x + w), y, w, h] for r, x, y, w, h in cur])
        cur = [[r, -(y + h), x, h, w] for r, x, y, w, h in cur]
    return out


def _bbox(boxes):
    return (min(b[1] for b in boxes), min(b[2] for b in boxes),
            max(b[1] + b[3] for b in boxes), max(b[2] + b[4] for b in boxes))


def _site_fit(boxes, site: Site):
    """The best orientation of a candidate for the site, as (boxes, cost), or None if none fits.
    cost: 3 if the living room has no wall on the road side, plus the Vastu penalty when asked."""
    W, D = site.width_m / 0.5, site.depth_m / 0.5
    best = None
    for v in _variants(boxes):
        x0, y0, x1, y1 = _bbox(v)
        if x1 - x0 > W or y1 - y0 > D:
            continue
        living = next(b for b in v if b[0].kind == "living")
        _, lx, ly, lw, lh = living
        on_road = {"N": ly == y0, "S": ly + lh == y1, "W": lx == x0, "E": lx + lw == x1}[site.road]
        cost = 0.0 if on_road else 3.0
        if site.vastu:
            rooms = [{"kind": b[0].kind, "name": b[0].name, "x0": b[1], "y0": b[2], "x1": b[1] + b[3], "y1": b[2] + b[4]}
                     for b in v if b[0].kind != "hallway"]
            cost += vastu.evaluate(rooms, entrance_side=site.road if on_road else None)["penalty"]
        if best is None or cost < best[1]:
            best = (v, cost)
    return best


# --------------------------------------------------------------------------
# Compact plans for tight plots: the buildable rectangle cut into bands from the road back
#   front   living room (and on bigger plots a front bedroom or study)
#   middle  dining, kitchen, utility, a common bathroom
#   back    bedrooms and their bathrooms, along a hallway when they don't all reach the dining room
# --------------------------------------------------------------------------
def _columns(rooms, width, depth, rng):
    """Widths (cells) for rooms side by side in a band, summing exactly to width; None if they can't."""
    if not rooms:
        return []
    ws = [max(_min_w(r, depth), round(_cells(r, 1.0) / depth)) for r in rooms]
    flex = [i for i, r in enumerate(rooms) if r.kind not in ("bathroom", "utility")] or list(range(len(rooms)))
    while sum(ws) < width:
        ws[rng.choice(flex)] += 1
    while sum(ws) > width:
        shrink = [i for i in flex if ws[i] > _min_w(rooms[i], depth)]
        if not shrink:
            return None
        ws[max(shrink, key=lambda i: ws[i])] -= 1
    return ws


def _min_w(r, depth=7):
    """Narrowest a room can be in a band `depth` cells deep: its shortest side, room for a door, and
    for bedrooms enough width to reach their minimum floor area."""
    w = max(MIN_SIDE[r.kind], DOOR_SIDE if r.kind != "bathroom" else 4)
    if r.kind in ("bedroom", "master_bedroom"):
        w = max(w, math.ceil(fb.KIND_SPEC[r.kind][1] / 0.25 / depth))
    return w


ROW_D = 8          # cells: rows of bedrooms along a passage are 4 m deep


def _compact_candidate(program, rng, W, D):
    """A compact house for a tight plot, built in bands from the road (y = 0) back; None if it won't fit.

        front    living room (+ a bedroom, study or common bathroom beside it when there's width)
        middle   dining, kitchen, utility (+ bathrooms)
        back     bedrooms side by side when they fit across the plot, opening off the dining room;
                 otherwise one bedroom per row along a side passage that starts at the dining room,
                 each with its bathroom on the far side
    Small homes without a dining room put the kitchen in the front band."""
    by = lambda k: [r for r in program if r.kind == k]  # noqa: E731
    living, dining, kitchen, utility = by("living"), by("dining"), by("kitchen"), by("utility")
    master = by("master_bedroom")
    ensuite = [r for r in program if r.kind == "bathroom" and r.ensuite]
    beds, study = by("bedroom"), by("study")
    baths = [r for r in program if r.kind == "bathroom" and not r.ensuite]
    rng.shuffle(beds)
    rng.shuffle(baths)
    width = W if rng.random() < 0.7 else W - 1
    wsum = lambda rooms, depth=7: sum(_min_w(r, depth) for r in rooms)  # noqa: E731
    front = list(living) + ([] if dining else kitchen + utility)
    middle = (dining + kitchen + utility) if dining else []
    units = ([master + ensuite] if master else []) + [[b] for b in beds] + [[st] for st in study]
    rng.shuffle(units)
    # a bedroom or study beside the living room, sometimes
    if len(units) >= 2 and rng.random() < 0.5 and units[-1][0].kind != "master_bedroom" \
            and wsum(front + units[-1]) <= width:
        front += units.pop()
    # common bathrooms near the day rooms when they fit there, else attached to a bedroom
    loose = []
    for b in baths:
        spots = [band for band in ((middle, front) if middle else (front,)) if wsum(band + [b]) <= width]
        if spots and rng.random() < 0.7:
            rng.choice(spots).append(b)
        else:
            loose.append(b)
    for b in loose:
        target = next((u for u in units if len(u) == 1 and u[0].kind == "bedroom"), None)
        if target is not None:
            target.append(b)
            continue
        spots = [band for band in ((middle, front) if middle else (front,)) if wsum(band + [b]) <= width]
        if not spots:
            return None
        spots[0].append(b)

    hw = rng.choice((3, 3, 4))
    passage = None                                      # None, or the passage's x (cells)
    if wsum([r for u in units for r in u]) <= width:
        rows = [[r for u in units for r in u]] if units else []
    else:
        if not middle:
            return None
        # bedrooms along a passage from the dining room, in rows 4 m deep: on both sides when they fit
        # (the widest opposite the narrowest), else on one side
        units.sort(key=lambda u: -wsum(u, ROW_D))
        half = (len(units) + 1) // 2
        left, right = units[:half], units[half:][::-1]
        lw = max(wsum(u, ROW_D) for u in left)
        rw = max((wsum(u, ROW_D) for u in right), default=0)
        if right and lw + hw + rw <= width and rng.random() < 0.85:
            lw += (width - hw - lw - rw) // 2
            passage = lw
            rows = [(lu, ru) for lu, ru in zip(left, right + [None] * (len(left) - len(right)))]
            rng.shuffle(rows)
        elif all(wsum(u, ROW_D) <= width - hw for u in units):
            passage = 0 if rng.random() < 0.5 else width - hw
            rows = [((u, None) if passage else (None, u)) for u in units]
        else:
            return None
    bands = [b for b in (front, middle) if b] + rows
    n_day = len(bands) - len(rows)
    if any(wsum(b) > width for b in bands[:n_day]):
        return None
    flat = lambda b: [r for u in b if u for r in u] if passage is not None and isinstance(b, tuple) else b  # noqa: E731

    # each band gets its minimum depth; what's left (of the plot, or of the program) is shared out
    # in proportion to the rooms' area, so the bands add up instead of each rounding up
    mins = [max([MIN_SIDE[r.kind] for r in flat(b)] + ([ROW_D] if passage is not None and bi >= n_day else []))
            for bi, b in enumerate(bands)]
    want = [sum(_cells(r, 1.0) for r in flat(b)) / (width - (hw if passage is not None and bi >= n_day else 0))
            for bi, b in enumerate(bands)]
    depth_total = min(D, max(sum(mins), round(sum(want) * rng.uniform(0.95, 1.08))))
    if sum(mins) > depth_total:
        return None
    depths = list(mins)
    for _ in range(depth_total - sum(mins)):
        i = max(range(len(bands)), key=lambda j: want[j] - depths[j])
        depths[i] += 1

    def place(order, x0, w, y, d, reverse_baths=False):
        """Rooms side by side in [x0, x0 + w); bathrooms kept beside their bedroom."""
        ws = _columns(order, w, d, rng)
        if ws is None:
            return None
        out, x = [], x0
        for r, cw in zip(order, ws):
            out.append([r, x, y, cw, d])
            x += cw
        return out

    boxes, y = [], 0
    for bi, band in enumerate(bands):
        d = depths[bi]
        if bi >= n_day and passage is not None:        # a row on the passage: units left and right of it
            lu, ru = band
            if lu:                                      # bedroom next to the passage, its bathroom outside
                order = sorted(lu, key=lambda r: r.kind != "bathroom")
                got = place(order, 0, passage, y, d)
                if got is None:
                    return None
                boxes += got
            if ru:
                order = sorted(ru, key=lambda r: r.kind == "bathroom")
                got = place(order, passage + hw, width - passage - hw, y, d)
                if got is None:
                    return None
                boxes += got
            y += d
            continue
        if bi >= n_day:                                 # bedrooms side by side: keep each with its bathroom
            order = list(band)
        else:
            order = list(band)
            rng.shuffle(order)
            if kitchen and kitchen[0] in order:         # the kitchen at an end (an outside wall), dining beside it
                order.remove(kitchen[0])
                pair = [kitchen[0]]
                if dining and dining[0] in order:
                    order.remove(dining[0])
                    pair = [dining[0], kitchen[0]]
                order = (pair[::-1] + order) if rng.random() < 0.5 else (order + pair)
        got = place(order, 0, width, y, d)
        if got is None:
            return None
        boxes += got
        y += d
    if passage is not None:
        top = sum(depths[:n_day])
        boxes.append([_hall_room(0, hw, y - top), passage, top, hw, y - top])
    return boxes


def _orient(boxes, road, rng, mirror=None):
    """Turn a compact plan (front at y = 0) so its front faces the road; mirrored if asked (else at random)."""
    if mirror if mirror is not None else rng.random() < 0.5:
        boxes = [[r, -(x + w), y, w, h] for r, x, y, w, h in boxes]
    turns = {"N": 0, "E": 1, "S": 2, "W": 3}[road]
    for _ in range(turns):          # each turn: rotate 90 degrees clockwise (front: N -> E -> S -> W)
        boxes = [[r, -(y + h), x, h, w] for r, x, y, w, h in boxes]
    return boxes


def generate(program, rng: random.Random | None = None, open_kitchen: bool | None = None,
             budget_s: float = 2.0, want: int = 60, max_tries: int = 20000, site: Site | None = None):
    """A varied, validated Layout for the program, or None if nothing sound turned up in time.
    With a site, the house fits the buildable area, its front door faces the road, and (if asked)
    layouts that follow Vastu are preferred."""
    rng = rng or random.Random()
    program = [r for r in program if r.kind in fb.KIND_SPEC]
    if not any(r.kind == "living" for r in program):
        return None
    target = sum(r.area for r in program)
    start = time.time()
    good = []
    for _ in range(max_tries):
        if len(good) >= want or time.time() - start > budget_s:
            break
        site_cost = 0.0
        if site and rng.random() < 0.6:
            # the compact plan is drawn with its front at y = 0, then turned to the road: across it is the
            # frontage (east-west for a north / south road, north-south for an east / west one)
            ew, ns = int(site.width_m / 0.5), int(site.depth_m / 0.5)
            front_w, back_d = (ew, ns) if site.road in ("N", "S") else (ns, ew)
            boxes = _compact_candidate(program, rng, front_w, back_d)
            if not boxes:
                continue
            if site.vastu:                 # the road fixes the front; left / right is free: take the better
                options = []
                for mirror in (False, True):
                    v = _orient(boxes, site.road, rng, mirror)
                    rooms_ = [{"kind": b[0].kind, "name": b[0].name, "x0": b[1], "y0": b[2], "x1": b[1] + b[3],
                               "y1": b[2] + b[4]} for b in v if b[0].kind != "hallway"]
                    options.append((vastu.evaluate(rooms_, entrance_side=site.road)["penalty"], v))
                site_cost, boxes = min(options, key=lambda o: o[0])
            else:
                boxes = _orient(boxes, site.road, rng)
        else:
            boxes = _candidate(program, rng)
            if not boxes:
                continue
            if site:
                fit = _site_fit(boxes, site)
                if fit is None:
                    continue
                boxes, site_cost = fit
        fp = _footprint(boxes)
        if isinstance(fp, str):
            continue
        filled, perim, bbox_area = fp
        if abs(filled * 0.25 / target - 1) > 0.25:
            continue
        rooms = _to_rooms(boxes)
        if fb._zone_fail(rooms):
            continue
        lay = GenLayout(rooms, False, preplaced=True)
        lay.open_kitchen = (rng.random() < 0.35) if open_kitchen is None else open_kitchen
        if site:
            lay.entrance_side = site.road
        try:
            lay.build()
        except fb.LayoutError:
            continue
        why = fb._post_fail(lay)
        if why == "furniture:dining" and site:
            site_cost += 1.0            # on a tight plot the dining area may double as the way through
        elif why:
            continue
        if site and lay.entrance_side_used != site.road:
            continue                    # the front door must face the road
        good.append((_score(boxes, target, filled, perim, bbox_area) + site_cost, lay))
    if not good:
        return None
    good.sort(key=lambda g: g[0])
    # one of the best few rather than always the best: the same brief should not give the same house
    top = good[:max(3, len(good) // 6)]
    weights = [math.exp(-(sc - top[0][0]) / 0.5) for sc, _ in top]
    return rng.choices([lay for _, lay in top], weights=weights)[0]
