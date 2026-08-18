from typing import List

from pydantic import BaseModel


class Resume(BaseModel):
    id: int
    filename: str
    skills: List[str]
    extracted_text: str
