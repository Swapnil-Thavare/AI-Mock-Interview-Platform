import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Interview } from '@/types';
import { Badge } from '@/components/ui/Badge';

interface InterviewRowProps {
  interview: Interview;
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

const statusColor = (status: string): 'green' | 'yellow' | 'gray' =>
  status === 'completed' ? 'green' : status === 'in-progress' ? 'yellow' : 'gray';

export const InterviewRow: React.FC<InterviewRowProps> = ({ interview }) => {
  const navigate = useNavigate();
  const completed = interview.status === 'completed' || Boolean(interview.result);
  const mode = interview.interview_mode ?? 'TEXT';

  const handleResume = () => {
    localStorage.setItem('currentInterviewId', interview.id);
    navigate('/interview');
  };

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md hover:shadow-primary-900/5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-100">
          <svg
            className="h-5 w-5"
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
          <h4 className="truncate font-medium text-gray-900">{interview.title}</h4>
          <p className="mt-0.5 text-sm text-gray-500">
            {new Date(interview.startedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
            · {interview.questions.length} questions ·{' '}
            {mode.charAt(0) + mode.slice(1).toLowerCase()}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 pl-[52px] sm:pl-0">
        <Badge color={statusColor(interview.status)}>{interview.status}</Badge>
        {interview.result && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreClass(
              interview.result.score
            )}`}
          >
            {Math.round(interview.result.score)}%
          </span>
        )}
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
      </div>
    </div>
  );
};
