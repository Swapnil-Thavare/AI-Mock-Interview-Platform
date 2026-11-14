import React, { useEffect, useRef, useState } from 'react';

interface TimerProps {
  durationSeconds: number;
  onTimeUp?: () => void;
}

export const Timer: React.FC<TimerProps> = ({ durationSeconds, onTimeUp }) => {
  const [remaining, setRemaining] = useState(durationSeconds);
  const onTimeUpRef = useRef(onTimeUp);
  const firedRef = useRef(false);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    setRemaining(durationSeconds);
    firedRef.current = false;
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [durationSeconds]);

  useEffect(() => {
    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onTimeUpRef.current?.();
    }
  }, [remaining]);

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${
        remaining < 10
          ? 'bg-red-100 text-red-800 ring-red-200'
          : 'bg-white text-gray-800 ring-gray-200 shadow-sm'
      }`}
      aria-live="off"
    >
      <svg
        className={`h-4 w-4 ${remaining < 10 ? 'text-red-600' : 'text-primary-600'}`}
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
      <span className="tabular-nums">{format(remaining)}</span>
    </div>
  );
};
