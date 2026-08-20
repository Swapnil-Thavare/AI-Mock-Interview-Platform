import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas import JobDescriptionCreate, JobDescriptionResponse
from app.services.job_description_service import JobDescriptionService

router = APIRouter(prefix="/job-descriptions", tags=["job-descriptions"])


@router.post("", response_model=JobDescriptionResponse)
def create_job(
    job: JobDescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return JobDescriptionService(db).create(current_user.id, job)


@router.get("", response_model=List[JobDescriptionResponse])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return JobDescriptionService(db).get_all(current_user.id)


@router.get("/{job_id}", response_model=JobDescriptionResponse)
def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return JobDescriptionService(db).get_by_id(current_user.id, job_id)


@router.delete("/{job_id}")
def delete_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    JobDescriptionService(db).delete(current_user.id, job_id)
    return {"message": "Job description deleted"}
