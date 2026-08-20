export interface User {
  id?: string | number;
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

export interface Resume {
  id: string | number;
  userId?: string | number;
  fileName: string;
  filename?: string;
  content: string;
  extracted_text?: string;
  skills: string[];
  experience?: WorkExperience[] | string[];
  education?: Education[] | string[];
  strengths?: string[];
  improvements?: string[];
  uploadedAt: string;
}

export interface JobDescription {
  id: string | number;
  userId?: string | number;
  title: string;
  company?: string;
  description: string;
  required_skills?: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel?: string;
  keyResponsibilities: string[];
  createdAt?: string;
}

export interface InterviewSetup {
  resumeId?: string | number;
  jobDescriptionId?: string | number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  type: 'technical' | 'behavioral' | 'mixed';
  duration: number;
}

export interface Interview {
  id: string | number;
  userId?: string | number;
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
  id: string | number;
  text: string;
  question_text?: string;
  category: 'technical' | 'behavioral';
  difficulty: 'easy' | 'medium' | 'hard';
  expectedAnswer?: string;
}

export interface Answer {
  questionId: string | number;
  question_id?: number;
  text: string;
  answer_text?: string;
  skipped: boolean;
  timeTaken: number;
  submittedAt: string;
}

export interface InterviewResult {
  interview_id?: string | number;
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
  questionId: string | number;
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
