import React, { useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { resumeService } from '@/services/resumeService';
import { mockResume, mockResumeAnalysis } from '@/utils/mockData';

export const Resume: React.FC = () => {
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [resume, setResume] = useState(mockResume);
  const [analysis, setAnalysis] = useState(mockResumeAnalysis);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = await resumeService.upload({ fileName, content });
    setResume(data);
    const a = await resumeService.analyze(data.id);
    setAnalysis(a);
    setLoading(false);
  };

  return (
    <DashboardLayout>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Resume analysis</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Upload or paste resume</h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <Input
              label="File name"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="my_resume.pdf"
            />
            <Textarea
              label="Resume text"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your resume content here..."
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze resume'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-2 text-lg font-semibold">ATS score</h3>
            <div className="text-4xl font-bold text-primary-700">{analysis.atsScore}</div>
            <p className="text-sm text-gray-600">Estimated match score</p>
          </Card>

          <Card>
            <h3 className="mb-3 text-lg font-semibold">Detected skills</h3>
            <div className="flex flex-wrap gap-2">
              {resume.skills.map((skill) => (
                <Badge key={skill} color="primary">
                  {skill}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-lg font-semibold">Strengths</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
              {resume.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="mb-3 text-lg font-semibold">Areas to improve</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
              {resume.improvements.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
