from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    projects = relationship("Project", back_populates="owner")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    locality = Column(String)
    floors = Column(Integer, default=1)
    status = Column(String, default="Draft")
    
    # Store the 2D elements (walls, doors, etc.) as JSON for easy serialization
    elements_data = Column(JSON, default=list)
    # War Room mood board items (notes, images, palettes)
    board_data = Column(JSON, default=list)
    # set when the owner shares a read-only link
    share_token = Column(String, unique=True, index=True, nullable=True)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="projects")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    name = Column(String)
    project_name = Column(String)
    building_type = Column(String, default="Residential")
    narrative = Column(Text, default="")
    costs = Column(JSON, default=dict)          # {"total": n, "currency": "INR", "breakdown": [...]}
    snapshot = Column(Text, nullable=True)      # PNG data URL of the plan
    element_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
