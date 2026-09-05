import api from '@/services/api';
import type { JobDescription, JobDescriptionAnalysis } from '@/types';

const defaultAnalysis: JobDescriptionAnalysis = {
  job_title: '',
  required_skills: [],
  preferred_skills: [],
  technologies: [],
  responsibilities: [],
  experience_requirements: [],
  education_requirements: [],
  important_keywords: [],
};

const normalizeJD = (data: Record<string, unknown>): JobDescription => {
  const analysis = (data.analysis as Record<string, unknown>) || {};
  const required = Array.isArray(data.required_skills)
    ? (data.required_skills as string[])
    : (data.requiredSkills as string[]) ?? [];
  const preferred = (analysis.preferred_skills as string[]) ?? (data.preferredSkills as string[]) ?? [];
  return {
    id: String(data.id ?? ''),
    user_id: data.user_id ? String(data.user_id) : undefined,
    userId: data.user_id ? String(data.user_id) : undefined,
    title: (data.title as string) ?? '',
    company: (data.company as string) ?? undefined,
    description: (data.description as string) ?? '',
    required_skills: required,
    requiredSkills: required,
    preferredSkills: preferred,
    experienceLevel: (analysis.experience_requirements as string[])?.[0] ?? (data.experienceLevel as string) ?? undefined,
    keyResponsibilities: (analysis.responsibilities as string[]) ?? (data.keyResponsibilities as string[]) ?? [],
    analysis: {
      job_title: (analysis.job_title as string) ?? (data.title as string) ?? '',
      required_skills: (analysis.required_skills as string[]) ?? required,
      preferred_skills: (analysis.preferred_skills as string[]) ?? [],
      technologies: (analysis.technologies as string[]) ?? [],
      responsibilities: (analysis.responsibilities as string[]) ?? [],
      experience_requirements: (analysis.experience_requirements as string[]) ?? [],
      education_requirements: (analysis.education_requirements as string[]) ?? [],
      important_keywords: (analysis.important_keywords as string[]) ?? [],
    },
    createdAt: (data.created_at as string) ?? (data.createdAt as string) ?? new Date().toISOString(),
  };
};

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
    return normalizeJD(data as Record<string, unknown>);
  },

  list: async (): Promise<JobDescription[]> => {
    const { data } = await api.get('/job-descriptions');
    return Array.isArray(data) ? data.map((j: Record<string, unknown>) => normalizeJD(j)) : [];
  },

  getById: async (id: string): Promise<JobDescription> => {
    const { data } = await api.get(`/job-descriptions/${id}`);
    return normalizeJD(data as Record<string, unknown>);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/job-descriptions/${id}`);
  },

  getDefaultAnalysis: () => defaultAnalysis,
};
