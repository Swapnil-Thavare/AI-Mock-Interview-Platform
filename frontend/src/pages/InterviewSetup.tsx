import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { interviewService } from '@/services/interviewService';
import { resumeService } from '@/services/resumeService';
import { jobDescriptionService } from '@/services/jobDescriptionService';
import { getApiErrorMessage } from '@/services/api';
import type {
  InterviewMode,
  InterviewSetup as InterviewSetupType,
  Resume,
  JobDescription,
} from '@/types';

const INTERVIEW_MODES: {
  value: InterviewMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'TEXT',
    label: 'Text',
    description: 'Type your answers. No camera or microphone required.',
    icon: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h10" />
        <path d="M4 18h7" />
      </>
    ),
  },
  {
    value: 'AUDIO',
    label: 'Audio',
    description: 'Speak your answers. A microphone is required.',
    icon: (
      <>
        <path d="M12 2a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
        <path d="M12 18v4" />
      </>
    ),
  },
  {
    value: 'VIDEO',
    label: 'Video',
    description: 'Camera and microphone. Recommended for the full experience.',
    icon: (
      <>
        <rect x="2" y="6" width="13" height="12" rx="2" />
        <path d="m15 10 7-3v10l-7-3" />
      </>
    ),
  },
];

const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({
  icon,
  title,
  subtitle,
}) => (
  <div className="mb-5 flex items-start gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-50 to-primary-100/70 text-primary-600 ring-1 ring-primary-100">
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
        {icon}
      </svg>
    </span>
    <div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

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
    interviewMode: 'TEXT',
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
    } catch (err) {
      setLoading(false);
      setError(getApiErrorMessage(err, 'Could not start interview. Please try again.'));
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
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded bg-gray-200 motion-safe:animate-pulse" />
            <div className="h-4 w-72 rounded bg-gray-100 motion-safe:animate-pulse" />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="space-y-4">
              <div className="h-4 w-28 rounded bg-gray-200 motion-safe:animate-pulse" />
              <div className="h-10 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
              <div className="h-10 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="space-y-4">
              <div className="h-4 w-28 rounded bg-gray-200 motion-safe:animate-pulse" />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="h-24 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
                <div className="h-24 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
                <div className="h-24 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
              </div>
              <div className="h-10 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl">
        {/* Page header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Set up your interview
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Choose your materials and preferences — the AI will generate
            questions tailored to the role.
          </p>
        </div>

        <div className="space-y-6">
          {/* Materials */}
          <Card>
            <SectionHeading
              title="Interview materials"
              subtitle="The interview is generated from these two inputs."
              icon={
                <>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 13h6" />
                  <path d="M9 17h6" />
                </>
              }
            />
            <div className="space-y-4">
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
              {resumes.length === 0 || jobs.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                  {resumes.length === 0 && jobs.length === 0
                    ? 'You need a resume and a job description first — upload them from the sidebar.'
                    : resumes.length === 0
                    ? 'You need to upload a resume first — add one from the Resume page.'
                    : 'You need a job description first — add one from the Job Description page.'}
                </p>
              ) : null}
            </div>
          </Card>

          {/* Preferences */}
          <Card>
            <SectionHeading
              title="Interview preferences"
              subtitle="Pick a mode, then tune the session to your needs."
              icon={
                <>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </>
              }
            />
            <div className="space-y-5">
              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  Interview mode
                </span>
                <div
                  role="radiogroup"
                  aria-label="Interview mode"
                  className="grid gap-3 sm:grid-cols-3"
                >
                  {INTERVIEW_MODES.map((mode) => {
                    const selected = setup.interviewMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => update('interviewMode', mode.value)}
                        className={`relative rounded-xl border p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          selected
                            ? 'border-primary-600 bg-primary-50/60 shadow-sm ring-1 ring-primary-600/30'
                            : 'border-gray-300 bg-white hover:border-primary-200 hover:bg-primary-50/30'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${
                            selected
                              ? 'bg-primary-100 text-primary-700 ring-primary-200'
                              : 'bg-gray-50 text-gray-500 ring-gray-200'
                          }`}
                        >
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
                            {mode.icon}
                          </svg>
                        </span>
                        <span className="mt-2.5 block text-sm font-semibold text-gray-900">
                          {mode.label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-gray-600">
                          {mode.description}
                        </span>
                        {selected && (
                          <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white">
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="m5 13 4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {setup.interviewMode !== 'TEXT' && (
                  <p className="mt-2 text-xs text-gray-500">
                    You will be asked to check your{' '}
                    {setup.interviewMode === 'VIDEO' ? 'camera and microphone' : 'microphone'}{' '}
                    before the interview starts. Nothing is recorded during the check.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </div>
          </Card>

          {/* Submit */}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
              {error}
            </p>
          )}
          <Button
            onClick={handleStart}
            className="w-full py-3 text-base shadow-md shadow-primary-600/20"
            disabled={loading}
          >
            {loading ? 'Generating your interview...' : 'Start interview'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};
