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
      className={`inline-block rounded-lg px-3 py-1 text-sm font-medium ${
        remaining < 10 ? 'bg-red-100 text-red-800' : 'bg-primary-100 text-primary-800'
      }`}
    >
      Time: {format(remaining)}
    </div>
  );
};
