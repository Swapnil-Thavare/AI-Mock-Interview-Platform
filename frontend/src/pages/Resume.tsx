import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { resumeService } from '@/services/resumeService';
import type { Resume as ResumeType } from '@/types';

export const Resume: React.FC = () => {
  const [resumes, setResumes] = useState<ResumeType[]>([]);
  const [resume, setResume] = useState<ResumeType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    resumeService.list().then(setResumes).catch(() => setResumes([]));
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
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Could not upload resume. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const active = resume ?? (resumes.length ? resumes[0] : null);

  return (
    <DashboardLayout>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Resume analysis</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Upload resume (PDF)</h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:text-white"
              required
            />
            {file && <p className="text-sm text-gray-600">Selected: {file.name}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={!file || loading}>
              {loading ? 'Analyzing...' : 'Analyze resume'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          {active ? (
            <>
              <Card>
                <h3 className="mb-3 text-lg font-semibold">File</h3>
                <p className="text-sm text-gray-700">{active.fileName}</p>
                {active.content && (
                  <p className="mt-2 line-clamp-3 text-sm text-gray-500">{active.content.slice(0, 200)}...</p>
                )}
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Professional summary</h3>
                <p className="text-sm text-gray-700">{active.analysis.summary || 'No summary extracted.'}</p>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Technical skills</h3>
                <div className="flex flex-wrap gap-2">
                  {active.analysis.technical_skills.map((skill) => (
                    <Badge key={skill} color="primary">{skill}</Badge>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Programming languages</h3>
                <div className="flex flex-wrap gap-2">
                  {active.analysis.programming_languages.map((skill) => (
                    <Badge key={skill} color="primary">{skill}</Badge>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Frameworks</h3>
                <div className="flex flex-wrap gap-2">
                  {active.analysis.frameworks.map((skill) => (
                    <Badge key={skill} color="green">{skill}</Badge>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Tools</h3>
                <div className="flex flex-wrap gap-2">
                  {active.analysis.tools.map((skill) => (
                    <Badge key={skill} color="green">{skill}</Badge>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Strengths</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                  {active.analysis.strengths.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </Card>

              <Card>
                <h3 className="mb-3 text-lg font-semibold">Areas to improve</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                  {active.analysis.improvements.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </Card>
            </>
          ) : (
            <p className="text-sm text-gray-600">Upload a PDF to see AI analysis.</p>
          )}
        </div>
      </div>

      {resumes.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Your resumes</h3>
          <div className="space-y-3">
            {resumes.map((r) => (
              <div
                key={r.id}
                className={`cursor-pointer ${r.id === active?.id ? 'ring-2 ring-primary-600' : ''}`}
                onClick={() => setResume(r)}
              >
                <Card>
                  <div>
                    <h4 className="font-medium text-gray-900">{r.fileName}</h4>
                    <p className="text-sm text-gray-500">{r.uploadedAt}</p>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
