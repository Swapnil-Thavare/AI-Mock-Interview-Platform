from fastapi import APIRouter

from app.schemas import JobDescription
from app.services import JobDescriptionService

router = APIRouter(prefix="/job-descriptions", tags=["job-descriptions"])
service = JobDescriptionService()


@router.post("")
def create_job(job: JobDescription):
    return service.create_job(job)


@router.get("")
def list_jobs():
    return service.get_all_jobs()
