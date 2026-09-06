"""Structured output schemas for the Gemini AI provider.

Pydantic models are passed directly to the google-genai SDK as
`response_schema` for JSON-mode generation and validated on return.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class ResumeAnalysisOutput(BaseModel):
    summary: str = Field(default="", description="Brief professional summary supported by the resume.")
    technical_skills: List[str] = Field(default=[], description="Technical/role-specific skills explicitly mentioned.")
    soft_skills: List[str] = Field(default=[], description="Soft skills explicitly mentioned.")
    programming_languages: List[str] = Field(default=[], description="Programming languages explicitly mentioned.")
    frameworks: List[str] = Field(default=[], description="Frameworks and libraries explicitly mentioned.")
    tools: List[str] = Field(default=[], description="Tools, platforms, and services explicitly mentioned.")
    education: List[str] = Field(default=[], description="Education entries as short strings.")
    experience: List[str] = Field(default=[], description="Work experience entries as short strings.")
    projects: List[str] = Field(default=[], description="Notable project entries as short strings.")
    certifications: List[str] = Field(default=[], description="Certifications explicitly mentioned.")
    strengths: List[str] = Field(default=[], description="Clear candidate strengths supported by the resume.")
    improvements: List[str] = Field(default=[], description="Areas that could be strengthened. Do not invent.")


class JobDescriptionAnalysisOutput(BaseModel):
    job_title: str = Field(default="", description="Job title if stated, otherwise inferred from the description.")
    required_skills: List[str] = Field(default=[], description="Required skills explicitly stated in the JD.")
    preferred_skills: List[str] = Field(default=[], description="Preferred / nice-to-have skills explicitly stated.")
    technologies: List[str] = Field(default=[], description="Technologies explicitly mentioned.")
    responsibilities: List[str] = Field(default=[], description="Key responsibilities explicitly stated.")
    experience_requirements: List[str] = Field(default=[], description="Experience requirements such as years or level.")
    education_requirements: List[str] = Field(default=[], description="Education requirements explicitly stated.")
    important_keywords: List[str] = Field(default=[], description="Important recurring keywords from the JD.")


class ResumeJDMatchOutput(BaseModel):
    overall_match_score: int = Field(..., ge=0, le=100, description="AI compatibility score from 0 to 100.")
    matched_skills: List[str] = Field(default=[], description="Skills that appear in both the resume and JD.")
    missing_skills: List[str] = Field(default=[], description="Skills required by the JD that are missing or weak in the resume.")
    strengths: List[str] = Field(default=[], description="Candidate strengths relative to the JD.")
    gaps: List[str] = Field(default=[], description="Specific gaps the candidate should address.")
    recommendations: List[str] = Field(default=[], description="Actionable recommendations for the candidate.")


class InterviewQuestionOutput(BaseModel):
    question: str = Field(..., description="The interview question text.")
    question_type: str = Field(..., description="One of: technical, behavioral, situational, HR.")
    difficulty: str = Field(..., description="One of: easy, medium, hard.")
    topic: str = Field(default="", description="The skill, concept, or theme the question targets.")
    expected_focus: str = Field(default="", description="What the interviewer would look for in a good answer.")


class InterviewQuestionsOutput(BaseModel):
    questions: List[InterviewQuestionOutput] = Field(..., description="The ordered list of generated interview questions.")


class AnswerEvaluationOutput(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Overall quality score for the answer (0-100).")
    relevance_score: int = Field(..., ge=0, le=100, description="How relevant the answer is to the question and expected focus.")
    correctness_score: int = Field(..., ge=0, le=100, description="Technical correctness of the answer.")
    clarity_score: int = Field(..., ge=0, le=100, description="Clarity and communication quality.")
    depth_score: int = Field(..., ge=0, le=100, description="Depth and completeness of the explanation.")
    strengths: List[str] = Field(default=[], description="Specific strengths demonstrated in this answer.")
    weaknesses: List[str] = Field(default=[], description="Specific weaknesses or gaps in this answer.")
    missing_points: List[str] = Field(default=[], description="Important points that were missing from the answer.")
    improvement_feedback: str = Field(default="", description="Concise, actionable feedback for the candidate.")
    ideal_answer_summary: str = Field(default="", description="A brief summary of what a strong answer would include.")
    follow_up_required: bool = Field(default=False, description="Whether a follow-up question is recommended.")
    follow_up_reason: str = Field(default="", description="Why a follow-up is or is not needed.")
    confidence: int = Field(..., ge=0, le=100, description="Confidence in this evaluation (0-100).")
    uncertainty_notes: str = Field(default="", description="Notes when the answer cannot be confidently evaluated.")


class FollowUpQuestionOutput(BaseModel):
    question: str = Field(..., description="The follow-up question text.")
    question_type: str = Field(..., description="One of: technical, behavioral, situational, HR.")
    difficulty: str = Field(..., description="One of: easy, medium, hard.")
    topic: str = Field(default="", description="The skill or theme the follow-up targets.")
    expected_focus: str = Field(default="", description="What a good follow-up answer should address.")


class QuestionResultSummary(BaseModel):
    question_id: str = Field(default="", description="Identifier for the question.")
    question: str = Field(default="", description="The question text.")
    answer: str = Field(default="", description="Brief summary of the candidate's answer.")
    score: int = Field(..., ge=0, le=100, description="Score for this answer.")
    feedback: str = Field(default="", description="Feedback for this specific answer.")


class InterviewReportOutput(BaseModel):
    overall_score: int = Field(..., ge=0, le=100, description="Overall interview performance score.")
    technical_score: Optional[int] = Field(default=None, ge=0, le=100, description="Technical knowledge score if evaluable.")
    communication_score: Optional[int] = Field(default=None, ge=0, le=100, description="Communication clarity score if evaluable.")
    relevance_score: Optional[int] = Field(default=None, ge=0, le=100, description="Relevance to the job description if evaluable.")
    problem_solving_score: Optional[int] = Field(default=None, ge=0, le=100, description="Problem-solving score if evaluable.")
    resume_alignment: str = Field(default="", description="Observation about resume/JD alignment based on the interview.")
    strengths: List[str] = Field(default=[], description="Overall strengths demonstrated.")
    weaknesses: List[str] = Field(default=[], description="Overall weaknesses or gaps.")
    missing_or_weak_skills: List[str] = Field(default=[], description="Skills that were missing or weak.")
    recommended_preparation_topics: List[str] = Field(default=[], description="Topics the candidate should study.")
    answer_quality_summary: str = Field(default="", description="Summary of answer quality across the interview.")
    interview_completion_summary: str = Field(default="", description="Summary of what was completed.")
    overall_feedback: str = Field(default="", description="Overall constructive feedback.")
    confidence: int = Field(..., ge=0, le=100, description="Confidence in the report.")
    uncertainty_notes: str = Field(default="", description="Notes when the report cannot be fully supported.")
    question_wise_summary: List[QuestionResultSummary] = Field(default=[], description="Per-question summary.")
