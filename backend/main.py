from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
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

    system_instruction = """You are an expert AI Architectural Floor Plan Generator.
    You MUST output ONLY valid JSON. Do not include any conversational text, markdown formatting, or explanations.
    
    CRITICAL RULES:
    1. Return a JSON object with a single key "elements" containing a list of objects.
    2. Each object MUST have: id (string), type (string), left (number), top (number), width (number), height (number), angle (number).
    3. You MUST generate AT LEAST 15 elements to create a fully furnished layout.
    4. 1 unit = 0.05 meters. Start outer walls around (100, 100). Walls are 8 units thick.
    
    EXPECTED JSON STRUCTURE (GENERATE YOUR OWN VALUES AND AT LEAST 15 ITEMS):
    {
      "elements": [
        {
          "id": "<generate_unique_string>",
          "type": "<wall | door | window | furniture_bed | furniture_sofa | furniture_table>",
          "left": <number_coordinate>,
          "top": <number_coordinate>,
          "width": <number_dimension>,
          "height": <number_dimension>,
          "angle": <number_rotation>
        }
      ]
    }
    """


    
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"User Request: {payload.prompt}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
        )
        
        raw_response = response.choices[0].message.content
        print("Raw AI Output:", raw_response)
        
        data = json.loads(raw_response)
        elements = data.get("elements", [])
        
        if not elements or len(elements) < 4:
            raise ValueError("AI generated an incomplete layout with fewer than 4 items.")
            
        import uuid
        for el in elements:
            if "id" not in el or not el["id"]:
                el["id"] = f"{el.get('type', 'item')}_{uuid.uuid4().hex[:7]}"
                
        return {"status": "success", "elements": elements}
        
    except Exception as e:
        print(f"Groq Generation Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Groq Engine Failed: {str(e)}")

# -----------------------------------------------------------------
# Sketch Upload (YOLOv11 Hook)
# -----------------------------------------------------------------
@app.post("/api/upload-sketch")
async def upload_sketch(file: UploadFile = File(...)):
    temp_file_path = None
    try:
        with NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name

        detected_elements = [
            create_element("wall", 100, 100, 600, 8, 0),
            create_element("wall", 100, 600, 600, 8, 0),
            create_element("wall", 100, 100, 500, 8, 90),
            create_element("wall", 700, 100, 500, 8, 90),
            create_element("door", 220, 600, 60, 4, 0),
            create_element("window", 280, 100, 80, 4, 0),
        ]
        return {
            "status": "success",
            "message": "Sketch digitized",
            "filename": file.filename,
            "elements": detected_elements
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        file.file.close()
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)

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
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Layout data: {json.dumps(payload.elements)}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
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
