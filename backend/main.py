from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Literal
import jwt
import json
import os
import shutil
from tempfile import NamedTemporaryFile
from fastapi.security import OAuth2PasswordBearer
from groq import Groq

import models
from database import engine, Base, get_db, add_missing_columns, DB_KIND

# Create database tables
Base.metadata.create_all(bind=engine)
add_missing_columns()

app = FastAPI(title="Arch-E-Tech API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "arch-e-tech-super-secret-key-for-jwt")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# -----------------------------------------------------------------
# Pydantic Schemas (API Requests)
# -----------------------------------------------------------------
class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class ProjectCreate(BaseModel):
    name: str
    elements_data: list = []

class ProjectUpdate(BaseModel):
    elements_data: list

class AIPrompt(BaseModel):
    prompt: str

class AIChatRequest(BaseModel):
    message: str
    elements: list

class ComplianceRequest(BaseModel):
    elements: list

class ReportRequest(BaseModel):
    elements: list

# -----------------------------------------------------------------
# Pydantic Schemas (Structured Outputs)
# -----------------------------------------------------------------
ROOM_KIND_LITERAL = Literal["living", "dining", "kitchen", "master_bedroom", "bedroom",
                            "bathroom", "study", "utility"]

class RoomItem(BaseModel):
    kind: ROOM_KIND_LITERAL
    area_sqm: float
    model_config = {"extra": "forbid"}

class RoomProgramSchema(BaseModel):
    layout_style: Literal["auto", "compact", "wing", "split"]
    total_area_sqm: float
    rooms: list[RoomItem]
    model_config = {"extra": "forbid"}


class RoomRect(BaseModel):
    kind: Literal["living", "dining", "kitchen", "master_bedroom", "bedroom",
                  "bathroom", "study", "utility", "lounge"]
    x: int
    y: int
    w: int
    h: int
    model_config = {"extra": "forbid"}


class LayoutSchema(BaseModel):
    rooms: list[RoomRect]
    model_config = {"extra": "forbid"}


class ComplianceSchema(BaseModel):
    status: str
    messages: list[str]
    model_config = {"extra": "forbid"}


# -----------------------------------------------------------------
# Auth Helpers & Endpoints
# -----------------------------------------------------------------
def create_access_token(email: str):
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode({"sub": email, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.post("/api/auth/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    user.email = user.email.strip().lower()
    if not user.email or not user.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    db_user = db.query(models.User).filter(func.lower(models.User.email) == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = pwd_context.hash(user.password)
    new_user = models.User(full_name=user.full_name, email=user.email, hashed_password=hashed_password)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_access_token(new_user.email)
    return {"token": token, "user": {"id": new_user.id, "email": new_user.email, "name": new_user.full_name}}

@app.post("/api/auth/login")
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    # accounts made before emails were lower-cased may be stored with capitals
    db_user = db.query(models.User).filter(func.lower(models.User.email) == user.email.strip().lower()).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(db_user.email)
    return {"token": token, "user": {"id": db_user.id, "email": db_user.email, "name": db_user.full_name}}

# -----------------------------------------------------------------
# Projects CRUD
# -----------------------------------------------------------------
@app.get("/api/projects")
def get_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Project).filter(models.Project.owner_id == current_user.id).all()

@app.post("/api/projects")
def create_project(project: ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_project = models.Project(
        name=project.name,
        elements_data=project.elements_data,
        owner_id=current_user.id
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@app.get("/api/projects/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.put("/api/projects/{project_id}")
def update_project(project_id: int, project_update: ProjectUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.elements_data = project_update.elements_data
    db.commit()
    return {"status": "success"}

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.query(models.RoomRender).filter(models.RoomRender.project_id == project.id).delete()
    db.delete(project)
    db.commit()
    return {"status": "success"}

@app.post("/api/projects/{project_id}/duplicate")
def duplicate_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_project = models.Project(
        name=f"{project.name} (Copy)",
        owner_id=current_user.id,
        elements_data=project.elements_data
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

# -----------------------------------------------------------------
# AI room photos (empty room -> same room furnished)
# -----------------------------------------------------------------
class RoomShot(BaseModel):
    room_key: str
    room_name: str = ""
    kind: str = "living"
    style: str = "modern"
    width_m: float | None = None
    depth_m: float | None = None
    windows: int = 0

class RoomUpload(RoomShot):
    image: str          # data URL of the user's own photo of the empty room

class RoomFurnish(BaseModel):
    room_key: str
    style: str = "modern"
    prompt: str = ""


def _owned_project(project_id: int, db: Session, user: models.User) -> models.Project:
    project = db.query(models.Project).filter(models.Project.id == project_id,
                                              models.Project.owner_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _render_out(r: models.RoomRender) -> dict:
    return {"room_key": r.room_key, "room_name": r.room_name, "kind": r.kind, "style": r.style,
            "empty_image": r.empty_image, "furnished_image": r.furnished_image, "prompt": r.prompt}


def _render_row(db: Session, project_id: int, shot: RoomShot) -> models.RoomRender:
    row = db.query(models.RoomRender).filter(models.RoomRender.project_id == project_id,
                                             models.RoomRender.room_key == shot.room_key).first()
    if not row:
        row = models.RoomRender(project_id=project_id, room_key=shot.room_key)
        db.add(row)
    row.room_name, row.kind, row.style = shot.room_name, shot.kind, shot.style
    return row


def _render_call(fn, *args):
    import render_ai
    try:
        return fn(*args)
    except render_ai.RenderError as e:
        raise HTTPException(status_code=e.status, detail=str(e))


@app.get("/api/render/status")
def render_status():
    import render_ai
    return {"enabled": render_ai.configured(), "styles": {k: v["name"] for k, v in render_ai.STYLES.items()}}


@app.get("/api/projects/{project_id}/renders")
def list_renders(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _owned_project(project_id, db, current_user)
    rows = db.query(models.RoomRender).filter(models.RoomRender.project_id == project_id).all()
    return [_render_out(r) for r in rows]


@app.post("/api/projects/{project_id}/renders/empty")
def render_empty_room(project_id: int, shot: RoomShot, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    """Photograph the bare room. Rooms of this house already photographed are references, so it matches them."""
    import render_ai
    _owned_project(project_id, db, current_user)
    others = db.query(models.RoomRender).filter(
        models.RoomRender.project_id == project_id, models.RoomRender.room_key != shot.room_key,
        models.RoomRender.style == shot.style, models.RoomRender.empty_image.isnot(None)).all()
    # the living room sets the look of the house, so it goes first
    others.sort(key=lambda r: (r.kind not in ("living", "lounge", "dining"), r.updated_at or datetime.min))
    refs = [r.empty_image for r in others[:2]]
    prompt = render_ai.empty_prompt(project_id, shot.style, shot.kind, shot.width_m, shot.depth_m,
                                    shot.windows, has_refs=bool(refs))
    image = _render_call(render_ai.generate, prompt, refs)
    row = _render_row(db, project_id, shot)
    row.empty_image, row.furnished_image = image, None    # a new empty room makes the old furnished one stale
    db.commit()
    return _render_out(row)


@app.post("/api/projects/{project_id}/renders/upload")
def upload_empty_room(project_id: int, shot: RoomUpload, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    """Use the owner's own photo of the empty room instead of a generated one."""
    import render_ai
    _owned_project(project_id, db, current_user)
    try:
        image = render_ai.normalise_upload(shot.image)
    except Exception:
        raise HTTPException(status_code=400, detail="That file isn't an image we can read. Use a JPG or PNG.")
    row = _render_row(db, project_id, shot)
    row.empty_image, row.furnished_image = image, None
    db.commit()
    return _render_out(row)


class ConceptRequest(BaseModel):
    plan_image: str             # data URL of the 2D plan, framed tightly
    aspect: float = 1.33        # plan width / height, so the picture is oriented like the plan
    mode: Literal["cutaway", "exterior"] = "cutaway"
    style: str = "modern"
    prompt: str = ""
    rooms: list[str] = []


@app.post("/api/projects/{project_id}/concept")
def render_concept(project_id: int, req: ConceptRequest, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    """Concept Viz: turn the floor plan into a 3D cutaway or an exterior view of the finished house."""
    import render_ai
    _owned_project(project_id, db, current_user)
    w, h = (1024, 768) if req.aspect >= 1 else (768, 1024)
    if req.mode == "exterior":
        w, h = 1024, 768
    prompt = render_ai.concept_prompt(req.mode, req.style, req.rooms, req.prompt)
    image = _render_call(render_ai.generate, prompt, [req.plan_image], w, h)
    key = f"__concept_{req.mode}__"
    row = _render_row(db, project_id, RoomShot(room_key=key, room_name=f"Concept ({req.mode})", kind="concept", style=req.style))
    row.furnished_image, row.prompt = image, req.prompt     # the plan picture is cheap to remake, so not stored
    db.commit()
    return {"mode": req.mode, "image": image}


@app.post("/api/projects/{project_id}/renders/furnish")
def render_furnished_room(project_id: int, req: RoomFurnish, db: Session = Depends(get_db),
                          current_user: models.User = Depends(get_current_user)):
    """Furnish the room in its own empty photo, the way the user described."""
    import render_ai
    _owned_project(project_id, db, current_user)
    row = db.query(models.RoomRender).filter(models.RoomRender.project_id == project_id,
                                             models.RoomRender.room_key == req.room_key).first()
    if not row or not row.empty_image:
        raise HTTPException(status_code=400, detail="Make the empty room photo first.")
    prompt = render_ai.furnish_prompt(req.style, row.kind, req.prompt)
    row.furnished_image = _render_call(render_ai.generate, prompt, [row.empty_image])
    row.prompt = req.prompt      # row.style stays the house style the empty rooms were made in
    db.commit()
    return _render_out(row)


# -----------------------------------------------------------------
# Generative Blueprint Synthesis (Groq GPT-OSS-20B)
# -----------------------------------------------------------------
ROOM_PROGRAM_PROMPT = """You are an architect's assistant. Convert the user's request into a ROOM PROGRAM only.
Do not output coordinates or geometry; software draws the plan.
Output JSON: {"layout_style": string, "total_area_sqm": number, "rooms": [{"kind": string, "area_sqm": number}]}.
layout_style is the house concept, chosen like an architect would for this kind of home:
"compact" = bedrooms open straight off the living area (small flats, studios, 1-2 bed homes, cottages);
"wing" = one day zone with a single bedroom wing (typical 2-4 bed houses, bungalows, duplex-style homes);
"split" = day zone in the middle with separate bedroom wings either side (villas, large or luxury homes, 4+ beds);
"auto" if unsure. Vary your choice between requests when more than one suits the brief.
Allowed kinds: living, dining, kitchen, master_bedroom, bedroom, bathroom, study, utility.
Rules: always include one living and one kitchen; exactly one master_bedroom if any bedroom is wanted,
extra bedrooms use "bedroom"; at least one bathroom; typical areas: living 20-35, dining 10-16,
kitchen 9-15, master_bedroom 18-26, bedroom 12-16 (the master is always the biggest bedroom), bathroom 4-7, study 8-12, utility 3-5.
A request for N bedrooms means N bedrooms in total with the master counted among them
("3 bedroom house" = 1 master_bedroom + 2 bedroom, never 3 extra bedrooms).
Only add a study or utility when the user asks for one.
Respect counts and total area stated by the user."""


def _ask_room_program(prompt: str):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    client = Groq(api_key=api_key)
    schema = RoomProgramSchema.model_json_schema()
    for attempt in range(1, 4):
        try:
            if attempt < 3:
                rf = {"type": "json_schema",
                      "json_schema": {"name": "room_program", "strict": True, "schema": schema}}
            else:
                rf = {"type": "json_object"}
            resp = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[{"role": "system", "content": ROOM_PROGRAM_PROMPT},
                          {"role": "user", "content": f"User Request: {prompt}"}],
                response_format=rf,
                temperature=0.3,
                max_completion_tokens=3000,
                reasoning_effort="low",
            )
            raw = resp.choices[0].message.content
            if not raw:
                raise ValueError("empty response")
            data = json.loads(raw)
            rooms = [r for r in data.get("rooms", []) if isinstance(r, dict) and "kind" in r]
            if not rooms:
                raise ValueError("no rooms")
            style = data.get("layout_style") if data.get("layout_style") in ("compact", "wing", "split") else "auto"
            return rooms, float(data.get("total_area_sqm") or 0), style
        except Exception as e:
            print(f"Room program error (attempt {attempt}/3): {e}")
    return None


# the layout step needs real spatial reasoning, so it can use a bigger model than the room-list step
LAYOUT_MODEL = os.getenv("LAYOUT_MODEL", "openai/gpt-oss-120b")

LAYOUT_PROMPT = """You are an experienced residential architect. Design a NEW house floor plan as axis-aligned room rectangles.
Grid: 1 unit = 0.5 m, x grows right, y grows down, (x, y) is a room's top-left corner, w and h are its size in units.
Output JSON: {"rooms": [{"kind": string, "x": int, "y": int, "w": int, "h": int}]}.
Kinds: living, dining, kitchen, master_bedroom, bedroom, bathroom, study, utility, lounge.

You are given REFERENCE PLANS of real-style houses. Study how they are organised, then design something different
in the same spirit: change the footprint (rectangle, L, T, Z or staggered wings; leave unused corners empty), the wing
arrangement, room order and proportions, and mirror or rotate the idea. Never copy a reference.

Rules:
- Rooms are solid rectangles and never overlap. Rooms that are neighbours touch exactly along a shared wall (no gaps inside the house).
- ONLY enclose the rooms in the brief. Do not invent extra rooms, corridors, lobbies, halls, closets or filler boxes. Circulation is open space:
  living, dining and (optionally) a "lounge" form one open area with no walls between them.
- Day zone: living, dining and kitchen are neighbours; dining touches living; kitchen touches dining or living; utility touches the kitchen.
- Spread the bedrooms around the house like a real home, never a hotel row: the master suite gets its own side of the
  house and must not share a wall with any other bedroom; the other bedrooms sit on a different side of the living area
  (front, back or the far end), and no straight row or column of the plan passes through more than 2 bedrooms.
  Vary where they go between designs.
- Every bedroom and study opens straight off the living room, dining room or lounge, so each must share at least 5 units of wall with one of them.
  Never line bedrooms along a corridor. Use a lounge (7+ units wide, open to the living/dining area, at most 2) only when 4+ bedrooms cannot all touch the living area.
- The master_bedroom touches its own ensuite bathroom. Other bathrooms touch a bedroom or the living area (at least 5 units of shared wall).
- Bedrooms are generous: each at least 11 m2 and at least 6 units on its short side. The master_bedroom is clearly the biggest bedroom (at least 15 m2 and at least 10% larger than any other bedroom).
- The living room has at least 6 units of outside wall for the entrance. Living, kitchen, bedrooms and study each touch an outside wall (for windows).
- No tiny leftover rooms: habitable rooms are at least 6 units on their short side, bathrooms at least 4.
- Sizes in m2 (units x units / 4): living 20-45, dining 10-20, kitchen 9-18, master bedroom 18-30, bedroom 12-20, study 8-14, bathroom 4-10, utility 3-7.
Use exactly the rooms listed in the brief."""


def _ask_layout(prompt: str, program, style: str, rng):
    """LLM designs the plan from reference houses; returns a validated Layout or None."""
    from collections import Counter
    import plan_designer as pd
    from floorplan_builder import LayoutError

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    want = Counter(r.kind for r in program)
    beds = want["master_bedroom"] + want["bedroom"]
    refs = pd.pick_references(beds, want["bathroom"], bool(want["study"]), rng, k=3)
    rooms_txt = ", ".join(f"{n} x {k}" for k, n in want.items())
    brief = (f"BRIEF: {prompt}\nRooms to include (exactly): {rooms_txt}. A lounge is the only optional extra.\n"
             f"Target total area about {round(pd.program_target_area(program))} m2.\n"
             f"Suggested concept: {style}.\n\nREFERENCE PLANS:\n"
             + "\n".join(json.dumps(pd.describe(m), separators=(",", ":")) for m in refs))
    client = Groq(api_key=api_key, timeout=45)
    schema = LayoutSchema.model_json_schema()
    messages = [{"role": "system", "content": LAYOUT_PROMPT}, {"role": "user", "content": brief}]
    for attempt in range(1, 4):
        try:
            resp = client.chat.completions.create(
                model=LAYOUT_MODEL,
                messages=messages,
                response_format={"type": "json_schema",
                                 "json_schema": {"name": "floor_plan", "strict": True, "schema": schema}},
                temperature=0.9,
                max_completion_tokens=6000,
                reasoning_effort="medium",
            )
            raw = resp.choices[0].message.content
            if not raw:
                raise ValueError("empty response")
            return pd.design_from_llm_rects(json.loads(raw).get("rooms", []), program)
        except LayoutError as e:
            print(f"LLM layout rejected (attempt {attempt}/3): {e}")
            messages += [{"role": "assistant", "content": raw},
                         {"role": "user", "content": f"That plan was rejected: {e}. Fix it and return the complete corrected plan."}]
        except Exception as e:
            print(f"LLM layout error (attempt {attempt}/3): {e}")
    return None


class PlanEditRequest(BaseModel):
    instruction: str
    elements: list
    selected: list[str] = []


@app.post("/api/ai/edit-plan")
def edit_plan(req: PlanEditRequest):
    """Change the plan as described ("make this door narrower"); returns the edited elements."""
    import plan_editor
    if not req.instruction.strip():
        raise HTTPException(status_code=400, detail="Describe the change you want.")
    try:
        return plan_editor.ask(req.instruction, req.elements, req.selected, os.getenv("GROQ_API_KEY"))
    except plan_editor.EditError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Plan edit failed: {e}")
        raise HTTPException(status_code=502, detail="The AI service didn't answer. Try again in a moment.")


@app.post("/api/ai/generate-plan")
async def generate_floor_plan(payload: AIPrompt):
    import random
    import plan_designer as pd
    from floorplan_builder import build_program, generate_layout

    source = "ai"
    ai = _ask_room_program(payload.prompt)
    llm_rooms, llm_total, style = ai if ai else ([], 0, "auto")
    if not ai:
        source = "fallback"
    rng = random.Random()

    try:
        program = build_program(llm_rooms, llm_total, payload.prompt)
    except Exception as e:
        print(f"Program from AI failed ({e}); using prompt-only program")
        source = "fallback"
        program = build_program([], 0, payload.prompt)

    layout = _ask_layout(payload.prompt, program, style, rng)       # 1. LLM designs it from reference houses
    if layout:
        source += "+designed"
    if not layout:                                                   # 2. a reference house, reshaped
        layout = pd.adapt_reference(program, rng, pd.program_target_area(program))
        if layout:
            source += "+reference"
    if not layout:                                                   # 3. zoned generator
        try:
            layout = generate_layout(program, style=style)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Layout generation failed: {e}")

    return {"status": "success", "elements": layout.elements(), "source": source}


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Arch-E-Tech Backend Running"}

@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    """Which database this deploy is using, and that it answers."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": DB_KIND}

# -----------------------------------------------------------------
# AI Copilot & Compliance (Groq)
# -----------------------------------------------------------------
@app.post("/api/ai/chat")
async def ai_copilot_chat(payload: AIChatRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"status": "error", "reply": "Warning: GROQ_API_KEY is missing on Render."}
        
    client = Groq(api_key=api_key)
        
    system_prompt = """You are an expert Architectural AI Copilot assisting a user currently designing a floor plan.
    Keep your answers concise, helpful, and professional. 
    Analyze their layout if they ask for feedback. Point out missing doors, weirdly placed walls, etc.
    """
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"My layout data: {json.dumps(payload.elements)}\n\nMy question: {payload.message}"}
            ],
            temperature=0.5
        )
        return {"status": "success", "reply": response.choices[0].message.content}
    except Exception as e:
        return {"status": "error", "reply": f"AI Copilot Error: {str(e)}"}

@app.post("/api/ai/compliance")
async def check_compliance(payload: ComplianceRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"status": "error", "messages": ["GROQ_API_KEY missing on Render."]}
        
    client = Groq(api_key=api_key)
        
    system_prompt = """You are an AI Building Inspector evaluating a 2D floor plan JSON.
    1 unit = 0.05 meters. Analyze the layout for IBC / ADA code compliance.
    You MUST output valid JSON format with exactly two keys: "status" (string) and "messages" (array of strings).
    """
    
    try:
        # CONVERT PYDANTIC SCHEMA FOR GROQ
        schema_dict = ComplianceSchema.model_json_schema()

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Layout data: {json.dumps(payload.elements)}"}
            ],
            # APPLY STRICT JSON SCHEMA
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "compliance_schema",
                    "strict": True,
                    "schema": schema_dict
                }
            },
            temperature=0.1,
            max_completion_tokens=4000,
            reasoning_effort="low",
        )
        data = json.loads(response.choices[0].message.content)
        return {
            "status": data.get("status", "success"),
            "messages": data.get("messages", ["All designs meet local compliance codes."])
        }
    except Exception as e:
        return {"status": "warning", "messages": [f"AI compliance check error: {str(e)}"]}

@app.post("/api/ai/report-narrative")
async def generate_report_narrative(payload: ReportRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"status": "error", "narrative": "Warning: GROQ_API_KEY is missing on Render."}
        
    client = Groq(api_key=api_key)
        
    system_prompt = """You are an AI Architectural Analyst. 
    Write a 3-paragraph executive summary based on the JSON layout. 
    1: Project Overview. 2: Structural Review. 3: Cost Analysis.
    Do NOT use markdown, just plain text with double newlines between paragraphs."""
    
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Layout data: {json.dumps(payload.elements)}"}
            ],
            temperature=0.3
        )
        return {"status": "success", "narrative": response.choices[0].message.content.strip()}
    except Exception as e:
        return {"status": "error", "narrative": f"Failed to generate report narrative: {str(e)}"}