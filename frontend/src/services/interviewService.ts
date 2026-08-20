import api from '@/services/api';
import type {
  Interview,
  InterviewSetup,
  Question,
  Answer,
  InterviewResult,
} from '@/types';
import { mockQuestions } from '@/utils/mockData';

const normalizeQuestion = (data: Record<string, unknown>): Question => ({
  id: String(data.id ?? 0),
  text: (data.question_text as string) ?? (data.text as string) ?? '',
  question_text: (data.question_text as string) ?? (data.text as string) ?? '',
  category: (data.category === 'behavioral' ? 'behavioral' : 'technical') as 'technical' | 'behavioral',
  difficulty: 'medium',
  expectedAnswer: (data.expected_answer as string) ?? undefined,
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

const defaultSetup: InterviewSetup = {
  difficulty: 'medium',
  questionCount: 2,
  type: 'mixed',
  duration: 30,
};

const normalizeInterview = (data: Record<string, unknown>, setup?: InterviewSetup): Interview => ({
  id: String(data.id ?? 0),
  userId: data.user_id ? String(data.user_id) : undefined,
  setup: (data.setup as InterviewSetup) ?? setup ?? defaultSetup,
  title: (data.title as string) ?? 'Mock Interview',
  status: (data.status as string) ?? 'in-progress',
  startedAt: (data.started_at as string) ?? (data.startedAt as string) ?? new Date().toISOString(),
  completedAt: (data.completed_at as string) ?? (data.completedAt as string) ?? undefined,
  questions: Array.isArray(data.questions)
    ? (data.questions as Record<string, unknown>[]).map(normalizeQuestion)
    : [],
  answers: Array.isArray(data.answers) ? (data.answers as Answer[]) : [],
  result: data.result ? normalizeResult(data.result as Record<string, unknown>) : undefined,
});

export const interviewService = {
  create: async (setup: InterviewSetup): Promise<Interview> => {
    const { data } = await api.post('/interviews', { ...setup, title: 'Mock Interview' });
    const interview = normalizeInterview(data, setup);
    if (!interview.questions.length) {
      interview.questions = mockQuestions.map((q) => ({ ...q, id: String(q.id) }));
    }
    return interview;
  },

  getById: async (id: string | number): Promise<Interview> => {
    const { data } = await api.get(`/interviews/${id}`);
    return normalizeInterview(data);
  },

  getQuestions: async (interviewId: string | number): Promise<Question[]> => {
    const { data } = await api.get(`/interviews/${interviewId}`);
    return Array.isArray(data.questions)
      ? (data.questions as Record<string, unknown>[]).map(normalizeQuestion)
      : [];
  },

  submitAnswer: async (
    interviewId: string | number,
    _questionId: string | number,
    answer: Answer
  ): Promise<void> => {
    await api.post(`/interviews/${interviewId}/answers`, {
      question_id: Number(answer.questionId),
      answer_text: answer.skipped ? '' : answer.text,
    });
  },

  complete: async (interviewId: string | number): Promise<InterviewResult> => {
    const { data } = await api.post(`/interviews/${interviewId}/complete`);
    return normalizeResult(data);
  },

  end: async (interviewId: string | number): Promise<InterviewResult> => {
    return interviewService.complete(interviewId);
  },

  getHistory: async (): Promise<Interview[]> => {
    const { data } = await api.get('/interviews');
    return Array.isArray(data) ? data.map((i: Record<string, unknown>) => normalizeInterview(i)) : [];
  },
};
