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

// Bounded wait for MediaRecorder.onstop — without it a browser that never
// fires the event would leave the submit flow pending forever.
const STOP_TIMEOUT_MS = 5000;

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

const streamHasLiveTracks = (stream: MediaStream | null): boolean =>
  !!stream &&
  stream.getTracks().some((track) => track.readyState !== 'ended');

export interface InterviewRecording {
  supported: boolean;
  armed: boolean;
  state: RecordingState;
  mimeType: string | null;
  stream: MediaStream | null;
  /** Which required device stopped mid-interview, if any. */
  deadTrack: 'audio' | 'video' | null;
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
 * device check has passed — browser permission is then already granted) and
 * attaches track 'ended' listeners so a disconnected device is detected
 * instead of silently recording nothing. start() begins a MediaRecorder for
 * the current question; stopAndCollect() finalizes the recording as a Blob
 * for upload; discard() drops it (skips). release() stops the recorder and
 * every track. All tracks are stopped on unmount and on mode change.
 */
export function useInterviewRecording(mode: InterviewMode): InterviewRecording {
  const [armed, setArmed] = useState(false);
  const [state, setState] = useState<RecordingState>('idle');
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [deadTrack, setDeadTrack] = useState<'audio' | 'video' | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const collectingRef = useRef(false);
  const trackListenersRef = useRef<{ track: MediaStreamTrack; handler: () => void }[]>([]);

  const supported = mode !== 'TEXT' && isSupported() && pickMimeType(mode) !== null;

  const detachTrackListeners = useCallback(() => {
    for (const { track, handler } of trackListenersRef.current) {
      track.removeEventListener('ended', handler);
    }
    trackListenersRef.current = [];
  }, []);

  const markTrackDead = useCallback((track: MediaStreamTrack) => {
    setDeadTrack(track.kind === 'video' ? 'video' : 'audio');
    setArmed(false);
    // A dead track can no longer produce audio — stop the active recorder
    // so it does not emit an empty or corrupt clip.
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Already stopping.
      }
    }
    chunksRef.current = [];
    setState('idle');
  }, []);

  const attachTrackListeners = useCallback(
    (mediaStream: MediaStream) => {
      detachTrackListeners();
      for (const track of mediaStream.getTracks()) {
        // 'ended' fires on device removal/OS interruption but NOT on our
        // own track.stop() calls — safe to treat as genuine device loss.
        const handler = () => markTrackDead(track);
        track.addEventListener('ended', handler);
        trackListenersRef.current.push({ track, handler });
      }
    },
    [detachTrackListeners, markTrackDead]
  );

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
    detachTrackListeners();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    chunksRef.current = [];
    discardRef.current = false;
    collectingRef.current = false;
    setArmed(false);
    setState('idle');
    setDeadTrack(null);
  }, [detachTrackListeners]);

  useEffect(() => release, [mode, release]);

  const arm = useCallback(async (): Promise<boolean> => {
    if (mode === 'TEXT' || !isSupported()) return false;
    // Never trust a remembered stream — a track may have ended since it was
    // acquired. Verify live tracks before reusing it.
    if (streamRef.current) {
      if (streamHasLiveTracks(streamRef.current)) return true;
      release();
    }
    const mime = pickMimeType(mode);
    if (!mime) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'VIDEO',
      });
      streamRef.current = stream;
      attachTrackListeners(stream);
      setStream(stream);
      setMimeType(mime);
      setDeadTrack(null);
      setArmed(true);
      return true;
    } catch {
      return false;
    }
  }, [mode, release, attachTrackListeners]);

  const start = useCallback((): boolean => {
    const stream = streamRef.current;
    const mime = mimeType ?? pickMimeType(mode);
    if (!stream || !mime || recorderRef.current) return false;
    if (!streamHasLiveTracks(stream)) return false;
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
    if (!recorder || collectingRef.current) return Promise.resolve(null);
    collectingRef.current = true;
    const mime = recorder.mimeType;
    const durationSeconds = (Date.now() - startedAtRef.current) / 1000;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (media: RecordedMedia | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        collectingRef.current = false;
        resolve(media);
      };
      // Bounded wait — if onstop never fires, resolve with null rather than
      // leaving the submit flow pending forever.
      const timer = window.setTimeout(() => {
        recorderRef.current = null;
        chunksRef.current = [];
        finish(null);
      }, STOP_TIMEOUT_MS);
      recorder.onstop = () => {
        recorderRef.current = null;
        setState('idle');
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        finish(
          discardRef.current || blob.size === 0
            ? null
            : { blob, mimeType: mime, durationSeconds }
        );
      };
      try {
        recorder.stop();
      } catch {
        finish(null);
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
    stream,
    deadTrack,
    arm,
    start,
    stopAndCollect,
    discard,
    release,
  };
}
