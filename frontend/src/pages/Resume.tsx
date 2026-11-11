import React, { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { resumeService } from '@/services/resumeService';
import { getApiErrorMessage } from '@/services/api';
import type { Resume as ResumeType } from '@/types';

const SectionHeading: React.FC<{ icon: React.ReactNode; title: string }> = ({
  icon,
  title,
}) => (
  <div className="mb-3 flex items-center gap-2.5">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-50 to-primary-100/70 text-primary-600 ring-1 ring-primary-100">
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
    <h3 className="font-semibold text-gray-900">{title}</h3>
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

export const Resume: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumes, setResumes] = useState<ResumeType[]>([]);
  const [resume, setResume] = useState<ResumeType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    resumeService
      .list()
      .then((data) => {
        if (!ignore) setResumes(data);
      })
      .catch((err) => {
        if (!ignore) setError(getApiErrorMessage(err, 'Could not load your resumes.'));
      })
      .finally(() => {
        if (!ignore) setListLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are allowed.');
        setFile(null);
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError('PDF must be 10 MB or smaller.');
        setFile(null);
        return;
      }
      setError('');
      setFile(selected);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const data = await resumeService.upload(file);
      setResume(data);
      setResumes((prev) => [data, ...prev]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not upload resume. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const active = resume ?? (resumes.length ? resumes[0] : null);

  const badgeSections: { title: string; items: string[] | undefined; color: 'primary' | 'green' }[] = active
    ? [
        {
          title: 'Technical skills',
          items: active.analysis.technical_skills,
          color: 'primary',
        },
        {
          title: 'Programming languages',
          items: active.analysis.programming_languages,
          color: 'primary',
        },
        {
          title: 'Frameworks',
          items: active.analysis.frameworks,
          color: 'green',
        },
        {
          title: 'Tools',
          items: active.analysis.tools,
          color: 'green',
        },
      ]
    : [];

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Resume analysis
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Upload a PDF resume and let AI extract your skills, strengths, and
          improvement areas.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Upload */}
        <Card>
          <SectionHeading
            title="Upload resume"
            icon={
              <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M12 18v-6" />
                <path d="m9 14 3-3 3 3" />
              </>
            }
          />
          <form onSubmit={handleUpload} className="space-y-4">
            <label
              htmlFor="resume-upload"
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                file
                  ? 'border-primary-300 bg-primary-50/50'
                  : 'border-gray-300 bg-gray-50/50 hover:border-primary-200 hover:bg-primary-50/30'
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full ring-1 ${
                  file
                    ? 'bg-primary-100 text-primary-700 ring-primary-200'
                    : 'bg-white text-primary-600 ring-primary-100'
                }`}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {file ? (
                    <path d="m5 13 4 4L19 7" />
                  ) : (
                    <>
                      <path d="M12 16V4" />
                      <path d="m6 10 6-6 6 6" />
                      <path d="M4 20h16" />
                    </>
                  )}
                </svg>
              </span>
              <span className="mt-3 text-sm font-medium text-gray-900">
                {file ? file.name : 'Choose a PDF to upload'}
              </span>
              <span className="mt-1 text-xs text-gray-500">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB — ready to analyze`
                  : 'PDF only · up to 10 MB'}
              </span>
              <input
                id="resume-upload"
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="sr-only"
                required
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full shadow-sm shadow-primary-600/20" disabled={!file || loading}>
              {loading ? 'Analyzing...' : 'Analyze resume'}
            </Button>
          </form>
        </Card>

        {/* Analysis */}
        <div className="space-y-4">
          {active ? (
            <>
              <Card className="border-t-4 border-t-primary-600">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {active.fileName}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      PDF resume · uploaded{' '}
                      {new Date(active.uploadedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                {active.analysis.summary ? (
                  <p className="mt-3 border-t border-gray-100 pt-3 text-sm leading-6 text-gray-700">
                    {active.analysis.summary}
                  </p>
                ) : (
                  active.content && (
                    <p className="mt-3 border-t border-gray-100 pt-3 text-sm leading-6 text-gray-500">
                      {active.content.slice(0, 200)}...
                    </p>
                  )
                )}
              </Card>

              {badgeSections.map(
                (section) =>
                  section.items &&
                  section.items.length > 0 && (
                    <Card key={section.title} className="p-5">
                      <SectionHeading
                        title={section.title}
                        icon={
                          <>
                            <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5Z" />
                            <path d="m9 12 2 2 4-4" />
                          </>
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        {section.items.map((skill) => (
                          <Badge key={skill} color={section.color}>
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  )
              )}

              {active.analysis.strengths.length > 0 && (
                <Card className="p-5">
                  <SectionHeading
                    title="Strengths"
                    icon={
                      <>
                        <path d="m22 7-8.5 8.5-5-5L2 17" />
                        <path d="M16 7h6v6" />
                      </>
                    }
                  />
                  <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                    {active.analysis.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {active.analysis.improvements.length > 0 && (
                <Card className="p-5">
                  <SectionHeading
                    title="Areas to improve"
                    icon={
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4" />
                        <path d="M12 16h.01" />
                      </>
                    }
                  />
                  <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                    {active.analysis.improvements.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-1 ring-primary-100">
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 13h6" />
                  <path d="M9 17h6" />
                </svg>
              </div>
              <h4 className="mt-4 font-semibold text-gray-900">No resume selected</h4>
              <p className="mx-auto mt-1 max-w-xs text-sm text-gray-600">
                Upload a PDF to see a breakdown of your skills, strengths, and
                areas to improve.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Saved resumes */}
      {listLoading ? (
        <div className="mt-10 space-y-3">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : resumes.length > 0 ? (
        <div className="mt-10">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Your resumes</h3>
          <div className="space-y-3">
            {resumes.map((r) => (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary-900/5 ${
                  r.id === active?.id
                    ? 'border-primary-300 ring-2 ring-primary-600/30'
                    : 'border-gray-200 hover:border-primary-200'
                }`}
                onClick={() => setResume(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setResume(r);
                }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h4 className="truncate font-medium text-gray-900">{r.fileName}</h4>
                  <p className="text-sm text-gray-500">
                    {new Date(r.uploadedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                {r.id === active?.id && (
                  <span className="ml-auto shrink-0 rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800">
                    Viewing
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        !error && (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
            No resumes uploaded yet.
          </div>
        )
      )}
      {!listLoading && error && resumes.length === 0 && (
        <p className="mt-10 text-sm text-red-600">{error}</p>
      )}
    </DashboardLayout>
  );
};
