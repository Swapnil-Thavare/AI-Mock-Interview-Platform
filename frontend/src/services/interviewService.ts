import type {
  Interview,
  InterviewSetup,
  Question,
  Answer,
  InterviewResult,
} from '@/types';
import {
  mockInterview,
  mockQuestions,
  mockResult,
  mockPreviousInterviews,
} from '@/utils/mockData';

export const interviewService = {
  create: async (setup: InterviewSetup): Promise<Interview> => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      ...mockInterview,
      id: `i-${Date.now()}`,
      setup,
      status: 'in-progress',
      startedAt: new Date().toISOString(),
      questions: mockQuestions,
      answers: [],
    };
  },

  getById: async (_id: string): Promise<Interview> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockInterview;
  },

  getQuestions: async (_interviewId: string): Promise<Question[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockQuestions;
  },

  submitAnswer: async (
    _interviewId: string,
    _questionId: string,
    _answer: Answer
  ): Promise<Question[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockQuestions;
  },

  end: async (_interviewId: string): Promise<InterviewResult> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return mockResult;
  },

  getHistory: async (): Promise<Interview[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockPreviousInterviews;
  },
};
