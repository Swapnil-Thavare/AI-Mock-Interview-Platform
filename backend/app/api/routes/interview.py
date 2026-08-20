import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas import (
    InterviewAnswer,
    InterviewCreate,
    InterviewResponse,
    InterviewResultResponse,
)
from app.services.interview_service import InterviewService

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.post("", response_model=InterviewResponse)
def create_interview(
    payload: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InterviewService(db).create_interview(current_user.id, payload)


@router.get("", response_model=List[InterviewResponse])
def list_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InterviewService(db).list_interviews(current_user.id)


@router.get("/{interview_id}", response_model=InterviewResponse)
def get_interview(
    interview_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InterviewService(db).get_interview(current_user.id, interview_id)


@router.post("/{interview_id}/answers")
def submit_answer(
    interview_id: uuid.UUID,
    answer: InterviewAnswer,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InterviewService(db).submit_answer(current_user.id, interview_id, answer)


@router.post("/{interview_id}/complete", response_model=InterviewResultResponse)
def complete_interview(
    interview_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InterviewService(db).complete_interview(current_user.id, interview_id)
