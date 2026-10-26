"""
Floor plan design pipeline.

  1. pick reference houses that resemble the brief (random among the closest)
  2. the LLM designs a NEW plan as room rectangles, using those references as examples
  3. snap_rects + layout_from_rects clean up and validate it; if the LLM's answer is
     unusable, a reference is stretched / mirrored / rotated instead (adapt_reference)

Everything here is deterministic apart from the injected `rng`.
"""
from __future__ import annotations

import json
import math
import random
from collections import Counter

import floorplan_builder as fb
import reference_plans as rp

KINDS = list(fb.KIND_SPEC) + ["hallway"]


# --------------------------------------------------------------------------
# References
# --------------------------------------------------------------------------
def _meta(plan: dict) -> dict:
    rects = rp.parse(plan)
    kinds = Counter(r["kind"] for r in rects)
    beds = kinds["master_bedroom"] + kinds["bedroom"]
    W = max(r["x"] + r["w"] for r in rects)
    H = max(r["y"] + r["h"] for r in rects)
    area = sum(r["w"] * r["h"] for r in rects if r["kind"] != "hallway") * 0.25
    return {"plan": plan, "rects": rects, "beds": beds, "baths": kinds["bathroom"],
            "study": kinds["study"], "W": W, "H": H, "area": area}


def pick_references(beds: int, baths: int, study: bool, rng: random.Random, k: int = 3) -> list[dict]:
    """The k references closest to the brief; ties and near-ties are shuffled so each request differs."""
    metas = [_meta(p) for p in rp.PLANS]
    scored = sorted(metas, key=lambda m: 3 * abs(m["beds"] - beds) + abs(m["baths"] - baths)
                    + 0.5 * (bool(m["study"]) != study) + rng.uniform(0, 2.5))
    return scored[:k]


def describe(meta: dict) -> dict:
    return {
        "name": meta["plan"]["name"],
        "concept": meta["plan"]["style"],
        "footprint_units": [meta["W"], meta["H"]],
        "area_sqm": round(meta["area"]),
        "rooms": [{k: r[k] for k in ("kind", "x", "y", "w", "h")} for r in meta["rects"]],
    }


# --------------------------------------------------------------------------
# Cleaning up LLM output
# --------------------------------------------------------------------------
def snap_rects(rects: list[dict], tol: int = 1) -> list[dict]:
    """Round to the grid and merge edges that are within `tol` cells so neighbours share a wall exactly."""
    rects = [{"kind": r["kind"], "x": int(round(r["x"])), "y": int(round(r["y"])),
              "w": int(round(r["w"])), "h": int(round(r["h"]))} for r in rects]

    def snap_axis(lo_key, size_key):
        edges = Counter()
        for r in rects:
            edges[r[lo_key]] += 1
            edges[r[lo_key] + r[size_key]] += 1
        clusters, cur = [], []
        for e in sorted(edges):         # edges within `tol` of each other are one wall drawn sloppily
            if cur and e - cur[-1] > tol:
                clusters.append(cur)
                cur = []
            cur.append(e)
        if cur:
            clusters.append(cur)
        rep = {}
        for cl in clusters:
            best = max(cl, key=lambda o: (edges[o], -abs(o - cl[len(cl) // 2])))
            for e in cl:
                rep[e] = best
        for r in rects:
            a, b = rep[r[lo_key]], rep[r[lo_key] + r[size_key]]
            r[lo_key], r[size_key] = a, b - a

    snap_axis("x", "w")
    snap_axis("y", "h")
    x0 = min(r["x"] for r in rects)
    y0 = min(r["y"] for r in rects)
    for r in rects:
        r["x"] -= x0
        r["y"] -= y0
    return rects


def _program_counts(program) -> Counter:
    return Counter(r.kind for r in program)


def matches_program(rects: list[dict], program) -> str | None:
    """None if the plan has the rooms the brief asked for, else a human-readable reason."""
    want, got = _program_counts(program), Counter(r["kind"] for r in rects)
    for kind in ("living", "kitchen"):
        if got[kind] != 1:
            return f"need exactly one {kind}"
    want_beds = want["master_bedroom"] + want["bedroom"]
    got_beds = got["master_bedroom"] + got["bedroom"]
    if got_beds != want_beds:
        return f"need {want_beds} bedrooms in total, got {got_beds}"
    if got["master_bedroom"] != min(1, want_beds):
        return "need exactly one master_bedroom"
    if got["bathroom"] < max(1, want["bathroom"] - 1):
        return f"need at least {max(1, want['bathroom'] - 1)} bathrooms"
    if got["hallway"] > 2:
        return "use at most 2 hallway lobbies"
    return None


def design_from_llm_rects(rects: list[dict], program) -> fb.Layout:
    """Raise fb.LayoutError (with a reason the LLM can act on) unless the rectangles make a good house."""
    rects = [r for r in rects if r.get("kind") in KINDS]
    if not rects:
        raise fb.LayoutError("no rooms")
    rects = snap_rects(rects)
    why = matches_program(rects, program)
    if why:
        raise fb.LayoutError(why)
    return fb.layout_from_rects(rects)


# --------------------------------------------------------------------------
# Adapting a reference without the LLM
# --------------------------------------------------------------------------
def _stretch_axis(rects, lo_key, size_key, scale, jitter, rng):
    edges = sorted({r[lo_key] for r in rects} | {r[lo_key] + r[size_key] for r in rects})
    new = {edges[0]: 0}
    for a, b in zip(edges, edges[1:]):
        length = (b - a) * scale * rng.uniform(1 - jitter, 1 + jitter)
        new[b] = new[a] + max(2, int(round(length)))
    for r in rects:
        a, b = new[r[lo_key]], new[r[lo_key] + r[size_key]]
        r[lo_key], r[size_key] = a, b - a


def transform(rects: list[dict], rng: random.Random, target_area: float | None = None) -> list[dict]:
    rects = [dict(r) for r in rects]
    area = sum(r["w"] * r["h"] for r in rects if r["kind"] != "hallway") * 0.25
    s = 1.0
    if target_area:
        s = max(0.85, min(1.45, math.sqrt(target_area / area)))
    _stretch_axis(rects, "x", "w", s * rng.uniform(0.95, 1.12), 0.18, rng)
    _stretch_axis(rects, "y", "h", s * rng.uniform(0.95, 1.12), 0.18, rng)
    W = max(r["x"] + r["w"] for r in rects)
    H = max(r["y"] + r["h"] for r in rects)
    if rng.random() < 0.5:
        for r in rects:
            r["x"] = W - r["x"] - r["w"]
    if rng.random() < 0.5:
        for r in rects:
            r["y"] = H - r["y"] - r["h"]
    if rng.random() < 0.5:
        for r in rects:
            r["x"], r["y"], r["w"], r["h"] = r["y"], r["x"], r["h"], r["w"]
    return rects


def adapt_reference(program, rng: random.Random, target_area: float | None = None,
                    tries: int = 80) -> fb.Layout | None:
    want = _program_counts(program)
    beds = want["master_bedroom"] + want["bedroom"]
    refs = pick_references(beds, want["bathroom"], bool(want["study"]), rng, k=len(rp.PLANS))
    refs = [m for m in refs if m["beds"] == beds]       # never hand back the wrong number of bedrooms
    if not refs:
        return None
    for _ in range(tries):
        ref = rng.choice(refs[:3])
        try:
            return fb.layout_from_rects(transform(ref["rects"], rng, target_area))
        except fb.LayoutError:
            continue
    return None


def program_target_area(program) -> float:
    return sum(r.area for r in program if r.kind != "hallway") * 1.15
