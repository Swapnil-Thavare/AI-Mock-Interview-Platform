import React, { useEffect, useState } from 'react';

interface TimerProps {
  durationSeconds: number;
  onTimeUp?: () => void;
}

export const Timer: React.FC<TimerProps> = ({ durationSeconds, onTimeUp }) => {
  const [remaining, setRemaining] = useState(durationSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      onTimeUp?.();
      return;
    }
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, onTimeUp]);

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`inline-block rounded-lg px-3 py-1 text-sm font-medium ${
        remaining < 10 ? 'bg-red-100 text-red-800' : 'bg-primary-100 text-primary-800'
      }`}
    >
      Time: {format(remaining)}
    </div>
  );
};
