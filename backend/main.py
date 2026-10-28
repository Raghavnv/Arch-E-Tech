from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Literal
import jwt
import json
import os
from fastapi.security import OAuth2PasswordBearer
from groq import Groq

import models
from database import engine, Base, get_db, add_missing_columns

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
    locality: str | None = None
    floors: int = 1

class ProjectUpdate(BaseModel):
    elements_data: list | None = None
    board_data: list | None = None
    name: str | None = None
    locality: str | None = None
    floors: int | None = None
    status: str | None = None

class ProfileUpdate(BaseModel):
    full_name: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ReportCreate(BaseModel):
    name: str
    project_id: int | None = None
    project_name: str | None = None
    building_type: str = "Residential"
    narrative: str = ""
    costs: dict = {}
    snapshot: str | None = None
    element_count: int = 0

class ReportUpdate(BaseModel):
    name: str | None = None
    building_type: str | None = None
    narrative: str | None = None

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
    total_area_sqm: float
    rooms: list[RoomItem]
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

def _user_out(u: models.User):
    return {"id": u.id, "email": u.email, "name": u.full_name,
            "created_at": u.created_at.isoformat() if u.created_at else None}

DEMO_EMAIL = "demo@archetech.io"

@app.post("/api/auth/demo")
def demo_login(db: Session = Depends(get_db)):
    """One-click demo account, created the first time someone asks for it."""
    user = db.query(models.User).filter(models.User.email == DEMO_EMAIL).first()
    if not user:
        user = models.User(full_name="Demo Architect", email=DEMO_EMAIL,
                           hashed_password=pwd_context.hash(os.urandom(16).hex()))
        db.add(user)
        db.commit()
        db.refresh(user)
    return {"token": create_access_token(user.email), "user": _user_out(user)}

@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return _user_out(current_user)

@app.put("/api/auth/me")
def update_me(payload: ProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    name = payload.full_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    current_user.full_name = name
    db.commit()
    return _user_out(current_user)

@app.post("/api/auth/change-password")
def change_password(payload: PasswordChange, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.email == DEMO_EMAIL:
        raise HTTPException(status_code=403, detail="The demo account's password can't be changed")
    if not pwd_context.verify(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    current_user.hashed_password = pwd_context.hash(payload.new_password)
    db.commit()
    return {"status": "success"}

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
        locality=project.locality,
        floors=max(1, min(10, project.floors)),
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
    
    changes = project_update.model_dump(exclude_none=True)
    if "name" in changes and not changes["name"].strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    if "floors" in changes:
        changes["floors"] = max(1, min(10, changes["floors"]))
    for key, value in changes.items():
        setattr(project, key, value)
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
        elements_data=project.elements_data,
        board_data=project.board_data,
        locality=project.locality,
        floors=project.floors,
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

# -----------------------------------------------------------------
# Read-only share links
# -----------------------------------------------------------------
def _own_project(project_id: int, db: Session, user: models.User):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.owner_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.post("/api/projects/{project_id}/share")
def share_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = _own_project(project_id, db, current_user)
    if not project.share_token:
        import secrets
        project.share_token = secrets.token_urlsafe(12)
        db.commit()
    return {"share_token": project.share_token}

@app.delete("/api/projects/{project_id}/share")
def unshare_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = _own_project(project_id, db, current_user)
    project.share_token = None
    db.commit()
    return {"status": "success"}

@app.get("/api/shared/{token}")
def get_shared_project(token: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.share_token == token).first()
    if not project:
        raise HTTPException(status_code=404, detail="This share link is no longer active")
    return {"name": project.name, "locality": project.locality, "floors": project.floors,
            "elements_data": project.elements_data or [], "board_data": project.board_data or [],
            "owner": project.owner.full_name if project.owner else None}

# -----------------------------------------------------------------
# Saved reports
# -----------------------------------------------------------------
def _report_out(r: models.Report):
    return {"id": r.id, "project_id": r.project_id, "name": r.name, "project_name": r.project_name,
            "building_type": r.building_type, "narrative": r.narrative, "costs": r.costs or {},
            "snapshot": r.snapshot, "element_count": r.element_count,
            "created_at": r.created_at.isoformat() if r.created_at else None}

def _own_report(report_id: int, db: Session, user: models.User):
    report = db.query(models.Report).filter(models.Report.id == report_id, models.Report.owner_id == user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@app.get("/api/reports")
def list_reports(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rows = db.query(models.Report).filter(models.Report.owner_id == current_user.id).order_by(models.Report.created_at.desc()).all()
    return [_report_out(r) for r in rows]

@app.post("/api/reports")
def create_report(payload: ReportCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if payload.project_id is not None:
        _own_project(payload.project_id, db, current_user)
    report = models.Report(owner_id=current_user.id, **payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_out(report)

@app.put("/api/reports/{report_id}")
def update_report(report_id: int, payload: ReportUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    report = _own_report(report_id, db, current_user)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(report, key, value)
    db.commit()
    return _report_out(report)

@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    report = _own_report(report_id, db, current_user)
    db.delete(report)
    db.commit()
    return {"status": "success"}

# -----------------------------------------------------------------
# Groq key: a user's own key (sent from Settings) wins over the server's
# -----------------------------------------------------------------
def _groq_key(header_key: str | None):
    return (header_key or "").strip() or os.getenv("GROQ_API_KEY")


@app.post("/api/ai/test-key")
def test_groq_key(x_groq_key: str | None = Header(default=None)):
    key = (x_groq_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="No key provided")
    try:
        Groq(api_key=key).models.list()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Groq rejected the key: {e}")
    return {"status": "success"}


# -----------------------------------------------------------------
# Generative Blueprint Synthesis
# The LLM reads the brief into a room program; house_generator places the rooms.
# -----------------------------------------------------------------
ROOM_PROGRAM_PROMPT = """You are an architect's assistant. Convert the user's request into a ROOM PROGRAM only.
Do not output coordinates or geometry; software draws the plan.
Output JSON: {"total_area_sqm": number, "rooms": [{"kind": string, "area_sqm": number}]}.
Allowed kinds: living, dining, kitchen, master_bedroom, bedroom, bathroom, study, utility.
Rules: only the rooms the user asks for (plus living, kitchen and bathrooms, which every house has);
never add a study or utility the user did not ask for; always include one living and one kitchen;
exactly one master_bedroom if any bedroom is wanted, extra bedrooms use "bedroom"; at least one bathroom;
typical areas: living 20-35, dining 10-16, kitchen 9-15, master_bedroom 18-26, bedroom 12-16
(the master is always the biggest bedroom), bathroom 4-7, study 8-12, utility 3-5.
Respect counts and total area stated by the user."""


def _ask_room_program(prompt: str, api_key: str | None):
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
            return rooms, float(data.get("total_area_sqm") or 0)
        except Exception as e:
            print(f"Room program error (attempt {attempt}/3): {e}")
    return None


@app.post("/api/ai/generate-plan")
async def generate_floor_plan(payload: AIPrompt, x_groq_key: str | None = Header(default=None)):
    import house_generator
    from fastapi.concurrency import run_in_threadpool
    from floorplan_builder import build_program, LayoutError

    ai = _ask_room_program(payload.prompt, _groq_key(x_groq_key))
    llm_rooms, llm_total = ai if ai else ([], 0)
    source = "ai" if ai else "fallback"
    try:
        program = build_program(llm_rooms, llm_total, payload.prompt)
    except Exception as e:
        print(f"Program from AI failed ({e}); using prompt-only program")
        source = "fallback"
        program = build_program([], 0, payload.prompt)

    try:
        layout = await run_in_threadpool(house_generator.generate, program)
    except LayoutError as e:
        raise HTTPException(status_code=500, detail=f"Layout generation failed: {e}")
    return {"status": "success", "elements": layout.elements(), "rooms": layout.summary(), "source": source}


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Arch-E-Tech Backend Running"}

def _plan_summary(elements: list) -> dict:
    """What the AI needs to know about a plan, in metres, without thousands of raw canvas numbers."""
    rooms, counts, wall_m = [], {}, 0.0
    for el in elements or []:
        if not isinstance(el, dict):
            continue
        t = el.get("type")
        if t == "room":
            rooms.append({"name": el.get("name"), "kind": el.get("kind"), "area_sqm": el.get("area"),
                          "width_m": round((el.get("width") or 0) / 20, 2), "depth_m": round((el.get("height") or 0) / 20, 2),
                          "floor": el.get("floor", 1)})
        elif t:
            counts[t] = counts.get(t, 0) + 1
            if t == "wall":
                wall_m += (el.get("width") or 0) / 20
    return {"rooms": rooms, "element_counts": counts, "total_wall_length_m": round(wall_m, 1),
            "door_width_m": 1.5, "wall_height_m": 3.0}

# -----------------------------------------------------------------
# AI Copilot & Compliance (Groq)
# -----------------------------------------------------------------
@app.post("/api/ai/chat")
async def ai_copilot_chat(payload: AIChatRequest, x_groq_key: str | None = Header(default=None)):
    api_key = _groq_key(x_groq_key)
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
                {"role": "user", "content": f"My layout data: {json.dumps(_plan_summary(payload.elements))}\n\nMy question: {payload.message}"}
            ],
            temperature=0.5
        )
        return {"status": "success", "reply": response.choices[0].message.content}
    except Exception as e:
        return {"status": "error", "reply": f"AI Copilot Error: {str(e)}"}

@app.post("/api/ai/compliance")
async def check_compliance(payload: ComplianceRequest, x_groq_key: str | None = Header(default=None)):
    api_key = _groq_key(x_groq_key)
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
                {"role": "user", "content": f"Layout data: {json.dumps(_plan_summary(payload.elements))}"}
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
async def generate_report_narrative(payload: ReportRequest, x_groq_key: str | None = Header(default=None)):
    api_key = _groq_key(x_groq_key)
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
                {"role": "user", "content": f"Layout data: {json.dumps(_plan_summary(payload.elements))}"}
            ],
            temperature=0.3
        )
        return {"status": "success", "narrative": response.choices[0].message.content.strip()}
    except Exception as e:
        return {"status": "error", "narrative": f"Failed to generate report narrative: {str(e)}"}