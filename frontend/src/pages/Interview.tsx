import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { QuestionCard } from '@/components/interview/QuestionCard';
import { Timer } from '@/components/interview/Timer';
import { InterviewDeviceCheck } from '@/components/interview/InterviewDeviceCheck';
import {
  useInterviewRecording,
  type RecordedMedia,
} from '@/components/interview/useInterviewRecording';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { interviewService } from '@/services/interviewService';
import { getApiErrorMessage } from '@/services/api';
import type {
  Interview as InterviewType,
  InterviewMode,
  Question,
  AnswerEvaluation,
  SubmitAnswerResponse,
  SubmitMediaResponse,
} from '@/types';

const QUESTION_TIME = 120;

export const Interview: React.FC = () => {
  const navigate = useNavigate();
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [interview, setInterview] = useState<InterviewType | null>(null);
  const [current, setCurrent] = useState<Question | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [activeMode, setActiveMode] = useState<InterviewMode>('TEXT');
  const [devicesReady, setDevicesReady] = useState(false);
  const recording = useInterviewRecording(activeMode);
  const [mediaUpload, setMediaUpload] = useState<
    'idle' | 'uploading' | 'uploaded' | 'failed' | 'eval_failed'
  >('idle');
  const pendingUploadRef = useRef<{
    answerId: string;
    media: RecordedMedia;
  } | null>(null);

  const loadInterview = useCallback(async (id: string) => {
    try {
      const data = await interviewService.getById(id);
      setInterview(data);
      const mode = data.interview_mode ?? 'TEXT';
      setActiveMode(mode);
      setDevicesReady(mode === 'TEXT');
      if (data.result) {
        navigate(`/interview/result/${id}`);
        return;
      }
      const answeredIds = new Set(data.answers.map((a) => a.questionId ?? a.question_id));
      const next = data.questions.find((q) => !answeredIds.has(q.id)) ?? null;
      setCurrent(next);
      setText('');
      setEvaluation(null);
    } catch {
      setError('Could not load interview. Please start a new one.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const id = localStorage.getItem('currentInterviewId');
    if (!id) {
      navigate('/interview/setup');
      return;
    }
    setInterviewId(id);
    let ignore = false;
    const load = async () => {
      if (ignore) return;
      await loadInterview(id);
    };
    void load();
    return () => {
      ignore = true;
    };
  }, [navigate, loadInterview]);

  // Acquire the interview media stream only after the device check has
  // passed — browser permission is already granted by that point.
  useEffect(() => {
    if (devicesReady && activeMode !== 'TEXT') {
      void recording.arm();
    }
  }, [devicesReady, activeMode, recording.arm]);

  // Record one clip per question. The cleanup discards the in-progress
  // recorder whenever the question changes or the component unmounts.
  const shouldRecord = devicesReady && activeMode !== 'TEXT' && !!current;
  useEffect(() => {
    if (!shouldRecord || !recording.armed || !recording.supported) return;
    recording.start();
    return () => recording.discard();
  }, [
    current?.id,
    shouldRecord,
    recording.armed,
    recording.supported,
    recording.start,
    recording.discard,
  ]);

  const total = interview?.questions.length ?? 0;
  const answeredCount = interview?.answers.length ?? 0;
  const progress = total ? ((answeredCount + (submitting ? 1 : 0)) / total) * 100 : 0;
  const isLast = !current || current.id === interview?.questions[interview.questions.length - 1]?.id;

  const voiceFirst = activeMode !== 'TEXT';

  const handleSubmit = async () => {
    if (!current || !interviewId || submitting) return;
    const trimmed = text.trim();
    // Voice-first AUDIO/VIDEO answers are spoken, not typed — the typed
    // field is optional notes. TEXT still requires a non-empty answer.
    if (!voiceFirst && !trimmed) {
      setError('Please type an answer before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    setEvaluation(null);
    setMediaUpload('idle');

    try {
      const response = await interviewService.submitAnswer(interviewId, current.id, {
        questionId: current.id,
        text: trimmed,
        skipped: false,
        timeTaken: QUESTION_TIME,
        submittedAt: new Date().toISOString(),
      });

      let outcome: SubmitAnswerResponse = response;
      const answerId = response.answer?.id;
      if (voiceFirst && answerId) {
        const media = await recording.stopAndCollect();
        if (media) {
          // One request performs upload → transcription → evaluation. Do
          // not advance while it fails — the retry below re-sends the blob.
          const processed = await uploadRecording(answerId, media);
          if (!processed) return;
          outcome = processed;
        } else {
          // No recording captured — the placeholder answer stays empty and
          // counts as skipped downstream.
          setError('No recording was captured — your answer was saved as empty.');
        }
      }

      setEvaluation(outcome.evaluation ?? null);
      const updated = await interviewService.getById(interviewId);
      setInterview(updated);

      if (outcome.is_complete || outcome.next_question == null) {
        await handleEnd(updated);
        return;
      }

      setCurrent(outcome.next_question);
      setText('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not submit answer. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!current || !interviewId || submitting) return;
    setSubmitting(true);
    setError('');
    setEvaluation(null);

    try {
      const response = await interviewService.submitAnswer(interviewId, current.id, {
        questionId: current.id,
        text: '',
        skipped: true,
        timeTaken: QUESTION_TIME,
        submittedAt: new Date().toISOString(),
      });

      const updated = await interviewService.getById(interviewId);
      setInterview(updated);

      if (response.is_complete || response.next_question == null) {
        await handleEnd(updated);
        return;
      }

      setCurrent(response.next_question);
      setText('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not skip question. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const uploadRecording = async (
    answerId: string,
    media: RecordedMedia
  ): Promise<SubmitMediaResponse | null> => {
    if (!interviewId) return null;
    setMediaUpload('uploading');
    try {
      const result = await interviewService.uploadAnswerMedia(
        interviewId,
        answerId,
        media.blob,
        media.durationSeconds
      );
      if (result.media?.transcription_status === 'COMPLETED' && !result.evaluation) {
        // Transcript saved but evaluation unavailable — the same retry
        // re-uploads the blob; the backend skips transcription and
        // re-runs only the evaluation.
        setMediaUpload('eval_failed');
        pendingUploadRef.current = { answerId, media };
      } else {
        setMediaUpload('uploaded');
        pendingUploadRef.current = null;
      }
      return result;
    } catch {
      setMediaUpload('failed');
      pendingUploadRef.current = { answerId, media };
      return null;
    }
  };

  const retryMediaUpload = async () => {
    const pending = pendingUploadRef.current;
    if (!pending || submitting) return;
    setSubmitting(true);
    try {
      const result = await uploadRecording(pending.answerId, pending.media);
      if (result) {
        setEvaluation(result.evaluation ?? null);
        const updated = await interviewService.getById(interviewId!);
        setInterview(updated);
        if (result.is_complete || result.next_question == null) {
          await handleEnd(updated);
          return;
        }
        setCurrent(result.next_question);
        setText('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleModeSwitch = async (mode: InterviewMode) => {
    setActiveMode(mode);
    setDevicesReady(mode === 'TEXT');
    if (interviewId) {
      try {
        const updated = await interviewService.updateMode(interviewId, mode);
        setInterview(updated);
      } catch {
        // The downgrade still applies for this session if it cannot be saved.
      }
    }
  };

  const handleEnd = async (currentInterview?: InterviewType) => {
    if (!interviewId) return;
    setLoading(true);
    setError('');
    try {
      await interviewService.complete(interviewId);
      navigate(`/interview/result/${interviewId}`);
    } catch (err) {
      const data = currentInterview ?? interview;
      if (data?.answers.length === 0) {
        setError('Please answer at least one question before finishing.');
      } else {
        setError(getApiErrorMessage(err, 'Could not finish the interview. Please try again.'));
      }
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">Loading interview...</div>
      </DashboardLayout>
    );
  }

  if (interview && activeMode !== 'TEXT' && !devicesReady) {
    return (
      <DashboardLayout>
        <InterviewDeviceCheck
          mode={activeMode}
          onReady={() => setDevicesReady(true)}
          onSwitchMode={(mode) => void handleModeSwitch(mode)}
          onCancel={() => navigate('/interview/setup')}
        />
      </DashboardLayout>
    );
  }

  if (!current) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">
          <p className="mb-4">No more questions. You can finish the interview.</p>
          <Button onClick={() => handleEnd()} disabled={submitting || loading}>
            Finish interview
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">Mock interview</h2>
          {interview?.interview_mode && interview.interview_mode !== 'TEXT' && (
            <Badge color="primary">
              {interview.interview_mode === 'VIDEO' ? 'Video' : 'Audio'}
            </Badge>
          )}
          {recording.state === 'recording' && (
            <Badge color="red">
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600"
                aria-hidden="true"
              />
              Recording
            </Badge>
          )}
          {recording.state === 'error' && (
            <Badge color="red">Recording stopped</Badge>
          )}
        </div>
        <Timer
          key={current.id}
          durationSeconds={QUESTION_TIME}
          onTimeUp={() => {
            // Voice-first: time-up still submits — the recording is the answer.
            if (text.trim() || voiceFirst) handleSubmit();
            else handleSkip();
          }}
        />
      </div>

      <div className="mb-6 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-primary-600 transition-all"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <QuestionCard question={current} index={answeredCount} total={Math.max(total, answeredCount + 1)} />

      <div className="mt-6">
        {voiceFirst && (
          <p className="mb-2 text-sm text-gray-600">
            Speak your answer aloud — your recording is transcribed and
            evaluated when you submit.
          </p>
        )}
        <Textarea
          label={voiceFirst ? 'Notes (optional)' : 'Your answer'}
          rows={voiceFirst ? 3 : 6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            voiceFirst
              ? 'Optional notes — your spoken answer is what gets evaluated.'
              : 'Type your response here...'
          }
          disabled={submitting}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={(!voiceFirst && !text.trim()) || submitting}
          >
            {submitting
              ? voiceFirst
                ? 'Processing...'
                : 'Evaluating...'
              : isLast
                ? 'Finish'
                : 'Submit & next'}
          </Button>
          <Button variant="secondary" onClick={handleSkip} disabled={submitting}>
            {isLast ? 'Skip & finish' : 'Skip'}
          </Button>
          <Button variant="secondary" onClick={() => handleEnd()} disabled={submitting || loading}>
            End interview
          </Button>
        </div>
      </div>

      {voiceFirst && mediaUpload !== 'idle' && (
        <div className="mt-3 text-sm" role="status">
          {mediaUpload === 'uploading' && (
            <span className="text-gray-600">
              Uploading, transcribing and evaluating your answer...
            </span>
          )}
          {mediaUpload === 'uploaded' && (
            <span className="text-green-700">Answer processed.</span>
          )}
          {mediaUpload === 'failed' && (
            <span className="text-red-600">
              Recording processing failed — your answer was saved.{' '}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => void retryMediaUpload()}
              >
                Retry
              </button>
            </span>
          )}
          {mediaUpload === 'eval_failed' && (
            <span className="text-red-600">
              Transcript saved — evaluation is unavailable right now.{' '}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => void retryMediaUpload()}
              >
                Retry evaluation
              </button>
            </span>
          )}
        </div>
      )}

      {submitting && (
        <div className="mt-4 text-sm text-gray-600">AI is evaluating your answer...</div>
      )}

      {evaluation && !submitting && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-2 font-semibold text-gray-900">Feedback</h4>
          <p className="mb-2 text-sm text-gray-700">
            <span className="font-medium">Score:</span> {evaluation.score}%
          </p>
          {evaluation.improvement_feedback && (
            <p className="mb-2 text-sm text-gray-700">{evaluation.improvement_feedback}</p>
          )}
          {evaluation.missing_points.length > 0 && (
            <div className="text-sm text-gray-700">
              <span className="font-medium">Missing points:</span>
              <ul className="mt-1 list-inside list-disc">
                {evaluation.missing_points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};
