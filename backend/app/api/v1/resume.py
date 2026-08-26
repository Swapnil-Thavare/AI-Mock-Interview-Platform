from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.db import get_db
from app.models.user import User
from app.schemas import ResumeResponse
from app.services.resume.resume_service import Resume

router = APIRouter()


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await Resume(db).create_resume(current_user.id, file)


@router.get("", response_model=ResumeResponse)
def get_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = Resume(db).get_latest(current_user.id)
    if not resume:
        raise HTTPException(status_code=404, detail="No resume found")
    return resume
