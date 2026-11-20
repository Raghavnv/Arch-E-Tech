# Plan reader service. Build from ml/ with the trained checkpoint at model/best.pt:
#   docker build -t archetech-plan-reader . && docker run -p 8100:8100 -e PLAN_READER_TOKEN=... archetech-plan-reader
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt
COPY archetech_ml ./archetech_ml
COPY serve.py .
COPY model/best.pt ./model/best.pt
ENV PLAN_READER_MODEL=/app/model/best.pt PLAN_READER_DEVICE=cpu
EXPOSE 8100
CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8100"]
