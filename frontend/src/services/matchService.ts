import api from '@/services/api';
import type { ResumeJDMatch } from '@/types';

const normalizeMatch = (data: Record<string, unknown>): ResumeJDMatch => ({
  id: String(data.id ?? ''),
  resume_id: data.resume_id ? String(data.resume_id) : '',
  job_description_id: data.job_description_id ? String(data.job_description_id) : '',
  overall_match_score: (data.overall_match_score as number) ?? 0,
  matched_skills: Array.isArray(data.matched_skills) ? (data.matched_skills as string[]) : [],
  missing_skills: Array.isArray(data.missing_skills) ? (data.missing_skills as string[]) : [],
  strengths: Array.isArray(data.strengths) ? (data.strengths as string[]) : [],
  gaps: Array.isArray(data.gaps) ? (data.gaps as string[]) : [],
  recommendations: Array.isArray(data.recommendations) ? (data.recommendations as string[]) : [],
  createdAt: (data.created_at as string) ?? (data.createdAt as string) ?? new Date().toISOString(),
});

export interface MatchInput {
  resumeId: string;
  jobDescriptionId: string;
}

export const matchService = {
  analyze: async (input: MatchInput): Promise<ResumeJDMatch> => {
    const { data } = await api.post('/matches', {
      resume_id: input.resumeId,
      job_description_id: input.jobDescriptionId,
    });
    return normalizeMatch(data as Record<string, unknown>);
  },
};
