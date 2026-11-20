"""Export plan imports whose owners agreed to share them, as training material for the plan reader.

    python export_plan_imports.py ../ml/data/user_imports

Writes one folder per accepted, consented import: the drawing, the elements as read, the elements
the owner accepted, the project's current ground floor (their later corrections), and the reader
info (scale, image -> plan mapping). ml/archetech_ml/user_data.py turns these into training labels.
Only rows with consent are ever exported.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import models
from database import SessionLocal

EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/pdf": ".pdf"}


def main(out_dir: str):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    n = 0
    try:
        rows = (db.query(models.PlanImport)
                .filter(models.PlanImport.consent.is_(True), models.PlanImport.status == "accepted",
                        models.PlanImport.image.isnot(None))
                .all())
        for row in rows:
            d = out / f"import_{row.id}"
            d.mkdir(exist_ok=True)
            (d / f"drawing{EXT.get(row.content_type, '.bin')}").write_bytes(row.image)
            (d / "predicted.json").write_text(json.dumps(row.predicted or []))
            (d / "accepted.json").write_text(json.dumps(row.accepted or []))
            (d / "info.json").write_text(json.dumps({**(row.info or {}), "content_type": row.content_type}))
            project = db.get(models.Project, row.project_id) if row.project_id else None
            if project:
                floor1 = [e for e in (project.elements_data or []) if (e.get("floor") or 1) == 1]
                (d / "project_now.json").write_text(json.dumps(floor1))
            n += 1
    finally:
        db.close()
    print(f"exported {n} imports to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "plan_imports_export")
