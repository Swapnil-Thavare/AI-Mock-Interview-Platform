from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class JobDescriptionBase(BaseModel):
    title: str
    company: Optional[str] = None
    description: str
    required_skills: List[str] = []


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
