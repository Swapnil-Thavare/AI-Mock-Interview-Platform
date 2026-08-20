import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { QuestionCard } from '@/components/interview/QuestionCard';
import { Timer } from '@/components/interview/Timer';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { interviewService } from '@/services/interviewService';
import type { Question, Answer } from '@/types';

const QUESTION_TIME = 120; // seconds per question

export const Interview: React.FC = () => {
  const navigate = useNavigate();
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('currentInterviewId');
    if (!id) {
      navigate('/interview/setup');
      return;
    }
    setInterviewId(id);

    const load = async () => {
      try {
        const qs = await interviewService.getQuestions(id);
        setQuestions(qs);
      } catch {
        setError('Could not load interview. Please start a new one.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  useEffect(() => {
    setText(answers[questions[index]?.id]?.text ?? '');
  }, [index, questions, answers]);

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const progress = questions.length ? ((index + 1) / questions.length) * 100 : 0;

  const save = (skipped: boolean): Answer | undefined => {
    if (!current || !interviewId) return undefined;
    const answer: Answer = {
      questionId: current.id,
      text: skipped ? '' : text,
      skipped,
      timeTaken: QUESTION_TIME,
      submittedAt: new Date().toISOString(),
    };
    setAnswers((prev) => ({ ...prev, [current.id]: answer }));
    return answer;
  };

  const handleSubmit = async () => {
    if (!current) return;
    setLoading(true);
    const answer = save(false);
    if (answer) {
      try {
        await interviewService.submitAnswer(interviewId!, current.id, answer);
      } catch {
        setError('Could not submit answer. Please try again.');
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    if (isLast) {
      await handleEnd();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleSkip = async () => {
    if (!current) return;
    const answer = save(true);
    if (answer) {
      try {
        await interviewService.submitAnswer(interviewId!, current.id, answer);
      } catch {
        setError('Could not submit answer. Please try again.');
        return;
      }
    }
    if (isLast) {
      await handleEnd();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleEnd = async () => {
    if (!interviewId) return;
    setLoading(true);
    setError('');
    try {
      await interviewService.complete(interviewId);
      navigate('/interview/result');
    } catch {
      setError('Could not finish the interview. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">Loading interview...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Mock interview</h2>
        <Timer
          durationSeconds={QUESTION_TIME}
          onTimeUp={() => {
            if (text.trim()) handleSubmit();
            else handleSkip();
          }}
        />
      </div>

      <div className="mb-6 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-primary-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {current && (
        <>
          <QuestionCard question={current} index={index} total={questions.length} />
          <div className="mt-6">
            <Textarea
              label="Your answer"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your response here..."
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={handleSubmit} disabled={!text.trim() || loading}>
                {isLast ? 'Finish' : 'Submit & next'}
              </Button>
              <Button variant="secondary" onClick={handleSkip} disabled={loading}>
                {isLast ? 'Skip & finish' : 'Skip'}
              </Button>
              <Button variant="secondary" onClick={handleEnd} disabled={loading}>
                End interview
              </Button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};
