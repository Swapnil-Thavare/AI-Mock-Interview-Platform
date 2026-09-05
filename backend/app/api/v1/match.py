from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import get_current_user
from app.db.db import get_session
from app.models.user import User
from app.schemas import ResumeJDMatchCreate, ResumeJDMatchResponse
from app.services.match.match_service import ResumeJDMatch

router = APIRouter()


@router.post("", response_model=ResumeJDMatchResponse)
async def analyze_match(
    payload: ResumeJDMatchCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await ResumeJDMatch(db).analyze(current_user.id, payload)
