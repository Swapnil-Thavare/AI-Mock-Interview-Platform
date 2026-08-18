import type { Resume } from '@/types';
import { mockResume, mockResumeAnalysis } from '@/utils/mockData';

export interface ResumeUploadInput {
  fileName: string;
  content: string;
}

export const resumeService = {
  upload: async (input: ResumeUploadInput): Promise<Resume> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      ...mockResume,
      fileName: input.fileName,
      content: input.content,
    };
  },

  getById: async (id: string): Promise<Resume> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { ...mockResume, id };
  },

  getLatest: async (): Promise<Resume> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockResume;
  },

  analyze: async (_resumeId: string) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return mockResumeAnalysis;
  },
};
