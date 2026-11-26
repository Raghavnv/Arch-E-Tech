"""
Plain requests -> plan actions, without an AI model.

"make the master bedroom 1 m wider", "add a balcony to bedroom 3", "put a door between the kitchen and the
dining room", "paint the living room sage", "add a sofa to the lounge", "split the study into a study and
a bathroom". Each sentence is matched against the kinds of change the Studio can make; rooms are found by
name ("bedroom 2"), by type ("the kitchen", "the master") or as "this" (the selected item). The actions
are the same ones the AI answers with, and plan_editor.run carries them out.
"""
from __future__ import annotations

import re

from plan_actions import FURNITURE, KIND_NAME, OUTDOOR, fl, rbox, mid, is_furniture, fbox

FT = 0.3048
KIND_WORDS = [  # (pattern, kind), longest first
    (r"master\s+bed(?:room)?|master\s+suite|main\s+bedroom|the\s+master|master", "master_bedroom"),
    (r"guest\s+bed(?:room)?|kids?'?s?\s+(?:bed)?room|children'?s\s+room|bed\s?room|bed rm", "bedroom"),
    (r"family\s+lounge|lounge|family\s+room|tv\s+room|media\s+room", "lounge"),
    (r"living\s+room|living\s+area|drawing\s+room|sitting\s+room|living|hall(?!way)", "living"),
    (r"dining\s+room|dining\s+area|dining", "dining"),
    (r"kitchen", "kitchen"),
    (r"en-?suite|attached\s+bath(?:room)?|bath\s?room|bath|toilet|washroom|wc|restroom|powder\s+room", "bathroom"),
    (r"study|office|home\s+office|library|work\s?room", "study"),
    (r"utility|laundry|store\s?room|storage\s+room|store|pantry|pooja\s+room|puja\s+room|prayer\s+room|mandir\s+room", "utility"),
    (r"walk-?in\s+closet|walk-?in|closet|dressing\s+room|wardrobe\s+room", "closet"),
    (r"hallway|corridor|passage|lobby|foyer", "hallway"),
    (r"balcon(?:y|ies)", "balcony"), (r"patio|sit-?\s?out|verandah?|porch|courtyard", "patio"),
    (r"terrace|roof\s+terrace|roof\s+garden", "terrace"), (r"deck", "deck"),
]
NEW_NAME = {"pooja": "Pooja Room", "puja": "Pooja Room", "prayer": "Pooja Room", "mandir": "Pooja Room", "store": "Store Room",
            "pantry": "Pantry", "laundry": "Laundry", "guest": "Guest Bedroom", "kid": "Kids' Bedroom", "children": "Kids' Bedroom",
            "office": "Home Office", "library": "Library", "powder": "Powder Room", "sit": "Sit-out", "verand": "Verandah",
            "porch": "Porch", "courtyard": "Courtyard", "roof garden": "Roof Garden", "dressing": "Dressing Room"}
SIDE_WORDS = {"north": "N", "south": "S", "east": "E", "west": "W", "top": "N", "bottom": "S", "right": "E", "left": "W"}
FURNITURE_WORDS = [
    (r"king\s+(?:size\s+)?bed|double\s+bed", "furniture_bed"), (r"queen\s+(?:size\s+)?bed", "furniture_bed_queen"),
    (r"single\s+bed|twin\s+bed", "furniture_bed_single"), (r"bunk\s+bed", "furniture_bunk_bed"), (r"\bbed\b", "furniture_bed_queen"),
    (r"l[- ]shaped\s+sofa|sectional", "furniture_sectional"), (r"2[- ]seater|loveseat|small\s+sofa", "furniture_sofa2"),
    (r"sofa|couch", "furniture_sofa"), (r"arm\s?chair", "furniture_armchair"), (r"recliner", "furniture_recliner"),
    (r"diwan|divan|day\s?bed", "furniture_diwan"), (r"coffee\s+table|centre\s+table|center\s+table", "furniture_coffee_table"),
    (r"side\s+table|end\s+table", "furniture_side_table"), (r"tv\s+unit|tv\s+cabinet|entertainment\s+unit", "furniture_tv_unit"),
    (r"\btv\b|television", "furniture_tv"), (r"book\s?shel(?:f|ves)|book\s?case", "furniture_bookshelf"),
    (r"console", "furniture_console"), (r"pouf|ottoman", "furniture_pouf"), (r"round\s+(?:dining\s+)?table", "furniture_dining_round"),
    (r"8[- ]seater|eight[- ]seater", "furniture_dining8"), (r"4[- ]seater|four[- ]seater", "furniture_dining4"),
    (r"dining\s+table|table", "furniture_table"), (r"bar\s+stools?", "furniture_bar_stool"), (r"dining\s+chairs?|chairs?", "furniture_chair"),
    (r"sideboard|crockery", "furniture_sideboard"), (r"bedside|night\s?stand", "furniture_bedside"),
    (r"sliding\s+wardrobe", "furniture_wardrobe_sliding"), (r"wardrobe|almirah|cupboard", "furniture_wardrobe3"),
    (r"dress(?:ing)?\s+table|dresser|vanity\s+table", "furniture_dresser"), (r"chest\s+of\s+drawers|drawers", "furniture_drawers"),
    (r"crib|cot", "furniture_crib"), (r"study\s+(?:table|desk)|desk|work\s?station", "furniture_desk"),
    (r"office\s+chair", "furniture_office_chair"), (r"island", "furniture_island"),
    (r"(?:double[- ]door\s+)?fridge|refrigerator", "furniture_fridge"), (r"dish\s?washer", "furniture_dishwasher"),
    (r"oven|microwave", "furniture_oven_tower"), (r"toilet|wc|commode", "furniture_wc"), (r"vanity|wash\s?basin|basin|sink", "furniture_vanity"),
    (r"shower", "furniture_shower"), (r"bath\s?tub|tub", "furniture_bathtub"), (r"washing\s+machine|washer", "furniture_washing_machine"),
    (r"pooja\s+unit|mandir|temple|puja\s+unit", "furniture_pooja"), (r"shoe\s+rack", "furniture_shoe_rack"),
    (r"shel(?:f|ves)|rack", "furniture_storage_shelf"), (r"outdoor\s+chairs?|garden\s+chairs?|patio\s+chairs?", "furniture_outdoor_chair"),
    (r"swing|jhula|jhoola", "furniture_swing"), (r"planters?", "furniture_planter"), (r"rug|carpet|dhurrie", "furniture_rug"),
    (r"plants?", "furniture_plant"), (r"floor\s+lamp|lamp", "furniture_floor_lamp"), (r"wall\s+art|painting|artwork|frame", "furniture_wall_art"),
    (r"mirror", "furniture_mirror"),
]
BASIC_COLOURS = {
    "white": "#f4f2ee", "off white": "#efe9df", "cream": "#f1e6d3", "ivory": "#f1e6d3", "beige": "#e2cfae", "sand": "#e2cfae",
    "grey": "#a7a39c", "gray": "#a7a39c", "light grey": "#cfcac2", "charcoal": "#4a4a4c", "black": "#2b2a29",
    "blue": "#6f8fb0", "light blue": "#bcd4e6", "sky blue": "#bcd4e6", "navy": "#2e3e5c", "teal": "#3f7a7a",
    "green": "#7f9a72", "sage": "#a8b79c", "olive": "#7d7a4a", "mint": "#cfe3d2", "forest green": "#3d5a45", "emerald": "#2f6b55",
    "yellow": "#e8cf7a", "mustard": "#c9a13b", "orange": "#d98a4e", "terracotta": "#c46a45", "peach": "#f0c7a6", "coral": "#e58d7a",
    "red": "#a84a3e", "maroon": "#6e2a2c", "pink": "#e8b8bd", "blush": "#ecc9c6", "rose": "#d9a3a8", "purple": "#7c6a9a",
    "lavender": "#cfc4e0", "lilac": "#c9b6d8", "brown": "#7a5a43", "taupe": "#a39383", "greige": "#cfc6b8",
}
STOP = {"ceiling", "light", "lights", "with", "and", "the", "false", "floor", "floors", "tiles", "tile", "wall", "walls",
        "paint", "room", "door", "doors", "window", "windows", "style", "for", "from"}
VAGUE_BIGGER = r"bigger|larger|more\s+spacious|roomier|enlarge|expand|extend|increase|grow"
VAGUE_SMALLER = r"smaller|tinier|reduce|shrink|decrease|compact"


def length_m(text: str):
    """The first length in the text, in metres ("3 ft", "1.5 m", "6'", "40 cm", "2 metres")."""
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:'|ft\b|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:\"|in\b|inch(?:es)?))?", text)
    if m:
        return float(m.group(1)) * FT + (float(m.group(2)) * 0.0254 if m.group(2) else 0)
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?)\b", text)
    if m:
        return float(m.group(1)) / 100
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:m\b|mt\b|mtrs?\b|met(?:er|re)s?\b)", text)
    if m:
        return float(m.group(1))
    return None


def dims_m(text: str):
    """"12 x 14 ft", "4 by 5 m", "4m x 3.5m" -> (a, b) in metres."""
    m = re.search(r"(\d+(?:\.\d+)?)\s*(m|ft|'|feet)?\s*(?:x|×|by|\*)\s*(\d+(?:\.\d+)?)\s*(m\b|ft\b|'|feet|metres?|meters?)?", text)
    if not m:
        return None
    unit = (m.group(4) or m.group(2) or "m")
    k = FT if unit in ("ft", "'", "feet") else 1.0
    return float(m.group(1)) * k, float(m.group(3)) * k


def area_m2(text: str):
    m = re.search(r"(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|square\s+feet|ft2|ft²)", text)
    if m:
        return float(m.group(1)) * FT * FT
    m = re.search(r"(\d+(?:\.\d+)?)\s*(sq\.?\s*m|sqm|square\s+met(?:er|re)s?|m2|m²)", text)
    if m:
        return float(m.group(1))
    return None


def side_of(text: str):
    m = re.search(r"\b(north|south|east|west)\b", text)
    if m:
        return SIDE_WORDS[m.group(1)]
    m = re.search(r"\b(?:to(?:wards)?\s+the|on\s+the|at\s+the)\s+(left|right|top|bottom)\b", text)
    return SIDE_WORDS[m.group(1)] if m else None


def floor_of(text: str):
    if re.search(r"\bground\s+floor|downstairs\b", text):
        return 1
    if re.search(r"\b(first|1st)\s+floor|upstairs\b|upper\s+floor", text):
        return 2
    if re.search(r"\b(second|2nd)\s+floor", text):
        return 3
    return None


class Rooms:
    """Find the rooms a sentence talks about."""

    def __init__(self, plan, active_floor, selected):
        self.plan, self.floor = plan, active_floor
        self.selected = [plan.by_id(i) for i in selected or [] if plan.by_id(i)]

    def this(self):
        for e in self.selected:
            if e["type"] == "room":
                return e
        for e in self.selected:
            x, y = ((fbox(e)[0] + fbox(e)[2]) / 2, (fbox(e)[1] + fbox(e)[3]) / 2) if is_furniture(e) else mid(e)
            r = self.plan.room_of_point(fl(e), x, y)
            if r:
                return r
        return None

    def find(self, text: str, floor_hint=None):
        """Rooms mentioned in the text, in order: [(start, end, room or None, kind)]."""
        rooms = self.plan.rooms()
        hits = []
        taken = [False] * len(text)

        def claim(a, b):
            if any(taken[a:b]):
                return False
            for i in range(a, b):
                taken[i] = True
            return True
        # names first ("bedroom 2", "guest bedroom"), longest first
        for r in sorted(rooms, key=lambda r: -len(r.get("name") or "")):
            n = (r.get("name") or "").lower().strip()
            if len(n) < 3:
                continue
            for m in re.finditer(r"\b" + re.escape(n) + r"\b", text):
                if claim(m.start(), m.end()):
                    hits.append((m.start(), m.end(), r, r.get("kind")))
        # "bedroom two", "bedroom #3"
        nums = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
        for m in re.finditer(r"\bbed\s?room\s*(?:#|no\.?|number)?\s*(\d|one|two|three|four|five|six)\b", text):
            n = m.group(1)
            n = nums.get(n, n)
            r = next((q for q in rooms if (q.get("name") or "").lower() == f"bedroom {n}"), None)
            if r and claim(m.start(), m.end()):
                hits.append((m.start(), m.end(), r, "bedroom"))
        for m in re.finditer(r"\b(this|it|the selected (?:room|one|item))\b", text):
            r = self.this()
            if r and claim(m.start(), m.end()):
                hits.append((m.start(), m.end(), r, r.get("kind")))
        for pat, kind in KIND_WORDS:
            for m in re.finditer(r"\b(?:" + pat + r")\b", text):
                if not claim(m.start(), m.end()):
                    continue
                hits.append((m.start(), m.end(), self.pick(kind, floor_hint), kind))
        return sorted(hits, key=lambda h: h[0])

    def pick(self, kind, floor_hint=None):
        cands = [r for r in self.plan.rooms() if r.get("kind") == kind]
        if kind == "living" and not cands:
            cands = [r for r in self.plan.rooms() if r.get("kind") in ("lounge", "hallway")]
        if not cands:
            return None
        for f in (floor_hint, self.floor):
            here = [r for r in cands if fl(r) == f]
            if here:
                return max(here, key=lambda r: r["width"] * r["height"])
        return max(cands, key=lambda r: r["width"] * r["height"])


def _furniture_in(text):
    for pat, t in FURNITURE_WORDS:
        m = re.search(r"\b(?:" + pat + r")", text)
        if m:
            return t, m
    return None, None


def _count(text):
    m = re.search(r"\b(\d+|two|three|four|five|six|a pair of|a couple of)\b", text)
    if not m:
        return 1
    return {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "a pair of": 2, "a couple of": 2}.get(m.group(1)) or int(m.group(1))


def _name_for(text, kind):
    for k, v in NEW_NAME.items():
        if re.search(r"\b" + k, text):
            return v
    return None


def _match_catalog(text, items):
    """The catalog entry ([id, name]) whose name best matches the text."""
    best, score = None, 0
    for item in items or []:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        name = str(item[1]).lower()
        words = [w for w in re.findall(r"[a-z]+", name) if len(w) > 2 and w not in STOP]
        hit = sum(1 for w in words if re.search(r"\b" + w, text))
        if re.search(r"\b" + re.escape(name) + r"\b", text):
            hit += 5
        if hit > score:
            best, score = item, hit
    return best


def _colour(text, catalog):
    m = re.search(r"#[0-9a-f]{6}\b", text)
    if m:
        return m.group(0), m.group(0)
    hit = _match_catalog(text, (catalog or {}).get("paints"))
    if hit:
        return hit[1], hit[0]
    for name in sorted(BASIC_COLOURS, key=len, reverse=True):
        if re.search(r"\b" + name + r"\b", text):
            return name, BASIC_COLOURS[name]
    return None, None


def parse(text: str, plan, active_floor=1, selected=None, catalog=None):
    """Actions for one request, or [] when nothing was understood."""
    actions = []
    verbs = r"(?:add|make|paint|put|remove|delete|move|change|give|turn|split|merge|rename|swap|furnish|enlarge|extend|widen|build|convert|use|replace|install|apply)"
    clauses = re.split(r"(?:\.\s+|;\s*|\bthen\b|\balso\b|\n|,?\s*\band\s+(?=" + verbs + r"\b)|,\s*(?=" + verbs + r"\b))", text.lower())
    last_room = None
    for clause in clauses:
        clause = (clause or "").strip(" .,")
        if not clause:
            continue
        sel = selected or []
        if last_room and re.search(r"\b(it|its|this|there|that room)\b", clause) and not sel:
            sel = [last_room]
        got = _parse_clause(clause, plan, active_floor, sel, catalog or {})
        actions.extend(got)
        for a in got:
            for k in ("room", "next_to"):
                if isinstance(a.get(k), str):
                    last_room = a[k]
                    break
    return actions


def _parse_clause(t, plan, active_floor, selected, catalog):
    R = Rooms(plan, active_floor, selected)
    fh = floor_of(t)
    hits = R.find(t, fh)
    rooms = [h[2] for h in hits if h[2] is not None]
    first = rooms[0] if rooms else R.this()
    side = side_of(t)
    sel = R.selected[0] if R.selected else None

    def rid(r):
        return r["id"] if r else None

    # --- the selected door / window / furniture / wall --------------------------------------------------
    if sel is not None and re.search(r"\b(this|it|selected)\b", t) and sel["type"] != "room":
        if re.search(r"\b(delete|remove|get rid of)\b", t):
            return [{"do": "raw", "ops": [{"op": "delete", "id": sel["id"]}]}]
        m = re.search(r"rotate.*?(-?\d+)", t)
        if m or "rotate" in t or "turn it" in t:
            return [{"do": "rotate", "id": sel["id"], "by": float(m.group(1)) if m else 90}]
        if sel["type"] in ("door", "window"):
            L = length_m(t)
            if L:
                return [{"do": "resize_element", "id": sel["id"], "width_m": L}]
            if re.search(r"wider|bigger|larger", t):
                return [{"do": "resize_element", "id": sel["id"], "width_m": sel["width"] / 20 * 1.3}]
            if re.search(r"narrower|smaller", t):
                return [{"do": "resize_element", "id": sel["id"], "width_m": sel["width"] / 20 * 0.75}]
        if is_furniture(sel):
            m = re.search(r"\bmove\b.*\b(?:to|into)\b", t)
            target = next((h[2] for h in hits if h[2] is not None and h[0] > (m.end() if m else 0)), None) if m else None
            if target:
                return [{"do": "move_furniture", "id": sel["id"], "room": target["id"]}]

    # --- outdoor spaces ----------------------------------------------------------------------------------
    m = re.search(r"\b(balcon(?:y|ies)|patio|terrace|roof\s+garden|deck|sit-?\s?out|verandah?|porch|courtyard)\b", t)
    if m and re.search(r"\b(add|build|create|put|give|attach|want|need|include|make|extend|have)\b", t) \
            and not re.search(r"\b(remove|delete|get rid of)\b", t):
        word = m.group(1)
        kind = "balcony" if word.startswith("balcon") else "terrace" if word in ("terrace", "roof garden") else "deck" if word == "deck" else "patio"
        host = next((h[2] for h in hits if h[2] is not None and h[3] not in OUTDOOR), None)
        if host is None:
            want_floor = fh or (max(fl(e) for e in plan.els) if kind in ("balcony", "terrace") and len({fl(e) for e in plan.els}) > 1 else 1)
            if kind == "balcony" and want_floor == 1 and len({fl(e) for e in plan.els}) > 1 and fh is None:
                want_floor = 2
            prefs = {"patio": ["living", "dining", "lounge", "kitchen"], "deck": ["living", "dining", "lounge"],
                     "balcony": ["master_bedroom", "bedroom", "lounge", "living"], "terrace": ["lounge", "hallway", "master_bedroom", "bedroom", "living"]}[kind]
            for k in prefs:
                host = next((r for r in plan.rooms(want_floor) if r.get("kind") == k), None)
                if host:
                    break
        dims = dims_m(t)
        L = length_m(t)
        depth = width = None
        if dims:
            width, depth = max(dims), min(dims)
        elif L and re.search(r"deep|depth|projection", t):
            depth = L
        elif L and re.search(r"wide|long|width", t):
            width = L
        elif L:
            depth = L
        n = _count(t) if word.endswith("ies") else 1
        out = []
        if re.search(r"\b(all|every|each)\b[\w\s]*?\bbed\s?rooms?\b", t):
            beds = [r for r in plan.rooms() if r.get("kind") in ("bedroom", "master_bedroom") and (kind != "balcony" or fl(r) > 1 or len({fl(e) for e in plan.els}) == 1)]
            return [{"do": "add_room", "kind": kind, "next_to": r["id"], "side": side, "width_m": width, "depth_m": depth} for r in beds]
        if kind == "terrace" and host is not None and not dims and not L and fl(host) > 1:
            out.append({"do": "add_terrace", "floor": fl(host)})
            return out
        for _ in range(n):
            out.append({"do": "add_room", "kind": kind, "next_to": rid(host), "side": side, "width_m": width, "depth_m": depth,
                        "name": _name_for(t, kind)})
        return out

    # --- doors and windows ----------------------------------------------------------------------------------
    for t_word, kind in (("door", "door"), ("window", "window")):
        if not re.search(r"\b" + t_word + r"s?\b", t):
            continue
        to = None
        if re.search(r"\b(outside|garden|exterior|outdoors|backyard|yard|front|road)\b", t) and kind == "door":
            to = "outside"
        elif len(rooms) >= 2:
            to = rooms[1]
        r = first
        if kind == "door" and re.search(r"\b(main|front|entrance|entry)\s+door\b|\bentrance\b", t):
            from plan_actions import front_side, edge, SIDES
            fs = front_side(plan)
            ent = None
            if fs:
                for q in plan.rooms(1):
                    if plan.openings_of(q, "door", "outside", fs):
                        ent = q
                        break
            if ent:
                r, to, side = ent, "outside", fs
        if r is None:
            return []
        L = length_m(t)
        if re.search(r"\b(remove|delete|close|block|wall up|get rid of|no)\b", t):
            return [{"do": f"remove_{kind}", "room": rid(r), "to": rid(to) if isinstance(to, dict) else to, "side": side,
                     "all": bool(re.search(r"\ball\b|\bevery\b|windows\b|doors\b", t))}]
        if re.search(r"\b(wider|narrower|bigger|smaller|larger|wide|width)\b", t) and not re.search(r"\b(add|new|another|put)\b", t):
            if L:
                w = L
            else:
                cur = plan.openings_of(r, kind, to if to else None, side) if hasattr(plan, "openings_of") else []
                base = (cur[0]["width"] / 20) if cur else (0.9 if kind == "door" else 1.2)
                w = base * (1.3 if re.search(r"wider|bigger|larger", t) else 0.75)
                if kind == "door":
                    w = min(w, 1.8 if to == "outside" else 1.2) if w > base else max(w, 0.7)
            return [{"do": f"resize_{kind}", "room": rid(r), "to": rid(to) if isinstance(to, dict) else to, "side": side, "width_m": round(w, 2)}]
        if re.search(r"\b(add|put|create|make|need|want|give|new|another|more|one more|cut|open)\b", t):
            if kind == "door":
                return [{"do": "add_door", "room": rid(r), "to": rid(to) if isinstance(to, dict) else (to or None), "side": side, "width_m": L}]
            return [{"do": "add_window", "room": rid(r), "side": side, "width_m": L, "count": _count(re.sub(r"\d+(\.\d+)?\s*(m|ft|feet|'|cm)\b", "", t))}]

    # --- furniture ---------------------------------------------------------------------------------------------
    ft, fm = _furniture_in(t)
    if re.search(r"\bfurnish\b|\bfurniture\b", t) and first and not ft:
        if re.search(r"\b(remove|clear|empty|delete|take out)\b", t):
            return [{"do": "remove_furniture", "room": rid(first), "item": None}]
        return [{"do": "furnish_room", "room": rid(first)}]
    if ft and first is not None and not re.search(r"\b(paint|floor(?:ing)?|ceiling)\b", t):
        # a room word inside the furniture name ("dining table") isn't the target room
        targets = [h[2] for h in hits if h[2] is not None and not (fm.start() <= h[0] < fm.end() + 1)]
        room = targets[0] if targets else first
        if re.search(r"\b(remove|delete|take out|get rid of|no)\b", t):
            return [{"do": "remove_furniture", "room": rid(room), "item": ft}]
        if re.search(r"\b(add|put|place|want|need|include|give|bring|get)\b", t):
            return [{"do": "add_furniture", "room": rid(room), "item": ft, "count": _count(t[:fm.start()])}]

    # --- finishes (applied in the Studio) ----------------------------------------------------------------------
    targets = [h[2] for h in hits if h[2] is not None] or ([first] if first else [])
    plural = []
    for pat, kind in KIND_WORDS:
        if re.search(r"\b(?:all|every|each|both)\b[\w\s]*?\b(?:" + pat + r")s?\b", t):
            plural += [r for r in plan.rooms() if r.get("kind") == kind or (kind == "bedroom" and r.get("kind") == "master_bedroom")]
    if plural:
        targets = list({id(r): r for r in plural}.values())
    every = bool(re.search(r"\b(all|every|whole|entire|each)\b.*\b(rooms?|walls?|house|home|floors?)\b|\bthe\s+(house|home)\b", t))
    room_ids = [r["id"] for r in targets] if plural else ("all" if every or not targets else [r["id"] for r in targets])
    if re.search(r"\b(exterior|outside walls|outside of the house|facade|façade|front of the house)\b", t):
        name, hexv = _colour(t, catalog)
        if hexv:
            return [{"do": "set_exterior", "paint": hexv, "label": name}]
    if re.search(r"\broof\b", t):
        patch = {}
        if "flat" in t:
            patch["roofStyle"] = "flat"
        elif re.search(r"pitched|sloped|tiled", t):
            patch["roofStyle"] = "pitched"
        name, hexv = _colour(t, catalog)
        if hexv:
            patch["roof"] = hexv
        if patch:
            return [{"do": "set_exterior", **patch}]
    style = _match_catalog(t, catalog.get("styles"))
    if style and re.search(r"\bstyle\b|\blook\b|\bdesign\b|\btheme\b|\bmake (?:it|the house|everything)\b", t):
        return [{"do": "apply_style", "style": style[0], "label": style[1]}]
    if re.search(r"\bceiling\b|chandelier|pendant|cove|coffered|false ceiling|fan\b|spotlights?|downlights?", t):
        cs = _match_catalog(t, catalog.get("ceilings"))
        lt = _match_catalog(t, catalog.get("lights"))
        if cs is None and re.search(r"false\s+ceiling|designer\s+ceiling", t):
            cs = next((c for c in catalog.get("ceilings") or [] if c[0] == "cove"), None)
        if cs or lt:
            return [{"do": "set_ceiling", "rooms": room_ids, "style": cs[0] if cs and "ceiling" in t else None, "light": lt[0] if lt else None,
                     "label": " and ".join(x[1] for x in (cs, lt) if x)}]
    if re.search(r"\bfloor(?:ing|s)?\b|tiles?\b|marble|granite|hardwood|laminate|parquet|vinyl", t) and not re.search(r"\bground floor|first floor|second floor\b", t.replace("floor tiles", "")):
        fin = _match_catalog(t, catalog.get("floors"))
        if fin:
            return [{"do": "set_floor", "rooms": room_ids, "finish": fin[0], "label": fin[1]}]
    if re.search(r"curtains?|blinds?|drapes|sheers?|shades", t):
        tr = _match_catalog(t, catalog.get("treatments"))
        name, hexv = _colour(t, catalog)
        return [{"do": "set_windows", "rooms": room_ids, "treatment": tr[0] if tr else ("blinds" if "blind" in t else "curtains"),
                 "fabric": hexv, "label": tr[1] if tr else None}]
    if re.search(r"\bframes?\b", t) and re.search(r"window", t):
        fr = _match_catalog(t, catalog.get("frames"))
        if fr:
            return [{"do": "set_windows", "rooms": room_ids, "frame": fr[0], "label": fr[1]}]
    if re.search(r"\b(paint|colou?r|walls?|wallpaper|panel(?:l)?ing|cladding|brick|stone|wood)\b", t):
        mat = _match_catalog(t, catalog.get("wall_finishes")) if re.search(r"wallpaper|panel|cladding|brick|stone|wood|veneer|slat", t) else None
        feature = bool(re.search(r"\bfeature\b|\baccent\b|\bone wall\b|\bbehind the (?:bed|tv|sofa)\b", t))
        if mat:
            return [{"do": "paint_walls", "rooms": room_ids, "material": mat[0], "isColor": False, "feature": feature, "label": mat[1]}]
        name, hexv = _colour(t, catalog)
        if hexv:
            return [{"do": "paint_walls", "rooms": room_ids, "material": hexv, "isColor": True, "feature": feature, "label": name}]

    # --- rooms: rename, change use, split, merge, swap, remove, add --------------------------------------------
    m = re.search(r"\b(?:rename|call|name)\b.*?\b(?:to|as)\b\s+['\"]?([\w' -]+?)['\"]?$", t) or re.search(r"\bcall\s+(?:it|this|the \w+(?: \w+)?)\s+['\"]?([\w' -]+)['\"]?$", t)
    if m and first:
        return [{"do": "rename_room", "room": rid(first), "name": m.group(1).strip().title()}]
    if re.search(r"\bswap\b|\bexchange\b|\bswitch\b", t) and len(rooms) >= 2:
        return [{"do": "swap_rooms", "room": rid(rooms[0]), "with": rid(rooms[1])}]
    if re.search(r"\b(merge|combine|join|open up|knock down the wall between|remove the wall between)\b", t) and len(rooms) >= 2:
        return [{"do": "merge_rooms", "room": rid(rooms[0]), "with": rid(rooms[1])}]
    m = re.search(r"\b(split|divide|partition)\b", t)
    if m and first:
        kinds = [h[3] for h in hits if h[0] > m.end() and h[3]]
        new_kind = next((k for k in kinds if k != first.get("kind")), kinds[-1] if kinds else first.get("kind"))
        return [{"do": "split_room", "room": rid(first), "kind": new_kind, "name": _name_for(t[m.end():], new_kind)}]
    m = re.search(r"\b(?:make|turn|convert|change|use|repurpose)\b.*?\b(?:into|to|as|in to)\b\s+(?:an?\s+|the\s+)?(.+)$", t)
    if m and first:
        target = m.group(1)
        kind = next((k for pat, k in KIND_WORDS if re.search(r"\b(?:" + pat + r")\b", target)), None)
        if kind and kind != first.get("kind") or (kind and _name_for(target, kind)):
            return [{"do": "rename_room", "room": rid(first), "kind": kind, "name": _name_for(target, kind) or KIND_NAME.get(kind)}]
    if re.search(r"\b(remove|delete|demolish|get rid of)\b", t) and first and not ft:
        return [{"do": "remove_room", "room": rid(first)}]
    # --- room sizes ----------------------------------------------------------------------------------------
    if first is not None:
        dims = dims_m(t)
        if dims and re.search(r"\b(make|resize|change|set|should be|to be|become|enlarge|expand|to)\b", t):
            a, b = dims
            w, d = first["width"] / 20, first["height"] / 20
            # match the given sizes to the room's own orientation
            if (w >= d) != (a >= b):
                a, b = b, a
            return [{"do": "resize_room", "room": rid(first), "to_width_m": round(a, 2), "to_depth_m": round(b, 2)}]
        A = area_m2(t)
        if A and re.search(r"\b(make|resize|to|should be|enlarge|expand|increase|reduce)\b", t):
            return [{"do": "resize_room", "room": rid(first), "to_area_m2": A, "side": side}]
        L = length_m(t)
        grow = re.search(VAGUE_BIGGER + r"|wider|longer|deeper|broader", t)
        shrink = re.search(VAGUE_SMALLER + r"|narrower|shorter|shallower", t)
        if grow or shrink:
            axis = None
            if re.search(r"wider|narrower|broader|width", t):
                axis = ["E", "W"]
            elif re.search(r"longer|shorter|deeper|shallower|depth", t):
                axis = ["N", "S"] if first["height"] >= first["width"] or "deeper" in t or "shallower" in t else ["E", "W"]
            m2 = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:m|ft|feet|')?\s*(?:wide|deep|long)\b", t)
            if m2 and L and re.search(r"\b(to|make it|be)\b", t) and not re.search(r"\bby\b", t):
                if axis == ["E", "W"] or "wide" in t:
                    return [{"do": "resize_room", "room": rid(first), "to_width_m": L, "side": side}]
                return [{"do": "resize_room", "room": rid(first), "to_depth_m": L, "side": side}]
            return [{"do": "resize_room", "room": rid(first), "side": side, "sides": axis, "by_m": L, "grow": bool(grow) and not (shrink and shrink.start() < grow.start())}]
        if L and re.search(r"\b(wide|width)\b", t):
            return [{"do": "resize_room", "room": rid(first), "to_width_m": L, "side": side}]
        if L and re.search(r"\b(deep|depth|long|length)\b", t):
            return [{"do": "resize_room", "room": rid(first), "to_depth_m": L, "side": side}]
        if re.search(r"\b(move|push|shift)\b.*\bwall\b", t) and L:
            out = re.search(r"\b(out|outward|outwards|out by|further)\b", t)
            return [{"do": "resize_room", "room": rid(first), "side": side, "by_m": L, "grow": bool(out) or not re.search(r"\bin\b|\binward", t)}]
        m = re.search(r"\b(add|build|create|make|need|want|put|include|give me)\b\s+(?:a|an|another|one more|a new|an extra|extra|new|a second|second)\s+(.+)$", t)
    if m:
        rest = m.group(2)
        kind = next((k for pat, k in KIND_WORDS if re.search(r"^(?:\w+\s+)?(?:" + pat + r")\b", rest)), None)
        if kind and kind not in OUTDOOR:
            near = re.search(r"\b(?:next to|beside|off|near|adjacent to|adjoining|attached to|by|behind|in front of|opening (?:off|onto|from)|from)\b", t)
            host = next((h[2] for h in hits if h[2] is not None and near and h[0] >= near.end()), None)
            if host is None:
                f = fh or active_floor
                prefs = {"bathroom": ["bedroom", "master_bedroom", "hallway", "living", "lounge"],
                         "bedroom": ["hallway", "lounge", "living"], "master_bedroom": ["hallway", "lounge", "living"],
                         "closet": ["master_bedroom", "bedroom"], "kitchen": ["dining", "living"], "dining": ["kitchen", "living"],
                         "utility": ["kitchen", "dining", "hallway"], "study": ["living", "lounge", "hallway", "bedroom"]}.get(kind, ["living", "lounge", "hallway"])
                for k in prefs:
                    host = next((r for r in plan.rooms(f) if r.get("kind") == k), None)
                    if host:
                        break
            dims = dims_m(rest)
            return [{"do": "add_room", "kind": kind, "next_to": rid(host), "side": side, "width_m": dims[0] if dims else None,
                     "depth_m": dims[1] if dims else None, "name": _name_for(rest, kind)}]

    return []
