"""A first electrical and plumbing layout for a plan, worked out from its rooms, doors and windows.

Electrical, per room (typical Indian residential practice):
  light        ceiling light at the centre (two in rooms over 20 m2)
  fan          ceiling fan in living, dining, bedrooms and study
  switch       a switchboard beside the room's door, on the wall the door swings against
  socket       6 A sockets spread along free walls (bedrooms 3, living 4, dining 2, study 3, kitchen 1)
  power        16 A points: kitchen counter (3) and fridge, washing machine in the utility
  ac           an AC point in bedrooms and the living room, beside a window
  geyser       16 A geyser point and an exhaust-fan point in each bathroom
  db           the distribution board, inside the front door
Plumbing:
  supply       cold / hot water points: WC, basin, shower; kitchen sink; washing machine
  drain        floor traps and waste outlets: bathrooms, kitchen sink, utility, balconies
  stack        a soil / waste stack on an outside wall of each bathroom (shared by bathrooms side by side)

Points are in plan units (20 = 1 m) with the floor they're on. This is a starting point for an
electrician and plumber, not a design: counts and positions follow common practice only.
"""
from __future__ import annotations

import math

U = 20.0
INSET = 6                    # points sit this far inside the wall line (0.3 m)
SOCKETS = {"bedroom": 3, "master_bedroom": 3, "living": 4, "dining": 2, "study": 3, "lounge": 2, "kitchen": 1}
FAN = {"living", "dining", "bedroom", "master_bedroom", "study", "lounge"}
AC = {"living", "bedroom", "master_bedroom"}
LABELS = {
    "light": "Light point", "fan": "Fan point", "switch": "Switchboard", "socket": "6 A socket",
    "power": "16 A power point", "ac": "AC point", "geyser": "Geyser point", "exhaust": "Exhaust fan point",
    "db": "Distribution board", "supply": "Water supply point", "drain": "Floor trap / waste outlet",
    "stack": "Soil / waste stack",
}
SYSTEM = {"supply": "plumbing", "drain": "plumbing", "stack": "plumbing"}


def _box(r):
    return r["left"], r["top"] - r["height"] / 2, r["left"] + r["width"], r["top"] + r["height"] / 2


def _mid(e):
    a = math.radians(e.get("angle") or 0)
    return e["left"] + e["width"] / 2 * math.cos(a), e["top"] + e["width"] / 2 * math.sin(a)


def _edges(box):
    """The room's four walls as (name, fixed coordinate, lo, hi, horizontal?, inward normal)."""
    x0, y0, x1, y1 = box
    return [("N", y0, x0, x1, True, (0, 1)), ("S", y1, x0, x1, True, (0, -1)),
            ("W", x0, y0, y1, False, (1, 0)), ("E", x1, y0, y1, False, (-1, 0))]


def _openings_on(edge, openings, tol=6):
    """Intervals [lo, hi] along this wall taken by doors / windows, each with its kind."""
    name, c, lo, hi, horiz, _ = edge
    out = []
    for o in openings:
        mx, my = _mid(o)
        along, across = (mx, my) if horiz else (my, mx)
        if abs(across - c) <= tol and lo - tol <= along <= hi + tol:
            half = o["width"] / 2
            out.append((along - half, along + half, o["type"], o))
    return sorted(out)


def _free_stretches(edge, openings, margin=6):
    name, c, lo, hi, horiz, _ = edge
    taken = [(a - margin, b + margin) for a, b, _, _ in _openings_on(edge, openings)]
    cur, out = lo + margin, []
    for a, b in taken:
        if a > cur:
            out.append((cur, min(a, hi - margin)))
        cur = max(cur, b)
    if hi - margin > cur:
        out.append((cur, hi - margin))
    return [(a, b) for a, b in out if b - a > 4]


def _on_wall(edge, along):
    name, c, lo, hi, horiz, n = edge
    x, y = (along, c) if horiz else (c, along)
    return x + n[0] * INSET, y + n[1] * INSET


def layout(elements: list[dict]) -> dict:
    els = [e for e in elements if isinstance(e, dict) and e.get("type")]
    rooms = [e for e in els if e["type"] == "room" and e.get("kind")]
    points = []

    def add(kind, x, y, room, floor):
        points.append({"type": kind, "system": SYSTEM.get(kind, "electrical"), "x": round(x, 1), "y": round(y, 1),
                       "floor": floor, "room": room.get("name") if room else None})

    for floor in sorted({e.get("floor") or 1 for e in els}):
        here = [r for r in rooms if (r.get("floor") or 1) == floor]
        if not here:
            continue
        openings = [e for e in els if e["type"] in ("door", "window") and (e.get("floor") or 1) == floor]
        X0 = min(_box(r)[0] for r in here)
        Y0 = min(_box(r)[1] for r in here)
        X1 = max(_box(r)[2] for r in here)
        Y1 = max(_box(r)[3] for r in here)
        outer = {"N": lambda e: abs(e[1] - Y0) < 2, "S": lambda e: abs(e[1] - Y1) < 2,
                 "W": lambda e: abs(e[1] - X0) < 2, "E": lambda e: abs(e[1] - X1) < 2}
        stacks = []
        for r in here:
            kind = r["kind"]
            if kind == "hallway":
                add("light", (r["left"] + r["width"] / 2), r["top"], r, floor)
                continue
            box = _box(r)
            cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
            w, h = box[2] - box[0], box[3] - box[1]
            area = (w / U) * (h / U)
            edges = _edges(box)

            # lights and fan, kept off the middle where drawings print the room's name
            up, down = cy - h * 0.27, cy + h * 0.27
            if kind in FAN:
                add("fan", cx, up, r, floor)
                offs = (0.28, 0.72) if area > 20 else (0.5,)
                for f in offs:
                    add("light", box[0] + w * f, down, r, floor)
            elif kind not in ("balcony",):
                add("light", cx, up, r, floor)

            # switchboard beside the door (on the side away from its hinge), else on the longest wall
            door_spot = None
            for edge in edges:
                for a, b, typ, o in _openings_on(edge, openings):
                    if typ == "door":
                        after = b + 6 if (o.get("hinge") or 1) > 0 else a - 6
                        if edge[2] + 4 <= after <= edge[3] - 4:
                            door_spot = (edge, after)
                            break
                if door_spot:
                    break
            if door_spot:
                add("switch", *_on_wall(*door_spot), r, floor)

            # sockets along free walls, the most free wall first
            stretches = sorted(((b - a, edge, a, b) for edge in edges for a, b in _free_stretches(edge, openings)),
                               key=lambda s: -s[0])
            def spread(n, kind_):
                placed = 0
                for length, edge, a, b in stretches:
                    if placed >= n:
                        break
                    k = max(1, min(n - placed, int(length // (2.5 * U)) + 1))
                    for i in range(k):
                        add(kind_, *_on_wall(edge, a + (i + 0.5) * (b - a) / k), r, floor)
                    placed += k
            spread(SOCKETS.get(kind, 0), "socket")
            if kind == "kitchen":
                spread(4, "power")                          # counter appliances and the fridge
                if stretches:                               # the sink on the longest free wall
                    _, edge, a, b = stretches[0]
                    add("supply", *_on_wall(edge, (a + b) / 2), r, floor)
                    add("drain", *_on_wall(edge, (a + b) / 2 + 12), r, floor)
            if kind == "utility":
                spread(1, "power")
                add("supply", cx - 6, down, r, floor)
                add("drain", cx + 6, down, r, floor)
            if kind == "balcony":
                add("drain", cx, down, r, floor)

            # AC beside a window
            if kind in AC:
                win = next(((edge, a, b) for edge in edges for a, b, typ, _ in _openings_on(edge, openings) if typ == "window"), None)
                if win:
                    edge, a, b = win
                    spot = b + 10 if b + 10 <= edge[3] - 6 else a - 10
                    add("ac", *_on_wall(edge, spot), r, floor)

            # bathrooms: geyser, exhaust, WC / basin / shower supply, floor trap, a stack on an outside wall
            if kind == "bathroom":
                powder = "powder" in (r.get("name") or "").lower()
                if not powder:
                    add("geyser", *_on_wall(edges[0], box[0] + w * 0.75), r, floor)
                add("exhaust", cx, box[1] + INSET, r, floor)
                fixtures = 2 if powder else 3
                for i in range(fixtures):
                    add("supply", box[0] + w * (i + 1) / (fixtures + 1), box[3] - INSET, r, floor)
                add("drain", cx, down, r, floor)
                outside = [e for e in edges if outer[e[0]](e)]
                edge = outside[0] if outside else edges[0]
                sx, sy = _on_wall(edge, edge[2] + INSET)
                near = next((s for s in stacks if math.hypot(s[0] - sx, s[1] - sy) < 1.5 * U), None)
                if near is None:
                    stacks.append((sx, sy))
                    add("stack", sx, sy, r, floor)

        # the distribution board inside the front door: the outside door nearest the living room
        living = next((r for r in here if r["kind"] == "living"), None)
        entrance = None
        for o in openings:
            if o["type"] != "door":
                continue
            mx, my = _mid(o)
            if min(abs(mx - X0), abs(mx - X1), abs(my - Y0), abs(my - Y1)) <= 6:
                d = math.hypot(mx - (living["left"] + living["width"] / 2), my - living["top"]) if living else 0
                if entrance is None or d < entrance[0]:
                    entrance = (d, mx, my)
        if entrance and floor == min(e.get("floor") or 1 for e in els):
            _, mx, my = entrance
            dx = INSET * 3 if abs(mx - X0) < 6 else (-INSET * 3 if abs(mx - X1) < 6 else 24)
            dy = INSET * 3 if abs(my - Y0) < 6 else (-INSET * 3 if abs(my - Y1) < 6 else 0)
            add("db", mx + dx, my + dy, living, floor)

    counts: dict = {}
    for p in points:
        counts[p["type"]] = counts.get(p["type"], 0) + 1
    return {"points": points, "counts": counts, "labels": LABELS}
