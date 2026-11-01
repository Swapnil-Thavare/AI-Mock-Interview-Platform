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

export type InterviewMode = 'TEXT' | 'AUDIO' | 'VIDEO';

export interface InterviewSetup {
  resumeId: string;
  jobDescriptionId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  type: 'technical' | 'behavioral' | 'mixed';
  question_types?: string[];
  duration: number;
  interviewMode: InterviewMode;
}

export interface Interview {
  id: string;
  user_id?: string;
  userId?: string;
  setup: InterviewSetup;
  title: string;
  status: 'in-progress' | 'completed' | 'cancelled' | 'pending' | string;
  interview_mode: InterviewMode;
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
  parent_question_id?: string;
  is_follow_up?: boolean;
  follow_up_reason?: string;
}

export interface Answer {
  id?: string;
  questionId: string;
  question_id?: string;
  text: string;
  answer_text?: string;
  skipped: boolean;
  timeTaken: number;
  submittedAt: string;
  media?: AnswerMedia;
}

export type TranscriptionStatus = 'NONE' | 'PENDING' | 'COMPLETED' | 'FAILED';

export type SpeechAnalysisStatus = 'NONE' | 'PENDING' | 'COMPLETED' | 'FAILED';

export interface FillerBreakdownEntry {
  count: number;
  ambiguous: boolean;
}

export interface SpeechAnalysis {
  id: string;
  interview_id: string;
  answer_id: string;
  media_id: string;
  status: SpeechAnalysisStatus;
  word_count?: number | null;
  recording_seconds?: number | null;
  speech_seconds?: number | null;
  wpm_recording?: number | null;
  wpm_speech?: number | null;
  filler_count?: number | null;
  filler_per_100_words?: number | null;
  filler_breakdown?: Record<string, FillerBreakdownEntry> | null;
  pause_count?: number | null;
  pause_total_seconds?: number | null;
  pause_avg_seconds?: number | null;
  pause_longest_seconds?: number | null;
  unique_word_ratio?: number | null;
  top_repeated_words?: { word: string; count: number }[] | null;
  structure_summary?: string | null;
  organization_notes?: string[] | null;
  clarity_notes?: string | null;
  communication_strengths?: string[] | null;
  communication_improvements?: string[] | null;
  analysis_error?: string | null;
  analyzed_at?: string | null;
  created_at?: string | null;
}

export interface PauseStatsInput {
  pause_count: number;
  pause_total_seconds: number;
  pause_longest_seconds: number;
  speech_seconds: number;
}

export interface AnswerMedia {
  id: string;
  interview_id: string;
  answer_id: string;
  media_type: 'AUDIO' | 'VIDEO';
  mime_type: string;
  storage_key: string;
  file_size: number;
  duration_seconds?: number | null;
  status: 'PENDING' | 'UPLOADED' | 'FAILED';
  uploaded_at?: string | null;
  transcription_status?: TranscriptionStatus;
  transcript_text?: string | null;
  transcription_error?: string | null;
  transcribed_at?: string | null;
  speech_analysis?: SpeechAnalysis | null;
}

export interface AnswerEvaluation {
  score: number;
  relevance_score: number;
  correctness_score: number;
  clarity_score: number;
  depth_score: number;
  strengths: string[];
  weaknesses: string[];
  missing_points: string[];
  improvement_feedback: string;
  ideal_answer_summary: string;
  follow_up_required: boolean;
  follow_up_reason: string;
  confidence: number;
  uncertainty_notes: string;
}

export interface SubmitAnswerResponse {
  answer: Answer;
  evaluation?: AnswerEvaluation;
  next_question?: Question;
  follow_up_generated: boolean;
  is_complete: boolean;
  message: string;
}

// POST /interviews/{id}/answers/{answer_id}/media — voice-first pipeline
// (upload → transcribe → evaluate) returns media + progression data.
export interface SubmitMediaResponse extends SubmitAnswerResponse {
  media: AnswerMedia;
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
  technical_score?: number | null;
  communication_score?: number | null;
  relevance_score?: number | null;
  problem_solving_score?: number | null;
  resume_alignment?: string | null;
  missing_skills?: string[];
  preparation_topics?: string[];
  questionResults?: QuestionResult[];
  completion_summary?: string | null;
  overall_feedback?: string | null;
  confidence?: number | null;
  uncertainty_notes?: string | null;
}

export interface QuestionResult {
  questionId: string;
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

export type ProctoringEventType =
  | 'FACE_NOT_DETECTED'
  | 'MULTIPLE_FACES_DETECTED'
  | 'CAMERA_DISCONNECTED'
  | 'CAMERA_INTERRUPTED'
  | 'TAB_HIDDEN'
  | 'WINDOW_FOCUS_LOST';

export type ProctoringSeverity = 'INFO' | 'WARNING';

export type ProctoringMetadataValue = string | number | boolean;

export interface ProctoringEventInput {
  client_event_id: string;
  event_type: ProctoringEventType;
  severity?: ProctoringSeverity;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  question_id?: string | null;
  event_metadata?: Record<string, ProctoringMetadataValue> | null;
}

export interface ProctoringEvent {
  id: string;
  interview_id: string;
  event_type: ProctoringEventType;
  severity: ProctoringSeverity;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  question_id?: string | null;
  event_metadata?: Record<string, ProctoringMetadataValue> | null;
  created_at?: string | null;
}

export interface ProctoringEventBatchResponse {
  accepted: number;
  duplicates: number;
  rejected: number;
  limit_reached: boolean;
  message: string;
}

export interface ProctoringSummary {
  interview_id: string;
  total_events: number;
  counts: Partial<Record<ProctoringEventType, number>>;
  durations_seconds: Partial<Record<ProctoringEventType, number>>;
  first_event_at?: string | null;
  last_event_at?: string | null;
  event_window_seconds?: number | null;
  consent_acknowledged_at?: string | null;
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
