export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'candidate' | 'admin';
  createdAt: string;
}

export interface Resume {
  id: string;
  userId: string;
  fileName: string;
  content: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  strengths: string[];
  improvements: string[];
  uploadedAt: string;
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

export interface JobDescription {
  id: string;
  userId: string;
  title: string;
  company: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  keyResponsibilities: string[];
  createdAt: string;
}

export interface InterviewSetup {
  resumeId?: string;
  jobDescriptionId?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  type: 'technical' | 'behavioral' | 'mixed';
  duration: number;
}

export interface Interview {
  id: string;
  userId: string;
  setup: InterviewSetup;
  title: string;
  status: 'in-progress' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  questions: Question[];
  answers: Answer[];
  result?: InterviewResult;
}

export interface Question {
  id: string;
  text: string;
  category: 'technical' | 'behavioral';
  difficulty: 'easy' | 'medium' | 'hard';
  expectedAnswer?: string;
}

export interface Answer {
  questionId: string;
  text: string;
  skipped: boolean;
  timeTaken: number;
  submittedAt: string;
}

export interface InterviewResult {
  score: number;
  totalQuestions: number;
  answered: number;
  skipped: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  questionResults: QuestionResult[];
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
