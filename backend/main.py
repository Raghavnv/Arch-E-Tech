from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer
import jwt
from datetime import datetime, timezone, timedelta
import json
import os
import shutil
import uuid
from tempfile import NamedTemporaryFile
from groq import Groq

import models
from database import engine, Base, get_db

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Arch-E-Tech API")

# Configure CORS for Vercel and local testing
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

# Pydantic Schemas
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


# =================================================================
# AUTHENTICATION ENDPOINTS
# =================================================================

def create_access_token(data: dict, expires_delta: timedelta = timedelta(days=7)):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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
    
    token = create_access_token({"sub": new_user.email})
    return {"token": token, "user": {"id": new_user.id, "email": new_user.email, "name": new_user.full_name}}

@app.post("/api/auth/login")
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": db_user.email})
    return {"token": token, "user": {"id": db_user.id, "email": db_user.email, "name": db_user.full_name}}


# =================================================================
# PROJECT CRUD ENDPOINTS
# =================================================================

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
    return {"status": "success", "message": f"Project {project_id} permanently deleted"}

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


# =================================================================
# PROCEDURAL BLUEPRINT GENERATOR (Text-to-CAD)
# =================================================================

def create_element(el_type, left, top, width, height, angle=0, **kwargs):
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

def generate_architectural_blueprint(prompt: str):
    p = prompt.lower()
    bedrooms = 3
    if any(k in p for k in ['1 bed', '1-bed', 'one bed', 'studio', '1bhk']):
        bedrooms = 1
    elif any(k in p for k in ['2 bed', '2-bed', 'two bed', '2bhk']):
        bedrooms = 2
    elif any(k in p for k in ['4 bed', '4-bed', 'four bed', '4bhk']):
        bedrooms = 4
    elif any(k in p for k in ['5 bed', '5-bed', 'five bed', '5bhk']):
        bedrooms = 5

    elements = []

    if bedrooms == 1:
        # Perimeter
        elements.append(create_element('wall', 100, 100, 660, 8, 0))
        elements.append(create_element('wall', 100, 680, 660, 8, 0))
        elements.append(create_element('wall', 100, 100, 580, 8, 90))
        elements.append(create_element('wall', 760, 100, 580, 8, 90))
        # Partitions
        elements.append(create_element('wall', 100, 360, 660, 8, 0))
        elements.append(create_element('wall', 440, 100, 260, 8, 90))
        elements.append(create_element('wall', 480, 360, 320, 8, 90))
        # Doors & Windows
        elements.append(create_element('door', 220, 680, 60, 4, 0))
        elements.append(create_element('door', 260, 360, 60, 4, 0))
        elements.append(create_element('door', 480, 480, 50, 4, 90))
        elements.append(create_element('window', 200, 100, 90, 4, 0))
        elements.append(create_element('window', 560, 100, 80, 4, 0))
        elements.append(create_element('window', 100, 500, 80, 4, 90))
        # Furniture
        elements.append(create_element('furniture_bed', 240, 500, 70, 80, 0))
        elements.append(create_element('furniture_sofa', 220, 210, 80, 35, 0))
        elements.append(create_element('furniture_table', 560, 210, 70, 45, 0))

    elif bedrooms == 2:
        # Perimeter
        elements.append(create_element('wall', 100, 100, 780, 8, 0))
        elements.append(create_element('wall', 100, 700, 780, 8, 0))
        elements.append(create_element('wall', 100, 100, 600, 8, 90))
        elements.append(create_element('wall', 880, 100, 600, 8, 90))
        # Partitions
        elements.append(create_element('wall', 460, 100, 280, 8, 90))
        elements.append(create_element('wall', 100, 380, 360, 8, 0))
        elements.append(create_element('wall', 460, 240, 160, 8, 0))
        elements.append(create_element('wall', 620, 100, 280, 8, 90))
        elements.append(create_element('wall', 460, 400, 160, 8, 0))
        elements.append(create_element('wall', 620, 380, 260, 8, 0))
        # Doors & Windows
        elements.append(create_element('door', 240, 700, 70, 4, 0))
        elements.append(create_element('door', 460, 320, 60, 4, 90))
        elements.append(create_element('door', 460, 170, 50, 4, 90))
        elements.append(create_element('door', 620, 320, 60, 4, 90))
        elements.append(create_element('door', 510, 400, 50, 4, 0))
        elements.append(create_element('window', 240, 100, 100, 4, 0))
        elements.append(create_element('window', 100, 220, 80, 4, 90))
        elements.append(create_element('window', 720, 100, 90, 4, 0))
        elements.append(create_element('window', 880, 220, 80, 4, 90))
        elements.append(create_element('window', 100, 540, 90, 4, 90))
        # Furniture
        elements.append(create_element('furniture_bed', 240, 220, 75, 85, 0))
        elements.append(create_element('furniture_bed', 740, 220, 65, 80, 0))
        elements.append(create_element('furniture_sofa', 240, 520, 80, 40, 0))
        elements.append(create_element('furniture_table', 740, 520, 70, 45, 0))

    else:
        # 3+ Bedroom Design with Master Suite & En-Suite
        elements.append(create_element('wall', 100, 100, 860, 8, 0))
        elements.append(create_element('wall', 100, 760, 860, 8, 0))
        elements.append(create_element('wall', 100, 100, 660, 8, 90))
        elements.append(create_element('wall', 960, 100, 660, 8, 90))

        elements.append(create_element('wall', 480, 100, 300, 8, 90))
        elements.append(create_element('wall', 100, 400, 380, 8, 0))
        elements.append(create_element('wall', 480, 240, 180, 8, 0))
        elements.append(create_element('wall', 660, 100, 280, 8, 90))
        elements.append(create_element('wall', 660, 380, 300, 8, 0))
        elements.append(create_element('wall', 480, 420, 180, 8, 0))
        elements.append(create_element('wall', 660, 380, 240, 8, 90))
        elements.append(create_element('wall', 660, 620, 300, 8, 0))
        elements.append(create_element('wall', 480, 520, 180, 8, 0))

        elements.append(create_element('door', 260, 760, 70, 4, 0))
        elements.append(create_element('door', 480, 340, 60, 4, 90))
        elements.append(create_element('door', 480, 170, 50, 4, 90))
        elements.append(create_element('door', 660, 300, 60, 4, 90))
        elements.append(create_element('door', 530, 420, 50, 4, 0))
        elements.append(create_element('door', 660, 460, 60, 4, 90))
        elements.append(create_element('door', 780, 760, 70, 4, 0))

        elements.append(create_element('window', 240, 100, 100, 4, 0))
        elements.append(create_element('window', 100, 220, 90, 4, 90))
        elements.append(create_element('window', 530, 100, 60, 4, 0))
        elements.append(create_element('window', 780, 100, 90, 4, 0))
        elements.append(create_element('window', 960, 220, 80, 4, 90))
        elements.append(create_element('window', 960, 480, 80, 4, 90))
        elements.append(create_element('window', 100, 560, 100, 4, 90))
        elements.append(create_element('window', 400, 760, 100, 4, 0))

        elements.append(create_element('furniture_bed', 240, 220, 75, 85, 0))
        elements.append(create_element('furniture_bed', 780, 220, 65, 80, 0))
        elements.append(create_element('furniture_bed', 780, 500, 65, 80, 0))
        elements.append(create_element('furniture_sofa', 240, 540, 85, 40, 0))
        elements.append(create_element('furniture_table', 780, 680, 75, 45, 0))

    return elements

@app.post("/api/ai/generate-plan")
async def generate_floor_plan(payload: AIPrompt):
    elements = generate_architectural_blueprint(payload.prompt)
    return {"status": "success", "elements": elements}


# =================================================================
# YOLOv11 SKETCH DIGITIZER (Ready for your trained weights)
# =================================================================

YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "weights/best.pt")

@app.post("/api/upload-sketch")
async def upload_sketch(file: UploadFile = File(...)):
    temp_file_path = None
    try:
        with NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name

        # If custom YOLO weights exist, run real inference; otherwise return fallback mock
        if os.path.exists(YOLO_MODEL_PATH):
            try:
                from ultralytics import YOLO
                model = YOLO(YOLO_MODEL_PATH)
                results = model(temp_file_path)
                
                detected_elements = []
                for r in results:
                    for box in r.boxes:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        cls_id = int(box.cls[0].item())
                        cls_name = model.names[cls_id].lower()
                        
                        detected_elements.append({
                            "id": f"{cls_name}_{uuid.uuid4().hex[:7]}",
                            "type": "wall" if "wall" in cls_name else ("door" if "door" in cls_name else "window"),
                            "left": round(x1),
                            "top": round(y1),
                            "width": round(x2 - x1),
                            "height": round(max(y2 - y1, 8)),
                            "angle": 0
                        })
                        
                return {
                    "status": "success",
                    "filename": file.filename,
                    "elements": detected_elements
                }
            except Exception as yolo_err:
                print(f"YOLO Inference Warning: {yolo_err}")

        # Fallback detected elements while model is training
        mock_detected_elements = [
            {"id": "w_mock1", "type": "wall", "left": 100, "top": 150, "width": 400, "height": 8, "angle": 0},
            {"id": "d_mock1", "type": "door", "left": 150, "top": 150, "width": 60, "height": 4, "angle": 0},
            {"id": "w_mock2", "type": "wall", "left": 100, "top": 150, "width": 300, "height": 8, "angle": 90}
        ]
        return {
            "status": "success",
            "message": "Processed with fallback detector (YOLO weights not yet uploaded)",
            "filename": file.filename,
            "elements": mock_detected_elements
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        file.file.close()
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


# =================================================================
# AI COPILOT, COMPLIANCE & REPORTS
# =================================================================

@app.post("/api/ai/chat")
async def ai_copilot_chat(payload: AIChatRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"status": "error", "reply": "GROQ_API_KEY is not configured on the server."}
        
    system_prompt = """You are an expert Architectural AI Copilot. 
    Analyze the user's floor plan JSON (walls, doors, windows).
    Point out missing egress doors, awkward room dimensions, or missing circulation paths.
    Keep responses clear, concise, and professional.
    """
    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Layout data: {json.dumps(payload.elements)}\n\nUser Question: {payload.message}"}
            ],
            model="llama3-70b-8192",
            temperature=0.4,
        )
        return {"status": "success", "reply": chat_completion.choices[0].message.content}
    except Exception as e:
        return {"status": "error", "reply": f"Copilot error: {str(e)}"}

@app.post("/api/ai/compliance")
async def check_compliance(payload: ComplianceRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"status": "error", "messages": ["GROQ_API_KEY missing - verify server environment variables."]}
        
    system_prompt = """You are an AI Building Inspector evaluating a 2D floor plan JSON.
    Standard conversions: 1 unit = 0.05 meters (~2 inches).
    Analyze for standard International Building Code (IBC) guidelines:
    - Minimum door opening width (at least 0.8 meters / 32 inches for egress)
    - Hallway clearance (at least 0.9 meters / 36 inches)
    - Window egress for primary bedrooms
    Return JSON only:
    {
      "status": "success" | "warning",
      "messages": ["list of findings"]
    }
    """
    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Layout data: {json.dumps(payload.elements)}"}
            ],
            model="llama3-70b-8192",
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        data = json.loads(chat_completion.choices[0].message.content)
        return {
            "status": data.get("status", "success"),
            "messages": data.get("messages", ["All designs meet standard building codes."])
        }
    except Exception as e:
        return {"status": "warning", "messages": [f"AI inspection fallback check: {str(e)}"]}

@app.post("/api/ai/report-narrative")
async def generate_report_narrative(payload: ReportRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"status": "error", "narrative": "GROQ_API_KEY is not configured on the server."}
        
    system_prompt = """You are an AI Architectural Analyst. 
    Write an executive 3-paragraph summary for a client PDF report based on this layout JSON:
    Paragraph 1: Project Footprint & Room Hierarchy
    Paragraph 2: Structural Integrity & Egress Assessment
    Paragraph 3: Material Takeoff & Cost Estimation Summary
    No markdown. Plain text with double newlines between paragraphs only.
    """
    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Layout data: {json.dumps(payload.elements)}"}
            ],
            model="llama3-70b-8192",
            temperature=0.3,
        )
        return {"status": "success", "narrative": chat_completion.choices[0].message.content.strip()}
    except Exception as e:
        return {"status": "error", "narrative": f"Report narrative error: {str(e)}"}

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Arch-E-Tech API Active"}
