export interface User {
  id: string;
  email: string;
  name: string;
  full_name?: string;
  avatar?: string;
  role?: 'candidate' | 'admin';
  phone?: string;
  skills?: string[];
  education?: string[] | string;
  experience?: string[] | string;
  createdAt?: string;
}

export interface WorkExperience {
  company: string;
  role: string;
  duration: string;
  description: string;
}

export interface Education {
  institution: string;
  degree: string;
  year: string;
}

export interface ResumeAnalysis {
  summary: string;
  technical_skills: string[];
  soft_skills: string[];
  programming_languages: string[];
  frameworks: string[];
  tools: string[];
  education: string[];
  experience: string[];
  projects: string[];
  certifications: string[];
  strengths: string[];
  improvements: string[];
}

export interface Resume {
  id: string;
  user_id?: string;
  userId?: string;
  fileName: string;
  filename?: string;
  content: string;
  extracted_text?: string;
  skills: string[];
  analysis: ResumeAnalysis;
  uploadedAt: string;
}

export interface JobDescriptionAnalysis {
  job_title: string;
  required_skills: string[];
  preferred_skills: string[];
  technologies: string[];
  responsibilities: string[];
  experience_requirements: string[];
  education_requirements: string[];
  important_keywords: string[];
}

export interface JobDescription {
  id: string;
  user_id?: string;
  userId?: string;
  title: string;
  company?: string;
  description: string;
  required_skills: string[];
  requiredSkills?: string[];
  preferredSkills: string[];
  experienceLevel?: string;
  keyResponsibilities: string[];
  analysis: JobDescriptionAnalysis;
  createdAt?: string;
}

export interface InterviewSetup {
  resumeId: string;
  jobDescriptionId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  type: 'technical' | 'behavioral' | 'mixed';
  question_types?: string[];
  duration: number;
}

export interface Interview {
  id: string;
  user_id?: string;
  userId?: string;
  setup: InterviewSetup;
  title: string;
  status: 'in-progress' | 'completed' | 'cancelled' | 'pending' | string;
  startedAt: string;
  completedAt?: string;
  questions: Question[];
  answers: Answer[];
  result?: InterviewResult;
}

export interface Question {
  id: string;
  text: string;
  question_text?: string;
  category: 'technical' | 'behavioral' | 'situational' | 'HR' | string;
  question_type?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;
  expected_focus?: string;
  expectedAnswer?: string;
}

export interface Answer {
  questionId: string;
  question_id?: string;
  text: string;
  answer_text?: string;
  skipped: boolean;
  timeTaken: number;
  submittedAt: string;
}

export interface InterviewResult {
  interview_id?: string;
  score: number;
  totalQuestions?: number;
  answered?: number;
  skipped?: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions?: string[];
  questionResults?: QuestionResult[];
}

export interface QuestionResult {
  questionId: string;
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

export interface DashboardStats {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number;
  improvementRate: number;
}

export interface ResumeJDMatch {
  id: string;
  resume_id: string;
  job_description_id: string;
  overall_match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  createdAt?: string;
}
