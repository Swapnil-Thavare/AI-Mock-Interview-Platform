import React, { useEffect, useState } from 'react';

/**
 * Per-question stopwatch — counts up from 0 for as long as the candidate
 * needs. The elapsed value is captured by the page when the answer is
 * submitted or skipped. Remount via `key` to reset for a new question.
 */
export const Timer: React.FC = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-gray-800 shadow-sm ring-1 ring-gray-200"
      aria-live="off"
      title="Time spent on this question"
    >
      <svg
        className="h-4 w-4 text-primary-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      <span className="tabular-nums">{format(elapsed)}</span>
    </div>
  );
};
