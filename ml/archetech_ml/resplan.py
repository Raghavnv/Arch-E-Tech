"""Loading ResPlan (github.com/m-agour/ResPlan, data CC BY 4.0) safely.

The dataset ships as a pickle. Unpickling can run arbitrary code, so only the three
globals the file actually uses (checked with pickletools) are allowed.
"""
from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy
import shapely.io

DATA = Path(__file__).resolve().parent.parent / "data" / "raw" / "resplan"
ALLOWED = {
    ("shapely.io", "from_wkb"): shapely.io.from_wkb,
    ("numpy._core.multiarray", "scalar"): numpy._core.multiarray.scalar,
    ("numpy", "dtype"): numpy.dtype,
}


class _SafeUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        try:
            return ALLOWED[(module, name)]
        except KeyError:
            raise pickle.UnpicklingError(f"refusing to load {module}.{name}") from None


def load_plans(path: Path = DATA / "ResPlan.pkl") -> list[dict]:
    with open(path, "rb") as f:
        return _SafeUnpickler(f).load()


def load_splits(path: Path = DATA / "split.json") -> dict[str, list]:
    return json.loads(Path(path).read_text())
