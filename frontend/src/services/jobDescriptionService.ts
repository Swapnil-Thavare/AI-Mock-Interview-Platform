import type { JobDescription } from '@/types';
import { mockJobDescription, mockJDAnalysis } from '@/utils/mockData';

export interface JobDescriptionInput {
  title: string;
  company: string;
  description: string;
}

export const jobDescriptionService = {
  create: async (input: JobDescriptionInput): Promise<JobDescription> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      ...mockJobDescription,
      title: input.title,
      company: input.company,
      description: input.description,
    };
  },

  getById: async (id: string): Promise<JobDescription> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { ...mockJobDescription, id };
  },

  getLatest: async (): Promise<JobDescription> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockJobDescription;
  },

  analyze: async (_jdId: string) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return mockJDAnalysis;
  },
};
