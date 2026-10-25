import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import get_current_user
from app.db.db import get_session
from app.models.interview import InterviewMode as InterviewModeModel
from app.models.user import User
from app.schemas import (
    InterviewAnswer,
    InterviewAnswerMediaResponse,
    InterviewCreate,
    InterviewModeUpdate,
    InterviewResponse,
    InterviewResultResponse,
    SubmitAnswerResponse,
)
from app.services.interview.interview_service import Interview

router = APIRouter()


@router.post("", response_model=InterviewResponse)
async def create_interview(
    payload: InterviewCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).create_interview(current_user.id, payload)


@router.get("", response_model=List[InterviewResponse])
async def list_interviews(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).list_interviews(current_user.id)


@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).get_interview(
        current_user.id, interview_id
    )


@router.patch("/{interview_id}/mode", response_model=InterviewResponse)
async def update_interview_mode(
    interview_id: uuid.UUID,
    payload: InterviewModeUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).update_interview_mode(
        current_user.id,
        interview_id,
        InterviewModeModel(payload.interview_mode.value),
    )


@router.post("/{interview_id}/answers", response_model=SubmitAnswerResponse)
async def submit_answer(
    interview_id: uuid.UUID,
    answer: InterviewAnswer,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).submit_answer(
        current_user.id, interview_id, answer
    )


@router.post(
    "/{interview_id}/answers/{answer_id}/media",
    response_model=InterviewAnswerMediaResponse,
)
async def upload_answer_media(
    interview_id: uuid.UUID,
    answer_id: uuid.UUID,
    file: UploadFile = File(...),
    duration_seconds: Optional[float] = Form(None),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).upload_answer_media(
        current_user.id, interview_id, answer_id, file, duration_seconds
    )


@router.post("/{interview_id}/complete", response_model=InterviewResultResponse)
async def complete_interview(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).complete_interview(
        current_user.id, interview_id
    )
