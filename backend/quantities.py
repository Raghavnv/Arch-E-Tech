"""
Material quantities and a build schedule from a plan.

For an ordinary Indian house: an RCC frame (isolated footings, plinth beam, columns, beams, slabs)
with burnt-clay brick walls, 230 mm outside and 115 mm inside, cement plaster, vitrified tile floors,
emulsion paint. Quantities come from the drawing itself (wall lengths and heights less the openings,
floor and roof areas, the footprint's corners for columns), with the usual Indian rules for mixes,
wastage and dry-volume factors. Each is an estimate to plan and budget with, not a contractor's BOQ.

    estimate(elements, rates=None) -> {
        "summary": {...}, "materials": [{key, item, qty, unit, rate, cost, note}],
        "works": [{key, item, qty, unit}], "phases": [{key, name, start_day, days, cost, materials}],
        "total_cost", "total_days", "assumptions": [...]
    }
"""
from __future__ import annotations

import math

U = 20.0                      # plan units per metre
WALL_H = 3.0                  # floor to ceiling
FLOOR_H = 3.2                 # floor to floor, with the slab
SLAB_T = 0.125
PLINTH_H = 0.45
DOOR_H, WINDOW_H = 2.1, 1.2
BEAM_D = 0.45                 # beam depth, slab included
EXT_T, INT_T = 0.23, 0.115
WET_KINDS = {"bathroom", "utility"}

# Indicative 2026 Indian material prices in rupees, supply only; the client may pass its own.
RATES = {
    "cement": 400.0,          # per 50 kg bag, OPC 53
    "steel": 68.0,            # per kg, Fe 500D TMT
    "sand": 3200.0,           # per m³ (M-sand / river sand)
    "aggregate": 2400.0,      # per m³, 20 mm
    "bricks": 9.0,            # each, first-class red brick
    "tiles": 750.0,           # per m², vitrified floor and ceramic wall tiles, laid
    "paint": 320.0,           # per litre, interior / exterior emulsion
    "putty": 30.0,            # per kg
    "primer": 220.0,          # per litre
    "waterproofing": 180.0,   # per m², membrane / coating
    "doors": 14000.0,         # each, frame, shutter and hardware
    "windows": 9000.0,        # per m², aluminium / UPVC with glass
    "wiring": 38.0,           # per metre of wire, with conduit share
    "pipes": 160.0,           # per metre, CPVC supply and PVC drainage
    "labour": 0.42,           # labour as a share of the material cost
}

# per m³ of wet concrete / mortar: (cement bags, sand m³, aggregate m³), dry factors included
MIX = {
    "M20": (8.06, 0.42, 0.84),          # 1 : 1.5 : 3
    "PCC": (3.40, 0.47, 0.94),          # 1 : 4 : 8
    "brick_mortar": (1.25, 0.32, 0.0),  # 1 : 6, for the 0.25 m³ of mortar in each m³ of brickwork
    "plaster": (6.5, 1.36, 0.0),        # 1 : 5 mortar, per m³ of plaster
}
STEEL = {"footing": 80, "plinth_beam": 120, "column": 200, "beam": 160, "slab": 85}   # kg per m³


def _box(r):
    h = r["height"]
    return (r["left"], r["top"] - h / 2, r["left"] + r["width"], r["top"] + h / 2)


def _ends(e):
    a = math.radians(e.get("angle") or 0)
    x0, y0 = e["left"], e["top"]
    return x0, y0, x0 + e["width"] * math.cos(a), y0 + e["width"] * math.sin(a)


def _in_room(x, y, rooms):
    return any(b[0] < x < b[2] and b[1] < y < b[3] for b in rooms)


def _footprint(boxes, grow):
    """Area (m²) and perimeter (m) of the union of rooms grown by `grow` units, on a compressed grid."""
    rs = [(b[0] - grow, b[1] - grow, b[2] + grow, b[3] + grow) for b in boxes]
    xs = sorted({v for r in rs for v in (r[0], r[2])})
    ys = sorted({v for r in rs for v in (r[1], r[3])})
    nx, ny = len(xs) - 1, len(ys) - 1
    fill = [[any(r[0] < (xs[i] + xs[i + 1]) / 2 < r[2] and r[1] < (ys[j] + ys[j + 1]) / 2 < r[3] for r in rs)
             for i in range(nx)] for j in range(ny)]
    at = lambda i, j: 0 <= i < nx and 0 <= j < ny and fill[j][i]
    area = sum((xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]) for j in range(ny) for i in range(nx) if fill[j][i])
    per = 0.0
    corners = 0
    for j in range(ny):
        for i in range(nx):
            if not fill[j][i]:
                continue
            if not at(i, j - 1): per += xs[i + 1] - xs[i]
            if not at(i, j + 1): per += xs[i + 1] - xs[i]
            if not at(i - 1, j): per += ys[j + 1] - ys[j]
            if not at(i + 1, j): per += ys[j + 1] - ys[j]
    for j in range(ny + 1):                 # outline corners: grid points where the outline turns
        for i in range(nx + 1):
            q = (at(i - 1, j - 1), at(i, j - 1), at(i - 1, j), at(i, j))
            n = sum(q)
            if n in (1, 3) or q in ((True, False, False, True), (False, True, True, False)):
                corners += 1
    return area / (U * U), per / U, corners


def _floor_takeoff(els, floor):
    here = [e for e in els if (e.get("floor") or 1) == floor]
    rooms = [e for e in here if e["type"] == "room"]
    # a ground-level patio or deck is paving outside the house, not part of the building
    boxes = [_box(r) for r in rooms if r.get("kind") not in ("patio", "deck")]
    walls = [e for e in here if e["type"] == "wall" and (e.get("width") or 0) > 0]
    doors = [e for e in here if e["type"] == "door"]
    windows = [e for e in here if e["type"] == "window"]

    ext_len = int_len = 0.0
    ends = set()
    for w in walls:
        x0, y0, x1, y1 = _ends(w)
        ends.add((round(x0 / 10), round(y0 / 10)))
        ends.add((round(x1 / 10), round(y1 / 10)))
        L = w["width"] / U
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        a = math.radians(w.get("angle") or 0)
        nx, ny = -math.sin(a) * 10, math.cos(a) * 10
        outside = not (_in_room(mx + nx, my + ny, boxes) and _in_room(mx - nx, my - ny, boxes))
        if boxes and outside:
            ext_len += L
        else:
            int_len += L
    if not boxes:                           # walls drawn without rooms: treat the longest half as outside
        ext_len, int_len = int_len * 0.55, int_len * 0.45

    door_area = sum(d["width"] / U * DOOR_H for d in doors)
    window_area = sum(wn["width"] / U * WINDOW_H for wn in windows)
    # split openings between outer and inner walls by length share (windows are almost all outside)
    share = ext_len / max(ext_len + int_len, 0.01)
    ext_open = window_area + door_area * share * 0.5
    int_open = door_area - door_area * share * 0.5
    ext_face = max(0.0, ext_len * WALL_H - ext_open)
    int_face = max(0.0, int_len * WALL_H - int_open)
    brick_k = (FLOOR_H - BEAM_D) / WALL_H        # brickwork stops under the beams

    floor_area = sum((b[2] - b[0]) * (b[3] - b[1]) for b in boxes) / (U * U)
    if boxes:
        plinth_area, perimeter, corners = _footprint(boxes, 4)      # out to the outer face of the walls
    else:
        plinth_area, perimeter, corners = floor_area * 1.12, ext_len, 4
    wet = [r for r in rooms if r.get("kind") in WET_KINDS]
    wet_floor = sum((r["width"] / U) * (r["height"] / U) for r in wet)
    wet_wall = sum(2 * (r["width"] + r["height"]) / U * 2.1 for r in wet)      # tiled to 2.1 m
    balcony = sum((r["width"] / U) * (r["height"] / U) for r in rooms if r.get("kind") in ("balcony", "terrace"))
    # columns: the outline's corners, wall junctions inside, and one every 4 m along long outer runs
    junctions = max(0, len(ends) - corners)
    columns = round(corners * 0.5 + junctions * 0.25 + perimeter / 5.0)
    # a column grid of about 3–4.5 m: between one per 14 m² and one per 7 m² of plinth
    columns = int(max(4, plinth_area / 14, min(columns, plinth_area / 7)))
    return {
        "floor": floor, "rooms": len(rooms), "floor_area": floor_area, "plinth_area": plinth_area,
        "perimeter": perimeter, "ext_len": ext_len, "int_len": int_len, "ext_face": ext_face, "int_face": int_face,
        "doors": len(doors), "window_area": window_area, "windows": len(windows), "wet_floor": wet_floor,
        "wet_wall": wet_wall, "balcony": balcony, "columns": columns, "brick_k": brick_k,
    }


def estimate(elements: list[dict], rates: dict | None = None) -> dict:
    R = {**RATES, **{k: float(v) for k, v in (rates or {}).items() if k in RATES and v is not None}}
    els = [e for e in elements if isinstance(e, dict) and e.get("type")]
    floors = sorted({e.get("floor") or 1 for e in els if e["type"] in ("room", "wall")})
    if not floors:
        raise ValueError("The plan has no walls or rooms yet.")
    F = [_floor_takeoff(els, f) for f in floors]
    g = F[0]
    n = len(F)

    # ---- works (quantities of work, in m³ / m² / m) -------------------------------------------------
    columns = max(f["columns"] for f in F)
    pad = {1: 1.2, 2: 1.5, 3: 1.8}.get(n, 2.0)                               # footing side, by storeys carried
    footing = columns * pad * pad * 0.4 + columns * 0.23 * 0.45 * 1.2         # pad + column to the plinth
    excavation = columns * (pad + 0.6) ** 2 * 1.5 + (g["ext_len"] + g["int_len"]) * 0.6 * 0.45
    pcc = columns * (pad + 0.2) ** 2 * 0.1 + g["plinth_area"] * 0.075         # under footings + under the floor
    plinth_beam = (g["ext_len"] + g["int_len"]) * 0.23 * 0.3
    column_c = sum(f["columns"] * 0.23 * 0.45 * FLOOR_H for f in F)
    beam = sum((f["ext_len"] + f["int_len"]) * 0.23 * (0.45 - SLAB_T) for f in F)
    slab = sum(f["plinth_area"] for f in F) * SLAB_T                           # each floor's ceiling / roof
    concrete = footing + plinth_beam + column_c + beam + slab
    steel = (footing * STEEL["footing"] + plinth_beam * STEEL["plinth_beam"] + column_c * STEEL["column"]
             + beam * STEEL["beam"] + slab * STEEL["slab"]) * 1.03            # 3 % for laps and offcuts
    brick_vol = sum((f["ext_face"] * EXT_T + f["int_face"] * INT_T) * f["brick_k"] for f in F)
    plaster_in = sum(f["ext_face"] + 2 * f["int_face"] for f in F) + sum(f["floor_area"] for f in F)   # walls + ceilings
    plaster_out = sum(f["ext_face"] for f in F) + sum(f["perimeter"] for f in F) * 0.45                # walls + slab edges
    plaster_vol = plaster_in * 0.012 + plaster_out * 0.020
    floor_tiles = sum(f["floor_area"] for f in F) * 1.06
    wall_tiles = sum(f["wet_wall"] for f in F) * 1.08
    paint_area = plaster_in + plaster_out
    roof = F[-1]["plinth_area"] + sum(f["balcony"] for f in F)
    waterproof = roof + sum(f["wet_floor"] for f in F)
    doors = sum(f["doors"] for f in F)
    window_area = sum(f["window_area"] for f in F)

    try:
        import services_layout
        pts = services_layout.layout(els)["points"]
    except Exception:
        pts = []
    elec_points = sum(1 for p in pts if p.get("system") == "electrical") or int(sum(f["floor_area"] for f in F) / 3)
    wet_points = sum(1 for p in pts if p.get("system") == "plumbing") or 6 * max(1, sum(1 for f in F if f["wet_floor"]))
    wire_m = elec_points * 11 + sum(f["floor_area"] for f in F) * 0.4
    pipe_m = wet_points * 6.5 + n * FLOOR_H * 3

    # ---- materials ---------------------------------------------------------------------------------
    def mix(name, vol):
        c, s, a = MIX[name]
        return vol * c, vol * s, vol * a
    cement = sand = agg = 0.0
    for name, vol in (("M20", concrete), ("PCC", pcc), ("brick_mortar", brick_vol), ("plaster", plaster_vol)):
        c, s, a = mix(name, vol)
        cement += c; sand += s; agg += a
    cement += (floor_tiles + wall_tiles) * 0.12                               # tile bedding and grout
    sand += (floor_tiles) * 0.03
    bricks = brick_vol * 500 * 1.05                                           # 500 a m³ with mortar, 5 % breakage
    paint_l = paint_area * 2 / 11                                             # two coats at ~11 m² a litre
    primer_l = paint_area / 12
    putty_kg = plaster_in * 0.9

    rows = [
        ("cement", "Cement (OPC 53, 50 kg bags)", math.ceil(cement), "bags", "Concrete, mortar, plaster and tile bedding"),
        ("steel", "Reinforcement steel (Fe 500D)", round(steel / 1000, 2), "t", "Footings, columns, beams, slabs"),
        ("sand", "Sand", round(sand, 1), "m³", f"≈ {round(sand * 35.3):,} cft"),
        ("aggregate", "Coarse aggregate (20 mm)", round(agg, 1), "m³", f"≈ {round(agg * 35.3):,} cft"),
        ("bricks", "Bricks", int(round(bricks, -2)), "nos", f"{round(brick_vol, 1)} m³ of brickwork"),
        ("tiles", "Floor and wall tiles", round(floor_tiles + wall_tiles, 1), "m²", f"{round(wall_tiles, 1)} m² of it on bathroom walls"),
        ("paint", "Emulsion paint", math.ceil(paint_l), "L", f"{round(paint_area)} m², two coats"),
        ("primer", "Primer", math.ceil(primer_l), "L", ""),
        ("putty", "Wall putty", math.ceil(putty_kg), "kg", "Inside walls and ceilings"),
        ("waterproofing", "Waterproofing", round(waterproof, 1), "m²", "Roof, balconies, bathrooms"),
        ("doors", "Doors", doors, "nos", "Frames, shutters, hardware"),
        ("windows", "Windows", round(window_area, 1), "m²", f"{sum(f['windows'] for f in F)} windows"),
        ("wiring", "Electrical wire and conduit", int(round(wire_m, -1)), "m", f"{elec_points} points"),
        ("pipes", "Plumbing pipes", int(round(pipe_m, -1)), "m", f"{wet_points} water and drain points"),
    ]
    unit_rate = {"steel": R["steel"] * 1000}
    materials = []
    for key, item, qty, unit, note in rows:
        rate = unit_rate.get(key, R[key])
        materials.append({"key": key, "item": item, "qty": qty, "unit": unit, "rate": rate,
                          "cost": round(qty * rate), "note": note})
    material_cost = sum(m["cost"] for m in materials)
    labour = round(material_cost * R["labour"])

    works = [
        {"key": "excavation", "item": "Excavation", "qty": round(excavation, 1), "unit": "m³"},
        {"key": "pcc", "item": "Plain concrete bed (1:4:8)", "qty": round(pcc, 1), "unit": "m³"},
        {"key": "rcc", "item": "Reinforced concrete (M20)", "qty": round(concrete, 1), "unit": "m³"},
        {"key": "footings", "item": "of which footings", "qty": round(footing, 1), "unit": "m³"},
        {"key": "columns", "item": "of which columns", "qty": round(column_c, 1), "unit": "m³"},
        {"key": "beams", "item": "of which beams and plinth beam", "qty": round(beam + plinth_beam, 1), "unit": "m³"},
        {"key": "slabs", "item": "of which slabs", "qty": round(slab, 1), "unit": "m³"},
        {"key": "brickwork", "item": "Brickwork", "qty": round(brick_vol, 1), "unit": "m³"},
        {"key": "plaster", "item": "Plastering", "qty": round(plaster_in + plaster_out), "unit": "m²"},
        {"key": "flooring", "item": "Flooring", "qty": round(sum(f["floor_area"] for f in F), 1), "unit": "m²"},
        {"key": "painting", "item": "Painting", "qty": round(paint_area), "unit": "m²"},
    ]

    # ---- schedule ------------------------------------------------------------------------------------
    by = {m["key"]: m["cost"] for m in materials}
    share = lambda key, f: by.get(key, 0) * f
    phases = []
    day = 0

    def phase(key, name, days, cost, mats, overlap=0):
        nonlocal day
        start = max(0, day - overlap)
        days = max(1, int(math.ceil(days)))
        phases.append({"key": key, "name": name, "start_day": start, "days": days,
                       "cost": round(cost * (1 + R["labour"])), "materials": mats})
        day = max(day, start + days)

    conc_cost = lambda vol: vol * (MIX["M20"][0] * R["cement"] + MIX["M20"][1] * R["sand"] + MIX["M20"][2] * R["aggregate"])
    phase("site", "Site clearing, marking and excavation", 5 + excavation / 18, 0, ["Excavation"])
    phase("foundation", "Footings, plinth beam and backfill", 14 + columns * 0.6,
          conc_cost(footing + plinth_beam + pcc) + (footing * 80 + plinth_beam * 120) * R["steel"],
          ["Cement", "Steel", "Sand", "Aggregate"])
    for i, f in enumerate(F):
        lvl = "Ground floor" if i == 0 else f"Floor {i + 1}"
        fc = f["columns"] * 0.23 * 0.45 * FLOOR_H
        fb = (f["ext_len"] + f["int_len"]) * 0.23 * (0.45 - SLAB_T)
        fs = f["plinth_area"] * SLAB_T
        phase(f"frame{i}", f"{lvl}: columns, beams and {'roof' if i == n - 1 else 'floor'} slab, curing", 24 + f["plinth_area"] / 10,
              conc_cost(fc + fb + fs) + (fc * 200 + fb * 160 + fs * 85) * R["steel"], ["Cement", "Steel", "Sand", "Aggregate"])
        bv = (f["ext_face"] * EXT_T + f["int_face"] * INT_T) * f["brick_k"]
        # walls go up while the slab above cures; the next frame waits for the slab's 14 days
        phase(f"walls{i}", f"{lvl}: brickwork", 4 + bv / 2.5, bv * 500 * 1.05 * R["bricks"] + bv * 0.25 * 1.25 * R["cement"],
              ["Bricks", "Cement", "Sand"], overlap=6)
    phase("services", "Electrical conduits and plumbing lines", 8 + n * 6, by.get("wiring", 0) * 0.5 + by.get("pipes", 0) * 0.7,
          ["Wiring", "Pipes"], overlap=5)
    phase("waterproofing", "Roof and bathroom waterproofing", 4 + waterproof / 60, by.get("waterproofing", 0), ["Waterproofing"])
    phase("plaster", "Plastering inside and out", (plaster_in + plaster_out) / 35, plaster_vol * (MIX["plaster"][0] * R["cement"] + MIX["plaster"][1] * R["sand"]),
          ["Cement", "Sand"], overlap=3)
    phase("doors", "Door and window frames, grills", 7 + doors * 0.4, share("doors", 0.4) + share("windows", 0.5), ["Doors", "Windows"], overlap=4)
    phase("flooring", "Flooring and bathroom tiling", (floor_tiles + wall_tiles) / 22, share("tiles", 1), ["Tiles", "Cement"])
    phase("finishes", "Doors and windows fitted, electrical wiring and switches", 10 + n * 3,
          share("doors", 0.6) + share("windows", 0.5) + share("wiring", 0.5) + share("pipes", 0.3), ["Doors", "Windows", "Wiring"], overlap=5)
    phase("painting", "Putty, primer and painting", paint_area / 40, share("paint", 1) + share("primer", 1) + share("putty", 1),
          ["Putty", "Primer", "Paint"])
    phase("handover", "Fixtures, cleaning and handover", 7 + n * 2, 0, [])

    total_area = sum(f["plinth_area"] for f in F)
    return {
        "summary": {
            "floors": n, "built_up_m2": round(total_area, 1), "carpet_m2": round(sum(f["floor_area"] for f in F), 1),
            "columns": columns, "material_cost": material_cost, "labour_cost": labour,
            "cost_per_m2": round((material_cost + labour) / max(total_area, 1)),
        },
        "materials": materials,
        "works": works,
        "phases": phases,
        "total_cost": material_cost + labour,
        "total_days": day,
        "rates": R,
        "assumptions": [
            "RCC frame on isolated footings 1.5 m deep (pads sized by the number of storeys), with brick walls: 230 mm outside, 115 mm inside.",
            "M20 concrete (1:1.5:3), brick mortar 1:6, plaster 1:5 at 12 mm inside and 20 mm outside.",
            "Wastage included: bricks 5 %, steel 3 %, tiles 6–8 %. Prices are indicative supply rates; labour is "
            f"taken as {round(R['labour'] * 100)} % of materials.",
            "A guide for planning and budgeting. Footing sizes and steel must come from a structural engineer.",
        ],
    }
