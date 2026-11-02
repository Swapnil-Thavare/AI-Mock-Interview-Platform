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
    InterviewAnswerMediaSubmitResponse,
    InterviewCreate,
    InterviewModeUpdate,
    InterviewReportResponse,
    InterviewResponse,
    InterviewResultResponse,
    ProctoringEventBatchIn,
    ProctoringEventBatchResponse,
    ProctoringEventResponse,
    ProctoringSummaryResponse,
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
    response_model=InterviewAnswerMediaSubmitResponse,
)
async def upload_answer_media(
    interview_id: uuid.UUID,
    answer_id: uuid.UUID,
    file: UploadFile = File(...),
    duration_seconds: Optional[float] = Form(None),
    pause_count: Optional[int] = Form(None),
    pause_total_seconds: Optional[float] = Form(None),
    pause_longest_seconds: Optional[float] = Form(None),
    speech_seconds: Optional[float] = Form(None),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).upload_answer_media(
        current_user.id,
        interview_id,
        answer_id,
        file,
        duration_seconds,
        pause_count,
        pause_total_seconds,
        pause_longest_seconds,
        speech_seconds,
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


@router.get("/{interview_id}/report", response_model=InterviewReportResponse)
async def get_interview_report(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).get_report(current_user.id, interview_id)


@router.post(
    "/{interview_id}/proctoring-consent", response_model=InterviewResponse
)
async def acknowledge_proctoring_consent(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).acknowledge_proctoring_consent(
        current_user.id, interview_id
    )


@router.post(
    "/{interview_id}/proctoring-events",
    response_model=ProctoringEventBatchResponse,
)
async def submit_proctoring_events(
    interview_id: uuid.UUID,
    payload: ProctoringEventBatchIn,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).submit_proctoring_events(
        current_user.id, interview_id, payload
    )


@router.get(
    "/{interview_id}/proctoring-events",
    response_model=List[ProctoringEventResponse],
)
async def list_proctoring_events(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).list_proctoring_events(
        current_user.id, interview_id
    )


@router.get(
    "/{interview_id}/proctoring-summary",
    response_model=ProctoringSummaryResponse,
)
async def get_proctoring_summary(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await Interview(db).proctoring_summary(
        current_user.id, interview_id
    )
