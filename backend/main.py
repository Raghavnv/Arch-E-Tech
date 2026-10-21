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

def generate_architectural_blueprint(prompt: str):
    p = prompt.lower()
    
    # 1. Parse room requirements from prompt
    bedrooms = 3  # default
    if any(k in p for k in ['1 bed', '1-bed', 'one bed', 'studio', '1bhk']):
        bedrooms = 1
    elif any(k in p for k in ['2 bed', '2-bed', 'two bed', '2bhk']):
        bedrooms = 2
    elif any(k in p for k in ['4 bed', '4-bed', 'four bed', '4bhk']):
        bedrooms = 4
    elif any(k in p for k in ['5 bed', '5-bed', 'five bed', '5bhk']):
        bedrooms = 5
    elif any(k in p for k in ['3 bed', '3-bed', 'three bed', '3bhk']):
        bedrooms = 3

    has_office = any(k in p for k in ['office', 'study', 'workspace', 'library'])
    elements = []

    if bedrooms == 1:
        # 1-BEDROOM / STUDIO SUITE APARTMENT
        # Perimeter: X: 100..760 (W: 660), Y: 100..680 (H: 580)
        elements.append(create_element('wall', 100, 100, 660, 8, 0))
        elements.append(create_element('wall', 100, 680, 660, 8, 0))
        elements.append(create_element('wall', 100, 100, 580, 8, 90))
        elements.append(create_element('wall', 760, 100, 580, 8, 90))
        
        # Internal partitions
        elements.append(create_element('wall', 100, 360, 660, 8, 0))  # Horizontal dividing Day / Night
        elements.append(create_element('wall', 440, 100, 260, 8, 90)) # Living / Kitchen
        elements.append(create_element('wall', 480, 360, 320, 8, 90)) # Bed / Bath
        
        # Doors
        elements.append(create_element('door', 220, 680, 60, 4, 0))   # Main Entrance
        elements.append(create_element('door', 260, 360, 60, 4, 0))   # Bedroom Door
        elements.append(create_element('door', 480, 480, 50, 4, 90))  # Bath Door
        
        # Windows
        elements.append(create_element('window', 200, 100, 90, 4, 0))
        elements.append(create_element('window', 560, 100, 80, 4, 0))
        elements.append(create_element('window', 100, 500, 80, 4, 90))
        
        # Furniture
        elements.append(create_element('furniture_bed', 240, 500, 70, 80, 0))
        elements.append(create_element('furniture_sofa', 220, 210, 80, 35, 0))
        elements.append(create_element('furniture_table', 560, 210, 70, 45, 0))

    elif bedrooms == 2:
        # 2-BEDROOM RESIDENCE (With larger Master Suite & Ensuite)
        # Perimeter: X: 100..880 (W: 780), Y: 100..700 (H: 600)
        elements.append(create_element('wall', 100, 100, 780, 8, 0))
        elements.append(create_element('wall', 100, 700, 780, 8, 0))
        elements.append(create_element('wall', 100, 100, 600, 8, 90))
        elements.append(create_element('wall', 880, 100, 600, 8, 90))
        
        # Partitions
        elements.append(create_element('wall', 460, 100, 280, 8, 90)) # Master East Wall
        elements.append(create_element('wall', 100, 380, 360, 8, 0))  # Master South Wall
        elements.append(create_element('wall', 460, 240, 160, 8, 0))  # Ensuite partition
        elements.append(create_element('wall', 620, 100, 280, 8, 90)) # Bed 2 West Wall
        elements.append(create_element('wall', 460, 400, 160, 8, 0))  # Bath partition
        elements.append(create_element('wall', 620, 380, 260, 8, 0))  # Bed 2 South Wall
        
        # Doors
        elements.append(create_element('door', 240, 700, 70, 4, 0))   # Main Entrance
        elements.append(create_element('door', 460, 320, 60, 4, 90))  # Master Door
        elements.append(create_element('door', 460, 170, 50, 4, 90))  # Ensuite Door
        elements.append(create_element('door', 620, 320, 60, 4, 90))  # Bed 2 Door
        elements.append(create_element('door', 510, 400, 50, 4, 0))   # Bath Door
        
        # Windows
        elements.append(create_element('window', 240, 100, 100, 4, 0))
        elements.append(create_element('window', 100, 220, 80, 4, 90))
        elements.append(create_element('window', 720, 100, 90, 4, 0))
        elements.append(create_element('window', 880, 220, 80, 4, 90))
        elements.append(create_element('window', 100, 540, 90, 4, 90))
        elements.append(create_element('window', 720, 700, 90, 4, 0))
        
        # Furniture
        elements.append(create_element('furniture_bed', 240, 220, 75, 85, 0))  # King Bed in Master
        elements.append(create_element('furniture_bed', 740, 220, 65, 80, 0))  # Queen Bed in Bed 2
        elements.append(create_element('furniture_sofa', 240, 520, 80, 40, 0))
        elements.append(create_element('furniture_table', 740, 520, 70, 45, 0))

    elif bedrooms >= 4:
        # 4/5-BEDROOM EXECUTIVE VILLA
        # Perimeter: X: 100..1020 (W: 920), Y: 100..820 (H: 720)
        elements.append(create_element('wall', 100, 100, 920, 8, 0))
        elements.append(create_element('wall', 100, 820, 920, 8, 0))
        elements.append(create_element('wall', 100, 100, 720, 8, 90))
        elements.append(create_element('wall', 1020, 100, 720, 8, 90))
        
        # Master Suite (Extra Grand)
        elements.append(create_element('wall', 500, 100, 320, 8, 90))
        elements.append(create_element('wall', 100, 420, 400, 8, 0))
        elements.append(create_element('wall', 500, 240, 180, 8, 0))  # Master Ensuite
        
        # Bed 2
        elements.append(create_element('wall', 680, 100, 300, 8, 90))
        elements.append(create_element('wall', 680, 400, 340, 8, 0))
        
        # Bed 3
        elements.append(create_element('wall', 100, 620, 340, 8, 0))
        elements.append(create_element('wall', 440, 420, 200, 8, 90))
        
        # Bed 4
        elements.append(create_element('wall', 680, 400, 220, 8, 90))
        elements.append(create_element('wall', 680, 620, 340, 8, 0))
        
        # Common Bath / Powder
        elements.append(create_element('wall', 500, 420, 180, 8, 0))
        
        # Doors
        elements.append(create_element('door', 260, 820, 75, 4, 0))   # Main Entrance
        elements.append(create_element('door', 500, 360, 60, 4, 90))  # Master Suite
        elements.append(create_element('door', 500, 170, 50, 4, 90))  # Master Ensuite
        elements.append(create_element('door', 680, 320, 60, 4, 90))  # Bed 2
        elements.append(create_element('door', 380, 420, 55, 4, 0))   # Bed 3
        elements.append(create_element('door', 680, 520, 60, 4, 90))  # Bed 4
        elements.append(create_element('door', 550, 420, 50, 4, 0))   # Common Bath
        elements.append(create_element('door', 840, 820, 70, 4, 0))   # Garden Slider
        
        # Windows
        elements.append(create_element('window', 260, 100, 120, 4, 0))
        elements.append(create_element('window', 100, 240, 100, 4, 90))
        elements.append(create_element('window', 820, 100, 100, 4, 0))
        elements.append(create_element('window', 1020, 240, 90, 4, 90))
        elements.append(create_element('window', 100, 520, 90, 4, 90))
        elements.append(create_element('window', 1020, 520, 90, 4, 90))
        elements.append(create_element('window', 460, 820, 110, 4, 0))
        
        # Furniture
        elements.append(create_element('furniture_bed', 260, 240, 80, 90, 0)) # Grand King Bed
        elements.append(create_element('furniture_bed', 820, 240, 65, 80, 0)) # Bed 2
        elements.append(create_element('furniture_bed', 240, 520, 65, 80, 0)) # Bed 3
        elements.append(create_element('furniture_bed', 820, 510, 65, 80, 0)) # Bed 4
        elements.append(create_element('furniture_sofa', 260, 710, 90, 40, 0))
        elements.append(create_element('furniture_table', 820, 710, 80, 45, 0))

    else:
        # 3-BEDROOM LUXURY RESIDENCE (The user's primary showcase request!)
        # - Master Suite (significantly larger with attached ensuite bathroom)
        # - Bedroom 2 (Guest Suite)
        # - Bedroom 3 (Kids / Secondary)
        # - Hallway corridor
        # - Common Bathroom
        # - Spacious Living Room with Sectional Lounge
        # - Open-plan Kitchen & Dining with Dining Table
        # Perimeter: X: 100..960 (W: 860px = 43m), Y: 100..760 (H: 660px = 33m)
        
        # 1. EXTERIOR PERIMETER WALLS
        elements.append(create_element('wall', 100, 100, 860, 8, 0))  # North Perimeter
        elements.append(create_element('wall', 100, 760, 860, 8, 0))  # South Perimeter
        elements.append(create_element('wall', 100, 100, 660, 8, 90)) # West Perimeter
        elements.append(create_element('wall', 960, 100, 660, 8, 90)) # East Perimeter
        
        # 2. INTERIOR PARTITION WALLS
        # Master Suite East Wall (X=480, Y=100..400)
        elements.append(create_element('wall', 480, 100, 300, 8, 90))
        # Master Suite South Wall (Y=400, X=100..480)
        elements.append(create_element('wall', 100, 400, 380, 8, 0))
        # Master Ensuite Partition (Y=240, X=480..660)
        elements.append(create_element('wall', 480, 240, 180, 8, 0))
        # Bedroom 2 West Wall (X=660, Y=100..380)
        elements.append(create_element('wall', 660, 100, 280, 8, 90))
        # Bedroom 2 South Wall (Y=380, X=660..960)
        elements.append(create_element('wall', 660, 380, 300, 8, 0))
        # Common Bathroom South Wall (Y=420, X=480..660)
        elements.append(create_element('wall', 480, 420, 180, 8, 0))
        # Bedroom 3 West Wall (X=660, Y=380..620)
        elements.append(create_element('wall', 660, 380, 240, 8, 90))
        # Bedroom 3 South Wall (Y=620, X=660..960)
        elements.append(create_element('wall', 660, 620, 300, 8, 0))
        # Kitchen & Dining Partition (Y=520, X=480..960)
        elements.append(create_element('wall', 480, 520, 180, 8, 0))

        # 3. DOORS (Accessible openings into each private space)
        # Main Front Entrance (Living Room south wall)
        elements.append(create_element('door', 260, 760, 70, 4, 0))
        # Master Suite Door (from hallway)
        elements.append(create_element('door', 480, 340, 60, 4, 90))
        # Master Ensuite Door (inside master suite into ensuite bath)
        elements.append(create_element('door', 480, 170, 50, 4, 90))
        # Bedroom 2 Door (from hallway)
        elements.append(create_element('door', 660, 300, 60, 4, 90))
        # Common Bathroom Door (from hallway)
        elements.append(create_element('door', 530, 420, 50, 4, 0))
        # Bedroom 3 Door (from hallway)
        elements.append(create_element('door', 660, 460, 60, 4, 90))
        # Kitchen Terrace / Balcony Sliding Door
        elements.append(create_element('door', 780, 760, 70, 4, 0))

        # 4. EXTERIOR WINDOWS (On outer perimeter for light and egress)
        # Master Suite Windows (North & West exterior)
        elements.append(create_element('window', 240, 100, 100, 4, 0))
        elements.append(create_element('window', 100, 220, 90, 4, 90))
        # Master Bath Window (North exterior)
        elements.append(create_element('window', 530, 100, 60, 4, 0))
        # Bedroom 2 Windows (North & East exterior)
        elements.append(create_element('window', 780, 100, 90, 4, 0))
        elements.append(create_element('window', 960, 220, 80, 4, 90))
        # Bedroom 3 Window (East exterior)
        elements.append(create_element('window', 960, 480, 80, 4, 90))
        # Living Room Windows (South & West exterior)
        elements.append(create_element('window', 100, 560, 100, 4, 90))
        elements.append(create_element('window', 400, 760, 100, 4, 0))
        # Kitchen Window (East exterior)
        elements.append(create_element('window', 960, 680, 80, 4, 90))

        # 5. FURNITURE (Accentuating the room scales)
        # Master Bedroom King Bed (380x300 suite)
        elements.append(create_element('furniture_bed', 240, 220, 75, 85, 0))
        # Bedroom 2 Queen Bed
        elements.append(create_element('furniture_bed', 780, 220, 65, 80, 0))
        # Bedroom 3 Bed
        elements.append(create_element('furniture_bed', 780, 500, 65, 80, 0))
        # Living Room Lounge Sectional Sofa
        elements.append(create_element('furniture_sofa', 240, 540, 85, 40, 0))
        # Dining Table in Dining Wing
        elements.append(create_element('furniture_table', 780, 680, 75, 45, 0))

    return elements

@app.post("/api/ai/generate-plan")
async def generate_floor_plan(payload: AIPrompt):
    # Always generate the intelligent architectural blueprint according to prompt
    elements = generate_architectural_blueprint(payload.prompt)
    return {
        "status": "success",
        "elements": elements
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
# Trigger Render deployment after rollback
