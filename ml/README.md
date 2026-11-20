# Plan reader

Reads a floor plan drawing (photo, scan, PDF) and turns it into an editable Arch-E-Tech plan.

```
drawing ─► U-Net (labels every pixel) ─┐
       └─► OCR (room names, sizes) ────┴─► vectorize ─► walls, doors, windows, rooms (20 units = 1 m)
```

- **Model** (`archetech_ml/train.py`): U-Net with a ResNet-34 encoder. Classes:
  `background, wall, door, window, living, bedroom, kitchen, bathroom, balcony, other_room`.
- **OCR** (`archetech_ml/ocr.py`): RapidOCR (Apache 2.0, bundled PP-OCR models, CPU). Room names set room
  types ("M. BEDROOM", "TOI.", "SIT OUT", "Pooja" …); room sizes ("12'0\" x 10'6\"", "3.60 x 3.00", "3600 x 3000")
  set the scale.
- **Vectorize** (`archetech_ml/vectorize.py`): straightens a tilted drawing, finds wall centre lines, joins
  corners, drops stray stubs, places doors / windows on walls, splits rooms, and returns the mapping from
  drawing pixels to plan units so the drawing can be shown under the plan. Scale: given > room sizes on
  the drawing > wall thickness (assumes 0.23 m walls).
- **Service** (`serve.py`): `POST /read` → elements. The backend's `/api/plan-imports` forwards uploads here.

## Data

| Source | Licence | Used for |
|---|---|---|
| [ResPlan](https://github.com/m-agour/ResPlan): 17,000 South Asian homes as polygons | CC BY 4.0 (data), MIT (code). **Credit "ResPlan"** wherever the model is shipped. | training, validation, test (official splits) |
| Arch-E-Tech's own layout generator (`backend/layout_generator.py`) | ours | training |
| Wikimedia Commons plans (`data/real_test`, list + licences in `manifest.json`) | public domain / CC0 / CC BY(-SA) | **testing only** |
| Shared user imports (opt-in) | consent given in the app | training |

Vector plans are rendered (`archetech_ml/render.py`) into drawings in many styles: line drawings, listing-style
colour plans, blueprints, hand sketches, thin-line CAD with dimension chains, hatched / outlined / solid walls,
furniture against the walls, room names and sizes, scan noise and blur, and phone photos at an angle on a table.
Labels come from the same geometry, so they are exact.

ResPlan is a Python pickle; it is loaded through an allow-list of the three globals it uses
(`archetech_ml/resplan.py`), so a tampered file cannot run code.

## Setup

```bash
cd ml
python3 -m venv .venv
.venv/bin/pip install torch torchvision numpy shapely pillow segmentation-models-pytorch \
    opencv-python-headless rapidocr onnxruntime pypdfium2 fastapi uvicorn python-multipart
mkdir -p data/raw/resplan && cd data/raw/resplan
curl -LO https://raw.githubusercontent.com/m-agour/ResPlan/main/ResPlan.zip
curl -LO https://raw.githubusercontent.com/m-agour/ResPlan/main/split.json
unzip ResPlan.zip && cd ../../..
```

`data/`, `runs/`, `model/` and `.venv/` are git-ignored.

## Train and evaluate

```bash
.venv/bin/python -m archetech_ml.make_dataset --variants 3          # ResPlan drawings: data/rendered/{train,val,test}
.venv/bin/python -m archetech_ml.generated --count 3000             # + drawings of generator plans
.venv/bin/python -m archetech_ml.train --name v2 --init runs/resplan_r34_v1/best.pt   # fine-tune (or no --init)
# v2 (current): ResPlan + generator drawings, 12 x 700 steps from v1 -> mean IoU 0.847 on the ResPlan test split (v1: 0.748)
.venv/bin/python -m archetech_ml.evaluate runs/v2/best.pt           # IoU per class on the ResPlan test split
.venv/bin/python -m archetech_ml.eval_real runs/v2/best.pt          # real drawings: counts + overlay pictures
.venv/bin/python -m archetech_ml.check_vectorize                    # vectorize on true labels (upper bound)
```

Training runs on Apple-silicon GPUs (MPS), CUDA or CPU; ~15 drawings/s on an M5.

## Serve

```bash
PLAN_READER_MODEL=runs/v2/best.pt PLAN_READER_TOKEN=change-me .venv/bin/uvicorn serve:app --port 8100
```

Docker (e.g. a Hugging Face Space or any container host): copy the checkpoint to `model/best.pt`, then
`docker build -t archetech-plan-reader .`. The image installs CPU-only PyTorch. Point the backend at it with
`PLAN_READER_URL` and the same `PLAN_READER_TOKEN`.

## Learning from users

When an owner ticks "Share this drawing…", the backend keeps the drawing, the plan as read and the plan they
accepted. To turn those into training data:

```bash
cd ../backend && .venv/bin/python export_plan_imports.py ../ml/data/user_imports
cd ../ml && .venv/bin/python -m archetech_ml.user_data data/user_imports    # -> data/rendered/train/u*.png
```

`user_data` draws the owner's final plan back onto their drawing through the saved image → plan mapping, so
every correction becomes a labelled real-world example for the next training run.
