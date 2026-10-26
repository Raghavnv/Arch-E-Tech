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
# Adjust this list to the exact type strings your frontend canvas renders.
ELEMENT_TYPES = [
    "wall", "door", "window",
    "furniture_bed", "furniture_sofa", "furniture_table",
]

class ElementSchema(BaseModel):
    id: str
    type: Literal["wall", "door", "window",
                  "furniture_bed", "furniture_sofa", "furniture_table"]
    left: float
    top: float
    width: float
    height: float
    angle: float
    
    # This tells Groq to strictly forbid the AI from hallucinating extra fields
    model_config = {"extra": "forbid"}

class FloorPlanSchema(BaseModel):
    # No min_length here: minItems breaks Groq's strict decoding. The 15-element
    # minimum is enforced in the prompt and checked in Python with a retry.
    elements: list[ElementSchema]
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
def create_element(el_type, left, top, width, height, angle=0, **kwargs):
    import uuid
    el = {
        "id": f"{el_type}_{uuid.uuid4().hex[:7]}",
        "type": el_type,
        "left": round(left),
        "top": round(top),
        "width": round(width),
        "height": round(height),
        "angle": angle
    }
    el.update(kwargs)
    return el

@app.post("/api/ai/generate-plan")
async def generate_floor_plan(payload: AIPrompt):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is missing. Please configure it in your Environment Variables.")

    client = Groq(api_key=api_key)

    # We removed the confusing JSON example and instead gave it a checklist to force it to generate more items.
    system_instruction = f"""You are an expert AI Architectural Floor Plan Generator.
    Output ONLY a JSON object with a single key "elements": an array of objects.
    Each object has exactly these fields: id (string), type (string), left, top,
    width, height, angle (numbers).

    ALLOWED TYPES (use these exact strings only): {", ".join(ELEMENT_TYPES)}

    CRITICAL RULES:
    1. 1 unit = 0.05 meters. Start outer walls around (100, 100). Walls are 8 units thick.
    2. You MUST include ALL of the following items in your layout:
       - 4 outer walls to enclose the space
       - At least 3 interior walls to divide rooms
       - At least 2 doors and 2 windows
       - A bed (furniture_bed)
       - A sofa (furniture_sofa)
       - A table (furniture_table)
    3. Generate a minimum of 15 elements total. Do not skip any requested furniture or structural items.
    4. Give every element a unique id like "wall_1", "door_2". Keep angle at 0 or 90.
    """

    MIN_ELEMENTS = 15
    MAX_ATTEMPTS = 3

    schema_dict = FloorPlanSchema.model_json_schema()
    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": f"User Request: {payload.prompt}"}
    ]

    last_err = "unknown error"
    elements = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            # Attempts 1-2: strict schema. Final attempt: plain json_object mode as a fallback.
            if attempt < MAX_ATTEMPTS:
                response_format = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "floor_plan_schema",
                        "strict": True,
                        "schema": schema_dict
                    }
                }
            else:
                response_format = {"type": "json_object"}

            response = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=messages,
                response_format=response_format,
                temperature=0.4,
                # gpt-oss is a reasoning model: reasoning tokens count against the output
                # limit. Without a generous cap it can run out before writing any JSON,
                # which shows up as json_validate_failed with an empty failed_generation.
                max_completion_tokens=8000,
                reasoning_effort="low",
            )

            raw_response = response.choices[0].message.content
            finish_reason = response.choices[0].finish_reason
            print(f"[attempt {attempt}] finish_reason={finish_reason} usage={response.usage}")
            print("Raw AI Output:", raw_response)

            if not raw_response:
                raise ValueError(f"Empty response (finish_reason={finish_reason})")

            data = json.loads(raw_response)
            candidate = data.get("elements", [])

            valid = [e for e in candidate if isinstance(e, dict) and e.get("type") in ELEMENT_TYPES]
            if len(valid) < MIN_ELEMENTS:
                raise ValueError(f"Only {len(valid)} valid elements (need {MIN_ELEMENTS})")

            elements = valid
            break

        except Exception as e:
            last_err = str(e)
            print(f"Groq Generation Error (attempt {attempt}/{MAX_ATTEMPTS}): {last_err}")

    if elements is None:
        raise HTTPException(status_code=500, detail=f"Groq Engine Failed: {last_err}")

    import uuid
    seen = set()
    for el in elements:
        if not el.get("id") or el["id"] in seen:
            el["id"] = f"{el.get('type', 'item')}_{uuid.uuid4().hex[:7]}"
        seen.add(el["id"])

    return {"status": "success", "elements": elements}


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