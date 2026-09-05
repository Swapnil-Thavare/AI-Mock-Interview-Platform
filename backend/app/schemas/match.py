from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ResumeJDMatchCreate(BaseModel):
    resume_id: UUID
    job_description_id: UUID


class ResumeJDMatchResponse(BaseModel):
    id: UUID
    user_id: UUID
    resume_id: UUID
    job_description_id: UUID
    overall_match_score: int = Field(..., ge=0, le=100)
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    strengths: List[str] = []
    gaps: List[str] = []
    recommendations: List[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
