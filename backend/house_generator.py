"""
Organic house generator.

Rooms are placed one at a time as whole, well-proportioned rectangles, each one attached to
the room it opens into: bedrooms, the study, the common bathroom and the kitchen hang off the
open living / dining space, an attached bathroom hangs off its own bedroom, the utility off
the kitchen.  Nothing is made by slicing a box into strips, and there are no corridors,
lobbies or lounges, so the footprint grows irregularly the way a real house does.

Every candidate position is scored (touching more rooms keeps the house compact, lining up
with existing walls keeps it tidy, a little noise keeps every house different) and checked
(each room keeps an outside wall for its window, the living room keeps one for the entrance,
the living area keeps enough free wall for the doors still to come).  A finished house must
also pass floorplan_builder's checks; otherwise the generator simply tries again.

Grid: 1 cell = 0.5 m, rooms are (x, y, w, h) in cells.
"""
from __future__ import annotations

import copy
import random
import time

import floorplan_builder as fb

DOOR = 5            # cells of shared wall a door needs (fb.DOOR_W + 2 * fb.MARGIN = 2.3 m)
WINDOW = 5          # cells of outside wall a window needs
MIN_SIDE = {"living": 7, "dining": 5, "kitchen": 5, "utility": 3,
            "master_bedroom": 7, "bedroom": 6, "study": 5, "bathroom": 4}
MAX_ASPECT = {"bathroom": 1.7, "utility": 1.8, "kitchen": 1.6, "dining": 1.5, "living": 1.5}
OPEN_ZONE = ("living", "dining")
WINDOW_KINDS = ("living", "kitchen", "master_bedroom", "bedroom", "study")


class GenerationError(Exception):
    pass


# --------------------------------------------------------------------------
# Rectangle helpers
# --------------------------------------------------------------------------
def _overlap(a, b):
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


def _shared(a, b):
    """Length (cells) of the wall two rectangles share."""
    if a[0] + a[2] == b[0] or b[0] + b[2] == a[0]:
        return max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    if a[1] + a[3] == b[1] or b[1] + b[3] == a[1]:
        return max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    return 0


def _cells(r):
    x, y, w, h = r
    return [(x + i, y + j) for i in range(w) for j in range(h)]


def _outside_runs(r, occ):
    """Lengths of the unbroken stretches of r's walls that face outside."""
    x, y, w, h = r
    sides = ([(x + i, y - 1) for i in range(w)], [(x + i, y + h) for i in range(w)],
             [(x - 1, y + j) for j in range(h)], [(x + w, y + j) for j in range(h)])
    runs = []
    for side in sides:
        cur = 0
        for c in side:
            if c in occ:
                if cur:
                    runs.append(cur)
                cur = 0
            else:
                cur += 1
        if cur:
            runs.append(cur)
    return runs


def _capacity(r, occ, size=DOOR):
    return sum(n // size for n in _outside_runs(r, occ))


# --------------------------------------------------------------------------
# Room sizes
# --------------------------------------------------------------------------
def _size_options(kind, area_m2):
    """Every (w, h) in cells with a sensible shape and close to the wanted area."""
    target = area_m2 * 4
    lo, asp = MIN_SIDE[kind], MAX_ASPECT.get(kind, 1.4)
    opts, near = [], []
    for w in range(lo, 31):
        for h in range(lo, 31):
            if max(w, h) / min(w, h) > asp:
                continue
            near.append((abs(w * h - target), (w, h)))
            if 0.88 * target <= w * h <= 1.18 * target:
                opts.append((w, h))
    if not opts:
        near.sort()
        opts = [s for _, s in near[:4]]
    return opts


def _flush_sizes(kind, area_m2, parent):
    """Sizes whose side matches a side of the parent, so the two rooms line up."""
    target = area_m2 * 4
    lo, asp = MIN_SIDE[kind], MAX_ASPECT.get(kind, 1.4)
    out = []
    for side in (parent[2], parent[3]):
        if side < lo:
            continue
        other = max(lo, round(target / side))
        if max(side, other) / min(side, other) <= asp and 0.85 * target <= side * other <= 1.25 * target:
            out += [(side, other), (other, side)]
    return out


# --------------------------------------------------------------------------
# One attempt
# --------------------------------------------------------------------------
class _Attempt:
    def __init__(self, program: list[fb.Room], rng: random.Random, grow: float):
        self.rng = rng
        self.rooms = {r.id: copy.deepcopy(r) for r in program}
        for r in self.rooms.values():
            if r.kind in OPEN_ZONE:
                r.area *= grow
            elif r.kind in ("master_bedroom", "bedroom", "kitchen", "study"):
                r.area *= rng.uniform(1.0, 1.12)     # a little variety in every house
        beds = [r.area for r in self.rooms.values() if r.kind == "bedroom"]
        for r in self.rooms.values():
            if r.kind == "master_bedroom" and beds:
                r.area = max(r.area, 1.2 * max(beds))
        self.rect: dict[str, tuple] = {}
        self.occ: dict[tuple, str] = {}
        self.order, self.parents = self._plan()

    # -- who attaches to whom ----------------------------------------------------
    def _plan(self):
        rng = self.rng
        by_kind = {}
        for r in self.rooms.values():
            by_kind.setdefault(r.kind, []).append(r)
        living = by_kind["living"][0]
        dining = (by_kind.get("dining") or [None])[0]
        kitchen = (by_kind.get("kitchen") or [None])[0]
        utility = (by_kind.get("utility") or [None])[0]
        zone = [living] + ([dining] if dining else [])
        owned: dict[str, list] = {}
        for r in self.rooms.values():
            if r.owner:
                owned.setdefault(r.owner, []).append(r)

        order, parents = [living], {living.id: []}
        if dining:
            order.append(dining)
            parents[dining.id] = [living]
        beds = by_kind.get("master_bedroom", []) + by_kind.get("bedroom", [])
        rng.shuffle(beds)
        rest = by_kind.get("study", []) + [r for r in by_kind.get("bathroom", []) if not r.owner]
        rng.shuffle(rest)
        deps = beds + rest
        if kitchen:
            # the kitchen usually goes in early so it can sit beside the dining table
            deps.insert(0 if rng.random() < 0.7 else rng.randint(0, len(deps)), kitchen)
        for r in deps:
            order.append(r)
            if r is kitchen:
                parents[r.id] = [dining] if dining and rng.random() < 0.8 else zone
                if utility:
                    order.append(utility)
                    parents[utility.id] = [kitchen]
            else:
                parents[r.id] = zone
            for bath in owned.get(r.id, []):
                order.append(bath)
                parents[bath.id] = [r]
        return order, parents

    # -- placing ---------------------------------------------------------------------
    def run(self):
        first = self.order[0]
        w, h = self.rng.choice(_size_options(first.kind, first.area))
        self._commit(first, (0, 0, w, h))
        for i, room in enumerate(self.order[1:], start=1):
            if not self._place(room, self.order[i + 1:]):
                raise GenerationError(f"no room for {room.name}")
        return self

    def _commit(self, room, r):
        self.rect[room.id] = r
        for c in _cells(r):
            self.occ[c] = room.id

    def _place(self, room, pending):
        rng = self.rng
        parents = [self.rect[p.id] for p in self.parents[room.id]]
        sizes = _size_options(room.kind, room.area)
        sizes = rng.sample(sizes, min(5, len(sizes)))
        for p in parents:
            sizes += _flush_sizes(room.kind, room.area, p)
        open_plan = room.kind == "dining"
        hug = 1.6 if room.kind in ("bathroom", "utility") else 1.0     # small rooms tuck into corners
        placed = list(self.rect.values())
        xs = {v for r in placed for v in (r[0], r[0] + r[2])}
        ys = {v for r in placed for v in (r[1], r[1] + r[3])}
        bx0 = min(r[0] for r in placed)
        by0 = min(r[1] for r in placed)
        bx1 = max(r[0] + r[2] for r in placed)
        by1 = max(r[1] + r[3] for r in placed)
        bbox = (bx1 - bx0) * (by1 - by0)

        scored = []
        for w, h in set(sizes):
            for p in parents:
                for cand in self._around(p, w, h):
                    if any(_overlap(cand, o) for o in placed):
                        continue
                    if open_plan and _shared(cand, p) < 0.6 * min(_side_against(cand, p), _side_against(p, cand)):
                        continue        # the dining area is open to the living room along most of its side
                    contact = sum(_shared(cand, o) for o in placed) * hug
                    slivers = sum(_sliver(cand, o) for o in placed)
                    align = (cand[0] in xs) + (cand[0] + w in xs) + (cand[1] in ys) + (cand[1] + h in ys)
                    grow = ((max(bx1, cand[0] + w) - min(bx0, cand[0])) *
                            (max(by1, cand[1] + h) - min(by0, cand[1])) - bbox - w * h)
                    score = contact + 2.0 * align - 0.06 * max(0, grow) - slivers + rng.gauss(0, 2.5)
                    scored.append((score, cand))
        scored.sort(key=lambda s: -s[0])
        for _, cand in scored[:60]:
            if self._feasible(room, cand, pending):
                self._commit(room, cand)
                return True
        return False

    @staticmethod
    def _around(p, w, h):
        """Positions where a w x h room shares at least a door's width of wall with p."""
        px, py, pw, ph = p
        for y in range(py - h + DOOR, py + ph - DOOR + 1):
            yield (px + pw, y, w, h)
            yield (px - w, y, w, h)
        for x in range(px - w + DOOR, px + pw - DOOR + 1):
            yield (x, py + ph, w, h)
            yield (x, py - h, w, h)

    def _feasible(self, room, cand, pending):
        occ = dict(self.occ)
        for c in _cells(cand):
            occ[c] = room.id
        rects = dict(self.rect)
        rects[room.id] = cand

        def outside_of(rid):
            return _OccView(occ, rid)

        for rid, r in rects.items():
            kind = self.rooms[rid].kind
            if kind in WINDOW_KINDS and max(_outside_runs(r, outside_of(rid)) or [0]) < WINDOW:
                return False
        living = next(rid for rid in rects if self.rooms[rid].kind == "living")
        if _capacity(rects[living], outside_of(living)) < 2:           # entrance + a window
            return False
        zone_left = sum(1 for p in pending if self.parents[p.id] and
                        self.parents[p.id][0].kind in OPEN_ZONE and not p.owner)
        zone_cap = sum(_capacity(rects[rid], outside_of(rid)) for rid in rects
                       if self.rooms[rid].kind in OPEN_ZONE) - 2
        if zone_cap < zone_left:
            return False
        # a bedroom / kitchen that still expects an attached room needs a door's worth of free wall
        # besides its window
        for p in pending:
            owner = self.parents[p.id][0] if self.parents[p.id] else None
            if owner is not None and owner.id in rects and owner.kind not in OPEN_ZONE:
                if _capacity(rects[owner.id], outside_of(owner.id)) < 2:
                    return False
        return True

    # -- finishing -------------------------------------------------------------------
    def has_holes(self):
        rs = list(self.rect.values())
        x0 = min(r[0] for r in rs) - 1
        y0 = min(r[1] for r in rs) - 1
        x1 = max(r[0] + r[2] for r in rs) + 1
        y1 = max(r[1] + r[3] for r in rs) + 1
        seen = {(x0, y0)}
        stack = [(x0, y0)]
        while stack:
            cx, cy = stack.pop()
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if x0 <= nx < x1 and y0 <= ny < y1 and (nx, ny) not in seen and (nx, ny) not in self.occ:
                    seen.add((nx, ny))
                    stack.append((nx, ny))
        return (x1 - x0) * (y1 - y0) - len(seen) > len(self.occ)

    def tidy(self):
        """Grow rooms by a cell or two into small notches and facade jogs so the outline reads cleanly."""
        rng = self.rng
        start_area = {rid: r[2] * r[3] for rid, r in self.rect.items()}
        for _ in range(3):
            changed = False
            ids = list(self.rect)
            rng.shuffle(ids)
            for rid in ids:
                kind = self.rooms[rid].kind
                for depth in (1, 2, 3):
                    for strip, grown in self._strips(self.rect[rid], depth):
                        others = [r for o, r in self.rect.items() if o != rid]
                        if any(_overlap(strip, o) for o in others):
                            continue
                        touch = sum(_shared(strip, o) for o in others)
                        notch = touch >= 2 * depth + 1                 # walled in on both ends
                        jog = depth <= 2 and touch >= depth            # one end lines up with a neighbour
                        if not (notch or jog):
                            continue
                        w, h = grown[2], grown[3]
                        if max(w, h) / min(w, h) > MAX_ASPECT.get(kind, 1.4) + 0.25:
                            continue
                        if w * h > 1.22 * start_area[rid] or w * h / 4 > fb.KIND_SPEC[kind][3]:
                            continue
                        for c in _cells(self.rect[rid]):
                            del self.occ[c]
                        self._commit(self.rooms[rid], grown)
                        changed = True
                        break
            if not changed:
                break

    @staticmethod
    def _strips(r, d):
        x, y, w, h = r
        return (((x, y - d, w, d), (x, y - d, w, h + d)),
                ((x, y + h, w, d), (x, y, w, h + d)),
                ((x - d, y, d, h), (x - d, y, w + d, h)),
                ((x + w, y, d, h), (x, y, w + d, h)))

    def layout(self, open_kitchen: bool) -> fb.Layout:
        rooms = []
        for room in self.order:
            x, y, w, h = self.rect[room.id]
            r = copy.deepcopy(room)
            r.x0, r.y0 = fb.ORIGIN_X + x * fb.CELL, fb.ORIGIN_Y + y * fb.CELL
            r.x1, r.y1 = r.x0 + w * fb.CELL, r.y0 + h * fb.CELL
            r.area = w * h / 4
            rooms.append(r)
        xs0 = min(r.x0 for r in rooms) - fb.ORIGIN_X
        ys0 = min(r.y0 for r in rooms) - fb.ORIGIN_Y
        for r in rooms:
            r.x0 -= xs0
            r.x1 -= xs0
            r.y0 -= ys0
            r.y1 -= ys0
        lay = fb.Layout(rooms)
        lay.open_kitchen = open_kitchen
        return lay.build()

    def quality(self):
        rs = list(self.rect.values())
        w = max(r[0] + r[2] for r in rs) - min(r[0] for r in rs)
        h = max(r[1] + r[3] for r in rs) - min(r[1] for r in rs)
        fill = len(self.occ) / (w * h)
        edges = len({v for r in rs for v in (r[0], r[0] + r[2])}) + len({v for r in rs for v in (r[1], r[1] + r[3])})
        return 10 * fill - 0.12 * edges - 0.8 * max(0, max(w, h) / min(w, h) - 1.6)


class _OccView:
    """occ without one room's own cells (a room never blocks its own outside walls)."""
    __slots__ = ("occ", "rid")

    def __init__(self, occ, rid):
        self.occ, self.rid = occ, rid

    def __contains__(self, c):
        v = self.occ.get(c)
        return v is not None and v != self.rid


def _sliver(a, b):
    """Penalty for leaving a 0.5-1 m strip of outside space between two parallel walls."""
    pen = 0
    if min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]) > 0:
        gap = max(b[1] - (a[1] + a[3]), a[1] - (b[1] + b[3]))
        pen += {1: 14, 2: 7}.get(gap, 0)
    if min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]) > 0:
        gap = max(b[0] - (a[0] + a[2]), a[0] - (b[0] + b[2]))
        pen += {1: 14, 2: 7}.get(gap, 0)
    return pen


def _side_against(a, b):
    """Length of a's side that faces b."""
    if a[0] + a[2] == b[0] or b[0] + b[2] == a[0]:
        return a[3]
    return a[2]


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------
def generate(program: list[fb.Room], rng: random.Random | None = None,
             keep: int = 6, budget_s: float = 4.0) -> fb.Layout:
    """Grow a house for the room program; returns the best of a few valid candidates."""
    rng = rng or random.Random()
    deadline = time.monotonic() + budget_s
    found, last = [], None
    grow = 1.0
    tries = 0
    while time.monotonic() < deadline or (not found and tries < 4000):
        tries += 1
        if tries % 150 == 0 and not found:
            grow = min(1.6, grow + 0.1)     # a cramped living area: give it more wall to open rooms off
        try:
            att = _Attempt(program, rng, grow).run()
        except GenerationError as e:
            last = e
            continue
        if att.has_holes():
            continue
        open_kitchen = rng.random() < 0.35
        lay = None
        for tidy in (True, False):
            trial = copy.deepcopy(att)
            if tidy:
                trial.tidy()
                if trial.has_holes():
                    continue
            try:
                cand = trial.layout(open_kitchen)
            except fb.LayoutError as e:
                last = e
                continue
            why = fb._post_fail(cand)
            if why:
                last = why
                continue
            lay = cand
            att = trial
            break
        if lay is None:
            continue
        found.append((att.quality() + rng.uniform(0, 0.6), lay))
        if len(found) >= keep:
            break
    if not found:
        raise fb.LayoutError(f"could not grow a house ({last})")
    return max(found, key=lambda f: f[0])[1]
