import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { jobDescriptionService } from '@/services/jobDescriptionService';
import { resumeService } from '@/services/resumeService';
import { matchService } from '@/services/matchService';
import { getApiErrorMessage } from '@/services/api';
import type { JobDescription as JobDescriptionType, Resume, ResumeJDMatch } from '@/types';

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

export const JobDescription: React.FC = () => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [jds, setJds] = useState<JobDescriptionType[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [active, setActive] = useState<JobDescriptionType | null>(null);
  const [selectedResume, setSelectedResume] = useState('');
  const [match, setMatch] = useState<ResumeJDMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const refreshList = async () => {
    setListLoading(true);
    setListError('');
    try {
      const [list, resumeList] = await Promise.all([
        jobDescriptionService.list(),
        resumeService.list(),
      ]);
      setJds(list);
      setResumes(resumeList);
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not load your job descriptions.'));
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    refreshList();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await jobDescriptionService.create({
        title,
        company,
        description,
        requiredSkills: requiredSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setActive(data);
      setJds((prev) => [data, ...prev]);
      setTitle('');
      setCompany('');
      setDescription('');
      setRequiredSkills('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save job description. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    setError('');
    try {
      await jobDescriptionService.delete(id);
      setJds((prev) => prev.filter((j) => j.id !== id));
      if (active?.id === id) setActive(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete the job description.'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleMatch = async () => {
    if (!active || !selectedResume) return;
    setMatchLoading(true);
    setMatch(null);
    try {
      const result = await matchService.analyze({
        resumeId: selectedResume,
        jobDescriptionId: active.id,
      });
      setMatch(result);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not generate match analysis.'));
    } finally {
      setMatchLoading(false);
    }
  };

  const analysis = active?.analysis;

  const analysisSections: {
    title: string;
    items: string[] | undefined;
    color: 'red' | 'primary' | 'green';
  }[] = active
    ? [
        { title: 'Required skills', items: analysis?.required_skills, color: 'red' },
        { title: 'Preferred skills', items: analysis?.preferred_skills, color: 'primary' },
        { title: 'Technologies', items: analysis?.technologies, color: 'green' },
        { title: 'Important keywords', items: analysis?.important_keywords, color: 'green' },
      ]
    : [];

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Job description
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Paste a role's details and let AI break down its requirements — then
          match it against your resumes.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <SectionHeading
            title="Add a job description"
            icon={
              <>
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M12 12v3" />
                <path d="M3 13h18" />
              </>
            }
          />
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Job title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Software Engineer - Frontend"
              required
            />
            <Input
              label="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="InnovateTech"
            />
            <Textarea
              label="Description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the job description here..."
              required
            />
            <Input
              label="Required skills (comma separated)"
              value={requiredSkills}
              onChange={(e) => setRequiredSkills(e.target.value)}
              placeholder="React, TypeScript, CSS"
            />
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full shadow-sm shadow-primary-600/20" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze job description'}
            </Button>
          </form>
        </Card>

        {/* Analysis */}
        <div className="space-y-4">
          {active ? (
            <>
              <Card className="border-t-4 border-t-primary-600">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-100">
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
                      <rect x="3" y="7" width="18" height="13" rx="2" />
                      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{active.title}</p>
                    {active.company && (
                      <p className="mt-0.5 text-sm text-gray-500">{active.company}</p>
                    )}
                    {analysis?.job_title && (
                      <p className="mt-1 text-xs text-gray-500">
                        Inferred title: {analysis.job_title}
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {analysisSections.map(
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
                        {section.items.map((s) => (
                          <Badge key={s} color={section.color}>
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  )
              )}

              {analysis && analysis.responsibilities.length > 0 && (
                <Card className="p-5">
                  <SectionHeading
                    title="Responsibilities"
                    icon={
                      <>
                        <path d="M4 6h16" />
                        <path d="M4 12h16" />
                        <path d="M4 18h10" />
                      </>
                    }
                  />
                  <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                    {analysis.responsibilities.map((r) => (
                      <li key={r}>{r}</li>
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
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <h4 className="mt-4 font-semibold text-gray-900">
                No job description selected
              </h4>
              <p className="mx-auto mt-1 max-w-xs text-sm text-gray-600">
                Add or select a job description to see its AI analysis.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Resume ↔ JD compatibility */}
      {active && resumes.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Resume ↔ JD compatibility
          </h3>
          <Card className="max-w-xl space-y-4">
            <Select
              label="Select resume"
              value={selectedResume}
              onChange={(e) => setSelectedResume(e.target.value)}
              options={[
                { value: '', label: 'Choose a resume' },
                ...resumes.map((r) => ({ value: r.id, label: r.fileName })),
              ]}
            />
            <Button
              onClick={handleMatch}
              disabled={!selectedResume || matchLoading}
              className="w-full shadow-sm shadow-primary-600/20"
            >
              {matchLoading ? 'Analyzing...' : 'Analyze compatibility'}
            </Button>

            {match && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-50 ring-2 ring-primary-100">
                    <span className="text-lg font-extrabold text-primary-700">
                      {match.overall_match_score}%
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">
                      Overall match score
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-500">
                      How well this resume fits the job description.
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Matched skills</h4>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {match.matched_skills.map((s) => (
                      <Badge key={s} color="green">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Missing skills</h4>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {match.missing_skills.map((s) => (
                      <Badge key={s} color="red">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                {match.gaps.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700">Gaps</h4>
                    <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
                      {match.gaps.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {match.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700">
                      Recommendations
                    </h4>
                    <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
                      {match.recommendations.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Saved job descriptions */}
      {listLoading ? (
        <div className="mt-10 space-y-3">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : listError ? (
        <div className="mt-10 rounded-xl border border-dashed border-red-200 bg-red-50/50 p-6 text-center">
          <p className="text-sm text-red-600">{listError}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => void refreshList()}
          >
            Try again
          </Button>
        </div>
      ) : jds.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No job descriptions yet. Add one above to see AI analysis and resume
          matching.
        </div>
      ) : (
        <div className="mt-10">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Your job descriptions
          </h3>
          <div className="space-y-3">
            {jds.map((jd) => (
              <div
                key={jd.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary-900/5 ${
                  jd.id === active?.id
                    ? 'border-primary-300 ring-2 ring-primary-600/30'
                    : 'border-gray-200 hover:border-primary-200'
                }`}
              >
                <button
                  className="flex min-w-0 items-center gap-3 text-left"
                  onClick={() => {
                    setActive(jd);
                    setMatch(null);
                  }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-100">
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
                      <rect x="3" y="7" width="18" height="13" rx="2" />
                      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">
                      {jd.title}
                    </span>
                    <span className="block text-sm text-gray-500">
                      {jd.company || 'No company specified'}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {jd.id === active?.id && (
                    <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800">
                      Viewing
                    </span>
                  )}
                  <Button
                    variant="secondary"
                    className="hover:border-red-200 hover:text-red-700"
                    onClick={() => handleDelete(jd.id)}
                    disabled={deletingId === jd.id}
                  >
                    {deletingId === jd.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
