import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { InterviewRow } from '@/components/dashboard/InterviewRow';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { interviewService } from '@/services/interviewService';
import { getApiErrorMessage } from '@/services/api';
import type { Interview } from '@/types';

const StatIcon: React.FC<{ path: React.ReactNode }> = ({ path }) => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
);

const QUICK_ACTIONS: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    to: '/interview/setup',
    title: 'New interview',
    description: 'Configure and start a mock interview.',
    icon: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
        <path d="M12 7v6" />
        <path d="M9 10h6" />
      </>
    ),
  },
  {
    to: '/resume',
    title: 'Upload resume',
    description: 'Refresh your skills analysis from a new PDF.',
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M12 18v-6" />
        <path d="m9 14 3-3 3 3" />
      </>
    ),
  },
  {
    to: '/job-description',
    title: 'Add job description',
    description: 'Analyze a role and check resume match.',
    icon: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M12 12v3" />
        <path d="M3 13h18" />
      </>
    ),
  },
];

const StatSkeleton: React.FC = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-5">
    <div className="flex items-center justify-between">
      <div className="h-3 w-20 rounded bg-gray-200 motion-safe:animate-pulse" />
      <div className="h-9 w-9 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
    </div>
    <div className="mt-3 h-8 w-16 rounded bg-gray-200 motion-safe:animate-pulse" />
    <div className="mt-2 h-3 w-24 rounded bg-gray-100 motion-safe:animate-pulse" />
  </div>
);

const RowSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
    <div className="h-10 w-10 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-1/3 rounded bg-gray-200 motion-safe:animate-pulse" />
      <div className="h-3 w-1/4 rounded bg-gray-100 motion-safe:animate-pulse" />
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError('');
    try {
      const data = await interviewService.getHistory();
      if (!isStale()) setInterviews(data);
    } catch (err) {
      if (!isStale()) setError(getApiErrorMessage(err, 'Could not load your interviews.'));
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void load(() => ignore);
    return () => {
      ignore = true;
    };
  }, [load]);

  const stats = useMemo(() => {
    const total = interviews.length;
    const completed = interviews.filter((i) => i.status === 'completed');
    const scores = completed
      .map((i) => i.result?.score)
      .filter((s): s is number => typeof s === 'number');
    const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const improvementRate =
      scores.length > 1 ? scores[scores.length - 1] - scores[0] : 0;

    return {
      total,
      completed: completed.length,
      averageScore,
      improvementRate,
    };
  }, [interviews]);

  const recent = interviews.slice(0, 5);
  const firstName = user?.name?.trim().split(' ')[0];

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            {firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Track your interview practice and pick up where you left off.
          </p>
        </div>
        <Link to="/interview/setup">
          <Button className="shadow-sm shadow-primary-600/20">
            Start new interview
          </Button>
        </Link>
      </div>

      {/* Statistics */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total interviews"
              value={stats.total}
              subtitle="All time"
              icon={
                <StatIcon
                  path={
                    <>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
                    </>
                  }
                />
              }
            />
            <StatCard
              title="Completed"
              value={stats.completed}
              subtitle="Finished sessions"
              icon={
                <StatIcon
                  path={
                    <>
                      <circle cx="12" cy="12" r="10" />
                      <path d="m8 12 3 3 5-6" />
                    </>
                  }
                />
              }
            />
            <StatCard
              title="Average score"
              value={`${stats.averageScore}%`}
              subtitle="Per completed interview"
              icon={
                <StatIcon
                  path={
                    <>
                      <path d="M3 3v18h18" />
                      <path d="m7 15 4-5 4 3 5-7" />
                    </>
                  }
                />
              }
            />
            <StatCard
              title="Improvement"
              value={`${stats.improvementRate >= 0 ? '+' : ''}${stats.improvementRate}%`}
              subtitle="Vs. first attempt"
              icon={
                <StatIcon
                  path={
                    <>
                      <path d="m22 7-8.5 8.5-5-5L2 17" />
                      <path d="M16 7h6v6" />
                    </>
                  }
                />
              }
            />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md hover:shadow-primary-900/5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-50 to-primary-100/70 text-primary-600 ring-1 ring-primary-100 transition-colors group-hover:from-primary-100 group-hover:to-primary-50">
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
                {action.icon}
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900 group-hover:text-primary-700">
                {action.title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                {action.description}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="ml-auto mt-0.5 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary-400"
            >
              →
            </span>
          </Link>
        ))}
      </div>

      {/* Recent interviews */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Recent interviews</h3>
        {!loading && interviews.length > 5 && (
          <Link
            to="/interviews"
            className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            View all →
          </Link>
        )}
      </div>
      {loading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {recent.length ? (
            recent.map((interview) => <InterviewRow key={interview.id} interview={interview} />)
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
                  <path d="M12 7v6" />
                  <path d="M9 10h6" />
                </svg>
              </div>
              <h4 className="mt-4 font-semibold text-gray-900">No interviews yet</h4>
              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
                Upload a resume, add a job description, and start your first
                AI-powered mock interview.
              </p>
              <Link to="/interview/setup">
                <Button className="mt-5">Start your first interview</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};
