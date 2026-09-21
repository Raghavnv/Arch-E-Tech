from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import jwt
import datetime
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


import google.generativeai as genai
import json

# -----------------------------------------------------------------
# AI GENERATIVE ENDPOINT (Text-to-Blueprint)
# -----------------------------------------------------------------
class AIPrompt(BaseModel):
    prompt: str

@app.post("/api/ai/generate-plan")
async def generate_floor_plan(payload: AIPrompt):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured.")
        
    genai.configure(api_key=api_key)
    
    generation_config = {
      "temperature": 0.2,
      "response_mime_type": "application/json",
    }
    
    model = genai.GenerativeModel("gemini-1.5-pro", generation_config=generation_config)
    
    system_prompt = f"""You are an expert architectural AI that designs 2D floor plans.
    The user will provide a description of a house or layout.
    You must output a JSON array of structural elements (walls, doors, windows).
    
    1 unit = 1 inch (or 1 pixel in our canvas).
    A standard house might be 800x600 units.
    Standard wall thickness = 8
    Standard door width = 60
    Standard window width = 80
    
    Your JSON MUST match this exact schema:
    [
      {{ "type": "wall", "left": X, "top": Y, "width": length, "height": 8, "angle": rotation_in_degrees }},
      {{ "type": "door", "left": X, "top": Y, "width": length, "height": 4, "angle": rotation_in_degrees }}
    ]
    
    "left" and "top" represent the starting X and Y coordinate of the element.
    Walls must form connected rooms. 
    Angles should typically be 0, 90, 180, or 270.
    
    User prompt: '{payload.prompt}'
    
    Return ONLY the raw JSON array.
    """
    
    try:
        response = model.generate_content(system_prompt)
        elements = json.loads(response.text)
        return {
            "status": "success",
            "elements": elements
        }
    except Exception as e:
        print(f"Gemini API Error: {str(e)}")
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
