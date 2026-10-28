"""
AI room photos with Cloudflare Workers AI (FLUX.2 Klein, free tier: 10,000 neurons a day).

Every room of a project is photographed twice:
  1. empty   - the bare room, described from one shared "house identity" (floors, walls, ceiling,
               window frames, light, the view outside) so every room looks like the same house;
               rooms already photographed are passed in as reference images for the same reason
  2. furnished - the empty photo is the reference image and the model only adds furniture,
               so the result is the same room, furnished the way the user asked

Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (a token from the "Workers AI" template).
"""
from __future__ import annotations

import base64
import io
import os
import random

import requests
from PIL import Image

MODEL = os.getenv("CF_IMAGE_MODEL", "@cf/black-forest-labs/flux-2-klein-4b")
WIDTH, HEIGHT = 1024, 768
REF_MAX = 511                 # Klein only accepts reference images smaller than 512 x 512
MAX_REFS = 4


class RenderError(Exception):
    """A generation failed; the message is safe to show to the user."""
    status = 502


class RenderNotConfigured(RenderError):
    status = 503


class RenderLimit(RenderError):
    status = 429


def configured() -> bool:
    return bool(os.getenv("CLOUDFLARE_ACCOUNT_ID") and os.getenv("CLOUDFLARE_API_TOKEN"))


# --------------------------------------------------------------------------
# Prompts
# --------------------------------------------------------------------------
STYLES = {
    "modern": {
        "name": "Modern",
        "shell": "wide-plank pale oak floors, smooth warm-white plaster walls, flat white ceilings with slim recessed "
                 "downlights, slim black-framed floor-to-ceiling windows",
        "furnish": "clean-lined modern furniture in warm neutrals, low-profile pieces, matte black and brass accents, "
                   "textured wool rug, a few large plants",
    },
    "japandi": {
        "name": "Japandi",
        "shell": "light ash wood floors, soft limewashed off-white walls, a pale timber-slat ceiling detail, "
                 "light oak window frames with deep sills",
        "furnish": "low Japandi furniture in light oak and linen, paper lantern lighting, ceramic vases, "
                   "a bonsai, calm muted beige and sage palette",
    },
    "scandinavian": {
        "name": "Scandinavian",
        "shell": "whitewashed pine floorboards, crisp matte white walls, white ceilings, white wooden window frames",
        "furnish": "bright Scandinavian furniture in pale wood, boucle and linen, soft grey and blush textiles, "
                   "sheepskin throws, simple pendant lamps, green plants",
    },
    "industrial": {
        "name": "Industrial loft",
        "shell": "polished concrete floors, one exposed red-brick wall with the rest painted grey, exposed ceiling "
                 "with black steel beams, black steel-framed factory windows",
        "furnish": "industrial loft furniture: cognac leather, reclaimed wood, black metal, Edison-bulb pendants, "
                   "vintage rug",
    },
    "contemporary": {
        "name": "Warm contemporary",
        "shell": "honed travertine-look stone floors, warm greige walls, a cove-lit ceiling, bronze-framed windows",
        "furnish": "warm contemporary furniture: curved sofas, walnut and travertine tables, sheer linen curtains, "
                   "sculptural lamps, earthy terracotta and cream palette",
    },
    "indian": {
        "name": "Modern Indian",
        "shell": "polished white marble floors with a thin brass inlay border, warm white walls, teak ceiling "
                 "beams, teak-framed windows with carved jaali screens",
        "furnish": "modern Indian furniture: teak and cane pieces, handwoven dhurrie rug, brass lamps, block-printed "
                   "cushions in indigo and ochre, potted palms",
    },
}

VIEWS = ["a leafy green garden", "tall trees and a quiet street", "a sunny courtyard with plants",
         "distant hills under a clear sky"]
LIGHT = ["soft morning daylight", "bright midday daylight", "warm late-afternoon sunlight"]

# the bare room, before anything is moved in
SHELL = {
    "living": "an empty living room with a large window wall and an opening to the dining area",
    "lounge": "an empty family lounge, an open area",
    "dining": "an empty dining room with a ceiling light point in the middle",
    "kitchen": "an empty kitchen before fitting: bare walls with capped plumbing and electrical points, "
               "no cabinets and no appliances yet, a window where the sink will go",
    "master_bedroom": "an empty large master bedroom with a doorway to an ensuite bathroom",
    "bedroom": "an empty bedroom",
    "bathroom": "an empty bathroom shell: tiled floor, waterproofed walls, capped plumbing points, "
                "no fixtures fitted yet, a small high window",
    "study": "an empty small study room",
    "utility": "an empty utility room with plumbing points",
}

# what goes in when it is furnished (the user's own words come on top of this)
FURNISH = {
    "living": "a sofa and armchairs around a coffee table on a rug, a TV or media wall, side tables, floor lamp, "
              "curtains, wall art, plants",
    "lounge": "a comfortable sectional sofa, coffee table, rug, bookshelf, reading lamp, plants",
    "dining": "a dining table with chairs, a pendant light above it, a sideboard, wall art",
    "kitchen": "complete fitted kitchen cabinets with stone countertops, sink, hob and oven, refrigerator, "
               "backsplash tiles, an island or breakfast counter with stools, pendant lights",
    "master_bedroom": "a king-size bed with headboard and layered bedding, two bedside tables with lamps, a wardrobe, "
                      "an armchair, rug, curtains, wall art",
    "bedroom": "a double bed with bedding, a bedside table with lamp, a wardrobe, a study desk and chair, rug, curtains",
    "bathroom": "a vanity with basin and mirror, toilet, glass shower enclosure, towels, small plant, bath accessories",
    "study": "a desk with an office chair, bookshelves, a desk lamp, an armchair, rug",
    "utility": "a washing machine and dryer, storage cabinets, a utility sink, shelves",
}


def _house_identity(project_id: int, style: str) -> str:
    rnd = random.Random(project_id * 7919)      # the same project always gets the same view and light
    st = STYLES.get(style, STYLES["modern"])
    return (f"a {st['name'].lower()} single-family home with {st['shell']}, {rnd.choice(LIGHT)} coming through the "
            f"windows, and a view of {rnd.choice(VIEWS)} outside")


def _size_phrase(width_m: float | None, depth_m: float | None) -> str:
    if width_m and depth_m:
        return f", about {width_m:.1f} m by {depth_m:.1f} m"
    return ""


def empty_prompt(project_id: int, style: str, kind: str, width_m=None, depth_m=None,
                 windows: int = 0, has_refs: bool = False) -> str:
    shell = SHELL.get(kind, f"an empty {kind.replace('_', ' ')}")
    win = f", with {windows} window{'s' if windows != 1 else ''}" if windows else ", with a window"
    if kind in ("living", "kitchen", "bathroom"):     # their shells already describe the windows
        win = ""
    same = (" It is another room of the same house as the reference photos: use exactly the same floor, wall "
            "finish, ceiling, window frames, light and outside view.") if has_refs else ""
    return (f"Real estate photograph of {shell}{_size_phrase(width_m, depth_m)}{win}, in "
            f"{_house_identity(project_id, style)}.{same} The room is completely unfurnished: no furniture, no rugs, "
            f"no curtains, no decor, no people. Wide-angle eye-level shot from the doorway corner showing the whole "
            f"room, photorealistic, sharp, natural colours.")


def furnish_prompt(style: str, kind: str, user_prompt: str | None) -> str:
    st = STYLES.get(style, STYLES["modern"])
    extra = f" The owner wants: {user_prompt.strip()}." if user_prompt and user_prompt.strip() else ""
    return (f"Furnish the room in the reference photo. Keep the room exactly the same: the same walls, floor, "
            f"ceiling, windows, doors, camera angle and lighting; only add furniture and decor. Add "
            f"{FURNISH.get(kind, 'suitable furniture')}, styled as {st['furnish']}.{extra} Realistic scale, "
            f"realistic materials, soft natural shadows, photorealistic interior design photograph.")


# --------------------------------------------------------------------------
# Images
# --------------------------------------------------------------------------
def _decode_data_url(data_url: str) -> bytes:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    return base64.b64decode(data_url)


def _reference(data_url: str) -> bytes:
    """Shrink a stored photo so the model accepts it as a reference (under 512 x 512)."""
    img = Image.open(io.BytesIO(_decode_data_url(data_url))).convert("RGB")
    img.thumbnail((REF_MAX, REF_MAX))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=90)
    return out.getvalue()


def _to_data_url(raw: bytes) -> str:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    out = io.BytesIO()
    img.save(out, "JPEG", quality=86, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()


def normalise_upload(data_url: str) -> str:
    """A user's own photo of the room: fit it to the render size and store it like a generated one."""
    img = Image.open(io.BytesIO(_decode_data_url(data_url))).convert("RGB")
    img.thumbnail((WIDTH * 2, HEIGHT * 2))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=86, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()


def generate(prompt: str, references: list[str] | None = None) -> str:
    """Run the model; references are data URLs. Returns the image as a JPEG data URL."""
    if not configured():
        raise RenderNotConfigured(
            "AI photos aren't set up yet: add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to the backend on Render.")
    account, token = os.environ["CLOUDFLARE_ACCOUNT_ID"], os.environ["CLOUDFLARE_API_TOKEN"]
    form = {"prompt": (None, prompt), "width": (None, str(WIDTH)), "height": (None, str(HEIGHT))}
    for i, ref in enumerate((references or [])[:MAX_REFS]):
        form[f"input_image_{i}"] = (f"ref{i}.jpg", _reference(ref), "image/jpeg")
    try:
        res = requests.post(f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{MODEL}",
                            headers={"Authorization": f"Bearer {token}"}, files=form, timeout=120)
    except requests.RequestException as e:
        raise RenderError(f"Couldn't reach the image service ({e.__class__.__name__}). Try again.") from e

    ctype = res.headers.get("content-type", "")
    if res.ok and ctype.startswith("image/"):
        return _to_data_url(res.content)
    try:
        body = res.json()
    except ValueError:
        body = {}
    errors = body.get("errors") or []
    text = " ".join(str(e.get("message", "")) for e in errors if isinstance(e, dict)).lower()
    if res.status_code == 429 or "neuron" in text or "allocation" in text or "rate limit" in text:
        raise RenderLimit("Today's free image allowance is used up. It resets every day; try again tomorrow.")
    if res.status_code in (401, 403):
        raise RenderNotConfigured("The Cloudflare token was rejected. Check CLOUDFLARE_API_TOKEN on Render "
                                  "(it needs the Workers AI permission).")
    image = (body.get("result") or {}).get("image") if isinstance(body.get("result"), dict) else None
    if res.ok and image:
        return _to_data_url(base64.b64decode(image))
    raise RenderError(f"The image service returned an error ({res.status_code}). Try again in a moment.")
