import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { interviewService } from '@/services/interviewService';
import type { InterviewResult as InterviewResultType } from '@/types';

export const InterviewResult: React.FC = () => {
  const [result, setResult] = useState<InterviewResultType | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('currentInterviewId') || 'i-1';
    interviewService.end(id).then(setResult);
  }, []);

  if (!result) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">Loading results...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Interview result</h2>
        <Link to="/interviews">
          <Button variant="secondary">View history</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="text-center">
          <h3 className="text-sm text-gray-600">Overall score</h3>
          <div className="text-5xl font-extrabold text-primary-700">{result.score}%</div>
        </Card>
        <Card className="text-center">
          <h3 className="text-sm text-gray-600">Answered</h3>
          <div className="text-5xl font-extrabold text-green-600">
            {result.answered}/{result.totalQuestions}
          </div>
        </Card>
        <Card className="text-center">
          <h3 className="text-sm text-gray-600">Skipped</h3>
          <div className="text-5xl font-extrabold text-yellow-600">
            {result.skipped}/{result.totalQuestions}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="mb-2 text-lg font-semibold">Feedback</h3>
        <p className="text-gray-700">{result.feedback}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-medium text-green-700">Strengths</h4>
            <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
              {result.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-red-700">Weaknesses</h4>
            <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
              {result.weaknesses.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <h3 className="mb-4 mt-8 text-lg font-semibold text-gray-900">Question-level feedback</h3>
      <div className="space-y-4">
        {result.questionResults.map((qr) => (
          <Card key={qr.questionId}>
            <div className="mb-2 flex items-start justify-between">
              <h4 className="font-medium text-gray-900">{qr.question}</h4>
              <Badge color={qr.score >= 70 ? 'green' : qr.score > 0 ? 'yellow' : 'red'}>
                {qr.score}%
              </Badge>
            </div>
            <p className="mb-2 text-sm text-gray-700">
              <span className="font-medium">Your answer:</span>{' '}
              {qr.answer || '(skipped)'}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Feedback:</span> {qr.feedback}
            </p>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};
