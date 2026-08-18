from app.repositories import JobDescriptionRepository
from app.schemas import JobDescription


class JobDescriptionService:
    def __init__(self):
        self._repo = JobDescriptionRepository()

    def create_job(self, job: JobDescription) -> JobDescription:
        return self._repo.create(job)

    def get_all_jobs(self):
        return self._repo.get_all()
