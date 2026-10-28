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


def add_missing_columns():
    """create_all() never alters existing tables, so add columns introduced after a table was created."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name not in have:
                    ddl = col.type.compile(dialect=engine.dialect)
                    conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {col.name} {ddl}'))
                    logger.info(f"Added column {table.name}.{col.name}")
