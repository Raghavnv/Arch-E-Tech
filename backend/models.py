from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text
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
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="projects")


class RoomRender(Base):
    """AI photos of one room of a project: the empty room, and the same room furnished."""
    __tablename__ = "room_renders"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    room_key = Column(String, index=True)          # the room element's id in the plan
    room_name = Column(String)
    kind = Column(String)
    style = Column(String)
    empty_image = Column(Text, nullable=True)      # data URL (JPEG)
    furnished_image = Column(Text, nullable=True)  # data URL (JPEG)
    prompt = Column(Text, nullable=True)           # what the user asked for when furnishing
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class SavedPhoto(Base):
    """A render the owner chose to keep, in their photo gallery."""
    __tablename__ = "saved_photos"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    room_key = Column(String, nullable=True)       # which room of the plan it shows (None for concepts)
    room_name = Column(String, nullable=True)
    title = Column(String)
    kind = Column(String, default="furnished")     # furnished | empty | cutaway | exterior
    style = Column(String, nullable=True)
    prompt = Column(Text, nullable=True)
    image = Column(Text)                           # full-size JPEG data URL
    thumb = Column(Text)                           # ~480 px JPEG data URL for the gallery grid
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
