"""Building-rules check for a plan: room sizes, light and air, and plot limits.

Room minimums are the National Building Code of India 2016 (Part 3) figures:
  habitable room (living, bedroom, study)  9.5 m2, 2.4 m wide
  kitchen                                  5.0 m2, 1.8 m wide
  bathroom                                 1.8 m2, 1.2 m wide
  separate WC (powder room)                1.1 m2, 0.9 m wide
Every habitable room and kitchen needs a window on an outside wall. Many municipal bye-laws also
ask for window openings of at least a tenth of the floor area; that is checked as a warning, with
windows assumed 1.2 m tall (the plan has no window heights).

Plot limits (ground coverage, floor area ratio, number of floors) differ from city to city, so they
come from the caller, with typical defaults. State bye-laws can override all of these: this is
guidance, not an approval.
"""
from __future__ import annotations

import math

U = 20.0                         # plan units per metre
WINDOW_H = 1.2                   # m, assumed
ROOM_MIN = {                     # kind -> (min m2, min width m, what it is called)
    "living": (9.5, 2.4, "habitable room"), "bedroom": (9.5, 2.4, "habitable room"),
    "master_bedroom": (9.5, 2.4, "habitable room"), "study": (9.5, 2.4, "habitable room"),
    "kitchen": (5.0, 1.8, "kitchen"), "bathroom": (1.8, 1.2, "bathroom"),
}
WC_MIN = (1.1, 0.9, "separate WC")
NEEDS_WINDOW = ("living", "bedroom", "master_bedroom", "study", "kitchen")
DEFAULT_LIMITS = {"coverage_pct": 75.0, "far": 1.75, "max_floors": 3}   # typical for small residential plots


def _room_box(e):
    return e["left"], e["top"] - e["height"] / 2, e["left"] + e["width"], e["top"] + e["height"] / 2


def _windows_of(room, windows):
    """Total window width (m) on the room's walls."""
    x0, y0, x1, y1 = _room_box(room)
    tol = 6
    total = 0.0
    for w in windows:
        a = math.radians(w.get("angle") or 0)
        cx = w["left"] + w["width"] / 2 * math.cos(a)
        cy = w["top"] + w["width"] / 2 * math.sin(a)
        on_edge = ((abs(cy - y0) <= tol or abs(cy - y1) <= tol) and x0 - tol <= cx <= x1 + tol) or \
                  ((abs(cx - x0) <= tol or abs(cx - x1) <= tol) and y0 - tol <= cy <= y1 + tol)
        if on_edge:
            total += w["width"] / U
    return total


def check(elements: list[dict], site: dict | None = None, limits: dict | None = None) -> dict:
    limits = {**DEFAULT_LIMITS, **{k: v for k, v in (limits or {}).items() if v}}
    els = [e for e in elements if isinstance(e, dict) and e.get("type")]
    rooms = [e for e in els if e["type"] == "room" and e.get("kind")]
    floors = sorted({e.get("floor") or 1 for e in els})
    checks = []

    def add(group, rule, status, detail):
        checks.append({"group": group, "rule": rule, "status": status, "detail": detail})

    # ---- room sizes -----------------------------------------------------------------------------
    small = []
    for r in rooms:
        is_wc = r.get("kind") == "bathroom" and "powder" in (r.get("name") or "").lower()
        spec = WC_MIN if is_wc else ROOM_MIN.get(r["kind"])
        if not spec:
            continue
        w, d = r["width"] / U, r["height"] / U
        area, short = r.get("area") or w * d, min(w, d)
        min_a, min_w, what = spec
        where = f"{r.get('name') or r['kind']}" + (f" (floor {r.get('floor')})" if len(floors) > 1 else "")
        if area < min_a - 0.05 or short < min_w - 0.02:
            small.append(where)
            add("Room sizes", where, "fail",
                f"{area:.1f} m², {short:.2f} m at its narrowest; a {what} needs at least {min_a} m² and {min_w} m.")
    if not small:
        add("Room sizes", "All rooms", "pass", "Every room meets the National Building Code minimum area and width.")

    # ---- light and air ------------------------------------------------------------------------------
    windows = [e for e in els if e["type"] == "window"]
    no_window, low = [], []
    for r in rooms:
        if r["kind"] not in NEEDS_WINDOW:
            continue
        here = [w for w in windows if (w.get("floor") or 1) == (r.get("floor") or 1)]
        width = _windows_of(r, here)
        area = r.get("area") or (r["width"] / U) * (r["height"] / U)
        name = r.get("name") or r["kind"]
        if width <= 0:
            no_window.append(name)
        elif width * WINDOW_H < area / 10:
            low.append(f"{name} ({width * WINDOW_H:.1f} of {area / 10:.1f} m²)")
    if no_window:
        add("Light and air", "Windows", "fail", f"No window on an outside wall: {', '.join(no_window)}.")
    if low:
        add("Light and air", "Window area", "warn",
            "Below a tenth of the floor area (a common bye-law rule; windows taken as 1.2 m tall): " + "; ".join(low) + ".")
    if not no_window and not low:
        add("Light and air", "Windows", "pass", "Every habitable room and kitchen has windows of at least a tenth of its floor area.")

    # ---- plot limits -------------------------------------------------------------------------------
    plot = (site or {}).get("plot_m")
    if plot:
        plot_area = plot[0] * plot[1]
        per_floor = {f: sum((r.get("area") or (r["width"] / U) * (r["height"] / U)) for r in rooms if (r.get("floor") or 1) == f)
                     for f in floors}
        # rooms are measured to wall centre lines, so add ~10% for the walls themselves
        built = {f: a * 1.1 for f, a in per_floor.items()}
        coverage = 100 * built.get(floors[0], 0) / plot_area
        far = sum(built.values()) / plot_area
        add("Plot", "Ground coverage", "pass" if coverage <= limits["coverage_pct"] else "fail",
            f"About {coverage:.0f}% of the {plot_area:.0f} m² plot is built on (limit {limits['coverage_pct']:.0f}%).")
        add("Plot", "Floor area ratio (FAR / FSI)", "pass" if far <= limits["far"] else "fail",
            f"About {far:.2f} ({sum(built.values()):.0f} m² built over all floors; limit {limits['far']}).")
        add("Plot", "Floors", "pass" if len(floors) <= limits["max_floors"] else "fail",
            f"{len(floors)} floor{'s' if len(floors) > 1 else ''} (limit {int(limits['max_floors'])}).")
        buildable = (site or {}).get("buildable_m")
        if buildable:
            g = [r for r in rooms if (r.get("floor") or 1) == floors[0]]
            xs = [v for r in g for v in (_room_box(r)[0], _room_box(r)[2])]
            ys = [v for r in g for v in (_room_box(r)[1], _room_box(r)[3])]
            w_m, d_m = (max(xs) - min(xs)) / U, (max(ys) - min(ys)) / U
            fits = w_m <= buildable[0] + 0.3 and d_m <= buildable[1] + 0.3
            sb = site.get("setbacks_m") or {}
            add("Plot", "Setbacks", "pass" if fits else "fail",
                f"The house is {w_m:.1f} × {d_m:.1f} m; the space inside the setbacks"
                f"{f' (front {sb.get('front')} m, rear {sb.get('rear')} m, sides {sb.get('sides')} m)' if sb else ''}"
                f" is {buildable[0]:.1f} × {buildable[1]:.1f} m.")
    else:
        add("Plot", "Plot limits", "info", "Add the plot size to check ground coverage, FAR, floors and setbacks.")

    fails = sum(c["status"] == "fail" for c in checks)
    warns = sum(c["status"] == "warn" for c in checks)
    return {"fails": fails, "warnings": warns, "limits": limits, "checks": checks}
