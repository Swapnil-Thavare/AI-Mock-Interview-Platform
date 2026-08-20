import api from '@/services/api';
import type { Resume } from '@/types';
import { mockResumeAnalysis } from '@/utils/mockData';

const normalizeResume = (data: Record<string, unknown>): Resume => ({
  id: String(data.id ?? 0),
  userId: data.user_id ? String(data.user_id) : undefined,
  fileName: (data.filename as string) ?? (data.fileName as string) ?? '',
  filename: (data.filename as string) ?? (data.fileName as string) ?? '',
  content: (data.extracted_text as string) ?? (data.content as string) ?? '',
  extracted_text: (data.extracted_text as string) ?? (data.content as string) ?? '',
  skills: Array.isArray(data.skills) ? (data.skills as string[]) : [],
  experience: (data.experience as Resume['experience']) ?? [],
  education: (data.education as Resume['education']) ?? [],
  strengths: (data.strengths as string[]) ?? [],
  improvements: (data.improvements as string[]) ?? [],
  uploadedAt: (data.uploaded_at as string) ?? (data.uploadedAt as string) ?? new Date().toISOString(),
});

export const resumeService = {
  upload: async (file: File): Promise<Resume> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/resume/upload', form, {
      headers: { 'Content-Type': undefined },
    });
    return normalizeResume(data);
  },

  getById: async (id: string | number): Promise<Resume> => {
    const { data } = await api.get(`/resume/${id}`);
    return normalizeResume(data);
  },

  getLatest: async (): Promise<Resume | null> => {
    const { data } = await api.get('/resume');
    if (!data) return null;
    return normalizeResume(data);
  },

  analyze: async (_resumeId: string | number) => {
    // The backend currently does not expose an analysis endpoint.
    // Keep the existing mock AI analysis display for now.
    return mockResumeAnalysis;
  },
};
