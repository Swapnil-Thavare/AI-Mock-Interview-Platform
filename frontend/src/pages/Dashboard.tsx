import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { InterviewRow } from '@/components/dashboard/InterviewRow';
import { Button } from '@/components/ui/Button';
import { mockDashboardStats, mockPreviousInterviews } from '@/utils/mockData';

export const Dashboard: React.FC = () => {
  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600">Track your interview practice progress.</p>
        </div>
        <Link to="/interview/setup">
          <Button>Start new interview</Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total interviews"
          value={mockDashboardStats.totalInterviews}
          subtitle="All time"
        />
        <StatCard
          title="Completed"
          value={mockDashboardStats.completedInterviews}
          subtitle="Finished sessions"
        />
        <StatCard
          title="Average score"
          value={`${mockDashboardStats.averageScore}%`}
          subtitle="Per completed interview"
        />
        <StatCard
          title="Improvement"
          value={`+${mockDashboardStats.improvementRate}%`}
          subtitle="Vs. first attempt"
        />
      </div>

      <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent interviews</h3>
      <div className="space-y-3">
        {mockPreviousInterviews.length ? (
          mockPreviousInterviews.map((interview) => (
            <InterviewRow key={interview.id} interview={interview} />
          ))
        ) : (
          <p className="text-sm text-gray-600">No interviews yet.</p>
        )}
      </div>
    </DashboardLayout>
  );
};
