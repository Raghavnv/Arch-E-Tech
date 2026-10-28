from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import time
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("uvicorn")

DB_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_DB_PATH = os.path.join(DB_DIR, "archetech.db")
SQLITE_URL = f"sqlite:///{SQLITE_DB_PATH}"

# Render, Heroku and Neon hand out "postgres://" URLs; SQLAlchemy only accepts "postgresql://"
SQLALCHEMY_DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
# and SQLAlchemy 2.1 defaults "postgresql://" to the psycopg 3 driver, which isn't installed —
# name psycopg2 (in requirements.txt) explicitly
for prefix in ("postgres://", "postgresql://"):
    if SQLALCHEMY_DATABASE_URL.startswith(prefix):
        SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://" + SQLALCHEMY_DATABASE_URL[len(prefix):]

# On a host (Render sets RENDER) the disk is wiped on every deploy and restart, so a SQLite
# file there silently loses every account and project. Refuse to start instead.
ON_HOST = bool(os.getenv("RENDER")) or os.getenv("ENV") == "production"

if not SQLALCHEMY_DATABASE_URL:
    if ON_HOST:
        raise RuntimeError(
            "DATABASE_URL is not set. Add your Postgres connection string in the Render dashboard; "
            "without it every deploy would wipe all accounts and projects."
        )
    SQLALCHEMY_DATABASE_URL = SQLITE_URL
    logger.info(f"DATABASE_URL not set, using local SQLite ({SQLITE_DB_PATH})")

# Supabase only accepts encrypted connections
if "supabase" in SQLALCHEMY_DATABASE_URL and "sslmode=" not in SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL += ("&" if "?" in SQLALCHEMY_DATABASE_URL else "?") + "sslmode=require"

# Supabase's direct host (db.<ref>.supabase.co) is IPv6-only and Render can't reach IPv6,
# so on Render the pooler URL (…pooler.supabase.com) has to be used instead
SUPABASE_DIRECT = "@db." in SQLALCHEMY_DATABASE_URL and ".supabase.co" in SQLALCHEMY_DATABASE_URL
if SUPABASE_DIRECT and ON_HOST:
    logger.warning(
        "DATABASE_URL points at Supabase's direct host, which Render cannot reach. In Supabase open "
        "Connect → Session pooler and use that connection string instead."
    )


def _make_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    # pre_ping replaces connections the server closed while idle (free Postgres tiers do this),
    # which otherwise makes the first save after a quiet spell fail
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=280,
        pool_size=5,
        max_overflow=5,
        connect_args={"connect_timeout": 10},
    )


def _connect_with_retry(url: str, attempts: int = 6):
    eng = _make_engine(url)
    if url.startswith("sqlite"):
        return eng
    for i in range(1, attempts + 1):
        try:
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Connected to PostgreSQL")
            return eng
        except Exception as e:
            # serverless Postgres (Neon, Supabase) can take a few seconds to wake up
            if i == attempts:
                hint = " Use Supabase's Session pooler connection string, not the direct one." if SUPABASE_DIRECT else ""
                raise RuntimeError(f"Could not connect to the database after {attempts} attempts: {e}.{hint}") from e
            wait = min(2 * i, 10)
            logger.warning(f"Database not reachable (attempt {i}/{attempts}): {e}. Retrying in {wait}s")
            time.sleep(wait)


engine = _connect_with_retry(SQLALCHEMY_DATABASE_URL)
DB_KIND = engine.dialect.name  # "postgresql" or "sqlite"

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
    from sqlalchemy import inspect
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
