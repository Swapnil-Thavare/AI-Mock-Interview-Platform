import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import get_current_user
from app.db.db import get_session
from app.models.user import User
from app.schemas import JobDescriptionCreate, JobDescriptionResponse
from app.services.job.job_service import JobDescription

router = APIRouter()


@router.post("", response_model=JobDescriptionResponse)
async def create_job(
    job: JobDescriptionCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await JobDescription(db).create(current_user.id, job)


@router.get("", response_model=List[JobDescriptionResponse])
async def list_jobs(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await JobDescription(db).get_all(current_user.id)


@router.get("/{job_id}", response_model=JobDescriptionResponse)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await JobDescription(db).get_by_id(current_user.id, job_id)


@router.delete("/{job_id}")
async def delete_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    await JobDescription(db).delete(current_user.id, job_id)
    return {"message": "Job description deleted"}
