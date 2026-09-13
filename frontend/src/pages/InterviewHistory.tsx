import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { InterviewRow } from '@/components/dashboard/InterviewRow';
import { Button } from '@/components/ui/Button';
import { interviewService } from '@/services/interviewService';
import { getApiErrorMessage } from '@/services/api';
import type { Interview } from '@/types';

export const InterviewHistory: React.FC = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    interviewService
      .getHistory()
      .then((data) => {
        if (!ignore) setInterviews(data);
      })
      .catch((err) => {
        if (!ignore) setError(getApiErrorMessage(err, 'Could not load interview history.'));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <DashboardLayout>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Interview history</h2>
      {loading ? (
        <p className="text-sm text-gray-600">Loading interviews...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-3">
          {interviews.length ? (
            interviews.map((interview) => <InterviewRow key={interview.id} interview={interview} />)
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="mb-4 text-gray-600">No interviews yet.</p>
              <Link to="/interview/setup">
                <Button>Start your first interview</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};
