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
import type { JobDescription as JobDescriptionType, Resume, ResumeJDMatch } from '@/types';

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
  const [matchLoading, setMatchLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshList = async () => {
    try {
      const [list, resumeList] = await Promise.all([
        jobDescriptionService.list(),
        resumeService.list(),
      ]);
      setJds(list);
      setResumes(resumeList);
    } catch {
      setJds([]);
      setResumes([]);
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
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Could not save job description. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await jobDescriptionService.delete(id);
      setJds((prev) => prev.filter((j) => j.id !== id));
      if (active?.id === id) setActive(null);
    } catch {
      // tolerate missing delete endpoint
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
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Could not generate match analysis.');
    } finally {
      setMatchLoading(false);
    }
  };

  const analysis = active?.analysis;

  return (
    <DashboardLayout>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Job description</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Add a job description</h3>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze job description'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          {active ? (
            <>
              <Card>
                <h3 className="mb-2 text-lg font-semibold">{active.title}</h3>
                {active.company && <p className="text-sm text-gray-500">{active.company}</p>}
                {analysis?.job_title && <p className="mt-2 text-sm text-gray-700">Inferred title: {analysis.job_title}</p>}
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Required skills</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis?.required_skills.map((s) => <Badge key={s} color="red">{s}</Badge>)}
                </div>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Preferred skills</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis?.preferred_skills.map((s) => <Badge key={s} color="primary">{s}</Badge>)}
                </div>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Technologies</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis?.technologies.map((s) => <Badge key={s} color="green">{s}</Badge>)}
                </div>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Responsibilities</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                  {analysis?.responsibilities.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Important keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis?.important_keywords.map((s) => <Badge key={s} color="green">{s}</Badge>)}
                </div>
              </Card>
            </>
          ) : (
            <p className="text-sm text-gray-600">Add a job description to see AI analysis.</p>
          )}
        </div>
      </div>

      {active && resumes.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Resume ↔ JD compatibility</h3>
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
              className="w-full"
            >
              {matchLoading ? 'Analyzing...' : 'Analyze compatibility'}
            </Button>

            {match && (
              <div className="space-y-4 pt-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Overall match score</h4>
                  <div className="text-4xl font-bold text-primary-700">{match.overall_match_score}%</div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Matched skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {match.matched_skills.map((s) => <Badge key={s} color="green">{s}</Badge>)}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Missing skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {match.missing_skills.map((s) => <Badge key={s} color="red">{s}</Badge>)}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Gaps</h4>
                  <ul className="list-inside list-disc text-sm text-gray-700">
                    {match.gaps.map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Recommendations</h4>
                  <ul className="list-inside list-disc text-sm text-gray-700">
                    {match.recommendations.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {jds.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Your job descriptions</h3>
          <div className="space-y-3">
            {jds.map((jd) => (
              <Card
                key={jd.id}
                className={`flex items-center justify-between ${jd.id === active?.id ? 'ring-2 ring-primary-600' : ''}`}
              >
                <button
                  className="text-left"
                  onClick={() => { setActive(jd); setMatch(null); }}
                >
                  <h4 className="font-medium text-gray-900">{jd.title}</h4>
                  <p className="text-sm text-gray-500">{jd.company}</p>
                </button>
                <Button
                  variant="secondary"
                  onClick={() => handleDelete(jd.id)}
                >
                  Delete
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
