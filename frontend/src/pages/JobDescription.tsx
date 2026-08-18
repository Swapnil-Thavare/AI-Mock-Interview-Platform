import React, { useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { jobDescriptionService } from '@/services/jobDescriptionService';
import { mockJobDescription, mockJDAnalysis } from '@/utils/mockData';

export const JobDescription: React.FC = () => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [jd, setJd] = useState(mockJobDescription);
  const [analysis, setAnalysis] = useState(mockJDAnalysis);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = await jobDescriptionService.create({ title, company, description });
    setJd(data);
    const a = await jobDescriptionService.analyze(data.id);
    setAnalysis(a);
    setLoading(false);
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
            />
            <Input
              label="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="InnovateTech"
            />
            <Textarea
              label="Description"
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the job description here..."
            />
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
              {jd.keyResponsibilities.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
