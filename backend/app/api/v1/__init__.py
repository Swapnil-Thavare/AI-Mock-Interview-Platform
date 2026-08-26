from fastapi import APIRouter

from app.api.v1 import auth as auth_module
from app.api.v1 import interview as interview_module
from app.api.v1 import job as job_module
from app.api.v1 import resume as resume_module

router_v1 = APIRouter()

router_v1.include_router(auth_module.router, prefix="/auth", tags=["auth"])
router_v1.include_router(resume_module.router, prefix="/resume", tags=["resume"])
router_v1.include_router(job_module.router, prefix="/job-descriptions", tags=["job-descriptions"])
router_v1.include_router(interview_module.router, prefix="/interviews", tags=["interviews"])
