"""Application-facing AI service.

Centralizes all model-backed operations: resume analysis, JD analysis,
resume-to-JD matching, and interview question generation. The service speaks to
one provider (Gemini) and returns validated Pydantic objects.
"""
import json
from typing import Any, Dict, List

from app.services.ai.gemini_provider import GeminiProvider
from app.services.ai.schemas import (
    InterviewQuestionsOutput,
    JobDescriptionAnalysisOutput,
    ResumeAnalysisOutput,
    ResumeJDMatchOutput,
)

_RESUME_PROMPT = """You are an expert resume reviewer. Given the resume text below, extract structured facts.
Rules:
- Only include information reasonably supported by the resume text.
- If a field cannot be filled from the text, return an empty string or empty list.
- Do not invent, infer, or hallucinate skills, jobs, or education.
- Return concise, accurate JSON matching the requested schema.

Resume text:
---
{text}
---
"""

_JD_PROMPT = """You are an expert job description analyzer. Given the JD text below, extract structured facts.
Rules:
- Only include requirements, skills, and responsibilities explicitly stated in the text.
- If a field cannot be filled, return an empty string or empty list.
- Do not invent benefits, technologies, or experience levels not in the text.
- Return concise, accurate JSON matching the requested schema.

Job description:
---
{text}
---
"""

_MATCH_PROMPT = """You are an expert technical recruiter. Compare the candidate's resume analysis with the job description analysis and produce a compatibility assessment.
Rules:
- Score must be an integer between 0 and 100.
- matched_skills are skills the candidate has that also appear in the JD.
- missing_skills are JD requirements not strongly supported by the resume.
- strengths are the candidate's clear advantages for this role.
- gaps are concrete differences or missing qualifications.
- recommendations are 2-4 actionable next steps for the candidate.
- Do not hallucinate skills; only use the provided analyses.

Resume analysis:
{resume}

Job description analysis:
{jd}
"""

_QUESTIONS_PROMPT = """You are an expert technical interviewer. Generate a personalized interview for the candidate below.
Rules:
- Each question must be relevant to the job description and the candidate's stated skills/experience.
- Use the requested difficulty level where appropriate.
- Mix technical and behavioral questions according to the requested question types.
- Do not ask about skills not present in the resume unless required by the JD.
- Return exactly the requested number of questions.

Resume analysis:
{resume}

Job description analysis:
{jd}

Configuration:
- difficulty: {difficulty}
- number of questions: {count}
- question types: {question_types}
"""


class AIProviderInterface:
    """Minimal protocol the AI service depends on."""

    async def complete_json(self, prompt: str, response_schema: Any) -> Any:
        raise NotImplementedError


class AIService:
    def __init__(self, provider: AIProviderInterface | None = None):
        self._provider = provider or GeminiProvider()

    async def analyze_resume(self, resume_text: str) -> ResumeAnalysisOutput:
        prompt = _RESUME_PROMPT.format(text=resume_text[:30000])
        return await self._provider.complete_json(prompt, ResumeAnalysisOutput)

    async def analyze_job_description(self, jd_text: str) -> JobDescriptionAnalysisOutput:
        prompt = _JD_PROMPT.format(text=jd_text[:20000])
        return await self._provider.complete_json(prompt, JobDescriptionAnalysisOutput)

    async def match_resume_jd(
        self,
        resume_analysis: Dict[str, Any],
        jd_analysis: Dict[str, Any],
    ) -> ResumeJDMatchOutput:
        prompt = _MATCH_PROMPT.format(
            resume=json.dumps(resume_analysis, ensure_ascii=False, indent=2),
            jd=json.dumps(jd_analysis, ensure_ascii=False, indent=2),
        )
        return await self._provider.complete_json(prompt, ResumeJDMatchOutput)

    async def generate_interview_questions(
        self,
        resume_analysis: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        difficulty: str,
        count: int,
        question_types: List[str],
    ) -> List[Dict[str, Any]]:
        prompt = _QUESTIONS_PROMPT.format(
            resume=json.dumps(resume_analysis, ensure_ascii=False, indent=2),
            jd=json.dumps(jd_analysis, ensure_ascii=False, indent=2),
            difficulty=difficulty,
            count=count,
            question_types=", ".join(question_types),
        )
        output = await self._provider.complete_json(prompt, InterviewQuestionsOutput)
        return [q.model_dump() for q in output.questions]
