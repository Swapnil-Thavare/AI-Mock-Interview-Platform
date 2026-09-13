from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ResumeBase(BaseModel):
    filename: str
    file_size: Optional[int] = None
    skills: List[str] = []
    extracted_text: Optional[str] = None
    analysis: Dict[str, Any] = {}


class ResumeCreate(ResumeBase):
    user_id: Optional[UUID] = None


class Resume(ResumeBase):
    id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    file_path: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ResumeResponse(ResumeBase):
    id: UUID
    user_id: UUID
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
