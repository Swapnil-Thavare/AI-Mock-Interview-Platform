import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { interviewService } from '@/services/interviewService';
import type {
  InterviewMode,
  InterviewResult as InterviewResultType,
  ProctoringEvent,
  ProctoringEventType,
  ProctoringSummary,
} from '@/types';

const PROCTORING_LABELS: Record<ProctoringEventType, string> = {
  FACE_NOT_DETECTED: 'Face not detected',
  MULTIPLE_FACES_DETECTED: 'Multiple faces detected',
  CAMERA_DISCONNECTED: 'Camera disconnected',
  CAMERA_INTERRUPTED: 'Camera interrupted',
  TAB_HIDDEN: 'Browser tab hidden',
  WINDOW_FOCUS_LOST: 'Window focus lost',
};

const formatSeconds = (value: number | null | undefined): string => {
  const s = Math.round(value ?? 0);
  return `${s} second${s === 1 ? '' : 's'}`;
};

const proctoringSummaryLines = (
  summary: ProctoringSummary
): string[] => {
  const count = (t: ProctoringEventType) => summary.counts[t] ?? 0;
  const duration = (t: ProctoringEventType) => summary.durations_seconds[t];
  const times = (n: number) => (n === 1 ? 'once' : `${n} times`);
  const lines: string[] = [];
  if (count('FACE_NOT_DETECTED') > 0) {
    lines.push(
      `Face was not visible ${times(count('FACE_NOT_DETECTED'))} — total ${formatSeconds(duration('FACE_NOT_DETECTED'))}.`
    );
  }
  if (count('MULTIPLE_FACES_DETECTED') > 0) {
    lines.push(
      `Multiple faces were detected ${times(count('MULTIPLE_FACES_DETECTED'))} — total ${formatSeconds(duration('MULTIPLE_FACES_DETECTED'))}.`
    );
  }
  if (count('CAMERA_INTERRUPTED') > 0) {
    lines.push(
      `Camera interruption detected ${times(count('CAMERA_INTERRUPTED'))} — total ${formatSeconds(duration('CAMERA_INTERRUPTED'))}.`
    );
  }
  if (count('CAMERA_DISCONNECTED') > 0) {
    lines.push(
      `Camera was disconnected ${times(count('CAMERA_DISCONNECTED'))}.`
    );
  }
  if (count('TAB_HIDDEN') > 0) {
    lines.push(
      `Browser tab was hidden ${times(count('TAB_HIDDEN'))} — total ${formatSeconds(duration('TAB_HIDDEN'))}.`
    );
  }
  if (count('WINDOW_FOCUS_LOST') > 0) {
    lines.push(
      `Window focus was lost ${times(count('WINDOW_FOCUS_LOST'))} — total ${formatSeconds(duration('WINDOW_FOCUS_LOST'))}.`
    );
  }
  return lines;
};

const ScoreCard: React.FC<{ label: string; value: number | null | undefined; color?: string }> = ({
  label,
  value,
  color = 'text-primary-700',
}) => {
  const display = value == null ? '—' : `${Math.round(value)}%`;
  return (
    <Card className="text-center">
      <h3 className="text-sm text-gray-600">{label}</h3>
      <div className={`text-5xl font-extrabold ${color}`}>{display}</div>
    </Card>
  );
};

export const InterviewResult: React.FC = () => {
  const navigate = useNavigate();
  const { interviewId } = useParams<{ interviewId: string }>();
  const [result, setResult] = useState<InterviewResultType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('TEXT');
  const [proctoring, setProctoring] = useState<{
    summary: ProctoringSummary;
    events: ProctoringEvent[];
  } | null>(null);

  const id = interviewId ?? localStorage.getItem('currentInterviewId');

  const load = useCallback(async () => {
    if (!id) {
      navigate('/interview/setup');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const interview = await interviewService.getById(id);
      setInterviewMode(interview.interview_mode ?? 'TEXT');
      if (interview.interview_mode !== 'TEXT') {
        try {
          const [summary, events] = await Promise.all([
            interviewService.getProctoringSummary(id),
            interviewService.getProctoringEvents(id),
          ]);
          setProctoring({ summary, events });
        } catch {
          // Proctoring data is additive — never fail the result page.
        }
      }
      if (interview.result) {
        setResult(interview.result);
      } else {
        const data = await interviewService.complete(id);
        setResult(data);
      }
    } catch {
      setError('Could not load results. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!id) {
        navigate('/interview/setup');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const interview = await interviewService.getById(id);
        if (ignore) return;
        setInterviewMode(interview.interview_mode ?? 'TEXT');
        if (interview.interview_mode !== 'TEXT') {
          try {
            const [summary, events] = await Promise.all([
              interviewService.getProctoringSummary(id),
              interviewService.getProctoringEvents(id),
            ]);
            if (!ignore) setProctoring({ summary, events });
          } catch {
            // Proctoring data is additive — never fail the result page.
          }
        }
        if (interview.result) {
          setResult(interview.result);
        } else {
          const data = await interviewService.complete(id);
          if (!ignore) setResult(data);
        }
      } catch {
        if (!ignore) setError('Could not load results. Please try again.');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    void run();
    return () => {
      ignore = true;
    };
  }, [navigate, interviewId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">Loading results...</div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <Button onClick={load} disabled={loading}>
            {loading ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!result) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">No results available.</div>
      </DashboardLayout>
    );
  }

  const total = result.totalQuestions ?? 0;
  const answered = result.answered ?? 0;
  const skipped = result.skipped ?? 0;

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Interview result</h2>
        <Link to="/interviews">
          <Button variant="secondary">View history</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <ScoreCard label="Overall score" value={result.score} />
        <ScoreCard label="Technical" value={result.technical_score} color="text-blue-600" />
        <ScoreCard label="Communication" value={result.communication_score} color="text-green-600" />
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <ScoreCard label="Relevance" value={result.relevance_score} color="text-purple-600" />
        <ScoreCard label="Problem solving" value={result.problem_solving_score} color="text-orange-600" />
        <ScoreCard label="Confidence" value={result.confidence} color="text-gray-600" />
      </div>

      <Card className="mt-6">
        <h3 className="mb-2 text-lg font-semibold">Overall feedback</h3>
        <p className="text-gray-700">{result.overall_feedback || result.feedback}</p>
        {result.resume_alignment && (
          <p className="mt-4 text-sm text-gray-700">
            <span className="font-medium">Resume alignment:</span> {result.resume_alignment}
          </p>
        )}
        {result.uncertainty_notes && (
          <p className="mt-2 text-sm italic text-gray-500">{result.uncertainty_notes}</p>
        )}
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-lg font-semibold text-green-700">Strengths</h3>
          <ul className="list-inside list-disc text-sm text-gray-700">
            {result.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
            {result.strengths.length === 0 && <li className="list-none text-gray-500">No strengths recorded.</li>}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-2 text-lg font-semibold text-red-700">Weaknesses</h3>
          <ul className="list-inside list-disc text-sm text-gray-700">
            {result.weaknesses.map((w) => (
              <li key={w}>{w}</li>
            ))}
            {result.weaknesses.length === 0 && <li className="list-none text-gray-500">No weaknesses recorded.</li>}
          </ul>
        </Card>
      </div>

      {result.missing_skills && result.missing_skills.length > 0 && (
        <Card className="mt-6">
          <h3 className="mb-2 text-lg font-semibold text-yellow-700">Missing or weak skills</h3>
          <ul className="list-inside list-disc text-sm text-gray-700">
            {result.missing_skills.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      )}

      {result.preparation_topics && result.preparation_topics.length > 0 && (
        <Card className="mt-6">
          <h3 className="mb-2 text-lg font-semibold text-blue-700">Recommended preparation topics</h3>
          <ul className="list-inside list-disc text-sm text-gray-700">
            {result.preparation_topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
      )}

      {result.questionResults && result.questionResults.length > 0 && (
        <>
          <h3 className="mb-4 mt-8 text-lg font-semibold text-gray-900">Question-level feedback</h3>
          <div className="space-y-4">
            {result.questionResults.map((qr) => (
              <Card key={String(qr.questionId)}>
                <div className="mb-2 flex items-start justify-between">
                  <h4 className="font-medium text-gray-900">{qr.question}</h4>
                  <Badge color={qr.score >= 70 ? 'green' : qr.score > 0 ? 'yellow' : 'red'}>
                    {qr.score}%
                  </Badge>
                </div>
                <p className="mb-2 text-sm text-gray-700">
                  <span className="font-medium">Your answer:</span>{' '}
                  {qr.answer || '(skipped)'}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Feedback:</span> {qr.feedback}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}

      {(total > 0 || answered > 0 || skipped > 0) && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card className="text-center">
            <h3 className="text-sm text-gray-600">Answered</h3>
            <div className="text-4xl font-extrabold text-green-600">
              {answered}/{total || answered + skipped}
            </div>
          </Card>
          <Card className="text-center">
            <h3 className="text-sm text-gray-600">Skipped</h3>
            <div className="text-4xl font-extrabold text-yellow-600">
              {skipped}/{total || answered + skipped}
            </div>
          </Card>
        </div>
      )}

      {interviewMode !== 'TEXT' && (
        <Card className="mt-6">
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            Session Integrity Observations
          </h3>
          <p className="mb-4 text-xs text-gray-500">
            Objective observations recorded locally in your browser during the
            interview. They are not automatic proof of misconduct and do not
            affect the interview score.
          </p>
          {!proctoring ? (
            <p className="text-sm text-gray-500">
              Session integrity observations are unavailable.
            </p>
          ) : proctoring.summary.total_events === 0 ? (
            <p className="text-sm text-gray-500">
              No session integrity observations were recorded during this
              interview.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-700">
                <span className="font-medium">Total observations:</span>{' '}
                {proctoring.summary.total_events}
              </p>
              <ul className="list-inside list-disc text-sm text-gray-700">
                {proctoringSummaryLines(proctoring.summary).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {proctoring.events.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                    Timeline
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {proctoring.events.map((event) => (
                      <li key={event.id}>
                        <span className="font-mono text-xs text-gray-500">
                          {new Date(event.started_at).toLocaleTimeString()}
                        </span>{' '}
                        — {PROCTORING_LABELS[event.event_type] ?? event.event_type}
                        {event.duration_seconds != null &&
                          ` (${formatSeconds(event.duration_seconds)})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </DashboardLayout>
  );
};
