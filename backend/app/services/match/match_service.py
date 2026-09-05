import uuid

from sqlmodel.ext.asyncio.session import AsyncSession

from app.exception import CustomException
from app.models.resume_job_match import ResumeJobMatch
from app.schemas.match import ResumeJDMatchCreate, ResumeJDMatchResponse
from app.services.ai.ai_service import AIService
from app.services.job.job_query import JobDescriptionQuery
from app.services.match.match_query import MatchQuery
from app.services.resume.resume_query import ResumeQuery


class ResumeJDMatch:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._resume_query = ResumeQuery(db)
        self._job_query = JobDescriptionQuery(db)
        self._match_query = MatchQuery(db)
        self._ai = AIService()

    async def analyze(
        self, user_id: uuid.UUID, payload: ResumeJDMatchCreate
    ) -> ResumeJDMatchResponse:
        resume = await self._resume_query.get_by_id(payload.resume_id)
        if not resume or resume.user_id != user_id:
            raise CustomException(404, "Resume not found")

        job = await self._job_query.get_by_id(payload.job_description_id)
        if not job or job.user_id != user_id:
            raise CustomException(404, "Job description not found")

        match_result = await self._ai.match_resume_jd(
            resume.analysis or {},
            job.analysis or {},
        )

        existing = await self._match_query.get_by_resume_jd(
            user_id, payload.resume_id, payload.job_description_id
        )
        if existing:
            existing.overall_match_score = match_result.overall_match_score
            existing.matched_skills = match_result.matched_skills
            existing.missing_skills = match_result.missing_skills
            existing.strengths = match_result.strengths
            existing.gaps = match_result.gaps
            existing.recommendations = match_result.recommendations
            match = await self._match_query.save(existing)
        else:
            match = ResumeJobMatch(
                user_id=user_id,
                resume_id=payload.resume_id,
                job_description_id=payload.job_description_id,
                overall_match_score=match_result.overall_match_score,
                matched_skills=match_result.matched_skills,
                missing_skills=match_result.missing_skills,
                strengths=match_result.strengths,
                gaps=match_result.gaps,
                recommendations=match_result.recommendations,
            )
            self._db.add(match)
            await self._db.commit()
            await self._db.refresh(match)

        return ResumeJDMatchResponse.model_validate(match)

    async def get_latest(
        self, user_id: uuid.UUID, payload: ResumeJDMatchCreate
    ) -> ResumeJDMatchResponse | None:
        match = await self._match_query.get_by_resume_jd(
            user_id, payload.resume_id, payload.job_description_id
        )
        if match:
            return ResumeJDMatchResponse.model_validate(match)
        return None
