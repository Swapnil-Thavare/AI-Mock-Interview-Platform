import { describe, expect, it } from 'vitest';
import { pickResumeTarget } from './resumeTarget';
import type { Answer, AnswerMedia, Question } from '@/types';

const q = (id: string): Question => ({
  id,
  text: `${id}?`,
  category: 'technical',
  difficulty: 'medium',
});

const answer = (
  id: string,
  questionId: string,
  text: string,
  media?: AnswerMedia | null
): Answer => ({
  id,
  questionId,
  text,
  skipped: false,
  timeTaken: 10,
  submittedAt: '2026-01-01T00:00:00Z',
  media: media ?? undefined,
});

const media = (over: Partial<AnswerMedia>): AnswerMedia => ({
  id: 'm1',
  interview_id: 'i1',
  answer_id: 'a1',
  media_type: 'AUDIO',
  mime_type: 'audio/webm',
  file_size: 100,
  status: 'UPLOADED',
  transcription_status: 'COMPLETED',
  transcript_text: 'transcript',
  ...over,
});

describe('pickResumeTarget', () => {
  it('returns fresh for the first unanswered question', () => {
    const result = pickResumeTarget([q('q1'), q('q2')], [], 'AUDIO');
    expect(result).toEqual({ action: 'fresh', question: q('q1'), answerId: null });
  });

  it('treats a voice placeholder without media as a re-record target', () => {
    // Refresh after placeholder submit, before upload — must reuse answer_id.
    const a = answer('a1', 'q1', '');
    const result = pickResumeTarget([q('q1'), q('q2')], [a], 'AUDIO');
    expect(result.action).toBe('record');
    expect(result.answerId).toBe('a1');
  });

  it('offers re-record when the media upload failed', () => {
    const a = answer('a1', 'q1', '', media({ status: 'FAILED' }));
    const result = pickResumeTarget([q('q1')], [a], 'VIDEO');
    expect(result.action).toBe('record');
    expect(result.answerId).toBe('a1');
  });

  it('offers reprocess when media exists but transcription never finished', () => {
    const a = answer(
      'a1',
      'q1',
      '',
      media({ transcription_status: 'FAILED', transcript_text: null })
    );
    const result = pickResumeTarget([q('q1')], [a], 'AUDIO');
    expect(result.action).toBe('reprocess');
    expect(result.answerId).toBe('a1');
  });

  it('skips a fully answered question and resumes at the next one', () => {
    const a = answer('a1', 'q1', 'transcript', media({}));
    const result = pickResumeTarget([q('q1'), q('q2')], [a], 'AUDIO');
    expect(result.action).toBe('fresh');
    expect(result.question).toEqual(q('q2'));
  });

  it('returns complete when every question is answered', () => {
    const a = answer('a1', 'q1', 'transcript', media({}));
    const result = pickResumeTarget([q('q1')], [a], 'AUDIO');
    expect(result.action).toBe('complete');
  });

  it('treats TEXT answers as final regardless of media state', () => {
    const a = answer('a1', 'q1', '', null);
    const result = pickResumeTarget([q('q1')], [a], 'TEXT');
    expect(result.action).toBe('complete');
  });
});
