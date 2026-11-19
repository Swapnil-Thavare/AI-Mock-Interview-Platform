import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { InterviewTable } from '@/components/dashboard/InterviewTable';
import { Button } from '@/components/ui/Button';
import { interviewService } from '@/services/interviewService';
import { getApiErrorMessage } from '@/services/api';
import type { Interview } from '@/types';

const RowSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
    <div className="h-10 w-10 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-1/3 rounded bg-gray-200 motion-safe:animate-pulse" />
      <div className="h-3 w-1/4 rounded bg-gray-100 motion-safe:animate-pulse" />
    </div>
    <div className="hidden h-5 w-16 rounded-full bg-gray-100 motion-safe:animate-pulse sm:block" />
  </div>
);

export const InterviewHistory: React.FC = () => {
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
      if (!isStale()) setError(getApiErrorMessage(err, 'Could not load interview history.'));
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

  const completed = interviews.filter((i) => i.status === 'completed' || i.result).length;
  const inProgress = interviews.length - completed;

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Interview history
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Review past sessions, resume unfinished interviews, and open your
            assessment reports.
          </p>
        </div>
        <Link to="/interview/setup">
          <Button className="shadow-sm shadow-primary-600/20">
            Start new interview
          </Button>
        </Link>
      </div>

      {/* Summary strip — real counts only */}
      {!loading && !error && interviews.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
            {interviews.length} total
          </span>
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800 ring-1 ring-green-200">
            {completed} completed
          </span>
          {inProgress > 0 && (
            <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-200">
              {inProgress} in progress
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-6 text-center">
          <p role="alert" className="text-sm font-medium text-red-600">{error}</p>
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
          {interviews.length ? (
            <InterviewTable interviews={interviews} />
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
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h4 className="mt-4 font-semibold text-gray-900">No interviews yet</h4>
              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
                Your completed and in-progress interviews will appear here.
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
