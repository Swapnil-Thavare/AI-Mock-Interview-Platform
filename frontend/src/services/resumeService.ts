import api from '@/services/api';
import type { Resume } from '@/types';

const normalizeResume = (data: Record<string, unknown>): Resume => {
  const analysis = (data.analysis as Record<string, unknown>) || {};
  return {
    id: String(data.id ?? ''),
    user_id: data.user_id ? String(data.user_id) : undefined,
    userId: data.user_id ? String(data.user_id) : undefined,
    fileName: (data.filename as string) ?? (data.fileName as string) ?? '',
    filename: (data.filename as string) ?? (data.fileName as string) ?? '',
    content: (data.extracted_text as string) ?? (data.content as string) ?? '',
    extracted_text: (data.extracted_text as string) ?? (data.content as string) ?? '',
    skills: Array.isArray(data.skills) ? (data.skills as string[]) : [],
    analysis: {
      summary: (analysis.summary as string) ?? '',
      technical_skills: Array.isArray(analysis.technical_skills) ? (analysis.technical_skills as string[]) : [],
      soft_skills: Array.isArray(analysis.soft_skills) ? (analysis.soft_skills as string[]) : [],
      programming_languages: Array.isArray(analysis.programming_languages) ? (analysis.programming_languages as string[]) : [],
      frameworks: Array.isArray(analysis.frameworks) ? (analysis.frameworks as string[]) : [],
      tools: Array.isArray(analysis.tools) ? (analysis.tools as string[]) : [],
      education: Array.isArray(analysis.education) ? (analysis.education as string[]) : [],
      experience: Array.isArray(analysis.experience) ? (analysis.experience as string[]) : [],
      projects: Array.isArray(analysis.projects) ? (analysis.projects as string[]) : [],
      certifications: Array.isArray(analysis.certifications) ? (analysis.certifications as string[]) : [],
      strengths: Array.isArray(analysis.strengths) ? (analysis.strengths as string[]) : [],
      improvements: Array.isArray(analysis.improvements) ? (analysis.improvements as string[]) : [],
    },
    uploadedAt: (data.created_at as string) ?? (data.uploadedAt as string) ?? (data.createdAt as string) ?? new Date().toISOString(),
  };
};

export const resumeService = {
  upload: async (file: File): Promise<Resume> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/resume/upload', form, {
      headers: { 'Content-Type': undefined },
    });
    return normalizeResume(data as Record<string, unknown>);
  },

  getById: async (id: string): Promise<Resume> => {
    const { data } = await api.get(`/resume/${id}`);
    return normalizeResume(data as Record<string, unknown>);
  },

  getLatest: async (): Promise<Resume | null> => {
    const { data } = await api.get('/resume/latest');
    if (!data) return null;
    return normalizeResume(data as Record<string, unknown>);
  },

  list: async (): Promise<Resume[]> => {
    const { data } = await api.get('/resume');
    return Array.isArray(data) ? data.map((r: Record<string, unknown>) => normalizeResume(r)) : [];
  },
};
