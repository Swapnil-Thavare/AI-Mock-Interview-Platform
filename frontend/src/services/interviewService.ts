import api from '@/services/api';
import type {
  Interview,
  InterviewSetup,
  Question,
  Answer,
  InterviewResult,
} from '@/types';

const normalizeQuestion = (data: Record<string, unknown>): Question => ({
  id: String(data.id ?? ''),
  text: (data.question_text as string) ?? (data.text as string) ?? '',
  question_text: (data.question_text as string) ?? (data.text as string) ?? '',
  category: (data.question_type as string) ?? (data.category as string) ?? 'technical',
  question_type: (data.question_type as string) ?? (data.category as string) ?? 'technical',
  difficulty: ((data.difficulty as string) ?? 'medium') as 'easy' | 'medium' | 'hard',
  topic: (data.topic as string) ?? undefined,
  expected_focus: (data.expected_focus as string) ?? undefined,
  expectedAnswer: (data.expected_focus as string) ?? undefined,
});

const normalizeResult = (data: Record<string, unknown>): InterviewResult => {
  const rawScore = (data.score as number) ?? 0;
  const score = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
  return {
    interview_id: data.interview_id ? String(data.interview_id) : undefined,
    score,
    totalQuestions: (data.total_questions as number) ?? undefined,
    answered: (data.answered as number) ?? undefined,
    skipped: (data.skipped as number) ?? undefined,
    feedback: (data.feedback as string) ?? '',
    strengths: Array.isArray(data.strengths) ? (data.strengths as string[]) : [],
    weaknesses: Array.isArray(data.weaknesses) ? (data.weaknesses as string[]) : [],
    suggestions: Array.isArray(data.suggestions) ? (data.suggestions as string[]) : undefined,
    questionResults: Array.isArray(data.question_results)
      ? (data.question_results as Record<string, unknown>[]).map((qr) => ({
          questionId: String(qr.question_id ?? qr.questionId ?? 0),
          question: (qr.question as string) ?? '',
          answer: (qr.answer as string) ?? '',
          score: (qr.score as number) ?? 0,
          feedback: (qr.feedback as string) ?? '',
        }))
      : undefined,
  };
};

const normalizeSetup = (data: Record<string, unknown>, setup?: InterviewSetup): InterviewSetup => {
  if (setup) return setup;
  return {
    resumeId: data.resume_id ? String(data.resume_id) : '',
    jobDescriptionId: data.job_description_id ? String(data.job_description_id) : '',
    difficulty: ((data.difficulty as string) ?? 'medium') as 'easy' | 'medium' | 'hard',
    questionCount: (data.question_count as number) ?? 5,
    type: 'mixed',
    duration: (data.duration as number) ?? 30,
  };
};

const normalizeInterview = (data: Record<string, unknown>, setup?: InterviewSetup): Interview => ({
  id: String(data.id ?? ''),
  user_id: data.user_id ? String(data.user_id) : undefined,
  userId: data.user_id ? String(data.user_id) : undefined,
  setup: normalizeSetup(data, setup),
  title: (data.title as string) ?? 'Mock Interview',
  status: (data.status as string) ?? 'in-progress',
  startedAt: (data.created_at as string) ?? (data.createdAt as string) ?? new Date().toISOString(),
  completedAt: (data.completed_at as string) ?? (data.completedAt as string) ?? undefined,
  questions: Array.isArray(data.questions)
    ? (data.questions as Record<string, unknown>[]).map(normalizeQuestion)
    : [],
  answers: Array.isArray(data.answers) ? (data.answers as Answer[]) : [],
  result: data.result ? normalizeResult(data.result as Record<string, unknown>) : undefined,
});

const questionTypesFromSetup = (setup: InterviewSetup): string[] => {
  if (setup.question_types && setup.question_types.length) return setup.question_types;
  if (setup.type === 'technical') return ['technical'];
  if (setup.type === 'behavioral') return ['behavioral'];
  return ['technical', 'behavioral'];
};

export const interviewService = {
  create: async (setup: InterviewSetup): Promise<Interview> => {
    const { data } = await api.post('/interviews', {
      title: 'Mock Interview',
      resume_id: setup.resumeId,
      job_description_id: setup.jobDescriptionId,
      difficulty: setup.difficulty,
      question_count: setup.questionCount,
      duration: setup.duration,
      question_types: questionTypesFromSetup(setup),
    });
    return normalizeInterview(data as Record<string, unknown>, setup);
  },

  getById: async (id: string): Promise<Interview> => {
    const { data } = await api.get(`/interviews/${id}`);
    return normalizeInterview(data as Record<string, unknown>);
  },

  getQuestions: async (interviewId: string): Promise<Question[]> => {
    const { data } = await api.get(`/interviews/${interviewId}`);
    return Array.isArray(data.questions)
      ? (data.questions as Record<string, unknown>[]).map(normalizeQuestion)
      : [];
  },

  submitAnswer: async (
    interviewId: string,
    _questionId: string,
    answer: Answer
  ): Promise<void> => {
    await api.post(`/interviews/${interviewId}/answers`, {
      question_id: answer.questionId,
      answer_text: answer.skipped ? '' : answer.text,
    });
  },

  complete: async (interviewId: string): Promise<InterviewResult> => {
    const { data } = await api.post(`/interviews/${interviewId}/complete`);
    return normalizeResult(data as Record<string, unknown>);
  },

  end: async (interviewId: string): Promise<InterviewResult> => {
    return interviewService.complete(interviewId);
  },

  getHistory: async (): Promise<Interview[]> => {
    const { data } = await api.get('/interviews');
    return Array.isArray(data) ? data.map((i: Record<string, unknown>) => normalizeInterview(i)) : [];
  },
};
