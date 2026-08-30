import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import get_current_user
from app.db.db import get_session
from app.models.user import User
from app.schemas import (
    InterviewAnswer,
    InterviewCreate,
    InterviewResponse,
    InterviewResultResponse,
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


@router.post("/{interview_id}/answers")
async def submit_answer(
    interview_id: uuid.UUID,
    answer: InterviewAnswer,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).submit_answer(
        current_user.id, interview_id, answer
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
