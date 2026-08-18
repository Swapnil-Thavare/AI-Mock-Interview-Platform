from typing import Any, Dict, List

from app.schemas import InterviewQuestion


class AIService:
    def generate_questions(self, resume: Dict[str, Any], job: Dict[str, Any]) -> List[InterviewQuestion]:
        return [
            InterviewQuestion(
                id=1,
                question_text="Tell us about your experience with Python.",
                category="technical",
            ),
            InterviewQuestion(
                id=2,
                question_text="Describe a challenging project you worked on.",
                category="behavioral",
            ),
        ]

    def analyze_resume(self, file_name: str, file_size: int) -> Dict[str, Any]:
        return {
            "file_name": file_name,
            "file_size": file_size,
            "skills": ["Python", "FastAPI", "Machine Learning"],
            "summary": "Mock resume summary.",
        }

    def analyze_job_description(self, text: str) -> Dict[str, Any]:
        return {
            "required_skills": ["Python", "FastAPI", "REST APIs"],
            "experience_level": "Mid-level",
            "summary": "Mock job description analysis.",
        }

    def evaluate_answer(self, question: str, answer: str) -> Dict[str, Any]:
        return {
            "score": 0.85,
            "feedback": "Mock feedback: good answer.",
        }

    def generate_feedback(self, answers: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "overall_score": 0.8,
            "strengths": ["Clear communication", "Technical depth"],
            "weaknesses": ["Could provide more examples"],
            "feedback": "Mock overall feedback.",
        }
