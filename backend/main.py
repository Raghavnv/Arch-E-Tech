from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import jwt
import datetime
import json
from pydantic import BaseModel

import models
from database import engine, Base, get_db
import shutil
import os
from tempfile import NamedTemporaryFile

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
SECRET_KEY = "arch-e-tech-super-secret-key-for-jwt"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pydantic Models for Input
class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

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
    
    # Generate token
    token = jwt.encode({"sub": new_user.email, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)}, SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token, "user": {"id": new_user.id, "email": new_user.email, "name": new_user.full_name}}

@app.post("/api/auth/login")
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = jwt.encode({"sub": db_user.email, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)}, SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token, "user": {"id": db_user.id, "email": db_user.email, "name": db_user.full_name}}


from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

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

class ProjectCreate(BaseModel):
    name: str
    elements_data: list = []

@app.get("/api/projects")
def get_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    projects = db.query(models.Project).filter(models.Project.owner_id == current_user.id).all()
    return projects

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

class ProjectUpdate(BaseModel):
    elements_data: list

@app.put("/api/projects/{project_id}")
def update_project(project_id: int, project_update: ProjectUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.elements_data = project_update.elements_data
    db.commit()
    return {"status": "success"}

from groq import Groq

# -----------------------------------------------------------------
# AI GENERATIVE ENDPOINT (Text-to-Blueprint)
# -----------------------------------------------------------------
class AIPrompt(BaseModel):
    prompt: str

@app.post("/api/ai/generate-plan")
async def generate_floor_plan(payload: AIPrompt):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("Warning: GROQ_API_KEY not found. Ensure it is set in the environment variables.")
        # We will attempt to proceed in case it's injected elsewhere, but it will likely trigger the fallback.
    
    system_prompt = f"""You are an expert architectural AI that designs 2D floor plans.
    The user will provide a description of a house or layout.
    You MUST generate the exact layout they asked for. If they ask for multiple rooms, you must generate the walls, doors, and windows for multiple rooms.
    
    1 unit = 1 inch (or 1 pixel in our canvas).
    A standard house might be 800x600 units.
    Standard wall thickness = 8
    Standard door width = 60
    Standard window width = 80
    
    You must output valid JSON. The JSON must be an object containing a single key "elements", which is an array of layout objects.
    Match this schema exactly:
    {{
      "elements": [
        {{ "type": "wall", "left": 100, "top": 100, "width": 400, "height": 8, "angle": 0 }},
        {{ "type": "door", "left": 250, "top": 400, "width": 60, "height": 4, "angle": 180 }}
      ]
    }}
    
    "left" and "top" represent the starting X and Y coordinate of the element.
    Walls must form connected rooms. 
    Angles should typically be 0, 90, 180, or 270.
    Output ONLY the JSON object, nothing else.
    """
    
    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": payload.prompt,
                }
            ],
            model="llama3-70b-8192",
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        raw_text = chat_completion.choices[0].message.content
        data = json.loads(raw_text)
        
        return {
            "status": "success",
            "elements": data.get("elements", [])
        }
    except Exception as e:
        print(f"Groq API Error: {str(e)}")
            
        # Fallback to mock if API fails/hallucinates
        return {
            "status": "error",
            "message": "AI failed to generate a valid layout. Showing fallback.",
            "elements": [
                { "type": "wall", "left": 100, "top": 100, "width": 400, "height": 8, "angle": 0 },
                { "type": "wall", "left": 500, "top": 100, "width": 300, "height": 8, "angle": 90 },
                { "type": "wall", "left": 500, "top": 400, "width": 400, "height": 8, "angle": 180 },
                { "type": "wall", "left": 100, "top": 400, "width": 300, "height": 8, "angle": 270 },
                { "type": "door", "left": 250, "top": 400, "width": 60, "height": 4, "angle": 180 },
                { "type": "window", "left": 500, "top": 200, "width": 80, "height": 4, "angle": 90 }
            ]
        }


@app.post("/api/upload-sketch")
async def upload_sketch(file: UploadFile = File(...)):
    # Create a temporary file to save the uploaded image
    try:
        with NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name

        # -------------------------------------------------------------
        # TODO: AI Detection with YOLOv11
        # 1. Load the YOLOv11 model: 
        #    model = YOLO('path/to/weights.pt')
        # 2. Run inference on the saved image: 
        #    results = model(temp_file_path)
        # 3. Parse results into a JSON format for the frontend (bounding boxes, classes)
        # -------------------------------------------------------------

        # Mocked response for now until AI is integrated
        mock_detected_elements = [
            {"type": "wall", "x": 100, "y": 150, "width": 400, "height": 20},
            {"type": "door", "x": 150, "y": 150, "width": 40, "height": 20}
        ]

        return {
            "status": "success",
            "message": "File processed successfully",
            "filename": file.filename,
            "elements": mock_detected_elements
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        file.file.close()
        # In a real scenario, you might want to clean up the temp file after processing
        # if os.path.exists(temp_file_path):
        #     os.remove(temp_file_path)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Arch-E-Tech Backend Running"}

# -----------------------------------------------------------------
# AI COPILOT CHAT ENDPOINT
# -----------------------------------------------------------------
class AIChatRequest(BaseModel):
    message: str
    elements: list

@app.post("/api/ai/chat")
async def ai_copilot_chat(payload: AIChatRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"status": "error", "reply": "Warning: GROQ_API_KEY is missing. I cannot process this request."}
        
    system_prompt = """You are an expert Architectural AI Copilot. 
    You are assisting a user who is currently designing a floor plan.
    You will be provided with their message and the current layout JSON (walls, doors, windows).
    Keep your answers concise, helpful, and professional. 
    Analyze their layout if they ask for feedback. Point out missing doors, weirdly placed walls, etc.
    """
    
    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"My current layout data: {json.dumps(payload.elements)}\n\nMy question: {payload.message}"}
            ],
            model="llama3-70b-8192",
            temperature=0.5,
        )
        
        reply = chat_completion.choices[0].message.content
        return {"status": "success", "reply": reply}
    except Exception as e:
        print(f"Groq Chat Error: {str(e)}")
        return {"status": "error", "reply": "Sorry, I am having trouble connecting to my neural network right now."}

# -----------------------------------------------------------------
# AI CODE COMPLIANCE RAG ENDPOINT
# -----------------------------------------------------------------
class ComplianceRequest(BaseModel):
    elements: list

@app.post("/api/ai/compliance")
async def check_compliance(payload: ComplianceRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"status": "error", "issues": ["GROQ_API_KEY missing - unable to run compliance check."]}
        
    system_prompt = """You are an AI Building Inspector evaluating a 2D floor plan JSON.
    Standard conversions: 1 unit = 1 inch.
    Analyze the provided layout for standard building code violations (e.g. ADA door widths must be at least 32 inches, window egress, span lengths).
    Return a valid JSON object matching this schema exactly:
    {
      "status": "success" or "warning",
      "messages": ["List of strings", "describing specific code violations", "or saying 'All clear!'"]
    }
    Output ONLY the JSON object.
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
        
        raw_text = chat_completion.choices[0].message.content
        data = json.loads(raw_text)
        return {
            "status": data.get("status", "success"),
            "messages": data.get("messages", ["All designs meet local compliance codes."])
        }
    except Exception as e:
        print(f"Groq Compliance Error: {str(e)}")
        return {"status": "warning", "messages": ["Failed to run AI compliance check. Please verify manually."]}

# -----------------------------------------------------------------
# AI PDF NARRATIVE ENDPOINT
# -----------------------------------------------------------------
class ReportRequest(BaseModel):
    elements: list

@app.post("/api/ai/report-narrative")
async def generate_report_narrative(payload: ReportRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"status": "error", "narrative": "Warning: GROQ_API_KEY is missing."}
        
    system_prompt = """You are an AI Architectural Analyst. 
    Review the provided layout JSON. 
    Write a 3-paragraph executive summary for a PDF report. 
    Paragraph 1: Project Overview (number of rooms, estimated footprint).
    Paragraph 2: Structural & Compliance Review.
    Paragraph 3: Estimated Cost Analysis (Assume basic construction costs).
    Do NOT use markdown, just output plain text with double newlines between paragraphs.
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
        
        reply = chat_completion.choices[0].message.content
        return {"status": "success", "narrative": reply.strip()}
    except Exception as e:
        print(f"Groq Report Error: {str(e)}")
        return {"status": "error", "narrative": "Failed to generate report narrative."}
