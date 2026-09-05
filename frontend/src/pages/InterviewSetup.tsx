import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { interviewService } from '@/services/interviewService';
import { resumeService } from '@/services/resumeService';
import { jobDescriptionService } from '@/services/jobDescriptionService';
import type { InterviewSetup as InterviewSetupType, Resume, JobDescription } from '@/types';

export const InterviewSetup: React.FC = () => {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [setup, setSetup] = useState<InterviewSetupType>({
    resumeId: '',
    jobDescriptionId: '',
    difficulty: 'medium',
    questionCount: 5,
    type: 'mixed',
    duration: 30,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([resumeService.list(), jobDescriptionService.list()])
      .then(([r, j]) => {
        setResumes(r);
        setJobs(j);
      })
      .catch(() => setError('Could not load resumes or job descriptions.'))
      .finally(() => setLoadingData(false));
  }, []);

  const handleStart = async () => {
    if (!setup.resumeId || !setup.jobDescriptionId) {
      setError('Please select both a resume and a job description.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const interview = await interviewService.create(setup);
      localStorage.setItem('currentInterviewId', String(interview.id));
      setLoading(false);
      navigate('/interview');
    } catch (err: any) {
      setLoading(false);
      setError(err?.response?.data?.detail || err?.message || 'Could not start interview. Please try again.');
    }
  };

  const update = <K extends keyof InterviewSetupType>(
    key: K,
    value: InterviewSetupType[K]
  ) => {
    setSetup((prev) => ({ ...prev, [key]: value }));
  };

  if (loadingData) {
    return (
      <DashboardLayout>
        <p className="py-20 text-center text-gray-600">Loading setup...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Setup mock interview</h2>
      <Card className="max-w-xl">
        <div className="space-y-6">
          <Select
            label="Resume"
            value={setup.resumeId}
            onChange={(e) => update('resumeId', e.target.value)}
            options={[
              { value: '', label: 'Choose a resume' },
              ...resumes.map((r) => ({ value: r.id, label: r.fileName })),
            ]}
          />
          <Select
            label="Job description"
            value={setup.jobDescriptionId}
            onChange={(e) => update('jobDescriptionId', e.target.value)}
            options={[
              { value: '', label: 'Choose a job description' },
              ...jobs.map((j) => ({ value: j.id, label: `${j.title} ${j.company ? `— ${j.company}` : ''}` })),
            ]}
          />
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={handleStart} className="w-full" disabled={loading}>
            {loading ? 'Starting...' : 'Start interview'}
          </Button>
        </div>
      </Card>
    </DashboardLayout>
  );
};
