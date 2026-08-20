import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { interviewService } from '@/services/interviewService';
import type { InterviewSetup as InterviewSetupType } from '@/types';

export const InterviewSetup: React.FC = () => {
  const navigate = useNavigate();
  const [setup, setSetup] = useState<InterviewSetupType>({
    difficulty: 'medium',
    questionCount: 5,
    type: 'mixed',
    duration: 30,
  });
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    const interview = await interviewService.create(setup);
    localStorage.setItem('currentInterviewId', String(interview.id));
    setLoading(false);
    navigate('/interview');
  };

  const update = <K extends keyof InterviewSetupType>(
    key: K,
    value: InterviewSetupType[K]
  ) => {
    setSetup((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <DashboardLayout>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Setup mock interview</h2>
      <Card className="max-w-xl">
        <div className="space-y-6">
          <Select
            label="Difficulty"
            value={setup.difficulty}
            onChange={(e) => update('difficulty', e.target.value as InterviewSetupType['difficulty'])}
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
          <Select
            label="Question type"
            value={setup.type}
            onChange={(e) => update('type', e.target.value as InterviewSetupType['type'])}
            options={[
              { value: 'technical', label: 'Technical' },
              { value: 'behavioral', label: 'Behavioral' },
              { value: 'mixed', label: 'Mixed' },
            ]}
          />
          <Select
            label="Number of questions"
            value={String(setup.questionCount)}
            onChange={(e) => update('questionCount', Number(e.target.value))}
            options={[
              { value: '3', label: '3' },
              { value: '5', label: '5' },
              { value: '10', label: '10' },
            ]}
          />
          <Select
            label="Time limit (minutes)"
            value={String(setup.duration)}
            onChange={(e) => update('duration', Number(e.target.value))}
            options={[
              { value: '15', label: '15' },
              { value: '30', label: '30' },
              { value: '45', label: '45' },
            ]}
          />
          <Button onClick={handleStart} className="w-full" disabled={loading}>
            {loading ? 'Starting...' : 'Start interview'}
          </Button>
        </div>
      </Card>
    </DashboardLayout>
  );
};
