import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { jobDescriptionService } from '@/services/jobDescriptionService';
import type { JobDescription as JobDescriptionType } from '@/types';
import { mockJDAnalysis } from '@/utils/mockData';

export const JobDescription: React.FC = () => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [jds, setJds] = useState<JobDescriptionType[]>([]);
  const [active, setActive] = useState<JobDescriptionType | null>(null);
  const [analysis, setAnalysis] = useState(mockJDAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshList = async () => {
    try {
      const list = await jobDescriptionService.list();
      setJds(list);
    } catch {
      // tolerate missing list endpoint
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
      const a = await jobDescriptionService.analyze(data.id);
      setAnalysis(a);
      await refreshList();
      setTitle('');
      setCompany('');
      setDescription('');
      setRequiredSkills('');
    } catch (err) {
      setError('Could not save job description. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await jobDescriptionService.delete(id);
      setJds((prev) => prev.filter((j) => j.id !== id));
      if (active?.id === id) setActive(null);
    } catch {
      // tolerate missing delete endpoint
    }
  };

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
              {loading ? 'Analyzing...' : 'Analyze match'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-2 text-lg font-semibold">Role match</h3>
            <div className="text-4xl font-bold text-primary-700">{analysis.matchScore}%</div>
            <p className="text-sm text-gray-600">How well your resume matches this role</p>
          </Card>

          <Card>
            <h3 className="mb-3 text-lg font-semibold">Matched skills</h3>
            <div className="flex flex-wrap gap-2">
              {analysis.matchedSkills.map((s) => (
                <Badge key={s} color="green">
                  {s}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-lg font-semibold">Missing skills</h3>
            <div className="flex flex-wrap gap-2">
              {analysis.missingSkills.map((s) => (
                <Badge key={s} color="red">
                  {s}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-lg font-semibold">Responsibilities</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
              {analysis.keyResponsibilities.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {jds.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Your job descriptions</h3>
          <div className="space-y-3">
            {jds.map((jd) => (
              <Card key={jd.id} className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{jd.title}</h4>
                  <p className="text-sm text-gray-500">{jd.company}</p>
                </div>
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
