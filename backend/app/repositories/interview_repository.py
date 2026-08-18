from typing import Dict, List, Optional

from app.schemas import Interview


class InterviewRepository:
    def __init__(self):
        self._interviews: Dict[int, Interview] = {}
        self._next_id = 1

    def create(self, interview: Interview) -> Interview:
        interview.id = self._next_id
        self._interviews[interview.id] = interview
        self._next_id += 1
        return interview

    def get_all(self) -> List[Interview]:
        return list(self._interviews.values())

    def get_by_id(self, interview_id: int) -> Optional[Interview]:
        return self._interviews.get(interview_id)
