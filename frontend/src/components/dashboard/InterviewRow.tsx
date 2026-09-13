import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Interview } from '@/types';
import { Badge } from '@/components/ui/Badge';

interface InterviewRowProps {
  interview: Interview;
}

export const InterviewRow: React.FC<InterviewRowProps> = ({ interview }) => {
  const navigate = useNavigate();
  const completed = interview.status === 'completed' || Boolean(interview.result);

  const handleResume = () => {
    localStorage.setItem('currentInterviewId', interview.id);
    navigate('/interview');
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h4 className="font-medium text-gray-900">{interview.title}</h4>
        <p className="text-sm text-gray-500">
          {new Date(interview.startedAt).toLocaleDateString()} ·{' '}
          {interview.questions.length} questions
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Badge color={completed ? 'green' : 'yellow'}>
          {interview.status}
        </Badge>
        {interview.result && (
          <span className="text-sm font-semibold text-primary-700">
            {interview.result.score}%
          </span>
        )}
        {completed ? (
          <Link
            to={`/interview/result/${interview.id}`}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            View
          </Link>
        ) : (
          <button
            onClick={handleResume}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
};
