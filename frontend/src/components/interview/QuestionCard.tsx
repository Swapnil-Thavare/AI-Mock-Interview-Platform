import React from 'react';
import type { Question } from '@/types';
import { Badge } from '@/components/ui/Badge';

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, index, total }) => {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Question {index + 1} of {total}
        </span>
        <div className="flex gap-2">
          <Badge color={question.category === 'technical' ? 'primary' : 'yellow'}>
            {question.category}
          </Badge>
          <Badge color="gray">{question.difficulty}</Badge>
        </div>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{question.text}</h3>
      {question.expectedAnswer && (
        <p className="text-sm text-gray-600">
          <strong>Hint:</strong> {question.expectedAnswer}
        </p>
      )}
    </div>
  );
};
