import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { InterviewRow } from '@/components/dashboard/InterviewRow';
import { Button } from '@/components/ui/Button';
import { interviewService } from '@/services/interviewService';
import type { Interview } from '@/types';

export const Dashboard: React.FC = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await interviewService.getHistory();
        setInterviews(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
        <StatCard title="Total interviews" value={stats.total} subtitle="All time" />
        <StatCard title="Completed" value={stats.completed} subtitle="Finished sessions" />
        <StatCard title="Average score" value={`${stats.averageScore}%`} subtitle="Per completed interview" />
        <StatCard
          title="Improvement"
          value={`${stats.improvementRate >= 0 ? '+' : ''}${stats.improvementRate}%`}
          subtitle="Vs. first attempt"
        />
      </div>

      <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent interviews</h3>
      {loading ? (
        <p className="text-sm text-gray-600">Loading interviews...</p>
      ) : (
        <div className="space-y-3">
          {recent.length ? (
            recent.map((interview) => <InterviewRow key={interview.id} interview={interview} />)
          ) : (
            <p className="text-sm text-gray-600">No interviews yet.</p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};
