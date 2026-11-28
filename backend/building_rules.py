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
import re

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
OUTDOOR = ("balcony", "patio", "terrace", "deck")
FLOOR_TO_FLOOR = 3.2             # m, slab to slab
PARAPET = 1.0                    # m, on the roof

# Typical limits for a small residential plot (a house on a road under ~12 m wide), by city. Bye-laws depend
# on the zone, the road width and the year, and change: these are a starting point to check a design
# against, to be confirmed with the local authority before applying. Setbacks: (plot area up to m2,
# front, rear, each side) in metres, the first row that fits. FAR None = no FAR cap (height and setbacks
# control the bulk instead). parking: car spaces per 100 m2 of built-up area (at least one above 75 m2).
CITY_RULES = {
    "Typical (NBC)": {"coverage": 65, "far": 1.75, "height": 15.0, "floors": 4, "parking": 1.0, "authority": "National Building Code 2016",
                      "setbacks": [(100, 1.5, 1.0, 0.0), (250, 3.0, 1.5, 1.0), (500, 3.0, 3.0, 1.5), (1e9, 4.5, 3.0, 3.0)]},
    "Bengaluru": {"coverage": 75, "coverage_big": (360, 65), "far": 1.75, "height": 15.0, "floors": 4, "parking": 1.0, "authority": "BBMP Building Bye-laws",
                  "setbacks": [(120, 1.0, 0.75, 0.75), (240, 1.5, 1.0, 1.0), (500, 3.0, 1.5, 1.5), (1e9, 4.0, 2.0, 2.0)]},
    "Chennai": {"coverage": 70, "far": 2.0, "height": 12.0, "floors": 4, "parking": 1.0, "authority": "TN Combined Development & Building Rules 2019",
                "setbacks": [(100, 1.5, 1.0, 0.0), (300, 1.5, 1.5, 1.0), (1e9, 3.0, 1.5, 1.5)]},
    "Hyderabad": {"coverage": 75, "far": None, "height": 10.0, "floors": 3, "parking": 1.0, "authority": "GHMC (GO 168)",
                  "setbacks": [(100, 1.5, 0.5, 0.5), (200, 1.5, 1.0, 1.0), (300, 3.0, 1.0, 1.0), (500, 3.0, 1.5, 1.5), (1e9, 3.0, 2.0, 2.0)]},
    "Mumbai": {"coverage": 60, "far": 2.0, "height": 24.0, "floors": 7, "parking": 1.0, "authority": "DCPR 2034 (base FSI with premium and TDR)",
               "setbacks": [(300, 3.0, 2.25, 1.5), (1e9, 3.0, 3.0, 3.0)]},
    "Pune": {"coverage": 60, "far": 1.1, "height": 15.0, "floors": 4, "parking": 1.0, "authority": "UDCPR 2020 (base FSI; premium and TDR can add more)",
             "setbacks": [(150, 2.0, 1.0, 1.0), (500, 3.0, 1.5, 1.5), (1e9, 4.5, 3.0, 3.0)]},
    "Ahmedabad": {"coverage": 60, "far": 1.8, "height": 15.0, "floors": 4, "parking": 1.0, "authority": "CGDCR 2017",
                  "setbacks": [(150, 2.25, 1.5, 0.0), (500, 3.0, 1.5, 1.5), (1e9, 4.5, 3.0, 3.0)]},
    "Kolkata": {"coverage": 65, "far": 1.75, "height": 12.5, "floors": 4, "parking": 1.0, "authority": "KMC Building Rules 2009",
                "setbacks": [(200, 1.2, 2.0, 1.2), (500, 2.0, 3.0, 1.5), (1e9, 3.0, 4.0, 2.0)]},
    "Delhi": {"coverage_tiers": [(100, 90), (250, 75), (750, 75), (1e9, 50)], "far_tiers": [(100, 3.5), (250, 3.0), (750, 2.25), (1e9, 1.5)],
              "height": 15.0, "floors": 4, "parking": 1.0, "authority": "Unified Building Bye-laws 2016 / MPD-2021",
              "setbacks": [(100, 0.0, 0.0, 0.0), (250, 3.0, 2.0, 0.0), (500, 4.0, 3.0, 3.0), (1e9, 6.0, 3.0, 3.0)]},
    "Jaipur": {"coverage": 60, "far": 1.8, "height": 15.0, "floors": 4, "parking": 1.0, "authority": "JDA Building Bye-laws 2020",
               "setbacks": [(150, 2.0, 1.5, 0.0), (500, 3.0, 2.0, 2.0), (1e9, 6.0, 3.0, 3.0)]},
    "Kochi": {"coverage": 65, "far": 3.0, "height": 10.0, "floors": 3, "parking": 1.0, "authority": "Kerala Municipality Building Rules 2019",
              "setbacks": [(1e9, 3.0, 1.5, 1.2)]},
    "Chandigarh": {"coverage": 60, "far": 1.5, "height": 11.0, "floors": 3, "parking": 1.0, "authority": "Chandigarh Building Rules (Urban) 2017",
                   "setbacks": [(250, 3.0, 2.5, 0.0), (1e9, 4.5, 3.0, 1.5)]},
    "Guwahati": {"coverage": 50, "far": 1.75, "height": 15.0, "floors": 4, "parking": 1.0, "authority": "GMDA Building Bye-laws 2014",
                 "setbacks": [(200, 3.0, 1.5, 1.5), (1e9, 4.5, 3.0, 3.0)]},
}
CITIES = list(CITY_RULES)

# rainwater harvesting: the plot area (m²) from which new houses must have it, typical values from each
# city's rules (0 = every new building); cities left out don't require it for a house of this size
RWH_FROM = {"Bengaluru": 111, "Chennai": 0, "Hyderabad": 200, "Mumbai": 300, "Pune": 300, "Delhi": 100,
            "Jaipur": 300, "Kochi": 100, "Chandigarh": 418}


def city_limits(city: str | None, plot_area: float | None) -> dict:
    """Coverage %, FAR, height, floors, parking and setbacks for a city and plot size."""
    rule = CITY_RULES.get(city or "", CITY_RULES["Typical (NBC)"])
    a = plot_area or 150
    cov = rule.get("coverage")
    if rule.get("coverage_big") and a > rule["coverage_big"][0]:
        cov = rule["coverage_big"][1]
    if rule.get("coverage_tiers"):
        cov = next(c for up, c in rule["coverage_tiers"] if a <= up)
    far = rule.get("far")
    if rule.get("far_tiers"):
        far = next(f for up, f in rule["far_tiers"] if a <= up)
    front, rear, side = next((f, r, s) for up, f, r, s in rule["setbacks"] if a <= up)
    return {"city": city if city in CITY_RULES else "Typical (NBC)", "authority": rule["authority"], "coverage_pct": cov, "far": far,
            "max_height_m": rule["height"], "max_floors": rule["floors"], "parking_per_100m2": rule["parking"],
            "setbacks_m": {"front": front, "rear": rear, "sides": side}}


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


def check(elements: list[dict], site: dict | None = None, limits: dict | None = None, city: str | None = None,
          rwh_tank_l: float | None = None) -> dict:
    plot_ = (site or {}).get("plot_m")
    base = city_limits(city, plot_[0] * plot_[1] if plot_ else None)
    over = {k: v for k, v in (limits or {}).items() if v not in (None, "", 0)}
    limits = {**DEFAULT_LIMITS, **{k: v for k, v in base.items() if v is not None or k == "far"}, **over}
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
    fixes = []
    indoor = [r for r in rooms if r.get("kind") not in OUTDOOR]
    n_floors = len({r.get("floor") or 1 for r in indoor}) or 1
    height = n_floors * FLOOR_TO_FLOOR + PARAPET
    add("Plot", "Height", "pass" if height <= limits["max_height_m"] + 0.01 else "fail",
        f"About {height:.1f} m to the top of the parapet ({n_floors} floor{'s' if n_floors > 1 else ''} at {FLOOR_TO_FLOOR} m); limit {limits['max_height_m']:.1f} m.")
    if height > limits["max_height_m"] + 0.01:
        fixes.append(f"Drop to {max(1, int((limits['max_height_m'] - PARAPET) // FLOOR_TO_FLOOR))} floors, or ask about a stilt (parking) floor, which some cities don't count.")
    if n_floors > limits["max_floors"]:
        add("Plot", "Floors", "fail", f"{n_floors} floors (limit {int(limits['max_floors'])}).")
    if plot:
        plot_area = plot[0] * plot[1]
        per_floor = {f: sum((r.get("area") or (r["width"] / U) * (r["height"] / U)) for r in indoor if (r.get("floor") or 1) == f)
                     for f in floors}
        # rooms are measured to wall centre lines, so add ~10% for the walls themselves; balconies, terraces
        # and patios are open to the sky and left out, as most bye-laws do
        built = {f: a * 1.1 for f, a in per_floor.items()}
        total = sum(built.values())
        coverage = 100 * built.get(floors[0], 0) / plot_area
        cov_lim = limits["coverage_pct"]
        add("Plot", "Ground coverage", "pass" if coverage <= cov_lim else "fail",
            f"About {coverage:.0f}% of the {plot_area:.0f} m² plot is built on (limit {cov_lim:.0f}%).")
        if coverage > cov_lim:
            fixes.append(f"Shrink the ground floor by about {built.get(floors[0], 0) - plot_area * cov_lim / 100:.0f} m² (coverage).")
        if limits.get("far"):
            far = total / plot_area
            add("Plot", "Floor area ratio (FAR / FSI)", "pass" if far <= limits["far"] + 1e-6 else "fail",
                f"About {far:.2f} ({total:.0f} m² built over all floors; limit {limits['far']}, so up to {limits['far'] * plot_area:.0f} m²).")
            if far > limits["far"] + 1e-6:
                fixes.append(f"Remove about {total - limits['far'] * plot_area:.0f} m² of built-up area (FAR), e.g. from the top floor; "
                             "turning a room into an open terrace takes it out of the count.")
        else:
            add("Plot", "Floor area ratio (FAR / FSI)", "info", "No FAR cap here: the height and setbacks limit the size.")
        # setbacks: does the ground floor fit inside the plot once the open margins are left?
        sb = limits.get("setbacks_m") or (site or {}).get("setbacks_m") or {}
        g = [r for r in indoor if (r.get("floor") or 1) == floors[0]]
        if g and sb:
            xs = [v for r in g for v in (_room_box(r)[0], _room_box(r)[2])]
            ys = [v for r in g for v in (_room_box(r)[1], _room_box(r)[3])]
            w_m, d_m = (max(xs) - min(xs)) / U + 0.2, (max(ys) - min(ys)) / U + 0.2     # out to the wall faces
            facing = (site or {}).get("facing") or "S"
            along, deep = (w_m, d_m) if facing in ("N", "S") else (d_m, w_m)
            room_along = plot[0] - 2 * sb.get("sides", 0)
            room_deep = plot[1] - sb.get("front", 0) - sb.get("rear", 0)
            ok_a, ok_d = along <= room_along + 0.05, deep <= room_deep + 0.05
            add("Plot", "Setbacks", "pass" if ok_a and ok_d else "fail",
                f"Front {sb.get('front')} m, rear {sb.get('rear')} m, sides {sb.get('sides')} m leave {room_along:.1f} m along the road and {room_deep:.1f} m deep; "
                f"the house is {along:.1f} × {deep:.1f} m.")
            if not ok_a:
                fixes.append(f"Make the house about {along - room_along:.1f} m narrower along the road (side setbacks).")
            if not ok_d:
                fixes.append(f"Make the house about {deep - room_deep:.1f} m shallower front to back (front and rear setbacks).")
            # parking: a car (5 × 2.5 m) in the front margin, a garage room, or a stilt floor
            # one car for a family house, two for a big one
            need = 0 if total < 75 else 1 if total < 250 else 2
            garage = [r for r in rooms if re.search(r"garage|parking|car\s?porch|carport", (r.get("name") or "").lower())]
            front_open = plot[1] - deep - sb.get("rear", 0)
            spots = len(garage) + (int(max(0.0, room_along + 2 * sb.get("sides", 0)) // 2.7) if front_open >= 5.0 else 0)
            if need:
                add("Plot", "Parking", "pass" if spots >= need else "fail",
                    f"{need} car space{'s' if need > 1 else ''} needed for {total:.0f} m²; "
                    + (f"the {front_open:.1f} m deep front yard holds {min(spots, 3)}." if front_open >= 5.0 else
                       f"the front yard is only {max(front_open, 0):.1f} m deep (a car needs 5 m)" + (", and there's a garage." if garage else "."))
                    )
                if spots < need:
                    fixes.append("Leave 5 m clear at the front for a car (push the house back), add a car porch, or put parking on a stilt floor.")
    else:
        add("Plot", "Plot limits", "info", "Add the plot size to check ground coverage, FAR, setbacks and parking.")

    # rainwater harvesting, where the city asks for it
    city_name = limits.get("city")
    if city_name in RWH_FROM:
        need_from = RWH_FROM[city_name]
        area = plot_[0] * plot_[1] if plot_ else None
        required = need_from == 0 or (area is not None and area >= need_from)
        if rwh_tank_l:
            add("Plot", "Rainwater harvesting", "pass", f"Planned: a {rwh_tank_l:,.0f} litre tank with recharge.")
        elif required:
            add("Plot", "Rainwater harvesting", "warn", f"{city_name} requires it for new houses"
                + (f" on plots of {need_from} m² or more" if need_from else "") + "; none is planned yet.")
            fixes.append("Plan rainwater harvesting: Solar & rainwater sizes the tank and recharge pit for this roof.")
        else:
            add("Plot", "Rainwater harvesting", "info", f"{city_name} requires it on plots of {need_from} m² or more"
                + ("" if area is not None else "; add the plot size to check") + ".")

    fails = sum(c["status"] == "fail" for c in checks)
    warns = sum(c["status"] == "warn" for c in checks)
    if small:
        fixes.insert(0, f"Enlarge {', '.join(small)} to the code minimum (AI Edit: \"make {small[0].split(' (')[0]} bigger\").")
    if no_window:
        fixes.append(f"Add a window on an outside wall in {', '.join(no_window)}.")
    verdict = ("Likely to meet the rules checked here" if not fails else
               "Needs changes before it would be approved")
    return {"fails": fails, "warnings": warns, "limits": limits, "checks": checks, "fixes": fixes, "verdict": verdict,
            "city": limits.get("city"), "authority": limits.get("authority"), "cities": CITIES}
