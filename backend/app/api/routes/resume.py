from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas import Resume
from app.services import ResumeService

router = APIRouter(prefix="/resume", tags=["resume"])
service = ResumeService()


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    content = await file.read()
    return service.create_resume(file.filename, len(content))


@router.get("", response_model=Resume)
def get_resume():
    resumes = service.get_all_resumes()
    if resumes:
        return resumes[-1]
    return Resume(
        id=0,
        filename="mock_resume.pdf",
        skills=["Python", "FastAPI"],
        extracted_text="Mock resume text.",
    )
