import React from 'react';
import { Link } from 'react-router-dom';
import type { Interview } from '@/types';
import { Badge } from '@/components/ui/Badge';

interface InterviewRowProps {
  interview: Interview;
}

export const InterviewRow: React.FC<InterviewRowProps> = ({ interview }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <h4 className="font-medium text-gray-900">{interview.title}</h4>
        <p className="text-sm text-gray-500">
          {new Date(interview.startedAt).toLocaleDateString()} ·{' '}
          {interview.questions.length} questions
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Badge color={interview.status === 'completed' ? 'green' : 'yellow'}>
          {interview.status}
        </Badge>
        {interview.result && (
          <span className="text-sm font-semibold text-primary-700">
            {interview.result.score}%
          </span>
        )}
        <Link
          to={`/interview/result`}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          View
        </Link>
      </div>
    </div>
  );
};
