import { useEffect, useRef, useState } from 'react';
import { interviewService } from '@/services/interviewService';
import type {
  InterviewMode,
  ProctoringEventInput,
  ProctoringEventType,
  ProctoringMetadataValue,
  ProctoringSeverity,
} from '@/types';

// ---- Centralized proctoring tuning constants ----
const SAMPLE_INTERVAL_MS = 1000;
const FACE_ABSENT_MIN_SAMPLES = 3;
const MULTI_FACE_MIN_SAMPLES = 3;
const MIN_FACE_SCORE = 0.5;
const SAMPLE_MAX_WIDTH = 640;
const CAMERA_MUTE_DEBOUNCE_MS = 1500;
const FLUSH_INTERVAL_MS = 20_000;
const FLUSH_MIN_BATCH = 10;
const MAX_QUEUED_EVENTS = 200;
const WASM_BASE_URL = '/mediapipe/wasm';
const FACE_MODEL_URL = '/mediapipe/models/blaze_face_short_range.tflite';
const DETECTOR_NAME = 'blazeface-short-range';
const QUEUE_STORAGE_PREFIX = 'proctoring_queue:';

const BROWSER_PERIOD_TYPES: ProctoringEventType[] = [
  'TAB_HIDDEN',
  'WINDOW_FOCUS_LOST',
];
const VIDEO_PERIOD_TYPES: ProctoringEventType[] = [
  'FACE_NOT_DETECTED',
  'MULTIPLE_FACES_DETECTED',
  'CAMERA_INTERRUPTED',
];

const SEVERITY: Record<ProctoringEventType, ProctoringSeverity> = {
  FACE_NOT_DETECTED: 'WARNING',
  MULTIPLE_FACES_DETECTED: 'WARNING',
  CAMERA_DISCONNECTED: 'WARNING',
  CAMERA_INTERRUPTED: 'WARNING',
  TAB_HIDDEN: 'INFO',
  WINDOW_FOCUS_LOST: 'INFO',
};

type FaceDetector = import('@mediapipe/tasks-vision').FaceDetector;

export interface ProctoringStatus {
  active: boolean;
  faceAbsent: boolean;
  multipleFaces: boolean;
  cameraInterrupted: boolean;
  cameraDisconnected: boolean;
  detectorFailed: boolean;
}

export interface UseProctoringArgs {
  stream: MediaStream | null;
  interviewId: string | null;
  mode: InterviewMode;
  activeQuestionId?: string | null;
  enabled: boolean;
}

export interface Proctoring {
  status: ProctoringStatus;
}

const IDLE_STATUS: ProctoringStatus = {
  active: false,
  faceAbsent: false,
  multipleFaces: false,
  cameraInterrupted: false,
  cameraDisconnected: false,
  detectorFailed: false,
};

interface OpenPeriod {
  clientEventId: string;
  startedAtMs: number;
  startedIso: string;
  questionId: string | null;
  metadata: Record<string, ProctoringMetadataValue>;
}

/**
 * Phase 7D — session-integrity monitoring for AUDIO/VIDEO interviews.
 *
 * Reuses the existing recording MediaStream (never calls getUserMedia) and
 * converts detection signals into period events — one event per continuous
 * occurrence, never per frame. VIDEO adds in-browser BlazeFace face counting
 * and camera-track monitoring; AUDIO/VIDEO both monitor tab visibility and
 * window focus. TEXT interviews never initialize monitoring.
 *
 * Structured as two effects sharing hook-level state: the session effect
 * (browser monitoring, upload queue) does not depend on `stream`, so an open
 * TAB_HIDDEN/WINDOW_FOCUS_LOST period is not split when the recording stream
 * arrives. The video effect owns camera/face monitoring and only closes the
 * periods it owns when it re-initializes.
 *
 * No frames, images, landmarks, or biometric data leave the browser — only
 * small structured events are uploaded in batches.
 */
export function useProctoring({
  stream,
  interviewId,
  mode,
  activeQuestionId,
  enabled,
}: UseProctoringArgs): Proctoring {
  const [status, setStatus] = useState<ProctoringStatus>(IDLE_STATUS);

  // Props mirrored into refs so effect-local handlers never go stale.
  const interviewIdRef = useRef<string | null>(interviewId);
  const questionIdRef = useRef<string | null>(activeQuestionId ?? null);
  useEffect(() => {
    interviewIdRef.current = interviewId;
  }, [interviewId]);
  useEffect(() => {
    questionIdRef.current = activeQuestionId ?? null;
  }, [activeQuestionId]);

  // Shared session state — outlives either effect's re-initialization.
  const openPeriodsRef = useRef(new Map<ProctoringEventType, OpenPeriod>());
  const queueRef = useRef<ProctoringEventInput[]>([]);
  const flushingRef = useRef(false);

  const persistQueue = () => {
    const id = interviewIdRef.current;
    if (!id) return;
    const queue = queueRef.current;
    try {
      if (queue.length === 0) {
        sessionStorage.removeItem(`${QUEUE_STORAGE_PREFIX}${id}`);
      } else {
        sessionStorage.setItem(
          `${QUEUE_STORAGE_PREFIX}${id}`,
          JSON.stringify(queue.slice(-MAX_QUEUED_EVENTS))
        );
      }
    } catch {
      // Storage may be unavailable (private mode, quota) — ignore.
    }
  };

  const flush = async (): Promise<void> => {
    const id = interviewIdRef.current;
    const queue = queueRef.current;
    if (!id || flushingRef.current || queue.length === 0) return;
    flushingRef.current = true;
    const batch = queue.splice(0, Math.min(queue.length, 100));
    try {
      await interviewService.submitProctoringEvents(id, batch);
      persistQueue();
    } catch {
      queue.unshift(...batch);
      if (queue.length > MAX_QUEUED_EVENTS) {
        queue.splice(0, queue.length - MAX_QUEUED_EVENTS);
      }
      persistQueue();
    } finally {
      flushingRef.current = false;
    }
  };

  const flushKeepalive = () => {
    const id = interviewIdRef.current;
    const queue = queueRef.current;
    if (id && queue.length > 0) {
      interviewService.flushProctoringEventsKeepalive(
        id,
        queue.slice(0, 100)
      );
    }
  };

  const pushEvent = (event: ProctoringEventInput) => {
    const queue = queueRef.current;
    queue.push(event);
    if (queue.length > MAX_QUEUED_EVENTS) {
      queue.splice(0, queue.length - MAX_QUEUED_EVENTS);
    }
    if (queue.length >= FLUSH_MIN_BATCH) void flush();
  };

  // `detector` metadata only tags face-detection events — browser/camera
  // events would wrongly suggest the vision model was running.
  const withDetector = (
    type: ProctoringEventType,
    metadata: Record<string, ProctoringMetadataValue>
  ) =>
    type.startsWith('FACE')
      ? { ...metadata, detector: DETECTOR_NAME }
      : metadata;

  const openPeriod = (
    type: ProctoringEventType,
    metadata: Record<string, ProctoringMetadataValue> = {},
    startedAtMs?: number
  ) => {
    const openPeriods = openPeriodsRef.current;
    if (openPeriods.has(type)) return;
    const startMs = startedAtMs ?? Date.now();
    openPeriods.set(type, {
      clientEventId: crypto.randomUUID(),
      startedAtMs: startMs,
      startedIso: new Date(startMs).toISOString(),
      questionId: questionIdRef.current,
      metadata: withDetector(type, metadata),
    });
  };

  const closePeriod = (
    type: ProctoringEventType,
    metadata: Record<string, ProctoringMetadataValue> = {}
  ) => {
    const openPeriods = openPeriodsRef.current;
    const period = openPeriods.get(type);
    if (!period) return;
    openPeriods.delete(type);
    const endMs = Date.now();
    pushEvent({
      client_event_id: period.clientEventId,
      event_type: type,
      severity: SEVERITY[type],
      started_at: period.startedIso,
      ended_at: new Date(endMs).toISOString(),
      duration_seconds:
        Math.round(((endMs - period.startedAtMs) / 1000) * 1000) / 1000,
      question_id: period.questionId,
      event_metadata: { ...period.metadata, ...metadata },
    });
  };

  const closePeriods = (types: ProctoringEventType[]) => {
    for (const type of types) closePeriod(type);
  };

  const closeAllPeriods = () => {
    for (const type of [...openPeriodsRef.current.keys()]) {
      closePeriod(type);
    }
  };

  const emitInstant = (
    type: ProctoringEventType,
    metadata: Record<string, ProctoringMetadataValue> = {}
  ) => {
    pushEvent({
      client_event_id: crypto.randomUUID(),
      event_type: type,
      severity: SEVERITY[type],
      started_at: new Date().toISOString(),
      ended_at: null,
      duration_seconds: null,
      question_id: questionIdRef.current,
      event_metadata: withDetector(type, metadata),
    });
  };

  // ---- Video monitoring (declared first so its cleanup runs before the
  // session cleanup's final flush — React cleans up in declaration order). ----
  useEffect(() => {
    if (!enabled || !interviewId || mode !== 'VIDEO' || !stream) return;

    let cancelled = false;
    let cameraGone = false;
    let detector: FaceDetector | null = null;
    let videoEl: HTMLVideoElement | null = null;
    let samplerTimer: number | undefined;
    let muteTimer: number | undefined;
    let faceMissCount = 0;
    let faceMissSince: number | null = null;
    let multiCount = 0;
    let multiSince: number | null = null;
    const videoTrack = stream.getVideoTracks()[0] ?? null;

    const onFaceSample = (faceCount: number) => {
      const now = Date.now();
      if (faceCount === 0) {
        if (faceMissSince === null) faceMissSince = now;
        faceMissCount += 1;
        multiCount = 0;
        multiSince = null;
        if (faceMissCount >= FACE_ABSENT_MIN_SAMPLES) {
          openPeriod(
            'FACE_NOT_DETECTED',
            { consecutive_samples: faceMissCount },
            faceMissSince
          );
          setStatus((s) => ({ ...s, faceAbsent: true }));
        }
        if (openPeriodsRef.current.has('MULTIPLE_FACES_DETECTED')) {
          closePeriod('MULTIPLE_FACES_DETECTED');
          setStatus((s) => ({ ...s, multipleFaces: false }));
        }
        return;
      }

      if (openPeriodsRef.current.has('FACE_NOT_DETECTED')) {
        closePeriod('FACE_NOT_DETECTED', {
          consecutive_samples: faceMissCount,
        });
      }
      faceMissCount = 0;
      faceMissSince = null;
      setStatus((s) => (s.faceAbsent ? { ...s, faceAbsent: false } : s));

      if (faceCount >= 2) {
        if (multiSince === null) multiSince = now;
        multiCount += 1;
        if (multiCount >= MULTI_FACE_MIN_SAMPLES) {
          openPeriod(
            'MULTIPLE_FACES_DETECTED',
            { face_count: faceCount },
            multiSince
          );
          setStatus((s) => ({ ...s, multipleFaces: true }));
        }
      } else {
        multiCount = 0;
        multiSince = null;
        if (openPeriodsRef.current.has('MULTIPLE_FACES_DETECTED')) {
          closePeriod('MULTIPLE_FACES_DETECTED');
        }
        setStatus((s) =>
          s.multipleFaces ? { ...s, multipleFaces: false } : s
        );
      }
    };

    const startSampler = (faceDetector: FaceDetector) => {
      videoEl = document.createElement('video');
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.srcObject = stream;
      void videoEl.play().catch(() => {});
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      samplerTimer = window.setInterval(() => {
        if (
          cancelled ||
          cameraGone ||
          !videoEl ||
          !ctx ||
          videoEl.readyState < 2 ||
          videoEl.videoWidth === 0
        ) {
          return;
        }
        const scale = Math.min(1, SAMPLE_MAX_WIDTH / videoEl.videoWidth);
        canvas.width = Math.round(videoEl.videoWidth * scale);
        canvas.height = Math.round(videoEl.videoHeight * scale);
        try {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const result = faceDetector.detectForVideo(
            canvas,
            performance.now()
          );
          onFaceSample(result.detections.length);
        } catch {
          // A single bad frame (timestamp ordering, torn canvas) is skipped.
        }
      }, SAMPLE_INTERVAL_MS);
    };

    const initFaceDetection = async () => {
      try {
        const mp = await import('@mediapipe/tasks-vision');
        const vision = await mp.FilesetResolver.forVisionTasks(WASM_BASE_URL);
        const options = (delegate: 'GPU' | 'CPU') => ({
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
          runningMode: 'VIDEO' as const,
          minDetectionConfidence: MIN_FACE_SCORE,
        });
        let created: FaceDetector;
        try {
          created = await mp.FaceDetector.createFromOptions(
            vision,
            options('GPU')
          );
        } catch {
          created = await mp.FaceDetector.createFromOptions(
            vision,
            options('CPU')
          );
        }
        if (cancelled) {
          created.close();
          return;
        }
        detector = created;
        startSampler(created);
      } catch {
        if (!cancelled) {
          setStatus((s) => ({ ...s, detectorFailed: true }));
        }
      }
    };

    const onTrackMute = () => {
      window.clearTimeout(muteTimer);
      muteTimer = window.setTimeout(() => {
        // Debounce: only a sustained mute counts as an interruption.
        if (!cancelled && videoTrack?.muted && !cameraGone) {
          openPeriod('CAMERA_INTERRUPTED', { reason: 'mute' });
          setStatus((s) => ({ ...s, cameraInterrupted: true }));
        }
      }, CAMERA_MUTE_DEBOUNCE_MS);
    };
    const onTrackUnmute = () => {
      window.clearTimeout(muteTimer);
      if (openPeriodsRef.current.has('CAMERA_INTERRUPTED')) {
        closePeriod('CAMERA_INTERRUPTED');
      }
      setStatus((s) =>
        s.cameraInterrupted ? { ...s, cameraInterrupted: false } : s
      );
    };
    const markCameraGone = (reason: string) => {
      if (cameraGone) return;
      cameraGone = true;
      window.clearTimeout(muteTimer);
      closePeriods(VIDEO_PERIOD_TYPES);
      emitInstant('CAMERA_DISCONNECTED', { reason });
      setStatus((s) => ({
        ...s,
        cameraInterrupted: false,
        cameraDisconnected: true,
        faceAbsent: false,
        multipleFaces: false,
      }));
    };
    const onTrackEnded = () => markCameraGone('ended');
    const onRemoveTrack = (event: MediaStreamTrackEvent) => {
      if (event.track.kind === 'video') markCameraGone('removed');
    };

    void initFaceDetection();
    videoTrack?.addEventListener('mute', onTrackMute);
    videoTrack?.addEventListener('unmute', onTrackUnmute);
    videoTrack?.addEventListener('ended', onTrackEnded);
    stream.addEventListener('removetrack', onRemoveTrack);

    return () => {
      cancelled = true;
      window.clearInterval(samplerTimer);
      window.clearTimeout(muteTimer);
      videoTrack?.removeEventListener('mute', onTrackMute);
      videoTrack?.removeEventListener('unmute', onTrackUnmute);
      videoTrack?.removeEventListener('ended', onTrackEnded);
      stream.removeEventListener('removetrack', onRemoveTrack);
      if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
        videoEl = null;
      }
      detector?.close();
      detector = null;
      // Only close the periods this effect owns — browser periods belong to
      // the session effect and must survive stream re-initialization.
      closePeriods(VIDEO_PERIOD_TYPES);
      setStatus((s) => ({
        ...s,
        faceAbsent: false,
        multipleFaces: false,
        cameraInterrupted: false,
        cameraDisconnected: false,
        detectorFailed: false,
      }));
    };
  }, [enabled, interviewId, mode, stream]);

  // ---- Session effect: browser monitoring + upload queue (AUDIO + VIDEO).
  // Deliberately excludes `stream` — browser periods must not split when the
  // recording stream arrives or changes. ----
  useEffect(() => {
    if (!enabled || !interviewId || mode === 'TEXT') {
      return;
    }

    // Restore events that survived a previous pagehide/reload. The server
    // dedupes by client_event_id, so re-sending is safe.
    const queue = queueRef.current;
    try {
      const raw = sessionStorage.getItem(`${QUEUE_STORAGE_PREFIX}${interviewId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as ProctoringEventInput[];
        if (Array.isArray(parsed)) {
          queue.push(...parsed.slice(-MAX_QUEUED_EVENTS));
        }
      }
      sessionStorage.removeItem(`${QUEUE_STORAGE_PREFIX}${interviewId}`);
    } catch {
      // Non-critical — a lost queue only loses un-uploaded observations.
    }

    const onVisibility = () => {
      if (document.hidden) {
        openPeriod('TAB_HIDDEN', { reason: 'hidden' });
      } else {
        closePeriod('TAB_HIDDEN');
      }
    };
    const onBlur = () => openPeriod('WINDOW_FOCUS_LOST', { reason: 'blur' });
    const onFocus = () => closePeriod('WINDOW_FOCUS_LOST');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    if (document.hidden) openPeriod('TAB_HIDDEN', { reason: 'hidden' });
    if (!document.hasFocus()) openPeriod('WINDOW_FOCUS_LOST', { reason: 'blur' });

    const flushTimer = window.setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);

    const onPageHide = () => {
      closeAllPeriods();
      persistQueue();
      flushKeepalive();
    };
    window.addEventListener('pagehide', onPageHide);

    setStatus((s) => ({ ...s, active: true }));

    return () => {
      window.clearInterval(flushTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onPageHide);
      closePeriods(BROWSER_PERIOD_TYPES);
      persistQueue();
      // Runs after the video cleanup (declaration order), so the final
      // keepalive flush carries camera/face periods closed there as well.
      flushKeepalive();
      setStatus(IDLE_STATUS);
    };
  }, [enabled, interviewId, mode]);

  return { status };
}
