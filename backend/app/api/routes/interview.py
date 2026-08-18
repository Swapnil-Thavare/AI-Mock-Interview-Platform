from fastapi import APIRouter, HTTPException

from app.schemas import InterviewAnswer, InterviewResult
from app.services import InterviewService

router = APIRouter(prefix="/interviews", tags=["interviews"])
service = InterviewService()


@router.post("")
def create_interview(payload: dict):
    return service.create_interview(payload)


@router.get("")
def list_interviews():
    return service.list_interviews()


@router.get("/{interview_id}")
def get_interview(interview_id: int):
    interview = service.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.post("/{interview_id}/answers")
def submit_answer(interview_id: int, answer: InterviewAnswer):
    return service.submit_answer(interview_id, answer)


@router.post("/{interview_id}/complete", response_model=InterviewResult)
def complete_interview(interview_id: int):
    return service.complete_interview(interview_id)
