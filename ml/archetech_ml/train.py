"""Train the floor plan reader: a U-Net that labels every pixel as wall, door, window or a room type.

    python -m archetech_ml.train --name first [--epochs 15] [--steps 700]

Training uses random 384 px crops (with 90-degree turns and flips) from the rendered 512 px drawings;
validation scores whole 512 px drawings. The best checkpoint (by mean IoU) is kept in
runs/<name>/best.pt, with a log in runs/<name>/log.txt.
"""
from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

import numpy as np
import segmentation_models_pytorch as smp
import torch
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset

from .render import CLASSES
from .resplan import DATA

ROOT = DATA.parent.parent / "rendered"
RUNS = Path(__file__).resolve().parent.parent / "runs"
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
N = len(CLASSES)


class Rendered(Dataset):
    def __init__(self, split, crop=None, limit=None, seed=0):
        self.items = sorted(p for p in (ROOT / split).glob("*.png") if not p.name.endswith("_mask.png"))
        if limit:
            random.Random(seed).shuffle(self.items)
            self.items = self.items[:limit]
        self.crop = crop

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        p = self.items[i]
        img = np.array(Image.open(p).convert("RGB"))
        mask = np.array(Image.open(p.with_name(p.stem + "_mask.png")))
        if self.crop:
            h, w = mask.shape
            y, x = random.randint(0, h - self.crop), random.randint(0, w - self.crop)
            img, mask = img[y:y + self.crop, x:x + self.crop], mask[y:y + self.crop, x:x + self.crop]
            k = random.randint(0, 3)
            img, mask = np.rot90(img, k), np.rot90(mask, k)
            if random.random() < 0.5:
                img, mask = img[:, ::-1], mask[:, ::-1]
        x = torch.from_numpy(np.ascontiguousarray(img)).permute(2, 0, 1).float() / 255
        return (x - MEAN) / STD, torch.from_numpy(np.ascontiguousarray(mask)).long()


def dice_loss(logits, target):
    prob = logits.softmax(1)
    onehot = F.one_hot(target, N).permute(0, 3, 1, 2).float()
    inter = (prob * onehot).sum((0, 2, 3))
    union = prob.sum((0, 2, 3)) + onehot.sum((0, 2, 3))
    return 1 - ((2 * inter + 1) / (union + 1)).mean()


@torch.no_grad()
def evaluate(model, loader, dev):
    model.eval()
    inter = torch.zeros(N, dtype=torch.float64)
    union = torch.zeros(N, dtype=torch.float64)
    correct = total = 0
    for x, y in loader:
        x, y = x.to(dev), y.to(dev)
        with torch.autocast("mps", dtype=torch.float16, enabled=dev.type == "mps"):
            pred = model(x).argmax(1)
        correct += (pred == y).sum().item()
        total += y.numel()
        for c in range(N):
            p, t = pred == c, y == c
            inter[c] += (p & t).sum().item()
            union[c] += (p | t).sum().item()
    model.train()
    iou = (inter / union.clamp(min=1)).tolist()
    return {"pixel_acc": correct / total, "miou": float(np.mean(iou)), "iou": dict(zip(CLASSES, iou))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="first")
    ap.add_argument("--encoder", default="resnet34")
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--steps", type=int, default=700, help="optimizer steps per epoch")
    ap.add_argument("--bs", type=int, default=12)
    ap.add_argument("--crop", type=int, default=384)
    ap.add_argument("--lr", type=float, default=5e-4)
    ap.add_argument("--val", type=int, default=400, help="validation drawings scored per epoch")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--init", default="", help="start from this checkpoint (fine-tuning) instead of ImageNet weights")
    a = ap.parse_args()

    dev = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    out = RUNS / a.name
    out.mkdir(parents=True, exist_ok=True)
    log = open(out / "log.txt", "a")

    def say(msg):
        line = f"{time.strftime('%H:%M:%S')} {msg}"
        print(line, flush=True)
        log.write(line + "\n")
        log.flush()

    train = DataLoader(Rendered("train", crop=a.crop), batch_size=a.bs, shuffle=True, num_workers=a.workers,
                       persistent_workers=True, drop_last=True)
    val = DataLoader(Rendered("val", limit=a.val), batch_size=8, num_workers=2)
    model = smp.Unet(a.encoder, encoder_weights=None if a.init else "imagenet", classes=N)
    if a.init:
        model.load_state_dict(torch.load(a.init, map_location="cpu", weights_only=False)["model"])
    model = model.to(dev)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=1e-4)
    total = a.epochs * a.steps
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=a.lr, total_steps=total, pct_start=0.05)
    kinds = {"resplan": sum(not p.name.startswith(("g", "u")) for p in train.dataset.items),
             "generator": sum(p.name.startswith("g") for p in train.dataset.items),
             "user": sum(p.name.startswith("u") for p in train.dataset.items)}
    say(f"start {vars(a)} device={dev} train_images={len(train.dataset)} {kinds}")

    best, step, it = -1.0, 0, iter(train)
    for epoch in range(1, a.epochs + 1):
        t0, run = time.time(), 0.0
        for _ in range(a.steps):
            try:
                x, y = next(it)
            except StopIteration:
                it = iter(train)
                x, y = next(it)
            x, y = x.to(dev), y.to(dev)
            with torch.autocast("mps", dtype=torch.float16, enabled=dev.type == "mps"):
                logits = model(x)
            logits = logits.float()
            loss = F.cross_entropy(logits, y) + dice_loss(logits, y)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            step += 1
            run += loss.item()
            if step % 100 == 0:
                say(f"epoch {epoch} step {step}/{total} loss {run / 100:.4f} "
                    f"{100 * a.bs / (time.time() - t0):.1f} img/s")
                run, t0 = 0.0, time.time()
        m = evaluate(model, val, dev)
        say(f"epoch {epoch} val pixel_acc {m['pixel_acc']:.4f} mIoU {m['miou']:.4f} "
            + " ".join(f"{k}={v:.3f}" for k, v in m["iou"].items()))
        torch.save({"model": model.state_dict(), "encoder": a.encoder, "classes": CLASSES, "epoch": epoch,
                    "metrics": m}, out / "last.pt")
        if m["miou"] > best:
            best = m["miou"]
            torch.save({"model": model.state_dict(), "encoder": a.encoder, "classes": CLASSES, "epoch": epoch,
                        "metrics": m}, out / "best.pt")
            (out / "best.json").write_text(json.dumps({"epoch": epoch, **m}, indent=2))
            say(f"new best mIoU {best:.4f}")
    say("done")


if __name__ == "__main__":
    main()
