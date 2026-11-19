import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Interview } from '@/types';
import { Badge } from '@/components/ui/Badge';

interface InterviewTableProps {
  interviews: Interview[];
}

const MODE_ICON: Record<string, React.ReactNode> = {
  TEXT: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h7" />
    </>
  ),
  AUDIO: (
    <>
      <path d="M12 2a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v4" />
    </>
  ),
  VIDEO: (
    <>
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="m15 10 7-3v10l-7-3" />
    </>
  ),
};

const scoreClass = (score: number): string =>
  score >= 70
    ? 'bg-green-100 text-green-800'
    : score >= 40
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-red-100 text-red-800';

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  in_progress: 'In Progress',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

const statusLabel = (status: string): string =>
  STATUS_LABELS[status] ??
  status.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const statusColor = (status: string): 'green' | 'yellow' | 'gray' =>
  status === 'completed' ? 'green' : status === 'in-progress' || status === 'in_progress' ? 'yellow' : 'gray';

const InterviewRowCells: React.FC<{ interview: Interview }> = ({ interview }) => {
  const navigate = useNavigate();
  const completed = interview.status === 'completed' || Boolean(interview.result);
  const mode = interview.interview_mode ?? 'TEXT';

  const handleResume = () => {
    localStorage.setItem('currentInterviewId', interview.id);
    navigate('/interview');
  };

  return (
    <tr className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {MODE_ICON[mode] ?? MODE_ICON.TEXT}
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900">{interview.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {new Date(interview.startedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
              {' · '}
              {interview.questions.length} questions
              {' · '}
              {mode.charAt(0) + mode.slice(1).toLowerCase()}
            </p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Badge color={statusColor(interview.status)}>{statusLabel(interview.status)}</Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {interview.result ? (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreClass(
              interview.result.score
            )}`}
          >
            {Math.round(interview.result.score)}%
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {completed ? (
          <Link
            to={`/interview/result/${interview.id}`}
            className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            View report →
          </Link>
        ) : (
          <button
            onClick={handleResume}
            className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            Resume →
          </button>
        )}
      </td>
    </tr>
  );
};

export const InterviewTable: React.FC<InterviewTableProps> = ({ interviews }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr className="bg-gray-50 text-left">
          <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Interview
          </th>
          <th scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Status
          </th>
          <th scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Score
          </th>
          <th scope="col" className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
            Report
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {interviews.map((interview) => (
          <InterviewRowCells key={interview.id} interview={interview} />
        ))}
      </tbody>
    </table>
  </div>
);
