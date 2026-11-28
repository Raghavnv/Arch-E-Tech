# The plan reader as a Hugging Face Space (Docker). Spaces serve on port 7860 and run as user 1000.
# Built from the folder that ml/make_space.sh assembles: archetech_ml/, serve.py and model/best.pt.
FROM python:3.12-slim

RUN useradd -m -u 1000 user
WORKDIR /home/user/app

RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY --chown=user requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt

COPY --chown=user archetech_ml ./archetech_ml
COPY --chown=user serve.py .
COPY --chown=user model/best.pt ./model/best.pt

USER user
ENV HOME=/home/user PLAN_READER_MODEL=/home/user/app/model/best.pt PLAN_READER_DEVICE=cpu
EXPOSE 7860
CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "7860"]
