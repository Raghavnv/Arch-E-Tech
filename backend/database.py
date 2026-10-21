from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("uvicorn")

DB_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_DB_PATH = os.path.join(DB_DIR, "archetech.db")
SQLITE_URL = f"sqlite:///{SQLITE_DB_PATH}"

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", SQLITE_URL)

# Resilient database connection with local SQLite fallback
try:
    if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
        # Test connection with timeout
        test_engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"connect_timeout": 3})
        with test_engine.connect():
            pass
        engine = test_engine
        logger.info("Connected to remote PostgreSQL database")
    else:
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL, 
            connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
        )
except Exception as e:
    logger.warning(f"Remote database unavailable ({e}). Falling back to local SQLite ({SQLITE_DB_PATH})...")
    engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
