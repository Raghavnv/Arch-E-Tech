"""Ready for a future floor: what it takes to build the house now so a floor can be added later.

The house is estimated twice: as it is, and with one more floor (a copy of the top floor's rooms and walls,
one storey up). The difference in footings and columns is what "ready now" costs, since footings and
columns are sized for the storeys they will carry. The new floor's own cost comes from the same pair.
If the house isn't made ready, adding the floor later means strengthening footings and jacketing columns
while people live in it; as a rule of thumb that costs about three times the up-front upgrade, plus weeks
of disruption. The city's limits (floors, height, FAR) say whether the extra floor would be allowed.
"""
from __future__ import annotations

import copy

import building_rules
import quantities

STOREY = 3.2
OUTDOOR = {"patio", "balcony", "terrace", "deck"}


def with_extra_floor(elements: list[dict]) -> list[dict]:
    floors = sorted({e.get("floor") or 1 for e in elements if isinstance(e, dict) and e.get("type")})
    top = floors[-1] if floors else 1
    extra = []
    for e in elements:
        if not isinstance(e, dict) or (e.get("floor") or 1) != top:
            continue
        if e.get("type") in ("room", "wall", "door", "window") and e.get("kind") not in OUTDOOR:
            c = copy.deepcopy(e)
            c["floor"] = top + 1
            if c.get("id"):
                c["id"] = f"{c['id']}_f{top + 1}"
            extra.append(c)
    return elements + extra


def _phase(q, prefix):
    return sum(p["cost"] for p in q["phases"] if p["key"].startswith(prefix))


def plan(elements: list[dict], site: dict | None = None, city: str | None = None) -> dict:
    now = quantities.estimate(elements, None)
    more = quantities.estimate(with_extra_floor(elements), None)
    n = now["summary"]["floors"]

    footings_now, footings_more = _phase(now, "foundation"), _phase(more, "foundation")
    # column share of each frame phase: the ground floor's columns carry every floor above
    frame0_now, frame0_more = _phase(now, "frame0"), _phase(more, "frame0")
    upgrade = max(0.0, (footings_more - footings_now) + 0.35 * max(0.0, frame0_more - frame0_now))
    upgrade += 25000                                              # the structural design done for one more floor
    starter = now["summary"]["columns"] * 1500                    # starter (lap) bars left at every column top, protected
    upgrade += starter
    new_floor = max(0.0, more["total_cost"] - now["total_cost"] - (footings_more - footings_now))
    retrofit = upgrade * 3

    # would the city allow it?
    plot = (site or {}).get("plot_m")
    lim = building_rules.city_limits(city, plot[0] * plot[1] if plot else None)
    allowed, why = True, []
    if n + 1 > (lim.get("max_floors") or 99):
        allowed = False
        why.append(f"{lim['city']} allows {lim['max_floors']} floors for this plot.")
    height = (n + 1) * STOREY + 0.45 + 0.5
    if height > (lim.get("max_height_m") or 99):
        allowed = False
        why.append(f"The house would be about {height:.1f} m tall; the limit is {lim['max_height_m']} m.")
    if plot and lim.get("far"):
        built = more["summary"]["built_up_m2"]
        far = built / (plot[0] * plot[1])
        if far > lim["far"]:
            allowed = False
            why.append(f"Built-up area would be {built:.0f} m², FAR {far:.2f} against {lim['far']}.")
    if not why:
        why.append(f"{n + 1} floors fit {lim['city']}'s limits for this plot" + ("" if plot else " (add the plot size to check FAR)") + ".")

    steps = [
        f"Get the structure designed for {n + 1} floors (G+{n}).",
        f"Stronger footings and columns: about Rs {upgrade - starter:,.0f} more now.",
        f"Leave protected starter bars on all {now['summary']['columns']} columns.",
        "Take the stair up to the roof (a mumty).",
        "Run a spare conduit and capped water line to the roof.",
        "Put the water tank and solar on movable stands.",
    ]
    return {
        "floors_now": n, "floors_later": n + 1, "upgrade_now": round(upgrade), "new_floor_cost": round(new_floor),
        "retrofit_later": round(retrofit), "built_up_later_m2": more["summary"]["built_up_m2"], "allowed": allowed, "why": why,
        "city": lim["city"], "steps": steps,
    }
