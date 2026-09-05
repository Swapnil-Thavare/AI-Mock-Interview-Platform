"""Structured output schemas for the Gemini AI provider.

Pydantic models are passed directly to the google-genai SDK as
`response_schema` for JSON-mode generation and validated on return.
"""
from typing import List

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
