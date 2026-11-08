import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import uuid

import anyio
from fastapi import UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import get_settings
from app.exception import CustomException
from app.models.interview import (
    Interview as InterviewModel,
    InterviewMode as InterviewModeModel,
    InterviewStatus,
)
from app.models.interview_answer import InterviewAnswer
from app.models.interview_answer_media import (
    InterviewAnswerMedia as InterviewAnswerMediaModel,
    MediaKind,
    MediaUploadStatus,
    TranscriptionStatus,
)
from app.models.interview_answer_speech_analysis import (
    InterviewAnswerSpeechAnalysis as InterviewAnswerSpeechAnalysisModel,
    SpeechAnalysisStatus,
)
from app.models.interview_proctoring_event import (
    InterviewProctoringEvent as InterviewProctoringEventModel,
    ProctoringEventType as ProctoringEventTypeModel,
    ProctoringSeverity as ProctoringSeverityModel,
)
from app.models.interview_question import InterviewQuestion, QuestionType
from app.models.interview_result import InterviewResult as InterviewResultModel
from app.schemas.interview import (
    CommunicationAggregate,
    InterviewAnswer as InterviewAnswerSchema,
    InterviewAnswerEvaluation,
    InterviewAnswerMediaResponse,
    InterviewAnswerMediaSubmitResponse,
    InterviewAnswerResponse,
    InterviewCreate,
    InterviewQuestionResponse,
    InterviewReportResponse,
    InterviewResponse,
    InterviewResult as InterviewResultSchema,
    InterviewResultResponse,
    ProctoringEventBatchIn,
    ProctoringEventBatchResponse,
    ProctoringEventIn,
    ProctoringEventResponse,
    ProctoringSummaryResponse,
    ReportAnswerStatus,
    ReportMediaInfo,
    ReportOverview,
    ReportProctoringEvent,
    ReportQuestionBlock,
    SessionIntegrityReport,
    SpeechAnalysisResponse,
    SubmitAnswerResponse,
)
from app.services.ai.ai_service import AIService
from app.services.ai.transcription_provider import default_transcription_provider
from app.services.auth.auth_query import UserQuery
from app.services.interview.interview_query import InterviewQuery
from app.services.interview.speech_analysis import (
    compute_speech_metrics,
    sanitize_pause_stats,
)
from app.services.job.job_query import JobDescriptionQuery
from app.services.match.match_query import MatchQuery
from app.services.resume.resume_query import ResumeQuery
from app.services.storage.storage_service import (
    download_media_file,
    upload_media_file,
)


_MAX_ANSWER_LENGTH = 20000

_ALLOWED_MEDIA_MIME_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/x-m4a",
    "video/webm",
    "video/mp4",
    "video/quicktime",
    "video/x-matroska",
}

_MEDIA_EXTENSIONS = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/x-m4a": "m4a",
    "video/webm": "webm",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
}

# Phase 7D — session-integrity (proctoring) events.
_MAX_PROCTORING_EVENTS_PER_INTERVIEW = 1000
_PROCTORING_METADATA_MAX_BYTES = 2048
_PROCTORING_METADATA_ALLOWED_KEYS = {
    "face_count",
    "consecutive_samples",
    "reason",
    "detector",
}
# Client clocks may be skewed; allow small future drift and a bounded
# lookback relative to the interview's creation time. Legitimate events can
# only exist after the interview row is created (the client learns
# interview_id at that point), so one hour of skew is sufficient.
_PROCTORING_FUTURE_SKEW = timedelta(minutes=5)
_PROCTORING_PAST_SKEW = timedelta(hours=1)
# Tolerance for duration_seconds vs the started_at/ended_at window.
_DURATION_CONSISTENCY_TOLERANCE_SECONDS = 5.0

_DEFAULT_PROCTORING_SEVERITY = {
    ProctoringEventTypeModel.FACE_NOT_DETECTED: ProctoringSeverityModel.WARNING,
    ProctoringEventTypeModel.MULTIPLE_FACES_DETECTED: (
        ProctoringSeverityModel.WARNING
    ),
    ProctoringEventTypeModel.CAMERA_DISCONNECTED: (
        ProctoringSeverityModel.WARNING
    ),
    ProctoringEventTypeModel.CAMERA_INTERRUPTED: (
        ProctoringSeverityModel.WARNING
    ),
    ProctoringEventTypeModel.TAB_HIDDEN: ProctoringSeverityModel.INFO,
    ProctoringEventTypeModel.WINDOW_FOCUS_LOST: ProctoringSeverityModel.INFO,
}

# Neutral wording rendered with the session-integrity section of the report.
_PROCTORING_DISCLAIMER = (
    "Session-integrity observations were recorded locally in the candidate's "
    "browser during the interview. They are neutral client-side observations, "
    "are not proof of misconduct, and do not affect the interview score."
)


class Interview:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._query = InterviewQuery(db)
        self._ai = AIService()
        self._transcription = default_transcription_provider()

    async def _ensure_resume_analysis(self, resume) -> dict:
        if resume.analysis:
            return resume.analysis
        analysis = await self._ai.analyze_resume(resume.extracted_text or "")
        resume.analysis = analysis.model_dump()
        self._db.add(resume)
        await self._db.commit()
        await self._db.refresh(resume)
        return resume.analysis

    async def _ensure_jd_analysis(self, job) -> dict:
        if job.analysis:
            return job.analysis
        analysis = await self._ai.analyze_job_description(job.description or "")
        job.analysis = analysis.model_dump()
        self._db.add(job)
        await self._db.commit()
        await self._db.refresh(job)
        return job.analysis

    async def _load_context(
        self, interview: InterviewModel
    ) -> tuple[dict, dict, Optional[dict]]:
        resume_analysis: dict = {}
        jd_analysis: dict = {}
        match_data: Optional[dict] = None

        if interview.resume_id:
            resume = await ResumeQuery(self._db).get_by_id(interview.resume_id)
            if resume:
                resume_analysis = resume.analysis or {}
        if interview.job_description_id:
            job = await JobDescriptionQuery(self._db).get_by_id(
                interview.job_description_id
            )
            if job:
                jd_analysis = job.analysis or {}
                match = await MatchQuery(self._db).get_by_resume_jd(
                    interview.user_id, interview.resume_id, interview.job_description_id
                )
                if match:
                    match_data = {
                        "overall_match_score": match.overall_match_score,
                        "matched_skills": match.matched_skills,
                        "missing_skills": match.missing_skills,
                        "strengths": match.strengths,
                        "gaps": match.gaps,
                        "recommendations": match.recommendations,
                    }
        return resume_analysis, jd_analysis, match_data

    async def _get_next_question(
        self, interview: InterviewModel
    ) -> Optional[InterviewQuestion]:
        stmt = (
            select(InterviewAnswer)
            .where(InterviewAnswer.interview_id == interview.id)
        )
        result = await self._db.exec(stmt)
        answered_ids = {a.question_id for a in result.all()}

        stmt = (
            select(InterviewQuestion)
            .where(InterviewQuestion.interview_id == interview.id)
            .order_by(InterviewQuestion.order)
        )
        result = await self._db.exec(stmt)
        questions = result.all()
        for q in questions:
            if q.id not in answered_ids:
                return q
        return None

    async def _count_follow_ups(self, interview: InterviewModel) -> int:
        return sum(1 for q in interview.questions if q.is_follow_up)

    @staticmethod
    def _question_to_dict(question: InterviewQuestion) -> Dict[str, Any]:
        return {
            "id": str(question.id),
            "question_text": question.question_text,
            "question_type": question.question_type.value,
            "difficulty": question.difficulty,
            "topic": question.topic,
            "expected_focus": question.expected_focus,
            "order": question.order,
            "category": question.category,
        }

    async def _evaluate_answer(
        self,
        interview: InterviewModel,
        question: InterviewQuestion,
        answer: InterviewAnswer,
    ) -> Optional[InterviewAnswerEvaluation]:
        resume_analysis, jd_analysis, _ = await self._load_context(interview)
        try:
            evaluation = await self._ai.evaluate_answer(
                self._question_to_dict(question),
                answer.answer_text,
                resume_analysis,
                jd_analysis,
                interview.difficulty,
            )
            return InterviewAnswerEvaluation.model_validate(
                evaluation.model_dump(mode="json")
            )
        except CustomException:
            raise
        except Exception:
            return None

    async def _generate_follow_up(
        self,
        interview: InterviewModel,
        question: InterviewQuestion,
        answer: InterviewAnswer,
        evaluation: InterviewAnswerEvaluation,
    ) -> Optional[InterviewQuestion]:
        resume_analysis, jd_analysis, _ = await self._load_context(interview)
        try:
            follow_up = await self._ai.generate_follow_up_question(
                self._question_to_dict(question),
                answer.answer_text,
                evaluation.model_dump(mode="json"),
                resume_analysis,
                jd_analysis,
                interview.difficulty,
            )
        except Exception:
            return None

        max_order = max((q.order for q in interview.questions), default=-1)
        raw_type = (follow_up.question_type or "technical").lower()
        q_type = QuestionType.BEHAVIORAL
        if raw_type == "technical":
            q_type = QuestionType.TECHNICAL

        follow_up_question = InterviewQuestion(
            interview_id=interview.id,
            question_text=follow_up.question,
            question_type=q_type,
            difficulty=follow_up.difficulty or interview.difficulty,
            order=max_order + 1,
            topic=follow_up.topic,
            expected_focus=follow_up.expected_focus,
            category=raw_type,
            parent_question_id=question.id,
            is_follow_up=True,
            follow_up_reason=evaluation.follow_up_reason,
        )
        self._db.add(follow_up_question)
        await self._db.commit()
        await self._db.refresh(follow_up_question)
        return follow_up_question

    async def _evaluate_and_follow_up(
        self,
        interview: InterviewModel,
        question: InterviewQuestion,
        answer: InterviewAnswer,
    ) -> tuple[Optional[InterviewAnswerEvaluation], Optional[InterviewQuestion]]:
        """Evaluate answer.answer_text, persist the result, and maybe
        generate an adaptive follow-up question.

        Shared by the text submission path and the voice-first media path.
        Evaluation failures leave the answer intact and return (None, None).
        Returns the generated follow-up question (if any) so callers can
        deliver it as the immediate next question — follow-ups keep
        order = max + 1 for persistence, but are asked right away.
        """
        evaluation_schema: Optional[InterviewAnswerEvaluation] = None
        try:
            evaluation_schema = await self._evaluate_answer(
                interview, question, answer
            )
            if evaluation_schema:
                answer.score = float(evaluation_schema.score)
                answer.evaluation = evaluation_schema.model_dump(mode="json")
                answer.evaluated_at = datetime.now(timezone.utc)
                self._db.add(answer)
                await self._db.commit()
                await self._db.refresh(answer)
        except CustomException:
            pass

        follow_up_question: Optional[InterviewQuestion] = None
        if evaluation_schema and evaluation_schema.follow_up_required:
            follow_up_count = await self._count_follow_ups(interview)
            max_follow_ups = max(0, get_settings().MAX_FOLLOW_UP_QUESTIONS)
            if follow_up_count < max_follow_ups:
                follow_up_question = await self._generate_follow_up(
                    interview, question, answer, evaluation_schema
                )
        return evaluation_schema, follow_up_question

    async def _transcribe_media(
        self,
        media: InterviewAnswerMediaModel,
        content: bytes,
        mime_type: str,
    ) -> InterviewAnswerMediaModel:
        """Transcribe recording bytes and persist the result on the media row.

        Raises a sanitized CustomException on failure; the media record keeps
        a FAILED status so the client can retry without losing the upload.
        """
        media.transcription_status = TranscriptionStatus.PENDING
        media.transcription_error = None
        media = await self._query.save_media(media)
        try:
            transcript = (
                await self._transcription.transcribe(content, mime_type)
            ).strip()
        except CustomException as exc:
            media.transcription_status = TranscriptionStatus.FAILED
            media.transcription_error = str(exc.message)[:512]
            await self._query.save_media(media)
            raise
        except Exception as exc:
            media.transcription_status = TranscriptionStatus.FAILED
            media.transcription_error = type(exc).__name__[:512]
            await self._query.save_media(media)
            raise CustomException(
                502, "Transcription failed unexpectedly."
            ) from exc
        if not transcript:
            media.transcription_status = TranscriptionStatus.FAILED
            media.transcription_error = "No intelligible speech detected."
            await self._query.save_media(media)
            raise CustomException(
                422,
                "The recording could not be transcribed — no speech was "
                "detected. Please retry with a clearer recording.",
            )
        media.transcript_text = transcript
        media.transcription_status = TranscriptionStatus.COMPLETED
        media.transcribed_at = datetime.now(timezone.utc)
        return await self._query.save_media(media)

    async def _analyze_speech(
        self,
        interview: InterviewModel,
        question: Optional[InterviewQuestion],
        answer: InterviewAnswer,
        media: InterviewAnswerMediaModel,
        pause_stats: Dict[str, Optional[float]],
    ) -> InterviewAnswerSpeechAnalysisModel:
        """Persist speech-communication observations for one answer.

        Deterministic metrics are recomputed idempotently on every retry;
        the Gemini communication call only runs while status != COMPLETED, so
        a previously successful analysis is never repeated. An AI failure is
        recorded as FAILED (deterministic metrics preserved) and never raises
        into the upload pipeline.
        """
        analysis = await self._query.get_speech_analysis_for_answer(answer.id)
        if (
            analysis is not None
            and analysis.status == SpeechAnalysisStatus.COMPLETED
        ):
            return analysis
        if analysis is None:
            analysis = InterviewAnswerSpeechAnalysisModel(
                answer_id=answer.id,
                media_id=media.id,
                interview_id=interview.id,
            )

        transcript = (media.transcript_text or "").strip()
        metrics = compute_speech_metrics(
            transcript,
            media.duration_seconds,
            pause_stats.get("speech_seconds"),
        )
        for field, value in metrics.items():
            setattr(analysis, field, value)
        analysis.pause_count = pause_stats.get("pause_count")
        analysis.pause_total_seconds = pause_stats.get("pause_total_seconds")
        analysis.pause_longest_seconds = pause_stats.get(
            "pause_longest_seconds"
        )
        analysis.pause_avg_seconds = (
            round(
                analysis.pause_total_seconds / analysis.pause_count, 3
            )
            if analysis.pause_count
            and analysis.pause_total_seconds is not None
            else None
        )
        analysis.analyzed_at = datetime.now(timezone.utc)
        analysis.analysis_error = None

        try:
            communication = await self._ai.analyze_communication(
                {
                    "question_text": (
                        question.question_text if question else ""
                    ),
                    "expected_focus": (
                        question.expected_focus if question else ""
                    ),
                },
                transcript,
            )
            analysis.structure_summary = communication.structure_summary
            analysis.organization_notes = communication.organization_notes
            analysis.clarity_notes = communication.clarity_notes
            analysis.communication_strengths = (
                communication.communication_strengths
            )
            analysis.communication_improvements = (
                communication.communication_improvements
            )
            analysis.status = SpeechAnalysisStatus.COMPLETED
        except Exception as exc:
            # Deterministic metrics stay persisted; only the AI observations
            # are missing. Retry re-runs this call — never the transcription.
            analysis.status = SpeechAnalysisStatus.FAILED
            analysis.analysis_error = (
                getattr(exc, "message", None) or type(exc).__name__
            )[:512]

        return await self._query.save_speech_analysis(analysis)

    async def create_interview(
        self, user_id: uuid.UUID, payload: InterviewCreate
    ) -> InterviewResponse:
        if payload.resume_id:
            resume = await ResumeQuery(self._db).get_by_id(payload.resume_id)
            if not resume or resume.user_id != user_id:
                raise CustomException(404, "Resume not found")
            resume_analysis = await self._ensure_resume_analysis(resume)
        else:
            resume_analysis = {}

        if payload.job_description_id:
            job = await JobDescriptionQuery(self._db).get_by_id(
                payload.job_description_id
            )
            if not job or job.user_id != user_id:
                raise CustomException(404, "Job description not found")
            job_analysis = await self._ensure_jd_analysis(job)
        else:
            job_analysis = {}

        interview = await self._query.create(payload, user_id)
        count = max(1, min(20, payload.question_count))
        try:
            questions = await self._ai.generate_interview_questions(
            resume_analysis,
            job_analysis,
            payload.difficulty,
                count,
                payload.question_types or ["technical"],
            )
        except Exception:
            # Do not leave an orphan PENDING interview with no questions.
            await self._db.delete(interview)
            await self._db.commit()
            raise
        for idx, q in enumerate(questions):
            raw_type = (q.get("question_type") or "technical").lower()
            q_type = QuestionType.BEHAVIORAL
            if raw_type == "technical":
                q_type = QuestionType.TECHNICAL
            db_question = InterviewQuestion(
                interview_id=interview.id,
                question_text=q["question"],
                question_type=q_type,
                difficulty=q.get("difficulty", "medium"),
                order=idx,
                topic=q.get("topic"),
                expected_focus=q.get("expected_focus"),
                category=raw_type,
            )
            self._db.add(db_question)
        interview.status = InterviewStatus.IN_PROGRESS
        await self._db.commit()
        await self._db.refresh(interview)
        stmt = (
            select(InterviewQuestion)
            .where(InterviewQuestion.interview_id == interview.id)
            .order_by(InterviewQuestion.order)
        )
        result = await self._db.exec(stmt)
        interview.questions = result.all()
        return InterviewResponse.model_validate(interview)

    async def list_interviews(
        self, user_id: uuid.UUID
    ) -> List[InterviewResponse]:
        interviews = await self._query.get_all(user_id)
        return [
            InterviewResponse.model_validate(i) for i in interviews
        ]

    async def get_interview(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        return InterviewResponse.model_validate(interview)

    async def update_interview_mode(
        self,
        user_id: uuid.UUID,
        interview_id: uuid.UUID,
        mode: InterviewModeModel,
    ) -> InterviewResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        if interview.status == InterviewStatus.COMPLETED:
            raise CustomException(
                400, "Cannot change the mode of a completed interview"
            )
        interview.interview_mode = mode
        interview = await self._query.save(interview)
        return InterviewResponse.model_validate(interview)

    async def submit_answer(
        self,
        user_id: uuid.UUID,
        interview_id: uuid.UUID,
        answer: InterviewAnswerSchema,
    ) -> SubmitAnswerResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        if interview.status == InterviewStatus.COMPLETED:
            raise CustomException(400, "Interview is already completed")

        question_ids = {q.id for q in interview.questions}
        question_id = answer.question_id
        if question_id not in question_ids:
            raise CustomException(
                400, "Question does not belong to this interview"
            )

        existing = await self._query.get_answer_for_question(
            interview.id, question_id
        )
        if existing:
            raise CustomException(400, "Answer already submitted for this question")

        answer_text = answer.answer_text.strip()
        # AUDIO/VIDEO answers are spoken — typed input is optional scratch
        # notes, never the evaluated answer. Every non-skipped voice submit
        # is a placeholder awaiting its recording; the transcript is the
        # only text evaluated or persisted as the answer.
        voice_placeholder = (
            not answer.skipped
            and interview.interview_mode != InterviewModeModel.TEXT
        )
        if voice_placeholder:
            answer_text = ""
        if not answer_text and not answer.skipped and not voice_placeholder:
            raise CustomException(400, "Answer cannot be empty")
        if len(answer.answer_text) > _MAX_ANSWER_LENGTH:
            raise CustomException(400, "Answer exceeds maximum length")

        question = next(q for q in interview.questions if q.id == question_id)
        db_answer = InterviewAnswer(
            interview_id=interview.id,
            question_id=question_id,
            answer_text=answer_text,
        )
        db_answer.media = None
        self._db.add(db_answer)
        try:
            await self._db.commit()
        except IntegrityError:
            await self._db.rollback()
            raise CustomException(
                400, "Answer already submitted for this question"
            )
        await self._db.refresh(db_answer)

        # Empty voice placeholders are evaluated after transcription in
        # upload_answer_media — never evaluate a placeholder.
        evaluation_schema: Optional[InterviewAnswerEvaluation] = None
        follow_up_question: Optional[InterviewQuestion] = None
        if not voice_placeholder:
            (
                evaluation_schema,
                follow_up_question,
            ) = await self._evaluate_and_follow_up(
                interview, question, db_answer
            )

        await self._db.refresh(interview)
        # A generated follow-up is delivered as the immediate next question
        # (persisted order stays unchanged at the end of the list).
        next_q = (
            follow_up_question
            if follow_up_question is not None
            else await self._get_next_question(interview)
        )
        is_complete = next_q is None

        return SubmitAnswerResponse(
            answer=InterviewAnswerResponse.model_validate(db_answer),
            evaluation=evaluation_schema,
            next_question=InterviewQuestionResponse.model_validate(next_q)
            if next_q
            else None,
            follow_up_generated=follow_up_question is not None,
            is_complete=is_complete,
            message="Answer submitted",
        )

    async def upload_answer_media(
        self,
        user_id: uuid.UUID,
        interview_id: uuid.UUID,
        answer_id: uuid.UUID,
        file: UploadFile,
        duration_seconds: Optional[float] = None,
        pause_count: Optional[int] = None,
        pause_total_seconds: Optional[float] = None,
        pause_longest_seconds: Optional[float] = None,
        speech_seconds: Optional[float] = None,
    ) -> InterviewAnswerMediaResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        if interview.status == InterviewStatus.COMPLETED:
            raise CustomException(
                400, "Cannot upload media to a completed interview"
            )
        if duration_seconds is not None and duration_seconds <= 0:
            duration_seconds = None
        if interview.interview_mode == InterviewModeModel.TEXT:
            raise CustomException(
                400, "This interview does not accept recordings"
            )

        answer = await self._query.get_answer_by_id(answer_id)
        if not answer or answer.interview_id != interview.id:
            raise CustomException(404, "Answer not found")

        raw_mime = (file.content_type or "").split(";")[0].strip().lower()
        if raw_mime not in _ALLOWED_MEDIA_MIME_TYPES:
            raise CustomException(415, "Unsupported recording format")
        media_kind = (
            MediaKind.AUDIO if raw_mime.startswith("audio/") else MediaKind.VIDEO
        )
        expected_kind = (
            MediaKind.VIDEO
            if interview.interview_mode == InterviewModeModel.VIDEO
            else MediaKind.AUDIO
        )
        if media_kind != expected_kind:
            raise CustomException(
                400,
                f"This interview requires a {expected_kind.value.lower()} recording",
            )

        settings = get_settings()
        max_bytes = settings.INTERVIEW_MEDIA_MAX_MB * 1024 * 1024
        declared = getattr(file, "size", None)
        if declared is not None and declared > max_bytes:
            raise CustomException(
                413,
                f"Recording must be {settings.INTERVIEW_MEDIA_MAX_MB} MB or smaller",
            )
        content = await file.read(max_bytes + 1)
        if not content:
            raise CustomException(400, "Recording is empty")
        if len(content) > max_bytes:
            raise CustomException(
                413,
                f"Recording must be {settings.INTERVIEW_MEDIA_MAX_MB} MB or smaller",
            )

        media = await self._query.get_media_for_answer(answer.id)
        if media is None:
            extension = _MEDIA_EXTENSIONS.get(raw_mime, "bin")
            media = InterviewAnswerMediaModel(
                answer_id=answer.id,
                interview_id=interview.id,
                media_type=media_kind,
                mime_type=raw_mime,
                storage_key=(
                    f"interviews/{user_id}/{interview.id}/{answer.id}/"
                    f"{uuid.uuid4()}.{extension}"
                ),
                file_size=len(content),
                duration_seconds=duration_seconds,
                status=MediaUploadStatus.PENDING,
            )
        else:
            media.media_type = media_kind
            media.mime_type = raw_mime
            media.file_size = len(content)
            media.duration_seconds = duration_seconds
            media.status = MediaUploadStatus.PENDING

        try:
            await anyio.to_thread.run_sync(
                upload_media_file, media.storage_key, content, raw_mime
            )
        except Exception:
            media.status = MediaUploadStatus.FAILED
            try:
                await self._query.save_media(media)
            except IntegrityError:
                # A concurrent upload created the media row first — the
                # persisted FAILED state wins over this in-memory insert.
                await self._db.rollback()
            self._db.expire(answer, ["media"])
            raise

        media.status = MediaUploadStatus.UPLOADED
        media.uploaded_at = datetime.now(timezone.utc)
        try:
            media = await self._query.save_media(media)
        except IntegrityError:
            # A concurrent upload created the media row first — adopt it and
            # re-upload to its server-generated key (upsert makes the
            # overwrite safe and scoped to this answer only). rollback()
            # expires every loaded object, so refetch answer and interview
            # instead of reusing the expired instances.
            await self._db.rollback()
            interview = await self._query.get_by_id(interview_id)
            answer = await self._query.get_answer_by_id(answer_id)
            media = await self._query.get_media_for_answer(answer_id)
            if media is None:
                raise
            media.media_type = media_kind
            media.mime_type = raw_mime
            media.file_size = len(content)
            media.duration_seconds = duration_seconds
            await anyio.to_thread.run_sync(
                upload_media_file, media.storage_key, content, raw_mime
            )
            media.status = MediaUploadStatus.UPLOADED
            media.uploaded_at = datetime.now(timezone.utc)
            media = await self._query.save_media(media)

        # Voice-first pipeline: transcribe the just-uploaded bytes (no
        # storage round-trip), then evaluate the transcript exactly like a
        # typed answer. Retries skip a completed transcription and an
        # existing evaluation so nothing is duplicated.
        if media.transcription_status != TranscriptionStatus.COMPLETED:
            try:
                media = await self._transcribe_media(
                    media, content, raw_mime
                )
            except Exception:
                # Keep the failure state visible to later reads in this
                # session — same identity-map behavior as upload failure.
                self._db.expire(answer, ["media"])
                raise

        return await self._finalize_media_answer(
            interview,
            answer,
            media,
            sanitize_pause_stats(
                media.duration_seconds,
                pause_count,
                pause_total_seconds,
                pause_longest_seconds,
                speech_seconds,
            ),
        )

    async def reprocess_answer_media(
        self,
        user_id: uuid.UUID,
        interview_id: uuid.UUID,
        answer_id: uuid.UUID,
    ) -> InterviewAnswerMediaSubmitResponse:
        """Re-run transcription/evaluation for a recording already in
        storage — lets a candidate recover from an interrupted upload
        without re-recording."""
        interview = await self._get_owned_interview(user_id, interview_id)
        if interview.status == InterviewStatus.COMPLETED:
            raise CustomException(
                400, "Cannot process media for a completed interview"
            )
        if interview.interview_mode == InterviewModeModel.TEXT:
            raise CustomException(
                400, "This interview does not accept recordings"
            )
        answer = await self._query.get_answer_by_id(answer_id)
        if not answer or answer.interview_id != interview.id:
            raise CustomException(404, "Answer not found")
        media = await self._query.get_media_for_answer(answer.id)
        if media is None or media.status != MediaUploadStatus.UPLOADED:
            raise CustomException(404, "No stored recording to process")

        content = await anyio.to_thread.run_sync(
            download_media_file, media.storage_key
        )
        if media.transcription_status != TranscriptionStatus.COMPLETED:
            media = await self._transcribe_media(
                media, content, media.mime_type
            )

        return await self._finalize_media_answer(
            interview,
            answer,
            media,
            sanitize_pause_stats(
                media.duration_seconds, None, None, None, None
            ),
        )

    async def _finalize_media_answer(
        self,
        interview: InterviewModel,
        answer: InterviewAnswer,
        media: InterviewAnswerMediaModel,
        pause_stats: Dict[str, Optional[float]],
    ) -> InterviewAnswerMediaSubmitResponse:
        """Shared tail of the media pipeline: adopt the transcript as the
        answer text, run speech analysis, evaluate if needed, and resolve
        the next question — a generated follow-up is delivered immediately."""
        if (
            media.transcription_status == TranscriptionStatus.COMPLETED
            and media.transcript_text
        ):
            answer.answer_text = media.transcript_text
            self._db.add(answer)
            await self._db.commit()
            await self._db.refresh(answer)

        question = next(
            (q for q in interview.questions if q.id == answer.question_id),
            None,
        )

        # Phase 7E — speech analysis: deterministic metrics plus Gemini
        # communication observations on the transcript already in hand.
        # Never retranscribes; a completed analysis is left untouched; an AI
        # failure records status=FAILED without failing the upload.
        analysis_row: Optional[InterviewAnswerSpeechAnalysisModel] = None
        if media.transcript_text:
            analysis_row = await self._analyze_speech(
                interview, question, answer, media, pause_stats
            )

        evaluation_schema: Optional[InterviewAnswerEvaluation] = None
        follow_up_question: Optional[InterviewQuestion] = None
        if answer.evaluation:
            evaluation_schema = InterviewAnswerEvaluation.model_validate(
                answer.evaluation
            )
        elif answer.answer_text.strip() and question is not None:
            (
                evaluation_schema,
                follow_up_question,
            ) = await self._evaluate_and_follow_up(
                interview, question, answer
            )
            await self._db.refresh(interview)

        next_q = (
            follow_up_question
            if follow_up_question is not None
            else await self._get_next_question(interview)
        )
        is_complete = next_q is None

        # Attach the just-saved media and its analysis in memory — the
        # intervening refresh() calls expire relationship attributes, so
        # both must be attached after them to serialize without a lazy load
        # in the async session. refresh(interview) can also cascade-expire
        # media through the eager-loaded answers collection, so reload
        # media's columns before model_validate reads them in sync code.
        await self._db.refresh(media)
        answer.media = media
        media.speech_analysis = analysis_row
        return InterviewAnswerMediaSubmitResponse(
            media=InterviewAnswerMediaResponse.model_validate(media),
            answer=InterviewAnswerResponse.model_validate(answer),
            evaluation=evaluation_schema,
            next_question=InterviewQuestionResponse.model_validate(next_q)
            if next_q
            else None,
            follow_up_generated=follow_up_question is not None,
            is_complete=is_complete,
            message="Recording processed",
        )

    async def complete_interview(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewResultResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        if interview.result is not None:
            return InterviewResultResponse.model_validate(interview.result)
        if not interview.answers:
            raise CustomException(
                400, "Cannot complete an interview with no answers"
            )
        if any(
            a.media is not None
            and a.media.transcription_status == TranscriptionStatus.PENDING
            for a in interview.answers
        ):
            raise CustomException(
                409,
                "A recording is still being transcribed. "
                "Please wait a moment and try again.",
            )

        report = await self._generate_report(interview)
        result = InterviewResultModel(
            interview_id=interview.id,
            score=report.score,
            feedback=report.feedback,
            strengths=report.strengths,
            weaknesses=report.weaknesses,
            technical_score=report.technical_score,
            communication_score=report.communication_score,
            relevance_score=report.relevance_score,
            problem_solving_score=report.problem_solving_score,
            resume_alignment=report.resume_alignment,
            missing_skills=report.missing_skills,
            suggestions=report.suggestions,
            preparation_topics=report.preparation_topics,
            question_results=report.question_results,
            completion_summary=report.completion_summary,
            overall_feedback=report.overall_feedback,
            confidence=report.confidence,
            uncertainty_notes=report.uncertainty_notes,
        )
        self._db.add(result)
        interview.status = InterviewStatus.COMPLETED
        interview.completed_at = datetime.now(timezone.utc)
        try:
            await self._db.commit()
        except IntegrityError:
            await self._db.rollback()
            existing = await self._query.get_by_id(interview.id)
            if existing is None or existing.result is None:
                raise
            return InterviewResultResponse.model_validate(existing.result)
        await self._db.refresh(result)
        return InterviewResultResponse.model_validate(result)

    async def _generate_report(
        self, interview: InterviewModel
    ) -> InterviewResultSchema:
        resume_analysis, jd_analysis, match_data = await self._load_context(interview)
        qa_data: List[Dict[str, Any]] = []
        for answer in interview.answers:
            question = next(
                (q for q in interview.questions if q.id == answer.question_id), None
            )
            qa_data.append(
                {
                    "question_id": str(answer.question_id),
                    "question": question.question_text if question else "",
                    "answer": answer.answer_text,
                    "evaluation": answer.evaluation or {},
                    "score": answer.score,
                }
            )

        config = {
            "difficulty": interview.difficulty,
            "question_count": interview.question_count,
            "duration": interview.duration,
            "question_types": interview.question_types,
            "answered_count": len(interview.answers),
            "total_questions": len(interview.questions),
        }

        try:
            report = await self._ai.generate_interview_report(
                config,
                resume_analysis,
                jd_analysis,
                match_data or {},
                qa_data,
            )
        except Exception:
            answered = len(interview.answers)
            total = max(1, len(interview.questions))
            avg_score = 0.0
            if answered:
                scores = [a.score for a in interview.answers if a.score is not None]
                avg_score = sum(scores) / len(scores) if scores else 0.0
            answered = len(interview.answers)
            skipped = 0
            total = len(interview.questions)
            return InterviewResultSchema(
                interview_id=interview.id,
                score=avg_score,
                feedback="Final report generation is unavailable. Based on submitted answers, additional review may be needed.",
                strengths=[],
                weaknesses=["Report generation failed"],
                confidence=0.0,
                uncertainty_notes="Could not generate a full report at this time.",
                total_questions=total,
                answered=answered,
                skipped=skipped,
            )

        return InterviewResultSchema(
            interview_id=interview.id,
            score=float(report.overall_score),
            feedback=report.overall_feedback or report.answer_quality_summary,
            strengths=report.strengths,
            weaknesses=report.weaknesses,
            technical_score=float(report.technical_score)
            if report.technical_score is not None
            else None,
            communication_score=float(report.communication_score)
            if report.communication_score is not None
            else None,
            relevance_score=float(report.relevance_score)
            if report.relevance_score is not None
            else None,
            problem_solving_score=float(report.problem_solving_score)
            if report.problem_solving_score is not None
            else None,
            resume_alignment=report.resume_alignment,
            missing_skills=report.missing_or_weak_skills,
            suggestions=report.recommended_preparation_topics,
            preparation_topics=report.recommended_preparation_topics,
            question_results=[q.model_dump(mode="json") for q in report.question_wise_summary],
            completion_summary=report.interview_completion_summary,
            overall_feedback=report.overall_feedback,
            confidence=float(report.confidence),
            uncertainty_notes=report.uncertainty_notes,
            total_questions=len(interview.questions),
            answered=sum(1 for a in interview.answers if a.answer_text.strip()),
            skipped=sum(1 for a in interview.answers if not a.answer_text.strip()),
        )

    # ------------------------------------------------------------------
    # Phase 7F — aggregated interview report (read model, never regenerates)
    # ------------------------------------------------------------------

    @staticmethod
    def _classify_answer_status(
        answer: Optional[InterviewAnswer],
        interview_mode: InterviewModeModel,
    ) -> ReportAnswerStatus:
        """Derive the per-question answer state for report display.

        An AUDIO/VIDEO voice placeholder (empty text awaiting a recording, or
        a recording awaiting/failed transcription) is reported as
        pending/unavailable — never misclassified as skipped.
        """
        if answer is None:
            return ReportAnswerStatus.UNAVAILABLE
        if answer.answer_text.strip():
            return ReportAnswerStatus.ANSWERED
        media = answer.media
        if interview_mode == InterviewModeModel.TEXT:
            # TEXT has no voice placeholder — an empty answer was skipped.
            return ReportAnswerStatus.SKIPPED
        if media is None:
            return ReportAnswerStatus.PENDING
        if (
            media.status == MediaUploadStatus.FAILED
            or media.transcription_status == TranscriptionStatus.FAILED
        ):
            return ReportAnswerStatus.UNAVAILABLE
        if media.transcription_status == TranscriptionStatus.COMPLETED:
            return ReportAnswerStatus.UNAVAILABLE
        return ReportAnswerStatus.PENDING

    @staticmethod
    def _build_report_question(
        question: InterviewQuestion,
        answer: Optional[InterviewAnswer],
        interview_mode: InterviewModeModel,
    ) -> ReportQuestionBlock:
        evaluation = None
        if answer is not None and answer.evaluation:
            try:
                evaluation = InterviewAnswerEvaluation.model_validate(
                    answer.evaluation
                )
            except Exception:
                evaluation = None

        media_info: Optional[ReportMediaInfo] = None
        speech: Optional[SpeechAnalysisResponse] = None
        if answer is not None and answer.media is not None:
            media = answer.media
            media_info = ReportMediaInfo(
                transcription_status=media.transcription_status,
                transcript_text=media.transcript_text,
                duration_seconds=media.duration_seconds,
            )
            if media.speech_analysis is not None:
                speech = SpeechAnalysisResponse.model_validate(
                    media.speech_analysis
                )

        return ReportQuestionBlock(
            question_id=question.id,
            order=question.order,
            question_text=question.question_text,
            question_type=question.question_type,
            difficulty=question.difficulty,
            topic=question.topic,
            category=question.category,
            expected_focus=question.expected_focus,
            is_follow_up=question.is_follow_up,
            parent_question_id=question.parent_question_id,
            follow_up_reason=question.follow_up_reason,
            answer_id=answer.id if answer else None,
            answer_text=(
                answer.answer_text if answer and answer.answer_text else None
            ),
            answer_status=Interview._classify_answer_status(
                answer, interview_mode
            ),
            score=answer.score if answer else None,
            evaluated_at=answer.evaluated_at if answer else None,
            evaluation=evaluation,
            media=media_info,
            speech_analysis=speech,
        )

    @staticmethod
    def _communication_aggregate(
        answers: List[InterviewAnswer],
    ) -> CommunicationAggregate:
        """Aggregate completed speech analyses; failed/missing rows are ignored."""
        analyses = [
            a.media.speech_analysis
            for a in answers
            if a.media is not None
            and a.media.speech_analysis is not None
            and a.media.speech_analysis.status == SpeechAnalysisStatus.COMPLETED
        ]
        if not analyses:
            return CommunicationAggregate()

        def _avg(values: List[float]) -> Optional[float]:
            return (
                round(sum(values) / len(values), 1) if values else None
            )

        definite = 0
        possible = 0
        for analysis in analyses:
            breakdown = analysis.filler_breakdown or {}
            for entry in breakdown.values():
                if not isinstance(entry, dict):
                    continue
                count = entry.get("count")
                if not isinstance(count, (int, float)):
                    continue
                if entry.get("ambiguous"):
                    possible += int(count)
                else:
                    definite += int(count)

        pauses = [
            a.pause_total_seconds
            for a in analyses
            if a.pause_total_seconds is not None
        ]
        return CommunicationAggregate(
            answers_analyzed=len(analyses),
            avg_wpm_recording=_avg(
                [a.wpm_recording for a in analyses if a.wpm_recording is not None]
            ),
            avg_wpm_speech=_avg(
                [a.wpm_speech for a in analyses if a.wpm_speech is not None]
            ),
            definite_filler_total=definite,
            possible_filler_total=possible,
            total_pause_seconds=(
                round(sum(pauses), 3) if pauses else None
            ),
        )

    async def get_report(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewReportResponse:
        """Compose the aggregated report for a completed interview.

        Read-only assembly of persisted data — questions, answers,
        evaluations, media/transcripts, speech analyses, and proctoring
        events. Never re-scores, re-evaluates, or calls the AI provider.
        """
        interview = await self._get_owned_interview(user_id, interview_id)
        # Query the result row directly — the relationship can hold a stale
        # "loaded as None" state when the same session completed the interview.
        stmt = select(InterviewResultModel).where(
            InterviewResultModel.interview_id == interview.id
        )
        result = (await self._db.exec(stmt)).first()
        if interview.status != InterviewStatus.COMPLETED or result is None:
            raise CustomException(404, "Interview report is not available")

        owner = await UserQuery(self._db).get_by_id(interview.user_id)
        candidate_name = owner.full_name if owner else ""

        job_title: Optional[str] = None
        company: Optional[str] = None
        if interview.job_description_id:
            job = await JobDescriptionQuery(self._db).get_by_id(
                interview.job_description_id
            )
            if job:
                job_title = job.title or (
                    (job.analysis or {}).get("job_title") or None
                )
                company = job.company

        questions = sorted(interview.questions, key=lambda q: q.order)
        answers_by_question = {a.question_id: a for a in interview.answers}
        blocks = [
            self._build_report_question(
                q, answers_by_question.get(q.id), interview.interview_mode
            )
            for q in questions
        ]
        counts = {
            ReportAnswerStatus.ANSWERED: 0,
            ReportAnswerStatus.SKIPPED: 0,
            ReportAnswerStatus.PENDING: 0,
            ReportAnswerStatus.UNAVAILABLE: 0,
        }
        for block in blocks:
            counts[block.answer_status] += 1

        elapsed: Optional[float] = None
        if interview.completed_at and interview.created_at:
            elapsed = max(
                0.0,
                (
                    self._aware(interview.completed_at)
                    - self._aware(interview.created_at)
                ).total_seconds(),
            )

        voice_mode = interview.interview_mode != InterviewModeModel.TEXT
        communication = (
            self._communication_aggregate(interview.answers)
            if voice_mode
            else None
        )

        session_integrity: Optional[SessionIntegrityReport] = None
        if voice_mode:
            events = await self._query.get_proctoring_events(interview.id)
            session_integrity = SessionIntegrityReport(
                summary=self._compute_proctoring_summary(interview, events),
                events=[
                    ReportProctoringEvent(
                        event_type=e.event_type,
                        severity=e.severity,
                        started_at=e.started_at,
                        ended_at=e.ended_at,
                        duration_seconds=e.duration_seconds,
                        question_id=e.question_id,
                    )
                    for e in events
                ],
                disclaimer=_PROCTORING_DISCLAIMER,
            )

        return InterviewReportResponse(
            report_id=result.id,
            generated_at=result.created_at,
            candidate_name=candidate_name,
            job_title=job_title,
            company=company,
            overview=ReportOverview(
                interview_id=interview.id,
                title=interview.title,
                interview_mode=interview.interview_mode,
                difficulty=interview.difficulty,
                status=interview.status,
                created_at=interview.created_at,
                completed_at=interview.completed_at,
                configured_duration_minutes=interview.duration,
                elapsed_seconds=elapsed,
                total_questions=len(questions),
                answered_count=counts[ReportAnswerStatus.ANSWERED],
                skipped_count=counts[ReportAnswerStatus.SKIPPED],
                pending_count=counts[ReportAnswerStatus.PENDING],
                unavailable_count=counts[ReportAnswerStatus.UNAVAILABLE],
                follow_up_count=sum(1 for q in questions if q.is_follow_up),
            ),
            result=InterviewResultResponse.model_validate(result),
            questions=blocks,
            communication=communication,
            session_integrity=session_integrity,
        )

    async def acknowledge_proctoring_consent(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewResponse:
        """Record when the candidate acknowledged session monitoring.

        Idempotent — the earliest acknowledgement is kept.
        """
        interview = await self._get_owned_interview(user_id, interview_id)
        if interview.proctoring_consent_at is None:
            interview.proctoring_consent_at = datetime.now(timezone.utc)
            interview = await self._query.save(interview)
        return InterviewResponse.model_validate(interview)

    @staticmethod
    def _aware(dt: datetime) -> datetime:
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)

    def _build_proctoring_row(
        self,
        interview: InterviewModel,
        question_ids: set,
        event: ProctoringEventIn,
        now: datetime,
        earliest: datetime,
    ) -> Optional[InterviewProctoringEventModel]:
        """Validate one submitted event into a model row, or None to reject.

        Never raises — a malformed event must not sink the whole batch.
        """
        started_at = self._aware(event.started_at)
        ended_at = self._aware(event.ended_at) if event.ended_at else None
        if ended_at is not None:
            if ended_at < started_at:
                return None
            if ended_at > now + _PROCTORING_FUTURE_SKEW:
                return None
        if started_at > now + _PROCTORING_FUTURE_SKEW:
            return None
        if started_at < earliest:
            return None

        duration = event.duration_seconds
        if duration is None and ended_at is not None:
            duration = round((ended_at - started_at).total_seconds(), 3)
        elif duration is not None and ended_at is not None:
            window = (ended_at - started_at).total_seconds()
            if abs(duration - window) > _DURATION_CONSISTENCY_TOLERANCE_SECONDS:
                return None

        metadata = None
        if event.event_metadata:
            metadata = {
                k: v
                for k, v in event.event_metadata.items()
                if k in _PROCTORING_METADATA_ALLOWED_KEYS
                and isinstance(v, (str, int, float, bool))
            }
            try:
                if len(json.dumps(metadata).encode("utf-8")) > (
                    _PROCTORING_METADATA_MAX_BYTES
                ):
                    return None
            except (TypeError, ValueError):
                return None

        severity = event.severity
        if severity is None:
            severity = _DEFAULT_PROCTORING_SEVERITY[
                ProctoringEventTypeModel(event.event_type.value)
            ]

        return InterviewProctoringEventModel(
            interview_id=interview.id,
            user_id=interview.user_id,
            question_id=(
                event.question_id if event.question_id in question_ids else None
            ),
            client_event_id=event.client_event_id,
            event_type=ProctoringEventTypeModel(event.event_type.value),
            severity=ProctoringSeverityModel(severity.value),
            started_at=started_at,
            ended_at=ended_at,
            duration_seconds=duration,
            event_metadata=metadata or None,
        )

    async def submit_proctoring_events(
        self,
        user_id: uuid.UUID,
        interview_id: uuid.UUID,
        payload: ProctoringEventBatchIn,
    ) -> ProctoringEventBatchResponse:
        """Persist a batch of client-reported proctoring events.

        Retries are idempotent via (interview_id, client_event_id). Completed
        interviews and limit breaches return a graceful 200 with zero accepted
        so pagehide flushes do not error-loop on the client.
        """
        interview = await self._get_owned_interview(user_id, interview_id)
        events = payload.events
        if not events:
            return ProctoringEventBatchResponse()

        if interview.status == InterviewStatus.COMPLETED:
            return ProctoringEventBatchResponse(
                rejected=len(events),
                message="Interview is completed; events were not recorded",
            )

        existing_count = await self._query.count_proctoring_events(interview.id)
        if existing_count >= _MAX_PROCTORING_EVENTS_PER_INTERVIEW:
            return ProctoringEventBatchResponse(
                rejected=len(events),
                limit_reached=True,
                message="Proctoring event limit reached",
            )

        existing_ids = await self._query.get_existing_proctoring_client_ids(
            interview.id, [e.client_event_id for e in events]
        )
        question_ids = {q.id for q in interview.questions}
        now = datetime.now(timezone.utc)
        created = self._aware(interview.created_at) if interview.created_at else now
        earliest = created - _PROCTORING_PAST_SKEW

        rows: List[InterviewProctoringEventModel] = []
        accepted = duplicates = rejected = 0
        limit_reached = False
        seen_in_batch = set()
        for event in events:
            if existing_count + accepted >= _MAX_PROCTORING_EVENTS_PER_INTERVIEW:
                limit_reached = True
                rejected += 1
                continue
            if (
                event.client_event_id in existing_ids
                or event.client_event_id in seen_in_batch
            ):
                duplicates += 1
                continue
            row = self._build_proctoring_row(
                interview, question_ids, event, now, earliest
            )
            if row is None:
                rejected += 1
                continue
            seen_in_batch.add(event.client_event_id)
            rows.append(row)
            accepted += 1

        if rows:
            self._db.add_all(rows)
            try:
                await self._db.commit()
            except IntegrityError:
                # Rare: a concurrent batch raced the uniqueness check. Retry
                # row-by-row so valid events are still recorded.
                await self._db.rollback()
                accepted = duplicates = 0
                for row in rows:
                    self._db.add(row)
                    try:
                        await self._db.commit()
                    except IntegrityError:
                        await self._db.rollback()
                        duplicates += 1
                    else:
                        accepted += 1

        return ProctoringEventBatchResponse(
            accepted=accepted,
            duplicates=duplicates,
            rejected=rejected,
            limit_reached=limit_reached,
        )

    async def list_proctoring_events(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> List[ProctoringEventResponse]:
        interview = await self._get_owned_interview(user_id, interview_id)
        events = await self._query.get_proctoring_events(interview.id)
        return [
            ProctoringEventResponse.model_validate(e) for e in events
        ]

    async def proctoring_summary(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> ProctoringSummaryResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        events = await self._query.get_proctoring_events(interview.id)
        return self._compute_proctoring_summary(interview, events)

    def _compute_proctoring_summary(
        self, interview: InterviewModel, events
    ) -> ProctoringSummaryResponse:
        counts: Dict[str, int] = {}
        durations: Dict[str, float] = {}
        first: Optional[datetime] = None
        last: Optional[datetime] = None
        for event in events:
            key = event.event_type.value
            counts[key] = counts.get(key, 0) + 1
            if event.duration_seconds:
                durations[key] = round(
                    durations.get(key, 0.0) + event.duration_seconds, 3
                )
            start = self._aware(event.started_at)
            end = self._aware(event.ended_at) if event.ended_at else start
            first = start if first is None or start < first else first
            last = end if last is None or end > last else last

        return ProctoringSummaryResponse(
            interview_id=interview.id,
            total_events=len(events),
            counts=counts,
            durations_seconds=durations,
            first_event_at=first,
            last_event_at=last,
            event_window_seconds=(
                round((last - first).total_seconds(), 3)
                if first is not None and last is not None
                else None
            ),
            consent_acknowledged_at=interview.proctoring_consent_at,
        )

    async def _get_owned_interview(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewModel:
        interview = await self._query.get_by_id(interview_id)
        if not interview or interview.user_id != user_id:
            raise CustomException(404, "Interview not found")
        return interview
