from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
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
from database import engine, Base, get_db

# Create database tables
Base.metadata.create_all(bind=engine)

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
                  "bathroom", "study", "utility", "hallway"]
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
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
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
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
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
extra bedrooms use "bedroom"; at least one bathroom; typical areas: living 16-30, dining 9-14,
kitchen 8-14, master_bedroom 13-20, bedroom 9-14, bathroom 4-6, study 7-10, utility 3-5.
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


LAYOUT_PROMPT = """You are an experienced residential architect. Design a NEW house floor plan as axis-aligned room rectangles.
Grid: 1 unit = 0.5 m, x grows right, y grows down, (x, y) is a room's top-left corner, w and h are its size in units.
Output JSON: {"rooms": [{"kind": string, "x": int, "y": int, "w": int, "h": int}]}.
Kinds: living, dining, kitchen, master_bedroom, bedroom, bathroom, study, utility, hallway.

You are given REFERENCE PLANS of real-style houses. Study how they are organised, then design something different
in the same spirit: change the footprint (rectangle, L, T, U or staggered wings; leave unused corners empty), the wing
arrangement, room order and proportions, and mirror or rotate the idea. Never copy a reference.

Rules:
- Rooms are solid rectangles and never overlap. Rooms that are neighbours touch exactly along a shared wall (no gaps inside the house).
- Group the day zone together: living, dining and kitchen are neighbours; dining touches living (open plan); kitchen touches dining or living; utility touches the kitchen.
- Bedrooms and bathrooms form their own wing(s). Every bedroom, study and bathroom must touch the living room, the dining room, or a short
  hallway lobby (kind "hallway", 4-6 units wide, at most 18 units long, serving at most 5 rooms, at most 2 lobbies, touching the living or dining room).
  NEVER make a long corridor with a row of doors; most 1-3 bedroom homes need no hallway at all.
- The master_bedroom touches its own ensuite bathroom. Other bathrooms touch a bedroom or the lobby.
- The living room has at least 6 units of outside wall (the entrance). Living, dining, kitchen, bedrooms and study each touch an outside wall (for windows).
- No tiny leftover rooms: habitable rooms are at least 5 units on their short side, bathrooms at least 4.
- Typical sizes in m2 (units x units / 4): living 18-40, dining 9-18, kitchen 8-16, master bedroom 14-24, bedroom 10-18, study 7-14, bathroom 4-9, utility 3-7.
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
    brief = (f"BRIEF: {prompt}\nRooms to include (exactly): {rooms_txt}. Hallway lobbies are extra and optional.\n"
             f"Target total area about {round(pd.program_target_area(program))} m2.\n"
             f"Suggested concept: {style}.\n\nREFERENCE PLANS:\n"
             + "\n".join(json.dumps(pd.describe(m), separators=(",", ":")) for m in refs))
    client = Groq(api_key=api_key, timeout=45)
    schema = LayoutSchema.model_json_schema()
    messages = [{"role": "system", "content": LAYOUT_PROMPT}, {"role": "user", "content": brief}]
    for attempt in range(1, 4):
        try:
            resp = client.chat.completions.create(
                model="openai/gpt-oss-20b",
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