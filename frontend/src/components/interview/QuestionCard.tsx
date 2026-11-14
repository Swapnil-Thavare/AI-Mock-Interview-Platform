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
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-primary-500 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          Question {index + 1} of {total}
        </span>
        <div className="flex gap-2">
          <Badge color={question.category === 'technical' ? 'primary' : 'yellow'}>
            {question.category}
          </Badge>
          <Badge color="gray">{question.difficulty}</Badge>
        </div>
      </div>
      <h3 className="text-xl font-semibold leading-relaxed text-gray-900">
        {question.text}
      </h3>
      {question.expectedAnswer && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-amber-100">
          <strong className="font-semibold">Hint:</strong> {question.expectedAnswer}
        </p>
      )}
    </div>
  );
};
