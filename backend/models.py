from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, JSON, LargeBinary, Text
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
    # the plot, when known: size, facing, setbacks, buildable area, Vastu wish, notes from generation
    site = Column(JSON, nullable=True)
    
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


class PlanImport(Base):
    """A floor plan drawing the owner uploaded to turn into an editable plan.

    The drawing itself and the plan they accepted are kept only when they agreed to share them
    (consent) for improving the plan reader; otherwise only the reader's summary is kept."""
    __tablename__ = "plan_imports"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    file_name = Column(String, nullable=True)
    content_type = Column(String)
    consent = Column(Boolean, default=False)
    image = Column(LargeBinary, nullable=True)        # the uploaded file, only with consent
    predicted = Column(JSON, nullable=True)           # elements as read, only with consent
    accepted = Column(JSON, nullable=True)            # elements the owner accepted, only with consent
    info = Column(JSON, nullable=True)                # reader summary: scale, counts, model version
    status = Column(String, default="read")           # read | accepted
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ProjectShare(Base):
    """A view-only link to a project for a client or family; anyone with the token can see the plan,
    comment on it and approve it, until the owner turns the link off."""
    __tablename__ = "project_shares"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    token = Column(String, unique=True, index=True)
    label = Column(String, nullable=True)                 # who it was sent to, for the owner
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ShareComment(Base):
    """A comment left through a share link, on the whole plan or on one room."""
    __tablename__ = "share_comments"

    id = Column(Integer, primary_key=True, index=True)
    share_id = Column(Integer, ForeignKey("project_shares.id", ondelete="CASCADE"), index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    author = Column(String)
    body = Column(Text)
    room_id = Column(String, nullable=True)               # the room element's id
    room_name = Column(String, nullable=True)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ShareDecision(Base):
    """A client's approval (or request for changes) of the plan as it was at that moment."""
    __tablename__ = "share_decisions"

    id = Column(Integer, primary_key=True, index=True)
    share_id = Column(Integer, ForeignKey("project_shares.id", ondelete="CASCADE"), index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    author = Column(String)
    decision = Column(String)                              # approved | changes_requested
    note = Column(Text, nullable=True)
    plan_version = Column(String)                          # hash of the plan that was decided on
    elements = Column(JSON)                                # that plan, kept so the owner can see what was approved
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
