import { useCallback, useEffect, useRef, useState } from 'react';
import type { InterviewMode } from '@/types';

export type RecordingState = 'idle' | 'recording' | 'error';

export interface RecordedMedia {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
}

const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

const pickMimeType = (mode: InterviewMode): string | null => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return null;
  }
  const candidates =
    mode === 'VIDEO' ? VIDEO_MIME_CANDIDATES : AUDIO_MIME_CANDIDATES;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? null;
};

const isSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function' &&
  typeof MediaRecorder !== 'undefined';

export interface InterviewRecording {
  supported: boolean;
  armed: boolean;
  state: RecordingState;
  mimeType: string | null;
  arm: () => Promise<boolean>;
  start: () => boolean;
  stopAndCollect: () => Promise<RecordedMedia | null>;
  discard: () => void;
  release: () => void;
}

/**
 * Per-answer recorder for AUDIO/VIDEO interviews.
 *
 * arm() acquires the interview MediaStream (call only after the Phase 7A
 * device check has passed — browser permission is then already granted).
 * start() begins a MediaRecorder for the current question; stopAndCollect()
 * finalizes the recording as a Blob for upload; discard() drops it (skips).
 * release() stops the recorder and every track. All tracks are stopped on
 * unmount and on mode change.
 */
export function useInterviewRecording(mode: InterviewMode): InterviewRecording {
  const [armed, setArmed] = useState(false);
  const [state, setState] = useState<RecordingState>('idle');
  const [mimeType, setMimeType] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);

  const supported = mode !== 'TEXT' && isSupported() && pickMimeType(mode) !== null;

  const release = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Already stopping.
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    discardRef.current = false;
    setArmed(false);
    setState('idle');
  }, []);

  useEffect(() => release, [mode, release]);

  const arm = useCallback(async (): Promise<boolean> => {
    if (mode === 'TEXT' || !isSupported()) return false;
    if (streamRef.current) return true;
    const mime = pickMimeType(mode);
    if (!mime) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'VIDEO',
      });
      streamRef.current = stream;
      setMimeType(mime);
      setArmed(true);
      return true;
    } catch {
      return false;
    }
  }, [mode]);

  const start = useCallback((): boolean => {
    const stream = streamRef.current;
    const mime = mimeType ?? pickMimeType(mode);
    if (!stream || !mime || recorderRef.current) return false;
    try {
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      discardRef.current = false;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => setState('error');
      recorder.onstop = () => {
        recorderRef.current = null;
        setState('idle');
      };
      startedAtRef.current = Date.now();
      recorderRef.current = recorder;
      recorder.start(1000);
      setState('recording');
      return true;
    } catch {
      return false;
    }
  }, [mode, mimeType]);

  const stopAndCollect = useCallback((): Promise<RecordedMedia | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return Promise.resolve(null);
    const mime = recorder.mimeType;
    const durationSeconds = (Date.now() - startedAtRef.current) / 1000;
    return new Promise((resolve) => {
      recorder.onstop = () => {
        recorderRef.current = null;
        setState('idle');
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        resolve(
          discardRef.current || blob.size === 0
            ? null
            : { blob, mimeType: mime, durationSeconds }
        );
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const discard = useCallback(() => {
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Already stopping.
      }
    }
    chunksRef.current = [];
  }, []);

  return {
    supported,
    armed,
    state,
    mimeType,
    arm,
    start,
    stopAndCollect,
    discard,
    release,
  };
}
