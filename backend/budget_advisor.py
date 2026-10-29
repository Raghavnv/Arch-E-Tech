"""
Budget advisor: where to cut back when the estimate is over the owner's budget.

Given the budget, the live cost takeoff (walls by length, doors, windows, stairs, railings, fittings)
and a summary of the plan, it suggests a short, ranked list of cuts: the most money for the least
loss of comfort first. Each suggestion carries a rough saving, how much it affects daily life, and,
when it is a change to the plan, an instruction AI Edit can carry out.

The LLM (Groq) writes the advice when a key is set; otherwise sensible cuts are worked out from the
takeoff itself, so the feature always answers.
"""
from __future__ import annotations

import json
import os

IMPACTS = ("low", "medium", "high")

SYSTEM = """You are a residential cost consultant in India helping a family who is over budget on their house.
You get their budget, the live cost takeoff of the plan (what the estimate is made of) and the rooms.
Suggest 4 to 7 cuts, ranked so the biggest savings with the least loss of comfort come first.

Answer JSON only:
{"summary": "one or two sentences on where the money goes and the overall approach",
 "suggestions": [{"title": "short imperative", "detail": "one or two plain sentences: what to change and why it saves money",
                  "saving": number (same currency as the budget, a realistic estimate), "impact": "low"|"medium"|"high",
                  "edit": "an instruction for the plan editor if this is a change to the drawing (e.g. 'remove the study', 'make Bedroom 3 smaller'), else empty string"}]}

Rules:
- Base savings on the takeoff numbers you are given; never claim more than an item costs.
- Prefer cuts people barely notice: phasing furniture, standard window sizes, fewer but well-placed windows, a shower instead of a bathtub, a straight kitchen counter instead of an island, a simpler roof or railing, trimming oversized rooms, dropping an extra bathroom or a rarely used room.
- Keep what the family clearly asked for (bedroom count, a master suite) unless nothing else closes the gap; say so if you suggest it.
- Write for homeowners, not engineers. No jargon. Use the currency symbol given."""


def _money(v: float, symbol: str) -> str:
    n = round(v)
    if symbol != "₹":
        return f"{symbol}{n:,}"
    # Indian grouping: 31,80,394
    s, sign = str(abs(n)), "-" if n < 0 else ""
    head, tail = s[:-3], s[-3:]
    while len(head) > 2:
        tail = head[-2:] + "," + tail
        head = head[:-2]
    return f"{sign}{symbol}{head + ',' + tail if head else tail}"


def fallback(budget: float, total: float, items: list[dict], rooms: list[dict], symbol: str) -> dict:
    """Cuts worked out from the takeoff alone."""
    by = {i.get("key"): i for i in items}
    cost = lambda k: float((by.get(k) or {}).get("cost") or 0)            # noqa: E731
    furniture = sum(float(i.get("cost") or 0) for i in items if str(i.get("key", "")).startswith("furniture_"))
    out = []
    if furniture:
        out.append({"title": "Furnish in stages", "impact": "low", "saving": furniture * 0.6, "edit": "",
                    "detail": "Buy the beds, sofa and dining table now and add the rest after moving in; the fittings are a large part of the estimate."})
    if cost("furniture_bathtub"):
        out.append({"title": "Fit showers instead of bathtubs", "impact": "low", "saving": cost("furniture_bathtub") * 0.7,
                    "edit": "remove the bathtubs",
                    "detail": "A walk-in shower costs far less than a tub with its plumbing, and most families rarely use the bath."})
    windows = by.get("window")
    if windows and int(windows.get("qty") or 0) > max(4, len(rooms) * 1.3):
        out.append({"title": "Standardise and trim the windows", "impact": "low", "saving": cost("window") * 0.25, "edit": "",
                    "detail": "Use one or two standard window sizes and drop the extra windows in rooms that already have good light."})
    if cost("furniture_kitchen") > 0:
        out.append({"title": "Choose a straight kitchen counter", "impact": "low", "saving": cost("furniture_kitchen") * 0.35, "edit": "",
                    "detail": "One straight run with a tall unit costs less than an island or an L, with nearly the same working space."})
    baths = [r for r in rooms if r.get("kind") == "bathroom"]
    beds = [r for r in rooms if r.get("kind") in ("bedroom", "master_bedroom")]
    if len(baths) > len(beds):
        out.append({"title": "Drop one bathroom", "impact": "medium", "saving": cost("wall") * 0.05 + cost("door") / max(1, (by.get("door") or {}).get("qty") or 1) + 0.5 * cost("furniture_vanity") / max(1, len(baths)),
                    "edit": "remove the smallest common bathroom",
                    "detail": "There are more bathrooms than bedrooms; one fewer saves walls, plumbing and fittings."})
    if cost("wall"):
        out.append({"title": "Trim the oversized rooms", "impact": "medium", "saving": cost("wall") * 0.08, "edit": "make the largest bedroom about 10% smaller",
                    "detail": "Bringing the biggest rooms down to comfortable standard sizes shortens the walls, which are the largest single cost."})
    if cost("railing"):
        out.append({"title": "Use a simple metal railing", "impact": "low", "saving": cost("railing") * 0.4, "edit": "",
                    "detail": "A plain mild-steel railing instead of glass panels gives the same safety for much less."})
    out.sort(key=lambda s: (IMPACTS.index(s["impact"]), -s["saving"]))
    gap = total - budget
    summary = (f"The estimate is {_money(total, symbol)}, {_money(abs(gap), symbol)} {'over' if gap > 0 else 'under'} the budget. "
               f"Walls make up the largest share, followed by fittings; start with the cuts that change daily life the least.")
    return {"summary": summary, "suggestions": out[:7]}


def _clean(data: dict, total: float) -> dict:
    out = []
    for s in (data.get("suggestions") or [])[:8]:
        if not isinstance(s, dict) or not s.get("title"):
            continue
        try:
            saving = max(0.0, min(float(s.get("saving") or 0), total))
        except (TypeError, ValueError):
            saving = 0.0
        impact = s.get("impact") if s.get("impact") in IMPACTS else "medium"
        out.append({"title": str(s["title"])[:80], "detail": str(s.get("detail") or "")[:400], "saving": saving,
                    "impact": impact, "edit": str(s.get("edit") or "")[:160]})
    return {"summary": str(data.get("summary") or "")[:500], "suggestions": out}


def advise(budget: float, symbol: str, total: float, items: list[dict], rooms: list[dict], floors: int,
           area_sqft: float, api_key: str | None) -> dict:
    if api_key:
        try:
            from groq import Groq
            brief = {
                "budget": round(budget), "currency_symbol": symbol, "estimate_total": round(total),
                "over_by": round(total - budget), "floors": floors, "built_up_sqft": round(area_sqft),
                "takeoff": [{"item": i.get("label"), "quantity": i.get("qty"), "cost": i.get("cost")} for i in items],
                "rooms": rooms,
            }
            resp = Groq(api_key=api_key, timeout=45).chat.completions.create(
                model=os.getenv("LAYOUT_MODEL", "openai/gpt-oss-120b"),
                messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": json.dumps(brief)}],
                response_format={"type": "json_object"}, temperature=0.3, max_completion_tokens=3000, reasoning_effort="medium",
            )
            data = _clean(json.loads(resp.choices[0].message.content or "{}"), total)
            if data["suggestions"]:
                return {**data, "source": "ai"}
        except Exception as e:
            print(f"Budget advice from the LLM failed: {e}")
    return {**_clean(fallback(budget, total, items, rooms, symbol), total), "source": "rules"}
