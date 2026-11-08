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
import { useProctoring } from '@/components/interview/useProctoring';
import { ProctoringIndicator } from '@/components/interview/ProctoringIndicator';
import { analyzeAudioPauses } from '@/components/interview/analyzeAudioPauses';
import {
  pickResumeTarget,
  type ResumeAction,
} from '@/components/interview/resumeTarget';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import {
  interviewService,
  MAX_RECORDING_MB,
} from '@/services/interviewService';
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
// Consent acknowledgement retried in the background — never blocks the
// interview, and the server keeps the earliest recorded timestamp.
const CONSENT_MAX_RETRIES = 3;
const CONSENT_RETRY_DELAY_MS = 10_000;
// Show an extended-processing hint after this long during media upload.
const SLOW_PROCESSING_HINT_MS = 15_000;

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
  // Consent gate for proctoring event delivery — event batches queue until
  // the acknowledgement is persisted server-side.
  const [consentReady, setConsentReady] = useState(false);
  const [armFailed, setArmFailed] = useState(false);
  // Resume state for orphaned placeholders (F-003): 'record' re-offers the
  // question for recording; 'reprocess' retries stored media server-side.
  const [resumeAction, setResumeAction] = useState<ResumeAction>('fresh');
  const [resumeAnswerId, setResumeAnswerId] = useState<string | null>(null);
  const proctoring = useProctoring({
    stream: recording.stream,
    interviewId,
    mode: activeMode,
    activeQuestionId: current?.id ?? null,
    enabled: devicesReady && activeMode !== 'TEXT',
    consentReady,
  });
  const [mediaUpload, setMediaUpload] = useState<
    'idle' | 'uploading' | 'uploaded' | 'failed' | 'eval_failed'
  >('idle');
  const [slowProcessing, setSlowProcessing] = useState(false);
  const pendingUploadRef = useRef<{
    answerId: string;
    media: RecordedMedia;
  } | null>(null);
  const consentRetryRef = useRef<number | undefined>(undefined);
  const consentDoneRef = useRef(false);

  const acknowledgeConsent = useCallback(
    (attemptsLeft: number) => {
      if (!interviewId || consentDoneRef.current) return;
      interviewService
        .acknowledgeProctoringConsent(interviewId)
        .then(() => {
          consentDoneRef.current = true;
          setConsentReady(true);
        })
        .catch(() => {
          if (attemptsLeft > 0) {
            consentRetryRef.current = window.setTimeout(
              () => acknowledgeConsent(attemptsLeft - 1),
              CONSENT_RETRY_DELAY_MS
            );
          }
        });
    },
    [interviewId]
  );

  // Surface a long-processing hint while the upload pipeline works.
  useEffect(() => {
    if (mediaUpload !== 'uploading') {
      setSlowProcessing(false);
      return;
    }
    const t = window.setTimeout(
      () => setSlowProcessing(true),
      SLOW_PROCESSING_HINT_MS
    );
    return () => window.clearTimeout(t);
  }, [mediaUpload]);

  useEffect(
    () => () => window.clearTimeout(consentRetryRef.current),
    []
  );

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
      // Resume point: first unanswered question — or, in voice modes, an
      // orphaned placeholder (record again) / unprocessed recording
      // (retry processing, no re-record).
      const target = pickResumeTarget(data.questions, data.answers, mode);
      setResumeAction(target.action);
      setResumeAnswerId(target.answerId);
      setCurrent(target.question);
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
      void recording.arm().then((ok) => setArmFailed(!ok));
    }
  }, [devicesReady, activeMode, recording.arm]);

  // Record one clip per question. The cleanup discards the in-progress
  // recorder whenever the question changes or the component unmounts.
  const shouldRecord =
    devicesReady &&
    activeMode !== 'TEXT' &&
    !!current &&
    resumeAction !== 'reprocess';
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

  // Shared "move to the next question / finish" tail after a submit or a
  // media pipeline result.
  const advanceFromResult = useCallback(
    async (outcome: SubmitAnswerResponse) => {
      setEvaluation(outcome.evaluation ?? null);
      const updated = await interviewService.getById(interviewId!);
      setInterview(updated);
      setResumeAction('fresh');
      setResumeAnswerId(null);
      if (outcome.is_complete || outcome.next_question == null) {
        await handleEnd(updated);
        return;
      }
      setCurrent(outcome.next_question);
      setText('');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interviewId]
  );

  /**
   * Stop the recorder, validate the clip, and run the media pipeline for
   * an answer that already exists. On failure the question stays put —
   * the recorder is restarted so the next attempt records a fresh clip,
   * and the pending blob is kept for the Retry action.
   */
  const captureAndUpload = async (
    answerId: string
  ): Promise<SubmitMediaResponse | null> => {
    const media = await recording.stopAndCollect();
    const retryLater = () => {
      // The answer placeholder exists — later submits go straight to
      // capture+upload instead of re-submitting the answer.
      setResumeAnswerId(answerId);
      setResumeAction('record');
      if (recording.armed) recording.start();
    };
    if (!media) {
      setError(
        'No recording was captured — check your device and try again.'
      );
      retryLater();
      return null;
    }
    if (interviewService.isRecordingOversized(media.blob)) {
      setError(
        `Your recording is larger than ${MAX_RECORDING_MB} MB — it cannot be processed. Please keep answers shorter and try again.`
      );
      setMediaUpload('failed');
      pendingUploadRef.current = null;
      retryLater();
      return null;
    }
    return uploadRecording(answerId, media);
  };

  const handleSubmit = async () => {
    if (!current || !interviewId || submitting) return;
    const trimmed = text.trim();
    // Voice-first AUDIO/VIDEO answers are spoken, not typed — the typed
    // field is optional notes. TEXT still requires a non-empty answer.
    if (!voiceFirst && !trimmed) {
      setError('Please type an answer before submitting.');
      return;
    }
    if (voiceFirst && (recording.deadTrack || !recording.armed)) {
      setError(
        'Your recording device is unavailable — re-check it below before submitting.'
      );
      return;
    }
    setSubmitting(true);
    setError('');
    setEvaluation(null);
    setMediaUpload('idle');

    try {
      let outcome: SubmitAnswerResponse;
      if (resumeAnswerId) {
        // Orphaned placeholder — the answer row already exists, so skip
        // submitAnswer (it would be rejected as a duplicate) and go
        // straight to capture + upload.
        const processed = await captureAndUpload(resumeAnswerId);
        if (!processed) return;
        outcome = processed;
      } else {
        const response = await interviewService.submitAnswer(
          interviewId,
          current.id,
          {
            questionId: current.id,
            // In voice modes the spoken recording is the answer — typed
            // notes are never sent or evaluated.
            text: voiceFirst ? '' : trimmed,
            skipped: false,
            timeTaken: QUESTION_TIME,
            submittedAt: new Date().toISOString(),
          }
        );
        outcome = response;
        const answerId = response.answer?.id;
        if (voiceFirst && answerId) {
          // The answer placeholder exists now — any further attempt must
          // upload against it rather than re-submitting the answer.
          setResumeAnswerId(answerId);
          setResumeAction('record');
          const processed = await captureAndUpload(answerId);
          if (!processed) return;
          outcome = processed;
        }
      }
      await advanceFromResult(outcome);
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
      // Estimated pause stats for speech analysis — null on unsupported
      // browsers; never blocks the upload.
      const pauses = await analyzeAudioPauses(media.blob);
      const result = await interviewService.uploadAnswerMedia(
        interviewId,
        answerId,
        media.blob,
        media.durationSeconds,
        pauses ?? undefined
      );
      if (result.media?.transcription_status === 'COMPLETED' && !result.evaluation) {
        // Transcript saved but evaluation unavailable — the same retry
        // re-uploads the blob; the backend skips transcription and
        // re-runs only the evaluation.
        setMediaUpload('eval_failed');
        pendingUploadRef.current = { answerId, media };
        if (recording.armed) recording.start();
      } else {
        setMediaUpload('uploaded');
        pendingUploadRef.current = null;
      }
      return result;
    } catch {
      setMediaUpload('failed');
      pendingUploadRef.current = { answerId, media };
      // Restart the recorder — the previous one was consumed by
      // stopAndCollect, so the next Submit captures a fresh clip.
      if (recording.armed) recording.start();
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
        await advanceFromResult(result);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Retry server-side processing of a recording already in storage — the
  // candidate does not need to re-record (F-003 reprocess resume action).
  const handleReprocess = async () => {
    if (!resumeAnswerId || !interviewId || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await interviewService.reprocessMedia(
        interviewId,
        resumeAnswerId
      );
      await advanceFromResult(result);
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'Could not process the stored recording. Please try again.'
        )
      );
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
          onReady={() => {
            // Fire-and-retry consent — a backend failure is retried in the
            // background and never blocks or terminates the interview.
            acknowledgeConsent(CONSENT_MAX_RETRIES);
            setDevicesReady(true);
          }}
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
            if (resumeAction === 'reprocess') void handleReprocess();
            else if (text.trim() || voiceFirst) void handleSubmit();
            else void handleSkip();
          }}
        />
      </div>

      {activeMode !== 'TEXT' && devicesReady && (
        <ProctoringIndicator status={proctoring.status} />
      )}

      {/* Device recovery — a dead mic/camera never silently records. */}
      {voiceFirst && (recording.deadTrack || armFailed) && (
        <div
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3"
          role="alert"
        >
          <p className="text-sm text-amber-800">
            {recording.deadTrack === 'video'
              ? 'Your camera stopped working. '
              : 'Your microphone is unavailable. '}
            Answers cannot be recorded until the device works again.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                recording.release();
                setArmFailed(false);
                void recording.arm().then((ok) => setArmFailed(!ok));
              }}
            >
              Re-check device
            </Button>
            {activeMode === 'VIDEO' && (
              <Button
                variant="secondary"
                onClick={() => void handleModeSwitch('AUDIO')}
              >
                Switch to audio interview
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mb-6 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-primary-600 transition-all"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <QuestionCard question={current} index={answeredCount} total={Math.max(total, answeredCount + 1)} />

      {voiceFirst && resumeAction === 'record' && resumeAnswerId && (
        <p className="mt-3 text-sm text-amber-700">
          Your previous recording for this question was not completed —
          please record it again.
        </p>
      )}

      <div className="mt-6">
        {voiceFirst && resumeAction === 'reprocess' && resumeAnswerId ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              Your recording for this question was saved but not fully
              processed — likely due to an interruption. You can retry
              processing it without recording again.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={handleReprocess} disabled={submitting}>
                {submitting ? 'Processing...' : 'Retry processing'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleEnd()}
                disabled={submitting || loading}
              >
                End interview
              </Button>
            </div>
          </div>
        ) : (
          <>
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
              {!resumeAnswerId && (
                <Button
                  variant="secondary"
                  onClick={handleSkip}
                  disabled={submitting}
                >
                  {isLast ? 'Skip & finish' : 'Skip'}
                </Button>
              )}
              <Button variant="secondary" onClick={() => handleEnd()} disabled={submitting || loading}>
                End interview
              </Button>
            </div>
          </>
        )}
      </div>

      {voiceFirst && mediaUpload !== 'idle' && (
        <div className="mt-3 text-sm" role="status">
          {mediaUpload === 'uploading' && (
            <span className="text-gray-600">
              {slowProcessing
                ? 'Still processing — long recordings can take up to a minute.'
                : 'Uploading, transcribing and evaluating your answer...'}
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
