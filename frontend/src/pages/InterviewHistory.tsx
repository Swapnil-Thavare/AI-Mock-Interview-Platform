import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { InterviewRow } from '@/components/dashboard/InterviewRow';
import { interviewService } from '@/services/interviewService';
import type { Interview } from '@/types';

export const InterviewHistory: React.FC = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);

  useEffect(() => {
    interviewService.getHistory().then(setInterviews);
  }, []);

  return (
    <DashboardLayout>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Interview history</h2>
      <div className="space-y-3">
        {interviews.length ? (
          interviews.map((interview) => <InterviewRow key={interview.id} interview={interview} />)
        ) : (
          <p className="text-gray-600">No interviews found.</p>
        )}
      </div>
    </DashboardLayout>
  );
};
