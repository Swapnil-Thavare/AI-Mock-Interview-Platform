import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { QuestionCard } from '@/components/interview/QuestionCard';
import { Timer } from '@/components/interview/Timer';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { interviewService } from '@/services/interviewService';
import type { Interview as InterviewType, Question, AnswerEvaluation } from '@/types';

const QUESTION_TIME = 120;

export const Interview: React.FC = () => {
  const navigate = useNavigate();
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [interview, setInterview] = useState<InterviewType | null>(null);
  const [current, setCurrent] = useState<Question | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);

  const loadInterview = useCallback(async (id: string) => {
    try {
      const data = await interviewService.getById(id);
      setInterview(data);
      if (data.result) {
        navigate('/interview/result');
        return;
      }
      const answeredIds = new Set(data.answers.map((a) => a.questionId ?? a.question_id));
      const next = data.questions.find((q) => !answeredIds.has(q.id)) ?? null;
      setCurrent(next);
      setText('');
      setEvaluation(null);
    } catch {
      setError('Could not load interview. Please start a new one.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const id = localStorage.getItem('currentInterviewId');
    if (!id) {
      navigate('/interview/setup');
      return;
    }
    setInterviewId(id);
    let ignore = false;
    const load = async () => {
      if (ignore) return;
      await loadInterview(id);
    };
    void load();
    return () => {
      ignore = true;
    };
  }, [navigate, loadInterview]);

  const total = interview?.questions.length ?? 0;
  const answeredCount = interview?.answers.length ?? 0;
  const progress = total ? ((answeredCount + (submitting ? 1 : 0)) / total) * 100 : 0;
  const isLast = !current || current.id === interview?.questions[interview.questions.length - 1]?.id;

  const handleSubmit = async () => {
    if (!current || !interviewId || submitting) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Please type an answer before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    setEvaluation(null);

    try {
      const response = await interviewService.submitAnswer(interviewId, current.id, {
        questionId: current.id,
        text: trimmed,
        skipped: false,
        timeTaken: QUESTION_TIME,
        submittedAt: new Date().toISOString(),
      });

      setEvaluation(response.evaluation ?? null);
      const updated = await interviewService.getById(interviewId);
      setInterview(updated);

      if (response.is_complete || response.next_question == null) {
        await handleEnd(updated);
        return;
      }

      setCurrent(response.next_question);
      setText('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Could not submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!current || !interviewId || submitting) return;
    setSubmitting(true);
    setError('');
    setEvaluation(null);

    try {
      const response = await interviewService.submitAnswer(interviewId, current.id, {
        questionId: current.id,
        text: '',
        skipped: true,
        timeTaken: QUESTION_TIME,
        submittedAt: new Date().toISOString(),
      });

      const updated = await interviewService.getById(interviewId);
      setInterview(updated);

      if (response.is_complete || response.next_question == null) {
        await handleEnd(updated);
        return;
      }

      setCurrent(response.next_question);
      setText('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Could not skip question. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnd = async (currentInterview?: InterviewType) => {
    if (!interviewId) return;
    setLoading(true);
    setError('');
    try {
      await interviewService.complete(interviewId);
      navigate('/interview/result');
    } catch (err: any) {
      const data = currentInterview ?? interview;
      if (data?.answers.length === 0) {
        setError('Please answer at least one question before finishing.');
      } else {
        setError(err?.response?.data?.detail || err?.message || 'Could not finish the interview. Please try again.');
      }
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

  if (!current) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">
          <p className="mb-4">No more questions. You can finish the interview.</p>
          <Button onClick={() => handleEnd()} disabled={submitting || loading}>
            Finish interview
          </Button>
        </div>
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
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <QuestionCard question={current} index={answeredCount} total={Math.max(total, answeredCount + 1)} />

      <div className="mt-6">
        <Textarea
          label="Your answer"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your response here..."
          disabled={submitting}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={handleSubmit} disabled={!text.trim() || submitting}>
            {submitting ? 'Evaluating...' : isLast ? 'Finish' : 'Submit & next'}
          </Button>
          <Button variant="secondary" onClick={handleSkip} disabled={submitting}>
            {isLast ? 'Skip & finish' : 'Skip'}
          </Button>
          <Button variant="secondary" onClick={() => handleEnd()} disabled={submitting || loading}>
            End interview
          </Button>
        </div>
      </div>

      {submitting && (
        <div className="mt-4 text-sm text-gray-600">AI is evaluating your answer...</div>
      )}

      {evaluation && !submitting && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-2 font-semibold text-gray-900">Feedback</h4>
          <p className="mb-2 text-sm text-gray-700">
            <span className="font-medium">Score:</span> {evaluation.score}%
          </p>
          {evaluation.improvement_feedback && (
            <p className="mb-2 text-sm text-gray-700">{evaluation.improvement_feedback}</p>
          )}
          {evaluation.missing_points.length > 0 && (
            <div className="text-sm text-gray-700">
              <span className="font-medium">Missing points:</span>
              <ul className="mt-1 list-inside list-disc">
                {evaluation.missing_points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};
