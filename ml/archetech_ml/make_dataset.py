"""Pre-render ResPlan into image / mask pairs for training.

    python -m archetech_ml.make_dataset [--variants 2] [--size 512]

Writes data/rendered/{train,val,test}/<plan id>_<variant>.png and ..._mask.png. Train plans get
`variants` differently styled drawings each (the augmented plans join train); val and test get one
fixed rendering each so scores are comparable between runs.
"""
from __future__ import annotations

import argparse
import random
from multiprocessing import Pool

from PIL import Image

from .render import render
from .resplan import DATA, load_plans, load_splits

OUT = DATA.parent.parent / "rendered"
_plans = None


def _init():
    global _plans
    _plans = {p["id"]: p for p in load_plans()}


def _job(args):
    split, pid, variant, size = args
    out = OUT / split
    img_path = out / f"{pid}_{variant}.png"
    if img_path.exists():
        return 1
    try:
        img, mask = render(_plans[pid], size, random.Random(f"{split}-{pid}-{variant}"))
    except Exception:
        return 0
    img.save(img_path)
    Image.fromarray(mask).save(out / f"{pid}_{variant}_mask.png")
    return 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants", type=int, default=2)
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()
    splits = load_splits()
    jobs = []
    for split, ids, n in (("train", splits["train"] + splits["augmented"], a.variants),
                          ("val", splits["val"], 1), ("test", splits["test"], 1)):
        (OUT / split).mkdir(parents=True, exist_ok=True)
        jobs += [(split, pid, v, a.size) for pid in ids for v in range(n)]
    with Pool(a.workers, initializer=_init) as pool:
        done = 0
        for i, ok in enumerate(pool.imap_unordered(_job, jobs, chunksize=64)):
            done += ok
            if i % 5000 == 0:
                print(f"{i}/{len(jobs)}", flush=True)
    print(f"rendered {done}/{len(jobs)} into {OUT}")


if __name__ == "__main__":
    main()
