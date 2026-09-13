from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class JobDescriptionBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    company: Optional[str] = Field(default=None, max_length=255)
    description: str = Field(min_length=1, max_length=30000)
    required_skills: List[str] = []
    analysis: Dict[str, Any] = {}


class JobDescriptionCreate(JobDescriptionBase):
    pass


class JobDescription(JobDescriptionBase):
    id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    model_config = ConfigDict(from_attributes=True)


class JobDescriptionResponse(JobDescriptionBase):
    id: UUID
    user_id: UUID
    model_config = ConfigDict(from_attributes=True)
