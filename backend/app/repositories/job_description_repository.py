from typing import Dict, List

from app.schemas import JobDescription


class JobDescriptionRepository:
    def __init__(self):
        self._jobs: Dict[int, JobDescription] = {}
        self._next_id = 1

    def create(self, job: JobDescription) -> JobDescription:
        job.id = self._next_id
        self._jobs[job.id] = job
        self._next_id += 1
        return job

    def get_all(self) -> List[JobDescription]:
        return list(self._jobs.values())
