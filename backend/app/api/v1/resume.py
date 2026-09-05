import uuid
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import get_current_user
from app.db.db import get_session
from app.models.user import User
from app.schemas import ResumeResponse
from app.services.resume.resume_service import Resume

router = APIRouter()


@router.post("/upload", response_model=ResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Resume(db).create_resume(current_user.id, file)


@router.get("/latest", response_model=ResumeResponse)
async def get_latest_resume(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    resume = await Resume(db).get_latest(current_user.id)
    if not resume:
        raise HTTPException(status_code=404, detail="No resume found")
    return resume


@router.get("", response_model=List[ResumeResponse])
async def list_resumes(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Resume(db).get_all(current_user.id)


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Resume(db).get_by_id(current_user.id, resume_id)
