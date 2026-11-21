"""Export a plan floor as a DXF drawing (AutoCAD R12, the version every CAD program reads).

Geometry is in metres (plan units / 20), with y flipped so north stays up. Layers:

  A-WALL     walls as closed outlines of their real thickness
  A-DOOR     door leaves and swings
  A-GLAZ     windows (frame outline and glass line)
  A-AREA     room outlines, names and areas
  A-STRS     stairs with treads
  A-FURN     furniture
  A-ANNO-DIMS overall dimensions
  A-ANNO-TTLB title text
"""
from __future__ import annotations

import math

U = 20.0                      # plan units per metre
LAYERS = [("A-WALL", 7), ("A-DOOR", 1), ("A-GLAZ", 5), ("A-AREA", 8), ("A-STRS", 6), ("A-FURN", 9),
          ("A-ANNO-DIMS", 3), ("A-ANNO-TTLB", 7)]


class _Dxf:
    def __init__(self):
        self.out: list[str] = []

    def _g(self, code, value):
        if isinstance(value, float):
            value = f"{value:.4f}"
        self.out += [str(code), str(value)]

    def line(self, layer, p0, p1):
        self._g(0, "LINE"); self._g(8, layer)
        self._g(10, float(p0[0])); self._g(20, float(p0[1])); self._g(30, 0.0)
        self._g(11, float(p1[0])); self._g(21, float(p1[1])); self._g(31, 0.0)

    def poly(self, layer, pts, closed=True):
        self._g(0, "POLYLINE"); self._g(8, layer); self._g(66, 1); self._g(70, 1 if closed else 0)
        self._g(10, 0.0); self._g(20, 0.0); self._g(30, 0.0)
        for x, y in pts:
            self._g(0, "VERTEX"); self._g(8, layer)
            self._g(10, float(x)); self._g(20, float(y)); self._g(30, 0.0)
        self._g(0, "SEQEND"); self._g(8, layer)

    def arc(self, layer, c, r, start_deg, end_deg):
        self._g(0, "ARC"); self._g(8, layer)
        self._g(10, float(c[0])); self._g(20, float(c[1])); self._g(30, 0.0)
        self._g(40, float(r)); self._g(50, float(start_deg % 360)); self._g(51, float(end_deg % 360))

    def text(self, layer, p, height, s, center=True):
        s = str(s).replace("\n", " ")
        self._g(0, "TEXT"); self._g(8, layer)
        self._g(10, float(p[0])); self._g(20, float(p[1])); self._g(30, 0.0)
        self._g(40, float(height)); self._g(1, s)
        if center:
            self._g(72, 1); self._g(73, 2)          # centred, middle
            self._g(11, float(p[0])); self._g(21, float(p[1])); self._g(31, 0.0)

    def document(self, extmin, extmax):
        head = ["0", "SECTION", "2", "HEADER",
                "9", "$ACADVER", "1", "AC1009",
                "9", "$INSUNITS", "70", "6",
                "9", "$EXTMIN", "10", f"{extmin[0]:.4f}", "20", f"{extmin[1]:.4f}", "30", "0.0",
                "9", "$EXTMAX", "10", f"{extmax[0]:.4f}", "20", f"{extmax[1]:.4f}", "30", "0.0",
                "0", "ENDSEC",
                "0", "SECTION", "2", "TABLES",
                "0", "TABLE", "2", "LTYPE", "70", "1",
                "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0",
                "0", "ENDTAB",
                "0", "TABLE", "2", "LAYER", "70", str(len(LAYERS))]
        for name, color in LAYERS:
            head += ["0", "LAYER", "2", name, "70", "0", "62", str(color), "6", "CONTINUOUS"]
        head += ["0", "ENDTAB",
                 "0", "TABLE", "2", "STYLE", "70", "1",
                 "0", "STYLE", "2", "STANDARD", "70", "0", "40", "0.0", "41", "1.0", "50", "0.0", "71", "0",
                 "42", "0.2", "3", "txt", "4", "",
                 "0", "ENDTAB", "0", "ENDSEC",
                 "0", "SECTION", "2", "ENTITIES"]
        return "\n".join(head + self.out + ["0", "ENDSEC", "0", "EOF"]) + "\n"


def _feet(m):
    inches = round(m / 0.0254)
    return f"{inches // 12}'-{inches % 12}\""


def to_dxf(elements: list[dict], floor: int = 1, title: str = "Plan", imperial: bool = False) -> str:
    """DXF text for one floor of the plan. Raises ValueError if the floor has nothing to draw."""
    els = [e for e in elements if isinstance(e, dict) and (e.get("floor") or 1) == floor and e.get("type")]
    if not any(e["type"] in ("wall", "room") for e in els):
        raise ValueError("This floor has no walls or rooms to export.")

    # plan units -> metres, y up; shifted so the drawing starts at (0, 0)
    pts = []
    for e in els:
        if e["type"] == "room":
            pts += [(e["left"], e["top"] - e["height"] / 2), (e["left"] + e["width"], e["top"] + e["height"] / 2)]
        else:
            a = math.radians(e.get("angle") or 0)
            pts += [(e["left"], e["top"]), (e["left"] + e["width"] * math.cos(a), e["top"] + e["width"] * math.sin(a))]
    x0, y1 = min(p[0] for p in pts), max(p[1] for p in pts)

    def P(x, y):
        return ((x - x0) / U, (y1 - y) / U)

    def frame(e):
        """(start, unit along, unit across, length m, thickness m) of a line-like element, in DXF metres."""
        a = math.radians(e.get("angle") or 0)
        start = P(e["left"], e["top"])
        ux, uy = math.cos(a), -math.sin(a)          # y flipped
        return start, (ux, uy), (-uy, ux), e["width"] / U, (e.get("height") or 8) / U

    def rect(start, u, n, length, thick):
        s, hx, hy = start, n[0] * thick / 2, n[1] * thick / 2
        e_ = (s[0] + u[0] * length, s[1] + u[1] * length)
        return [(s[0] + hx, s[1] + hy), (e_[0] + hx, e_[1] + hy), (e_[0] - hx, e_[1] - hy), (s[0] - hx, s[1] - hy)]

    d = _Dxf()
    for e in els:
        t = e["type"]
        if t == "room":
            a, b = P(e["left"], e["top"] - e["height"] / 2), P(e["left"] + e["width"], e["top"] + e["height"] / 2)
            d.poly("A-AREA", [(a[0], a[1]), (b[0], a[1]), (b[0], b[1]), (a[0], b[1])])
            if e.get("kind") != "hallway":
                c = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                w_m, h_m = abs(b[0] - a[0]), abs(b[1] - a[1])
                area = e.get("area") or w_m * h_m
                size = f"{_feet(w_m)} x {_feet(h_m)}" if imperial else f"{w_m:.2f} x {h_m:.2f} m"
                area_s = f"{area * 10.7639:.0f} sq ft" if imperial else f"{area:.1f} m2"
                d.text("A-AREA", (c[0], c[1] + 0.25), 0.22, (e.get("name") or e.get("kind", "")).upper())
                d.text("A-AREA", (c[0], c[1] - 0.05), 0.14, size)
                d.text("A-AREA", (c[0], c[1] - 0.3), 0.14, area_s)
        elif t == "wall":
            d.poly("A-WALL", rect(*frame(e)))
        elif t == "window":
            start, u, n, length, _ = frame(e)
            thick = 8 / U                               # windows sit in the wall's thickness
            d.poly("A-GLAZ", rect(start, u, n, length, thick))
            d.line("A-GLAZ", start, (start[0] + u[0] * length, start[1] + u[1] * length))
        elif t == "door":
            start, u, n, length, _ = frame(e)
            side = 1 if (e.get("swing") or 1) > 0 else -1
            hinge = start if (e.get("hinge") or 1) > 0 else (start[0] + u[0] * length, start[1] + u[1] * length)
            along = u if hinge is start else (-u[0], -u[1])
            # the y flip turns the swing side over too
            leaf_dir = (-n[0] * side, -n[1] * side)
            leaf_end = (hinge[0] + leaf_dir[0] * length, hinge[1] + leaf_dir[1] * length)
            d.line("A-DOOR", hinge, leaf_end)
            a0 = math.degrees(math.atan2(along[1], along[0]))
            a1 = math.degrees(math.atan2(leaf_dir[1], leaf_dir[0]))
            cross = along[0] * leaf_dir[1] - along[1] * leaf_dir[0]
            d.arc("A-DOOR", hinge, length, *((a0, a1) if cross > 0 else (a1, a0)))
        elif t == "stairs":
            # like walls, (left, top) is the middle of the element's starting edge
            start, u, n, length, thick = frame(e)
            thick = (e.get("height") or 24) / U
            d.poly("A-STRS", rect(start, u, n, length, thick))
            steps = max(2, int(length / 0.28))
            for i in range(1, steps):
                p = (start[0] + u[0] * length * i / steps, start[1] + u[1] * length * i / steps)
                d.line("A-STRS", (p[0] - n[0] * thick / 2, p[1] - n[1] * thick / 2),
                       (p[0] + n[0] * thick / 2, p[1] + n[1] * thick / 2))
        elif t == "railing":
            start, u, n, length, _ = frame(e)
            d.line("A-STRS", start, (start[0] + u[0] * length, start[1] + u[1] * length))
        elif t.startswith("furniture_"):
            d.poly("A-FURN", rect(*frame(e)))

    # overall dimensions, 1 m outside the walls
    xs = [P(*p)[0] for p in pts]
    ys = [P(*p)[1] for p in pts]
    X0, X1, Y0, Y1 = min(xs), max(xs), min(ys), max(ys)
    W, H = X1 - X0, Y1 - Y0
    lab = (lambda m: _feet(m)) if imperial else (lambda m: f"{m:.2f}")
    top = Y1 + 1.0
    d.line("A-ANNO-DIMS", (X0, top), (X1, top))
    for x in (X0, X1):
        d.line("A-ANNO-DIMS", (x, top - 0.15), (x, top + 0.15))
    d.text("A-ANNO-DIMS", ((X0 + X1) / 2, top + 0.3), 0.25, lab(W))
    left = X0 - 1.0
    d.line("A-ANNO-DIMS", (left, Y0), (left, Y1))
    for y in (Y0, Y1):
        d.line("A-ANNO-DIMS", (left - 0.15, y), (left + 0.15, y))
    d.text("A-ANNO-DIMS", (left - 0.5, (Y0 + Y1) / 2), 0.25, lab(H))
    d.text("A-ANNO-TTLB", (X0, Y0 - 1.2), 0.35, f"{title} - {'Ground floor' if floor == 1 else f'Floor {floor}'}", center=False)
    d.text("A-ANNO-TTLB", (X0, Y0 - 1.7), 0.2,
           "Drawing units: metres" + ("; labels in feet and inches" if imperial else "") + ". Drawn with Arch-E-Tech.",
           center=False)
    return d.document((X0 - 2, Y0 - 2.5), (X1 + 1, Y1 + 2))
