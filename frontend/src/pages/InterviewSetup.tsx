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
        <path d="M12 2a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V6a4 4 0 0 1-8 0Z" />
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

const CheckDot: React.FC<{ show: boolean }> = ({ show }) =>
  show ? (
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
  ) : null;

const cardCls = (selected: boolean) =>
  `relative rounded-xl border p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
    selected
      ? 'border-primary-600 bg-primary-50/60 shadow-sm ring-1 ring-primary-600/30'
      : 'border-gray-300 bg-white hover:border-primary-200 hover:bg-primary-50/30'
  }`;

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

  const handleRadioKey = (e: React.KeyboardEvent<HTMLElement>) => {
    const nav = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!nav.includes(e.key)) return;
    e.preventDefault();
    const group = (e.target as HTMLElement).closest('[role="radiogroup"]');
    if (!group) return;
    const items = Array.from(
      group.querySelectorAll<HTMLElement>('[role="radio"]')
    );
    const idx = items.indexOf(e.target as HTMLElement);
    if (idx < 0) return;
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else next = items.length - 1;
    items[next].focus();
    items[next].click();
  };

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded bg-gray-200 motion-safe:animate-pulse" />
            <div className="h-4 w-72 rounded bg-gray-100 motion-safe:animate-pulse" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="space-y-4">
                <div className="h-4 w-28 rounded bg-gray-200 motion-safe:animate-pulse" />
                <div className="h-14 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
                <div className="h-14 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  const typeOptions: { value: InterviewSetupType['type']; label: string }[] = [
    { value: 'technical', label: 'Technical' },
    { value: 'behavioral', label: 'Behavioral' },
    { value: 'mixed', label: 'Mixed' },
  ];
  const difficultyOptions: { value: InterviewSetupType['difficulty']; label: string }[] = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
  ];

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
            <div className="space-y-5">
              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  Resume
                </span>
                {resumes.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800 ring-1 ring-amber-200">
                    No resumes yet — upload one from the Resume page first.
                  </p>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label="Resume"
                    className="max-h-56 space-y-2 overflow-y-auto pr-1"
                  >
                    {resumes.map((r, i) => {
                      const selected = setup.resumeId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          tabIndex={selected || (!setup.resumeId && i === 0) ? 0 : -1}
                          onKeyDown={handleRadioKey}
                          onClick={() => update('resumeId', r.id)}
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            selected
                              ? 'border-primary-600 bg-primary-50/60 ring-1 ring-primary-600/30'
                              : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-primary-50/30'
                          }`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[10px] font-bold text-red-600 ring-1 ring-red-100">
                            PDF
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">
                              {r.fileName}
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-500">
                              Uploaded {new Date(r.uploadedAt).toLocaleDateString()}
                            </span>
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              selected
                                ? 'border-primary-600 bg-primary-600 text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {selected && (
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m5 13 4 4L19 7" />
                              </svg>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  Job description
                </span>
                {jobs.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800 ring-1 ring-amber-200">
                    No job descriptions yet — add one from the Job Description page first.
                  </p>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label="Job description"
                    className="max-h-56 space-y-2 overflow-y-auto pr-1"
                  >
                    {jobs.map((j, i) => {
                      const selected = setup.jobDescriptionId === j.id;
                      return (
                        <button
                          key={j.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          tabIndex={selected || (!setup.jobDescriptionId && i === 0) ? 0 : -1}
                          onKeyDown={handleRadioKey}
                          onClick={() => update('jobDescriptionId', j.id)}
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            selected
                              ? 'border-primary-600 bg-primary-50/60 ring-1 ring-primary-600/30'
                              : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-primary-50/30'
                          }`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="2" y="7" width="20" height="14" rx="2" />
                              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                            </svg>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">
                              {j.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-gray-500">
                              {j.company || 'No company specified'}
                            </span>
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              selected
                                ? 'border-primary-600 bg-primary-600 text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {selected && (
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m5 13 4 4L19 7" />
                              </svg>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
                        tabIndex={selected ? 0 : -1}
                        onKeyDown={handleRadioKey}
                        onClick={() => update('interviewMode', mode.value)}
                        className={cardCls(selected)}
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
                        <CheckDot show={selected} />
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
                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Difficulty
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Difficulty"
                    className="flex rounded-lg border border-gray-300 bg-gray-50 p-1"
                  >
                    {difficultyOptions.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={setup.difficulty === o.value}
                        tabIndex={setup.difficulty === o.value ? 0 : -1}
                        onKeyDown={handleRadioKey}
                        onClick={() => update('difficulty', o.value)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          setup.difficulty === o.value
                            ? 'bg-white text-primary-700 shadow-sm ring-1 ring-primary-200'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Question type
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Question type"
                    className="flex rounded-lg border border-gray-300 bg-gray-50 p-1"
                  >
                    {typeOptions.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={setup.type === o.value}
                        tabIndex={setup.type === o.value ? 0 : -1}
                        onKeyDown={handleRadioKey}
                        onClick={() => update('type', o.value)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          setup.type === o.value
                            ? 'bg-white text-primary-700 shadow-sm ring-1 ring-primary-200'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
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
                <div className="rounded-lg bg-primary-50/60 px-4 py-3 ring-1 ring-primary-100">
                  <p className="text-xs font-medium text-primary-800">
                    Timed answers
                  </p>
                  <p className="mt-0.5 text-xs text-primary-700">
                    Your per-answer time is recorded and shown in the report.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Submit */}
          <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-primary-50/40 p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
              <span className="font-medium text-gray-700">Session:</span>
              <span>{setup.questionCount} questions</span>
              <span className="capitalize">{setup.difficulty}</span>
              <span className="capitalize">{setup.type}</span>
              <span>{setup.interviewMode === 'TEXT' ? 'Text' : setup.interviewMode === 'AUDIO' ? 'Audio' : 'Video'}</span>
            </div>
            {error && (
              <p
                role="alert"
                className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200"
              >
                {error}
              </p>
            )}
            <Button
              onClick={handleStart}
              className="w-full py-3 text-base shadow-md shadow-primary-600/20"
              disabled={loading || !setup.resumeId || !setup.jobDescriptionId}
            >
              {loading ? 'Generating your interview...' : 'Start interview'}
            </Button>
            {(!setup.resumeId || !setup.jobDescriptionId) && !error && (
              <p className="mt-2 text-center text-xs text-gray-500">
                Select a resume and a job description above to continue.
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
