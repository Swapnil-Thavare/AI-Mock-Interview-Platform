"""Application-facing AI service.

Centralizes all model-backed operations: resume analysis, JD analysis,
resume-to-JD matching, and interview question generation. The service speaks to
one provider (Gemini) and returns validated Pydantic objects.
"""
import json
from typing import Any, Dict, List

from app.services.ai.gemini_provider import GeminiProvider
from app.services.ai.schemas import (
    AnswerEvaluationOutput,
    FollowUpQuestionOutput,
    InterviewQuestionsOutput,
    InterviewReportOutput,
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

_ANSWER_EVAL_PROMPT = """You are an expert technical interviewer evaluating a candidate's answer.
Evaluate ONLY the supplied question and answer. Use the resume and job description as context, but do not invent candidate experience.
Rules:
- Distinguish between incorrect, incomplete, and acceptable answers.
- If the candidate says "I don't know" or the answer is empty, evaluate honestly with low scores and explain what was missing.
- Avoid judging protected personal characteristics or making unsupported hiring decisions.
- Use cautious language such as "Based on the submitted answer..." and "Additional evidence may be needed...".
- If you cannot confidently evaluate the answer, set confidence below 50 and explain in uncertainty_notes.
- Return structured JSON only.

Interview difficulty: {difficulty}

Question:
{question}

Expected focus:
{expected_focus}

Candidate answer:
{answer}

Resume analysis:
{resume}

Job description analysis:
{jd}
"""

_FOLLOW_UP_PROMPT = """You are an expert technical interviewer generating ONE adaptive follow-up question.
Rules:
- The follow-up must be relevant to the previous question and the candidate's answer.
- Do not repeat the previous question.
- Ground the follow-up in the resume and job description context.
- Match the selected difficulty level.
- Target a specific gap, missing point, or unclear area from the evaluation.
- Return structured JSON only.

Previous question:
{question}

Candidate answer:
{answer}

Evaluation notes:
{evaluation}

Resume analysis:
{resume}

Job description analysis:
{jd}

Difficulty: {difficulty}
"""

_FINAL_REPORT_PROMPT = """You are an expert technical interviewer creating a final interview report.
Use the interview configuration, resume analysis, job description analysis, and all question/answer/evaluation data below.
Rules:
- Do not invent scores when insufficient data exists; return null for dimensions that cannot be reliably evaluated.
- Do not make unsupported hiring decisions or claims about protected characteristics.
- Use cautious, evidence-based language such as "Based on the submitted answers..." and "Additional evidence may be needed...".
- Include uncertainty notes when the report cannot be fully supported.
- Return structured JSON only.

Interview configuration:
{config}

Resume analysis:
{resume}

Job description analysis:
{jd}

Resume/JD match:
{match}

Questions, answers, and evaluations:
{qa}
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

    async def evaluate_answer(
        self,
        question: Dict[str, Any],
        answer_text: str,
        resume_analysis: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        difficulty: str,
    ) -> AnswerEvaluationOutput:
        prompt = _ANSWER_EVAL_PROMPT.format(
            difficulty=difficulty,
            question=question.get("question_text", ""),
            expected_focus=question.get("expected_focus", ""),
            answer=answer_text[:20000],
            resume=json.dumps(resume_analysis or {}, ensure_ascii=False, indent=2),
            jd=json.dumps(jd_analysis or {}, ensure_ascii=False, indent=2),
        )
        return await self._provider.complete_json(prompt, AnswerEvaluationOutput)

    async def generate_follow_up_question(
        self,
        question: Dict[str, Any],
        answer_text: str,
        evaluation: Dict[str, Any],
        resume_analysis: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        difficulty: str,
    ) -> FollowUpQuestionOutput:
        prompt = _FOLLOW_UP_PROMPT.format(
            question=question.get("question_text", ""),
            answer=answer_text[:20000],
            evaluation=json.dumps(evaluation, ensure_ascii=False, indent=2),
            resume=json.dumps(resume_analysis or {}, ensure_ascii=False, indent=2),
            jd=json.dumps(jd_analysis or {}, ensure_ascii=False, indent=2),
            difficulty=difficulty,
        )
        return await self._provider.complete_json(prompt, FollowUpQuestionOutput)

    async def generate_interview_report(
        self,
        config: Dict[str, Any],
        resume_analysis: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        match: Dict[str, Any],
        qa_data: List[Dict[str, Any]],
    ) -> InterviewReportOutput:
        prompt = _FINAL_REPORT_PROMPT.format(
            config=json.dumps(config, ensure_ascii=False, indent=2),
            resume=json.dumps(resume_analysis or {}, ensure_ascii=False, indent=2),
            jd=json.dumps(jd_analysis or {}, ensure_ascii=False, indent=2),
            match=json.dumps(match or {}, ensure_ascii=False, indent=2),
            qa=json.dumps(qa_data, ensure_ascii=False, indent=2),
        )
        return await self._provider.complete_json(prompt, InterviewReportOutput)
