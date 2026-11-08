import type { Answer, InterviewMode, Question } from '@/types';

/**
 * What the candidate should do with the question shown after (re)loading
 * an interview.
 *
 * - `fresh`: no answer row yet — normal submit flow.
 * - `record`: an orphaned voice placeholder exists (answer row, no usable
 *   recording) — re-record and upload to the existing answerId without
 *   re-submitting the answer.
 * - `reprocess`: a recording reached storage but was never transcribed —
 *   retry server-side processing without re-recording.
 * - `complete`: nothing left to do.
 */
export type ResumeAction = 'fresh' | 'record' | 'reprocess' | 'complete';

export interface ResumeTarget {
  action: ResumeAction;
  question: Question | null;
  /** Existing answer row to upload/reprocess against (record/reprocess). */
  answerId: string | null;
}

export function pickResumeTarget(
  questions: Question[],
  answers: Answer[],
  mode: InterviewMode
): ResumeTarget {
  const byQuestion = new Map<string, Answer>();
  for (const a of answers) {
    const qid = a.questionId || a.question_id || '';
    if (qid) byQuestion.set(qid, a);
  }
  const voiceMode = mode !== 'TEXT';

  for (const question of questions) {
    const answer = byQuestion.get(question.id);
    if (!answer) {
      return { action: 'fresh', question, answerId: null };
    }
    if (!voiceMode) continue; // TEXT answers (incl. skips) are final.
    const text = (answer.text ?? answer.answer_text ?? '').trim();
    if (text) continue; // Transcript present — fully answered.
    const media = answer.media;
    if (!media || media.status === 'FAILED') {
      // Placeholder with no usable recording — offer the question again.
      return { action: 'record', question, answerId: answer.id ?? null };
    }
    if (
      media.transcription_status !== 'COMPLETED' ||
      !media.transcript_text
    ) {
      // A recording exists but was never transcribed — the stored object
      // can be re-processed without re-recording.
      return { action: 'reprocess', question, answerId: answer.id ?? null };
    }
  }
  return { action: 'complete', question: null, answerId: null };
}
