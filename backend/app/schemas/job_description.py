from typing import List, Optional

from pydantic import BaseModel


class JobDescription(BaseModel):
    id: Optional[int] = None
    title: str
    company: Optional[str] = None
    description: str
    required_skills: List[str] = []
