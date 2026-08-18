from typing import Dict, List

from app.schemas import Resume


class ResumeRepository:
    def __init__(self):
        self._resumes: Dict[int, Resume] = {}
        self._next_id = 1

    def create(self, resume: Resume) -> Resume:
        resume.id = self._next_id
        self._resumes[resume.id] = resume
        self._next_id += 1
        return resume

    def get_all(self) -> List[Resume]:
        return list(self._resumes.values())
