"""Check a contractor's quote against the app's own estimate of the house (quantities.estimate).

A quote is plain text (copied from a PDF, WhatsApp or email): one item per line, with amounts in any
Indian style ("Rs 2,45,000", "₹2.45 L", "18 lakhs", "45k"), quantities and rates ("620 bags @ 420"), or a
package rate ("₹2,100 per sq ft"). Each line is sorted into a trade by its words; with a GROQ_API_KEY the
lines are read by the language model instead, which copes with messier quotes, then checked the same way.

The check:
  * the total, and the rate per square foot of built-up area, against the estimate
  * each trade (foundation, frame, brickwork, plaster, waterproofing, electrical, plumbing, flooring,
    painting, doors and windows) against the estimate's share for it: high over +25 %, low under -30 %
  * material rates (cement a bag, steel a kg or tonne, sand a cft or brass, bricks each, tiles a sq ft)
    against market rates: high over +20 %, suspiciously low under -25 % (often a lower grade)
  * quantities of steel and cement against what this design needs
  * what is missing: main trades with no line, and the extras quotes commonly leave out
The estimate is raised by 12 % for the contractor's overheads and profit (and by 18 % GST when the quote
says GST is included) before comparing, since a quote carries both and the raw estimate doesn't.
"""
from __future__ import annotations

import json
import os
import re

SQFT = 10.7639

TRADES = {
    "foundation": ("Excavation and foundation", r"excavat|earth\s*work|footing|foundation|\bpcc\b|plinth|anti[- ]?termite|soling|backfill"),
    "structure": ("RCC frame: columns, beams, slabs", r"\brcc\b|column|beam|slab|concrete|\bsteel\b|reinforce|\btmt\b|shuttering|centering|\bm\s?20\b|\bm\s?25\b|structure"),
    "masonry": ("Brick or block walls", r"brick|block\s*work|masonry|\baac\b|wall(?!\s*paper)"),
    "plaster": ("Plastering", r"plaster"),
    "waterproofing": ("Waterproofing", r"water\s*proof"),
    "electrical": ("Electrical", r"electric|wiring|\bswitch|\bmcb\b|\bdb\b|light\s*point|conduit|\bpoints?\b"),
    "plumbing": ("Plumbing and sanitary", r"plumb|sanitar|\bpipe|cpvc|upvc\s*pipe|drain|\bwc\b|toilet|\btaps?\b|cp\s*fitt|bath\s*fitt|geyser"),
    "flooring": ("Flooring and tiling", r"floor|tile|tiling|vitrified|skirting|dado|granite|marble|kota"),
    "painting": ("Painting", r"paint|putty|primer|emulsion|texture"),
    "doors_windows": ("Doors and windows", r"door|window|grill|shutter|frame|ventilator"),
}
# extras outside the estimate, often left out of quotes and added later
EXTRAS = {
    "anti-termite treatment": r"anti[- ]?termite",
    "sump and overhead tank": r"sump|overhead\s*tank|water\s*tank|\boht\b",
    "compound wall and gate": r"compound|boundary\s*wall|\bgate\b",
    "electrical fittings (lights, fans)": r"fitting|light\s*fix|\bfans?\b|lights\b",
    "sanitaryware and CP fittings": r"sanitar|\bcp\b|\bwc\b|wash\s*basin|commode",
    "GST": r"\bgst\b|\btax",
    "approvals and architect's fees": r"approv|sanction|architect|plan\s*fee",
    "debris removal and site cleaning": r"debris|clean",
    "curing water and site electricity": r"curing|water\s*(and|&)\s*electric|temporary\s*(power|electric)",
}
MAIN = ["foundation", "structure", "masonry", "plaster", "waterproofing", "electrical", "plumbing", "flooring", "painting", "doors_windows"]

# material rates: (pattern, unit the market rate is in, the estimate's rate key, conversions from quoted units)
MATERIALS = [
    ("Cement", r"cement", "bag", "cement", {"bag": 1, "bags": 1}),
    ("Steel", r"\bsteel\b|\btmt\b|reinforce", "kg", "steel", {"kg": 1, "t": 1000, "ton": 1000, "tons": 1000, "tonne": 1000, "tonnes": 1000, "mt": 1000, "quintal": 100}),
    ("Sand", r"\bsand\b|m[- ]?sand|p[- ]?sand", "cft", "sand", {"cft": 1, "brass": 100, "m3": 35.31, "cum": 35.31}),
    ("Bricks", r"brick", "no", "bricks", {"no": 1, "nos": 1, "each": 1, "piece": 1, "1000": 1000}),
    ("Aggregate", r"aggregate|jelly|metal\s*\(|20\s*mm|40\s*mm", "cft", "aggregate", {"cft": 1, "brass": 100, "m3": 35.31, "cum": 35.31}),
    ("Tiles", r"\btiles?\b|vitrified", "sqft", "tiles", {"sqft": 1, "sft": 1, "m2": 10.7639, "sqm": 10.7639}),
]
UNIT = r"(bags?|kg|kgs|t|tons?|tonnes?|mt|quintals?|cft|brass|m3|m³|cum|sqft|sq\.?\s?ft|sft|m2|m²|sqm|sq\.?\s?m|nos?|each|pieces?|points?|rft)"


def _unit(u: str) -> str:
    u = (u or "").lower().replace(" ", "").replace(".", "").replace("³", "3").replace("²", "2")
    return {"sqft": "sqft", "sft": "sqft", "sqm": "sqm", "m2": "m2", "kgs": "kg", "pieces": "piece", "quintals": "quintal", "points": "point"}.get(u, u)


def money(s: str) -> float | None:
    """'₹2,45,000' / 'Rs. 2.45 L' / '18 lakhs' / '1.2 Cr' / '45k' -> rupees."""
    m = re.search(r"(\d[\d,]*(?:\.\d+)?)\s*(cr(?:ores?)?|l(?:akhs?|acs?|akh)?|k)?\b", s.strip(), re.I)
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    mult = (m.group(2) or "").lower()
    if mult.startswith("cr"):
        v *= 1e7
    elif mult.startswith("l"):
        v *= 1e5
    elif mult == "k":
        v *= 1e3
    return v


def _amounts(line: str) -> list[tuple[float, int, int]]:
    """Every money-looking number in a line: (value, start, end)."""
    out = []
    for m in re.finditer(r"(?:₹|rs\.?|inr)?\s*(?<![A-Za-z+])(\d[\d,]*(?:\.\d+)?)\s*(cr(?:ores?)?\b|lakhs?\b|lacs?\b|lakh\b|l\b|k\b)?", line, re.I):
        raw = m.group(0)
        if not re.search(r"\d", raw):
            continue
        v = money(raw.replace("₹", "").replace("Rs.", "").replace("rs.", "").replace("Rs", "").replace("INR", ""))
        if v is not None:
            out.append((v, m.start(), m.end()))
    return out


def parse_lines(text: str) -> list[dict]:
    """The quote's lines as {text, trade, amount, qty, unit, rate, rate_unit, per_sqft, total}."""
    lines = []
    for raw in re.split(r"[\r\n]+", text or ""):
        line = raw.strip(" \t-•*|")
        if len(line) < 3 or not re.search(r"\d", line):
            continue
        low = line.lower()
        item = {"text": line[:160], "trade": None, "amount": None, "qty": None, "unit": None, "rate": None, "rate_unit": None,
                "per_sqft": None, "total": bool(re.search(r"\b(grand\s*)?total\b|\bnet\s*amount|\btotal\s*cost", low))}
        for key, (_, pat) in TRADES.items():
            if re.search(pat, low):
                item["trade"] = key
                break
        if not item["trade"] and re.search(r"cement|\bsand\b|aggregate|jelly|\bmetal\b|bricks?\b", low):
            item["trade"] = "materials"
        # a package rate: "₹2,100 per sq ft", "@ 1950/sft"
        m = re.search(r"(?:₹|rs\.?)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:/-)?\s*(?:per|/)\s*(sq\.?\s?ft|sft|sqft|square\s*f(?:ee|oo)t)", low)
        if m and not item["trade"] or (m and re.search(r"construction|package|turnkey|built[- ]?up|all\s*inclusive", low)):
            item["per_sqft"] = float(m.group(1).replace(",", ""))
        # quantity, and a rate after @ or "rate" or "per <unit>"
        q = re.search(r"(\d[\d,]*(?:\.\d+)?)\s*" + UNIT + r"\b", low)
        if q:
            item["qty"], item["unit"] = float(q.group(1).replace(",", "")), _unit(q.group(2))
        r = re.search(r"(?:@|rate[:\s]|at\s)\s*(?:₹|rs\.?)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:/-)?\s*(?:(?:per|/)\s*" + UNIT + r")?", low)
        if not r:
            r = re.search(r"(?:₹|rs\.?)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:/-)?\s*(?:per|/)\s*" + UNIT, low)
        if r:
            item["rate"] = float(r.group(1).replace(",", ""))
            item["rate_unit"] = _unit(r.group(2)) if r.lastindex and r.lastindex >= 2 and r.group(2) else item["unit"]
        # the amount: after "=", else the last money in the line that isn't the quantity or rate
        nums = _amounts(line)
        if "=" in line:
            after = [n for n in nums if n[1] > line.rindex("=")]
            if after:
                item["amount"] = after[-1][0]
        if item["amount"] is None and nums:
            skip = {item["qty"], item["rate"], item["per_sqft"]}
            rest = [n[0] for n in nums if n[0] not in skip and n[0] >= 1000]
            if rest:
                item["amount"] = rest[-1]
        if item["amount"] is None and item["qty"] and item["rate"]:
            item["amount"] = round(item["qty"] * item["rate"])
        if item["amount"] is not None:
            item["amount"] = round(item["amount"])
        if item["amount"] is None and item["per_sqft"] is None and not item["rate"]:
            continue
        lines.append(item)
    return lines


def parse_with_ai(text: str, api_key: str) -> list[dict] | None:
    """The quote's lines read by the language model, in the same shape as parse_lines. None if it fails."""
    try:
        from groq import Groq
        client = Groq(api_key=api_key, timeout=40)
        trades = ", ".join(f"{k} ({v[0]})" for k, v in TRADES.items())
        res = client.chat.completions.create(
            model=os.getenv("LAYOUT_MODEL", "openai/gpt-oss-20b"),
            messages=[{"role": "system", "content": (
                "You read Indian house-construction quotes. Return JSON {\"lines\": [...]} with one entry per priced item: "
                "{\"text\": the item as written (short), \"trade\": one of " + trades + " or null, \"amount\": rupees as a number or null, "
                "\"qty\": number or null, \"unit\": e.g. bags, kg, t, cft, brass, sqft, nos or null, \"rate\": rupees per unit or null, "
                "\"rate_unit\": unit of the rate or null, \"per_sqft\": a package rate in rupees per sq ft of built-up area or null, "
                "\"total\": true if this line is the quote's total}. Convert lakh (1e5) and crore (1e7). Do not invent items.")},
                {"role": "user", "content": text[:12000]}],
            response_format={"type": "json_object"}, temperature=0.1,
        )
        data = json.loads(res.choices[0].message.content or "{}")
        out = []
        for l in data.get("lines") or []:
            if not isinstance(l, dict):
                continue
            out.append({"text": str(l.get("text") or "")[:160], "trade": l.get("trade") if l.get("trade") in TRADES else None,
                        "amount": _num(l.get("amount")), "qty": _num(l.get("qty")), "unit": _unit(str(l.get("unit") or "")) or None,
                        "rate": _num(l.get("rate")), "rate_unit": _unit(str(l.get("rate_unit") or "")) or None,
                        "per_sqft": _num(l.get("per_sqft")), "total": bool(l.get("total"))})
        return out or None
    except Exception as e:                      # the built-in reader takes over
        print(f"quote AI parse failed: {e}")
        return None


def _num(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def trade_estimates(q: dict) -> dict:
    """The estimate's cost per trade, from its build phases (labour included)."""
    ph = {p["key"]: p["cost"] for p in q["phases"]}
    frames = sum(v for k, v in ph.items() if k.startswith("frame"))
    walls = sum(v for k, v in ph.items() if k.startswith("walls"))
    fin, svc = ph.get("finishes", 0), ph.get("services", 0)
    return {
        "foundation": ph.get("site", 0) + ph.get("foundation", 0), "structure": frames, "masonry": walls,
        "plaster": ph.get("plaster", 0), "waterproofing": ph.get("waterproofing", 0),
        "electrical": svc * 0.55 + fin * 0.25, "plumbing": svc * 0.45 + fin * 0.15,
        "flooring": ph.get("flooring", 0), "painting": ph.get("painting", 0),
        "doors_windows": ph.get("doors", 0) + fin * 0.6,
    }


def check(text: str, q: dict, api_key: str | None = None) -> dict:
    lines = (parse_with_ai(text, api_key) if api_key else None)
    source = "ai" if lines else "rules"
    if not lines:
        lines = parse_lines(text)
    if not lines:
        raise ValueError("No prices found in that text. Paste the quote's items with their amounts, one per line.")
    built_sqft = q["summary"]["built_up_m2"] * SQFT
    with_gst = bool(re.search(r"(incl\w*|with)\s+(of\s+)?gst|gst\s+incl", (text or "").lower()))
    factor = 1.12 * (1.18 if with_gst else 1)
    est_total = q["total_cost"] * factor
    est_trades = {k: v * factor for k, v in trade_estimates(q).items()}
    R = q.get("rates") or {}

    # the quote's total: a total line, else a package rate times the area, else the items added up
    items = [l for l in lines if not l["total"]]
    stated = [l["amount"] for l in lines if l["total"] and l["amount"]]
    package = next((l["per_sqft"] for l in lines if l.get("per_sqft")), None)
    summed = sum(l["amount"] or 0 for l in items)
    total = max(stated) if stated else (package * built_sqft if package and summed < package * built_sqft * 0.5 else summed)
    basis = "stated total" if stated else ("package rate × built-up area" if package and summed < package * built_sqft * 0.5 else "items added up")

    notes = []
    diff = (total - est_total) / est_total if est_total else 0
    overall = "high" if diff > 0.2 else "low" if diff < -0.25 else "ok"
    if overall == "high":
        notes.append(f"The quote is {diff:.0%} above the estimate for this design. Ask for an item-wise breakup and compare the trades below.")
    elif overall == "low":
        notes.append(f"The quote is {-diff:.0%} below the estimate. Check what it leaves out and which grades it assumes (cement, steel, tiles).")

    # trades
    by_trade = {}
    for l in items:
        if l["trade"] and l["amount"]:
            by_trade[l["trade"]] = by_trade.get(l["trade"], 0) + l["amount"]
    trades = []
    for key in MAIN:
        name = TRADES[key][0]
        est = est_trades.get(key, 0)
        got = by_trade.get(key)
        if got is None:
            listed = bool(re.search(TRADES[key][1], (text or "").lower()))
            if package:
                status = "covered" if listed else "unclear"
                note = "Listed as included in the package." if listed else "Not listed in the package: ask if it's included."
            else:
                status, note = "missing", "No line for this. Ask if it's included or comes as an extra."
        else:
            ratio = got / est if est else None
            status = "high" if ratio and ratio > 1.25 else "low" if ratio and ratio < 0.7 else "ok"
            note = (f"{ratio - 1:.0%} above the estimate." if status == "high" else
                    f"{1 - ratio:.0%} below the estimate: check the specification." if status == "low" else "In line with the estimate.")
        trades.append({"key": key, "name": name, "quote": got, "estimate": round(est), "status": status, "note": note})

    # material rates and quantities
    rates = []
    for name, pat, unit, key, conv in MATERIALS:
        market = R.get(key)
        if not market:
            continue
        # the estimate's rates are per bag, per kg, per m³, per brick and per m² (tiles supplied; laying adds about Rs 25/sq ft)
        market_per = {"bag": market, "kg": market, "cft": market / 35.31, "no": market, "sqft": market / SQFT + 25}[unit]
        for l in items:
            if not re.search(pat, l["text"].lower()) or not l["rate"]:
                continue
            u = l["rate_unit"] or l["unit"] or unit
            f = conv.get(u)
            if f is None:
                continue
            per = l["rate"] / f
            ratio = per / market_per
            status = "high" if ratio > 1.2 else "low" if ratio < 0.75 else "ok"
            rates.append({"item": name, "quote": round(per, 2), "market": round(market_per, 2), "unit": unit, "status": status,
                          "note": (f"{ratio - 1:.0%} above the usual rate." if status == "high" else
                                   f"{1 - ratio:.0%} below the usual rate: ask which brand and grade." if status == "low" else "A fair rate.")})
            break
    need = {m["key"]: m for m in q["materials"]}
    for name, key, units in (("Steel", "steel", {"t": 1, "ton": 1, "tons": 1, "tonne": 1, "tonnes": 1, "mt": 1, "kg": 0.001, "quintal": 0.1}),
                             ("Cement", "cement", {"bag": 1, "bags": 1})):
        l = next((l for l in items if re.search(name.lower() if key == "cement" else r"\bsteel\b|\btmt\b", l["text"].lower()) and l["qty"] and (l["unit"] in units)), None)
        if l and key in need:
            got = l["qty"] * units[l["unit"]]
            want = need[key]["qty"]
            ratio = got / want if want else 1
            if ratio > 1.3 or ratio < 0.7:
                notes.append(f"{name}: the quote has {got:,.1f} {'t' if key == 'steel' else 'bags'}; this design needs about {want:,.1f}. "
                             + ("Ask for the bar bending schedule or the structural drawings it is based on." if key == "steel" else "Ask how it was worked out."))

    missing_extras = [name for name, pat in EXTRAS.items() if not re.search(pat, (text or "").lower())]
    loose = sum(l["amount"] or 0 for l in items if l["trade"] == "materials")
    if loose:
        notes.append(f"Rs {loose:,.0f} of loose materials (cement, sand, aggregate) are priced separately; the estimate counts them inside the trades.")
    return {
        "source": source, "lines": lines,
        "total": round(total), "basis": basis, "estimate": round(est_total), "diff": round(diff, 3), "overall": overall,
        "per_sqft": round(total / built_sqft) if built_sqft else None, "est_per_sqft": round(est_total / built_sqft) if built_sqft else None,
        "package_rate": package, "built_sqft": round(built_sqft), "margin": 0.12, "gst": with_gst,
        "trades": trades, "rates": rates, "notes": notes, "extras": missing_extras,
    }
