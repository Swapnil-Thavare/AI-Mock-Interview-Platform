import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/services/api';
import { interviewService } from '@/services/interviewService';
import type {
  AnswerEvaluation,
  InterviewMode,
  InterviewReport,
  ProctoringEventType,
  ReportAnswerStatus,
  ReportQuestionBlock,
  SpeechAnalysis,
} from '@/types';

const PROCTORING_LABELS: Record<ProctoringEventType, string> = {
  FACE_NOT_DETECTED: 'Face not detected',
  MULTIPLE_FACES_DETECTED: 'Multiple faces detected',
  CAMERA_DISCONNECTED: 'Camera disconnected',
  CAMERA_INTERRUPTED: 'Camera interrupted',
  TAB_HIDDEN: 'Browser tab hidden',
  WINDOW_FOCUS_LOST: 'Window focus lost',
};

// Which session-integrity event types are meaningful per mode. AUDIO
// interviews never show camera/face observations.
const SESSION_TYPES_BY_MODE: Record<'AUDIO' | 'VIDEO', ProctoringEventType[]> = {
  AUDIO: ['TAB_HIDDEN', 'WINDOW_FOCUS_LOST'],
  VIDEO: [
    'FACE_NOT_DETECTED',
    'MULTIPLE_FACES_DETECTED',
    'CAMERA_DISCONNECTED',
    'CAMERA_INTERRUPTED',
    'TAB_HIDDEN',
    'WINDOW_FOCUS_LOST',
  ],
};

const formatSeconds = (value: number | null | undefined): string => {
  const s = Math.round(value ?? 0);
  return `${s} second${s === 1 ? '' : 's'}`;
};

const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds == null) return '—';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} sec`;
  return s === 0 ? `${m} min` : `${m} min ${s} sec`;
};

const formatDate = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

const formatDateTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString() : '—';

const metric = (value: number | null | undefined, suffix = ''): string =>
  value == null ? '—' : `${value}${suffix}`;

const percent = (ratio: number | null | undefined): string =>
  ratio == null ? '—' : `${Math.round(ratio * 100)}%`;

const scoreColor = (score: number | null | undefined): string => {
  if (score == null) return 'text-gray-500';
  if (score >= 70) return 'text-green-700';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
};

const scoreBadgeColor = (
  score: number | null | undefined
): 'green' | 'yellow' | 'red' =>
  score != null && score >= 70
    ? 'green'
    : score != null && score > 0
    ? 'yellow'
    : 'red';

interface FillerSplit {
  definite: number | null;
  possible: number | null;
}

const fillerSplit = (analysis: SpeechAnalysis): FillerSplit => {
  const breakdown = analysis.filler_breakdown;
  if (!breakdown) return { definite: null, possible: null };
  return Object.values(breakdown).reduce<FillerSplit>(
    (acc, entry) => {
      if (entry?.ambiguous) acc.possible = (acc.possible ?? 0) + entry.count;
      else acc.definite = (acc.definite ?? 0) + entry.count;
      return acc;
    },
    { definite: 0, possible: 0 }
  );
};

const ANSWER_STATUS_TEXT: Record<ReportAnswerStatus, string> = {
  answered: '',
  skipped: 'This question was skipped.',
  pending:
    'A spoken answer was started but the recording or its transcription is still pending.',
  unavailable:
    'A recording or its transcription is unavailable, so no answer text could be produced.',
};

const Section: React.FC<{
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, className = '', children }) => (
  <Card className={`break-inside-avoid print:shadow-none ${className}`}>
    <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
      {title}
    </h2>
    {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </Card>
);

const ScoreTile: React.FC<{
  label: string;
  value: number | null | undefined;
  large?: boolean;
}> = ({ label, value, large = false }) => (
  <div
    className={`rounded-lg border border-gray-200 p-4 text-center ${
      large ? 'bg-primary-50' : 'bg-white'
    }`}
  >
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div
      className={`font-extrabold ${large ? 'text-4xl' : 'text-3xl'} ${scoreColor(
        value
      )}`}
    >
      {value == null ? '—' : `${Math.round(value)}%`}
    </div>
  </div>
);

const MetaItem: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div>
    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
  </div>
);

/** Content that is collapsible on screen but always expanded in print. */
const Collapsible: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-medium text-primary-700 hover:text-primary-800 print:hidden"
      >
        {open ? '▾' : '▸'} {title}
      </button>
      <div className="mt-2 hidden print:block">{children}</div>
      {open && <div className="mt-2 print:hidden">{children}</div>}
    </div>
  );
};

const EvalDetail: React.FC<{ evaluation: AnswerEvaluation }> = ({
  evaluation,
}) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(
        [
          ['Relevance', evaluation.relevance_score],
          ['Correctness', evaluation.correctness_score],
          ['Clarity', evaluation.clarity_score],
          ['Depth', evaluation.depth_score],
        ] as const
      ).map(([label, value]) => (
        <div
          key={label}
          className="rounded-lg bg-gray-50 p-2 text-center"
        >
          <div className="text-xs text-gray-500">{label}</div>
          <div className={`text-lg font-bold ${scoreColor(value)}`}>
            {value}%
          </div>
        </div>
      ))}
    </div>
    {(evaluation.strengths.length > 0 ||
      evaluation.weaknesses.length > 0) && (
      <div className="grid gap-3 sm:grid-cols-2">
        {evaluation.strengths.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-green-700">
              Strengths
            </div>
            <ul className="list-inside list-disc text-sm text-gray-700">
              {evaluation.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {evaluation.weaknesses.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-red-700">
              Weaknesses
            </div>
            <ul className="list-inside list-disc text-sm text-gray-700">
              {evaluation.weaknesses.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}
    {evaluation.missing_points.length > 0 && (
      <div>
        <div className="text-xs font-semibold text-yellow-700">
          Missing points
        </div>
        <ul className="list-inside list-disc text-sm text-gray-700">
          {evaluation.missing_points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    )}
    {evaluation.improvement_feedback && (
      <p className="text-sm text-gray-700">
        <span className="font-medium">Improvement feedback:</span>{' '}
        {evaluation.improvement_feedback}
      </p>
    )}
    {evaluation.ideal_answer_summary && (
      <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
        <span className="font-medium">What a strong answer would include:</span>{' '}
        {evaluation.ideal_answer_summary}
      </p>
    )}
    {evaluation.uncertainty_notes && (
      <p className="text-sm italic text-gray-500">
        {evaluation.uncertainty_notes}
      </p>
    )}
  </div>
);

const speechSummaryLine = (analysis: SpeechAnalysis): string | null => {
  const parts: string[] = [];
  if (analysis.wpm_recording != null) {
    parts.push(`${analysis.wpm_recording} wpm`);
  }
  const fillers = fillerSplit(analysis);
  if (fillers.definite != null || fillers.possible != null) {
    parts.push(
      `${metric(fillers.definite)} definite / ${metric(
        fillers.possible
      )} possible fillers`
    );
  }
  if (analysis.pause_count != null) {
    parts.push(
      `${analysis.pause_count} pauses (${formatSeconds(
        analysis.pause_total_seconds
      )})`
    );
  }
  return parts.length ? parts.join(' · ') : null;
};

const QuestionReportCard: React.FC<{
  block: ReportQuestionBlock;
  index: number;
  childrenOf: (id: string) => ReportQuestionBlock[];
}> = ({ block, index, childrenOf }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="break-inside-avoid rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Question {index + 1}
          </div>
          <h4 className="mt-0.5 font-medium text-gray-900">
            {block.question_text}
          </h4>
          <div className="mt-1 flex flex-wrap gap-1 print:hidden">
            <Badge color="gray">{block.question_type}</Badge>
            <Badge color="gray">{block.difficulty}</Badge>
            {block.answer_status !== 'answered' && (
              <Badge color="yellow">{block.answer_status}</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {block.score != null && (
            <Badge color={scoreBadgeColor(block.score)}>
              {Math.round(block.score)}%
            </Badge>
          )}
          <span className="text-gray-400 print:hidden">
            {open ? '▾' : '▸'}
          </span>
        </div>
      </button>

      {/* Expanded on demand on screen; always expanded in print. */}
      <div className="hidden border-t border-gray-200 p-4 print:block">
        <QuestionBody block={block} />
      </div>
      {open && (
        <div className="border-t border-gray-200 p-4 print:hidden">
          <QuestionBody block={block} />
        </div>
      )}

      {childrenOf(block.question_id).map((child) => (
        <div
          key={child.question_id}
          className="ml-4 border-l-2 border-gray-200 pl-4 sm:ml-6"
        >
          <FollowUpBlock block={child} childrenOf={childrenOf} />
        </div>
      ))}
    </div>
  );
};

const QuestionBody: React.FC<{ block: ReportQuestionBlock }> = ({ block }) => (
  <div className="space-y-3 text-sm">
    {block.expected_focus && (
      <p className="text-gray-600">
        <span className="font-medium">Expected focus:</span>{' '}
        {block.expected_focus}
      </p>
    )}
    {block.answer_status === 'answered' && block.answer_text && (
      <div>
        <div className="font-medium text-gray-900">Candidate answer</div>
        <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-gray-700">
          {block.answer_text}
        </p>
      </div>
    )}
    {block.answer_status !== 'answered' && (
      <p className="italic text-gray-500">
        {ANSWER_STATUS_TEXT[block.answer_status]}
      </p>
    )}
    {block.evaluation ? (
      <EvalDetail evaluation={block.evaluation} />
    ) : (
      block.answer_status === 'answered' && (
        <p className="text-gray-500">No evaluation is available for this answer.</p>
      )
    )}
    {block.speech_analysis && speechSummaryLine(block.speech_analysis) && (
      <p className="text-xs text-gray-500">
        <span className="font-medium">Delivery observations:</span>{' '}
        {speechSummaryLine(block.speech_analysis)}
      </p>
    )}
  </div>
);

const FollowUpBlock: React.FC<{
  block: ReportQuestionBlock;
  childrenOf: (id: string) => ReportQuestionBlock[];
}> = ({ block, childrenOf }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="break-inside-avoid py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-primary-700">
            Follow-up question
          </div>
          <h5 className="mt-0.5 text-sm font-medium text-gray-900">
            {block.question_text}
          </h5>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {block.score != null && (
            <Badge color={scoreBadgeColor(block.score)}>
              {Math.round(block.score)}%
            </Badge>
          )}
          <span className="text-gray-400 print:hidden">
            {open ? '▾' : '▸'}
          </span>
        </div>
      </button>
      {block.follow_up_reason && (
        <p className="mt-1 text-xs italic text-gray-500">
          {block.follow_up_reason}
        </p>
      )}
      <div className="mt-2 hidden print:block">
        <QuestionBody block={block} />
      </div>
      {open && (
        <div className="mt-2 print:hidden">
          <QuestionBody block={block} />
        </div>
      )}
      {childrenOf(block.question_id).map((child) => (
        <div
          key={child.question_id}
          className="ml-4 border-l-2 border-gray-200 pl-4"
        >
          <FollowUpBlock block={child} childrenOf={childrenOf} />
        </div>
      ))}
    </div>
  );
};

const SpeechAnswerRow: React.FC<{
  block: ReportQuestionBlock;
}> = ({ block }) => {
  const analysis = block.speech_analysis;
  if (!analysis) return null;
  const fillers = fillerSplit(analysis);
  return (
    <div className="break-inside-avoid rounded-lg border border-gray-200 p-4">
      <p className="mb-3 text-sm font-medium text-gray-900">
        {block.question_text}
      </p>
      <div className="grid gap-x-6 gap-y-1 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-3">
        <span>Words: {metric(analysis.word_count)}</span>
        <span>
          Answer length: {metric(analysis.recording_seconds, 's')}
        </span>
        <span>Pace: {metric(analysis.wpm_recording, ' wpm')}</span>
        <span>
          Rate excl. pauses: {metric(analysis.wpm_speech, ' wpm')}
        </span>
        <span>Definite fillers: {metric(fillers.definite)}</span>
        <span>Possible fillers: {metric(fillers.possible)}</span>
        {analysis.filler_per_100_words != null && (
          <span>
            Filler rate: ≈{analysis.filler_per_100_words} per 100 words
          </span>
        )}
        <span>
          Pauses:{' '}
          {analysis.pause_count == null
            ? '—'
            : `${analysis.pause_count} (${metric(
                analysis.pause_total_seconds,
                's'
              )} total)`}
        </span>
        <span>
          Unique-word ratio: {percent(analysis.unique_word_ratio)}
        </span>
        {analysis.top_repeated_words &&
          analysis.top_repeated_words.length > 0 && (
            <span className="sm:col-span-2">
              Repeated words:{' '}
              {analysis.top_repeated_words
                .map((w) => `${w.word} (${w.count})`)
                .join(', ')}
            </span>
          )}
      </div>
      {analysis.filler_breakdown &&
        Object.keys(analysis.filler_breakdown).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(analysis.filler_breakdown).map(
              ([term, entry]) => (
                <Badge key={term} color="gray">
                  {entry.ambiguous ? '≈' : ''}
                  {term} ×{entry.count}
                </Badge>
              )
            )}
          </div>
        )}
      {analysis.status === 'FAILED' && (
        <p className="mt-2 text-xs text-gray-500">
          Communication observations for this answer are unavailable; the
          descriptive metrics above were still recorded.
        </p>
      )}
      {analysis.structure_summary && (
        <p className="mt-3 text-sm text-gray-700">
          <span className="font-medium">Structure:</span>{' '}
          {analysis.structure_summary}
        </p>
      )}
      {analysis.organization_notes &&
        analysis.organization_notes.length > 0 && (
          <ul className="mt-1 list-inside list-disc text-sm text-gray-600">
            {analysis.organization_notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      {analysis.clarity_notes && (
        <p className="mt-2 text-sm text-gray-700">
          <span className="font-medium">Clarity:</span>{' '}
          {analysis.clarity_notes}
        </p>
      )}
      {((analysis.communication_strengths?.length ?? 0) > 0 ||
        (analysis.communication_improvements?.length ?? 0) > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {analysis.communication_strengths &&
            analysis.communication_strengths.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-green-700">
                  Communication strengths
                </div>
                <ul className="list-inside list-disc text-sm text-gray-700">
                  {analysis.communication_strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          {analysis.communication_improvements &&
            analysis.communication_improvements.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-yellow-700">
                  Could improve
                </div>
                <ul className="list-inside list-disc text-sm text-gray-700">
                  {analysis.communication_improvements.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}
      {block.media?.transcript_text && (
        <div className="mt-3">
          <Collapsible title="Transcript">
            <p className="whitespace-pre-wrap break-words rounded bg-gray-50 p-3 text-sm text-gray-700">
              {block.media.transcript_text}
            </p>
          </Collapsible>
        </div>
      )}
    </div>
  );
};

export const InterviewResult: React.FC = () => {
  const navigate = useNavigate();
  const { interviewId } = useParams<{ interviewId: string }>();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const id = interviewId ?? localStorage.getItem('currentInterviewId');

  const load = useCallback(
    async (cancelled?: () => boolean) => {
      if (!id) {
        navigate('/interview/setup');
        return;
      }
      setLoading(true);
      setError('');
      try {
        let data: InterviewReport;
        try {
          data = await interviewService.getReport(id);
        } catch (err) {
          const status = (
            err as { response?: { status?: number } }
          )?.response?.status;
          if (status !== 404) throw err;
          // No persisted result yet — complete the interview once, then
          // fetch the report. Mirrors the previous completion-on-arrival
          // behaviour while keeping the report as the single data source.
          await interviewService.complete(id).catch(() => undefined);
          data = await interviewService.getReport(id);
        }
        if (!cancelled?.()) setReport(data);
      } catch (err) {
        if (!cancelled?.()) {
          setError(
            getApiErrorMessage(err, 'Could not load the interview report.')
          );
        }
      } finally {
        if (!cancelled?.()) setLoading(false);
      }
    },
    [id, navigate]
  );

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">
          Preparing your interview report...
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <Button onClick={() => void load()} disabled={loading}>
            {loading ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">
          No report is available for this interview.
        </div>
      </DashboardLayout>
    );
  }

  const { overview, result, communication, session_integrity } = report;
  const mode = overview.interview_mode as InterviewMode;
  const voiceMode = mode !== 'TEXT';

  const byId = new Map(report.questions.map((q) => [q.question_id, q]));
  const children = new Map<string, ReportQuestionBlock[]>();
  for (const q of report.questions) {
    if (q.is_follow_up && q.parent_question_id && byId.has(q.parent_question_id)) {
      const list = children.get(q.parent_question_id) ?? [];
      list.push(q);
      children.set(q.parent_question_id, list);
    }
  }
  const childrenOf = (id: string) => children.get(id) ?? [];
  // Top level = real questions plus any orphaned follow-up whose parent is
  // missing from the report payload (defensive — should not happen).
  const mainBlocks = report.questions.filter(
    (q) =>
      !q.is_follow_up ||
      !q.parent_question_id ||
      !byId.has(q.parent_question_id)
  );

  const allowedEventTypes = new Set<ProctoringEventType>(
    voiceMode ? SESSION_TYPES_BY_MODE[mode as 'AUDIO' | 'VIDEO'] : []
  );
  const integrityEvents = (session_integrity?.events ?? []).filter((e) =>
    allowedEventTypes.has(e.event_type)
  );
  const integritySummaryLines = (() => {
    if (!session_integrity) return [] as string[];
    const counts = session_integrity.summary.counts;
    const durations = session_integrity.summary.durations_seconds;
    const times = (n: number) => (n === 1 ? 'once' : `${n} times`);
    const lines: string[] = [];
    for (const type of allowedEventTypes) {
      const count = counts[type] ?? 0;
      if (count <= 0) continue;
      const duration = durations[type];
      const label = PROCTORING_LABELS[type];
      lines.push(
        duration != null
          ? `${label} ${times(count)} — total ${formatSeconds(duration)}.`
          : `${label} ${times(count)}.`
      );
    }
    return lines;
  })();

  return (
    <DashboardLayout>
      {/* Screen controls — never printed. */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Interview report</h2>
        <div className="flex gap-2">
          <Button onClick={() => window.print()}>Download report</Button>
          <Link to="/interviews">
            <Button variant="secondary">View history</Button>
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {/* A. Report header */}
        <Card className="border-t-4 border-t-primary-600 print:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary-700">
                IntelliInterview
              </p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                Interview Assessment Report
              </h1>
              <p className="mt-1 text-gray-600">
                {report.candidate_name || 'Candidate'}
                {report.job_title ? ` — ${report.job_title}` : ''}
                {report.company ? `, ${report.company}` : ''}
              </p>
            </div>
            <Badge color="primary">{mode}</Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
            <MetaItem
              label="Candidate"
              value={report.candidate_name || '—'}
            />
            <MetaItem
              label="Target role"
              value={
                report.job_title
                  ? `${report.job_title}${
                      report.company ? ` · ${report.company}` : ''
                    }`
                  : '—'
              }
            />
            <MetaItem
              label="Interview date"
              value={formatDate(overview.created_at)}
            />
            <MetaItem
              label="Report ID"
              value={
                <span className="break-all font-mono text-xs">
                  {report.report_id}
                </span>
              }
            />
          </dl>
        </Card>

        {/* B. Executive summary */}
        <Section title="Executive summary">
          <div className="grid gap-4 md:grid-cols-3">
            <ScoreTile label="Overall score" value={result.score} large />
            <div className="md:col-span-2">
              {(result.overall_feedback || result.feedback) && (
                <p className="text-sm text-gray-700">
                  {result.overall_feedback || result.feedback}
                </p>
              )}
              {result.completion_summary && (
                <p className="mt-2 text-sm text-gray-600">
                  {result.completion_summary}
                </p>
              )}
              {result.uncertainty_notes && (
                <p className="mt-2 text-sm italic text-gray-500">
                  {result.uncertainty_notes}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-green-700">
                Key strengths
              </div>
              <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
                {result.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
                {result.strengths.length === 0 && (
                  <li className="list-none text-gray-500">None recorded.</li>
                )}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Improvement areas
              </div>
              <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
                {result.weaknesses.map((w) => (
                  <li key={w}>{w}</li>
                ))}
                {result.weaknesses.length === 0 && (
                  <li className="list-none text-gray-500">None recorded.</li>
                )}
              </ul>
            </div>
          </div>
        </Section>

        {/* C. Interview overview */}
        <Section title="Interview overview">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetaItem label="Mode" value={mode} />
            <MetaItem
              label="Difficulty"
              value={
                overview.difficulty.charAt(0).toUpperCase() +
                overview.difficulty.slice(1)
              }
            />
            <MetaItem
              label="Session duration (approx.)"
              value={formatDuration(overview.elapsed_seconds)}
            />
            <MetaItem
              label="Completed"
              value={formatDate(overview.completed_at)}
            />
            <MetaItem label="Total questions" value={overview.total_questions} />
            <MetaItem label="Answered" value={overview.answered_count} />
            <MetaItem label="Skipped" value={overview.skipped_count} />
            <MetaItem
              label="Follow-up questions"
              value={overview.follow_up_count}
            />
          </dl>
          {(overview.pending_count > 0 || overview.unavailable_count > 0) && (
            <p className="mt-3 text-xs text-gray-500">
              {overview.pending_count > 0 &&
                `${overview.pending_count} answer(s) still pending a recording or transcription. `}
              {overview.unavailable_count > 0 &&
                `${overview.unavailable_count} answer(s) unavailable due to a recording or transcription problem.`}
            </p>
          )}
        </Section>

        {/* D. Technical assessment */}
        <Section title="Assessment scores">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ScoreTile label="Technical" value={result.technical_score} />
            <ScoreTile label="Relevance" value={result.relevance_score} />
            <ScoreTile
              label="Problem solving"
              value={result.problem_solving_score}
            />
            {result.communication_score != null && (
              <ScoreTile
                label="Communication"
                value={result.communication_score}
              />
            )}
          </div>
          {result.resume_alignment && (
            <p className="mt-4 text-sm text-gray-700">
              <span className="font-medium">Resume alignment:</span>{' '}
              {result.resume_alignment}
            </p>
          )}
          {result.missing_skills && result.missing_skills.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
                Missing or weak skills
              </div>
              <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
                {result.missing_skills.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {result.confidence != null && (
            <p className="mt-4 text-xs text-gray-500">
              Evaluation confidence: {Math.round(result.confidence)}%
            </p>
          )}
        </Section>

        {/* E. Question-wise analysis */}
        <Section
          title="Question-wise analysis"
          subtitle={
            mainBlocks.length
              ? `${mainBlocks.length} question${
                  mainBlocks.length === 1 ? '' : 's'
                } — expand each for the full answer and evaluation.`
              : undefined
          }
          className="print:break-before-page print:break-inside-auto"
        >
          {mainBlocks.length === 0 ? (
            <p className="text-sm text-gray-500">
              No questions were recorded for this interview.
            </p>
          ) : (
            <div className="space-y-3">
              {mainBlocks.map((block, idx) => (
                <QuestionReportCard
                  key={block.question_id}
                  block={block}
                  index={idx}
                  childrenOf={childrenOf}
                />
              ))}
            </div>
          )}
        </Section>

        {/* F. Communication analysis (AUDIO/VIDEO only) */}
        {voiceMode && (
          <Section
            title="Communication analysis"
            subtitle="Descriptive observations about how each spoken answer was delivered — estimated from transcripts and recordings. These are not scores and do not affect the interview result. ≈ marks approximate (ambiguous) filler matches; — means a metric was unavailable."
            className="print:break-inside-auto"
          >
            {!communication || communication.answers_analyzed === 0 ? (
              <p className="text-sm text-gray-500">
                No communication analysis is available for this interview.
              </p>
            ) : (
              <>
                <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <div className="text-xs text-gray-500">
                      Avg speaking pace
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {metric(communication.avg_wpm_recording, ' wpm')}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <div className="text-xs text-gray-500">
                      Avg rate excl. pauses
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {metric(communication.avg_wpm_speech, ' wpm')}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <div className="text-xs text-gray-500">
                      Answers analyzed
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {communication.answers_analyzed}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <div className="text-xs text-gray-500">Total fillers</div>
                    <div className="text-lg font-bold text-gray-900">
                      {communication.definite_filler_total}{' '}
                      <span className="text-sm font-normal text-gray-500">
                        definite
                      </span>
                      {' · '}
                      {communication.possible_filler_total}{' '}
                      <span className="text-sm font-normal text-gray-500">
                        possible
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <div className="text-xs text-gray-500">
                      Total estimated pauses
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {metric(communication.total_pause_seconds, 's')}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {report.questions
                    .filter((q) => q.speech_analysis)
                    .map((block) => (
                      <SpeechAnswerRow key={block.question_id} block={block} />
                    ))}
                </div>
              </>
            )}
          </Section>
        )}

        {/* G. Session integrity (AUDIO/VIDEO only) */}
        {voiceMode && (
          <Section
            title="Session integrity observations"
            subtitle={session_integrity?.disclaimer}
          >
            {!session_integrity || integrityEvents.length === 0 ? (
              <p className="text-sm text-gray-500">
                No session integrity observations were recorded during this
                interview.
              </p>
            ) : (
              <>
                <ul className="list-inside list-disc text-sm text-gray-700">
                  {integritySummaryLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Collapsible title="Event timeline">
                    <ul className="space-y-1 text-sm text-gray-600">
                      {integrityEvents.map((event, i) => (
                        <li key={`${event.started_at}-${i}`}>
                          <span className="font-mono text-xs text-gray-500">
                            {new Date(event.started_at).toLocaleTimeString()}
                          </span>{' '}
                          — {PROCTORING_LABELS[event.event_type] ?? event.event_type}
                          {event.duration_seconds != null &&
                            ` (${formatSeconds(event.duration_seconds)})`}
                        </li>
                      ))}
                    </ul>
                  </Collapsible>
                </div>
              </>
            )}
          </Section>
        )}

        {/* H. Final recommendations */}
        <Section title="Recommendations">
          {(!result.preparation_topics || result.preparation_topics.length === 0) &&
          (!result.suggestions || result.suggestions.length === 0) ? (
            <p className="text-sm text-gray-500">
              No specific recommendations were recorded for this interview.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.preparation_topics &&
                result.preparation_topics.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Suggested preparation topics
                    </div>
                    <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
                      {result.preparation_topics.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              {result.suggestions && result.suggestions.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Recommendations
                  </div>
                  <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
                    {result.suggestions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* I. Report footer */}
        <div className="break-inside-avoid rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500 print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="font-semibold text-primary-700">
                IntelliInterview
              </span>{' '}
              — AI-powered mock interview assessment. Scores reflect the
              evaluations recorded at interview completion.
            </span>
            <span className="font-mono">Report ID: {report.report_id}</span>
          </div>
          <p className="mt-1">
            Generated {formatDateTime(report.generated_at)} ·{' '}
            {session_integrity
              ? 'Client-side session observations are not proof of misconduct.'
              : 'Report reflects submitted answers only.'}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
