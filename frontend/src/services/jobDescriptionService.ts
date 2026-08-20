import api from '@/services/api';
import type { JobDescription } from '@/types';
import { mockJDAnalysis } from '@/utils/mockData';

const normalizeJD = (data: Record<string, unknown>): JobDescription => ({
  id: String(data.id ?? 0),
  userId: data.user_id ? String(data.user_id) : undefined,
  title: (data.title as string) ?? '',
  company: (data.company as string) ?? undefined,
  description: (data.description as string) ?? '',
  required_skills: Array.isArray(data.required_skills)
    ? (data.required_skills as string[])
    : (data.requiredSkills as string[]) ?? [],
  requiredSkills: Array.isArray(data.required_skills)
    ? (data.required_skills as string[])
    : (data.requiredSkills as string[]) ?? [],
  preferredSkills: (data.preferred_skills as string[]) ?? (data.preferredSkills as string[]) ?? [],
  experienceLevel: (data.experience_level as string) ?? (data.experienceLevel as string) ?? undefined,
  keyResponsibilities: (data.key_responsibilities as string[]) ?? (data.keyResponsibilities as string[]) ?? [],
  createdAt: (data.created_at as string) ?? (data.createdAt as string) ?? new Date().toISOString(),
});

export interface JobDescriptionInput {
  title: string;
  company?: string;
  description: string;
  requiredSkills?: string[];
}

export const jobDescriptionService = {
  create: async (input: JobDescriptionInput): Promise<JobDescription> => {
    const { data } = await api.post('/job-descriptions', {
      title: input.title,
      company: input.company,
      description: input.description,
      required_skills: input.requiredSkills ?? [],
    });
    return normalizeJD(data);
  },

  list: async (): Promise<JobDescription[]> => {
    const { data } = await api.get('/job-descriptions');
    return Array.isArray(data) ? data.map(normalizeJD) : [];
  },

  delete: async (id: string | number): Promise<void> => {
    await api.delete(`/job-descriptions/${id}`);
  },

  analyze: async (_jdId: string | number) => {
    // The backend does not expose an analysis endpoint yet.
    // Keep the existing mock AI analysis display.
    return mockJDAnalysis;
  },
};
