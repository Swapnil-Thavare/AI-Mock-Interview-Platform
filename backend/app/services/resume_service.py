from app.repositories import ResumeRepository
from app.schemas import Resume


class ResumeService:
    def __init__(self):
        self._repo = ResumeRepository()

    def create_resume(self, filename: str, file_size: int) -> Resume:
        resume = Resume(
            id=0,
            filename=filename,
            skills=["Python", "FastAPI"],
            extracted_text="Mock extracted resume text.",
        )
        return self._repo.create(resume)

    def get_all_resumes(self):
        return self._repo.get_all()
