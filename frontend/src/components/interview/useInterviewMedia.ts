import { useCallback, useEffect, useRef, useState } from 'react';
import type { InterviewMode } from '@/types';

export type DeviceCheckStatus =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'permission_denied'
  | 'device_unavailable'
  | 'unsupported'
  | 'error';

export type DeviceState =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface InterviewMedia {
  status: DeviceCheckStatus;
  microphone: DeviceState;
  camera: DeviceState;
  message: string | null;
  stream: MediaStream | null;
  check: () => Promise<void>;
  stop: () => void;
}

const isMediaDevicesSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function';

const classifyError = (
  err: unknown,
  kind: 'camera' | 'microphone'
): { state: DeviceState; message: string } => {
  const name = (err as { name?: string })?.name ?? '';
  if (
    name === 'NotAllowedError' ||
    name === 'SecurityError' ||
    name === 'PermissionDeniedError'
  ) {
    return {
      state: 'denied',
      message: `${
        kind === 'camera' ? 'Camera' : 'Microphone'
      } permission was denied. Allow access in your browser settings and try again.`,
    };
  }
  if (
    name === 'NotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'DevicesNotFoundError'
  ) {
    return {
      state: 'unavailable',
      message: `No ${kind} was detected. Connect a ${kind} and try again.`,
    };
  }
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') {
    return {
      state: 'unavailable',
      message: `Your ${kind} is being used by another application. Close it and try again.`,
    };
  }
  return {
    state: 'error',
    message: `We could not check your ${kind}. Please try again.`,
  };
};

export function useInterviewMedia(mode: InterviewMode): InterviewMedia {
  const needsCamera = mode === 'VIDEO';
  const [status, setStatus] = useState<DeviceCheckStatus>('idle');
  const [microphone, setMicrophone] = useState<DeviceState>('idle');
  const [camera, setCamera] = useState<DeviceState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  // Stop any live tracks on unmount, and fully reset when the requested mode
  // changes (e.g. a VIDEO -> AUDIO fallback).
  useEffect(() => {
    stop();
    setStatus('idle');
    setMicrophone('idle');
    setCamera('idle');
    setMessage(null);
    return stop;
  }, [mode, stop]);

  const check = useCallback(async () => {
    if (!isMediaDevicesSupported()) {
      setStatus('unsupported');
      setMicrophone('unavailable');
      setCamera(needsCamera ? 'unavailable' : 'idle');
      setMessage(
        'This browser cannot access a camera or microphone. Use a recent version of Chrome, Edge, or Firefox over a secure (HTTPS) connection, or switch to a text interview.'
      );
      return;
    }

    stop();
    setStatus('checking');
    setMicrophone('checking');
    setCamera(needsCamera ? 'checking' : 'idle');
    setMessage(null);

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: needsCamera,
      });
      streamRef.current = media;
      setStream(media);
      const micReady = media.getAudioTracks().length > 0;
      const camReady = !needsCamera || media.getVideoTracks().length > 0;
      setMicrophone(micReady ? 'ready' : 'unavailable');
      setCamera(needsCamera ? (camReady ? 'ready' : 'unavailable') : 'idle');
      if (micReady && camReady) {
        setStatus('ready');
        setMessage(null);
      } else {
        setStatus('device_unavailable');
        setMessage(
          micReady
            ? 'No camera was detected. Connect a camera and try again.'
            : 'No microphone was detected. Connect a microphone and try again.'
        );
      }
    } catch (err) {
      const primary = classifyError(err, needsCamera ? 'camera' : 'microphone');
      let micState: DeviceState = needsCamera ? 'idle' : primary.state;
      let camState: DeviceState = needsCamera ? primary.state : 'idle';
      let overall: DeviceCheckStatus =
        primary.state === 'denied'
          ? 'permission_denied'
          : primary.state === 'unavailable'
            ? 'device_unavailable'
            : 'error';
      let msg = primary.message;

      // VIDEO requests the camera and microphone together, so a single failure
      // cannot tell us whether the microphone alone works. Probe audio-only so
      // per-device status and the "switch to audio" fallback stay accurate.
      if (needsCamera) {
        try {
          const micProbe = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          micProbe.getTracks().forEach((track) => track.stop());
          micState = 'ready';
          if (primary.state === 'denied') {
            msg =
              'Camera permission was denied. Allow camera access in your browser settings and try again.';
          } else {
            overall = 'device_unavailable';
            msg =
              'No camera was detected, or it is unavailable. Connect a camera and try again, or switch to an audio interview.';
          }
        } catch (micErr) {
          micState = classifyError(micErr, 'microphone').state;
          if (micState === 'denied') {
            overall = 'permission_denied';
            msg =
              'Camera and microphone permissions were denied. Allow access in your browser settings and try again.';
          } else if (primary.state === 'denied') {
            msg =
              'Camera permission was denied. Allow camera access in your browser settings and try again.';
          }
        }
      }

      setMicrophone(micState);
      setCamera(camState);
      setStatus(overall);
      setMessage(msg);
    }
  }, [needsCamera, stop]);

  return { status, microphone, camera, message, stream, check, stop };
}
