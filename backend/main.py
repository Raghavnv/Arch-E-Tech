from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from tempfile import NamedTemporaryFile

app = FastAPI(title="Arch-E-Tech API")

# Configure CORS for the Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
