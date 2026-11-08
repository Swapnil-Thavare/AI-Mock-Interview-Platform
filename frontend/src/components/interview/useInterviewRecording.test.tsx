import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInterviewRecording } from './useInterviewRecording';

class FakeTrack {
  kind = 'audio' as const;
  readyState: 'live' | 'ended' = 'live';
  private handlers: Record<string, ((...args: never[]) => void)[]> = {};

  addEventListener(type: string, handler: (...args: never[]) => void) {
    (this.handlers[type] ??= []).push(handler);
  }
  removeEventListener(type: string, handler: (...args: never[]) => void) {
    this.handlers[type] = (this.handlers[type] ?? []).filter(
      (h) => h !== handler
    );
  }
  // A real device-removal ending — fires 'ended' WITHOUT stop() being called.
  fireEnded() {
    this.readyState = 'ended';
    (this.handlers['ended'] ?? []).forEach((h) => h());
  }
  stop() {
    this.readyState = 'ended';
  }
}

class FakeStream {
  tracks: FakeTrack[];
  constructor(kinds: string[]) {
    this.tracks = kinds.map((k) => {
      const t = new FakeTrack();
      Object.defineProperty(t, 'kind', { value: k });
      return t;
    });
  }
  getTracks() {
    return this.tracks;
  }
}

let autoStop = true;

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }
  state = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_stream: unknown, opts: { mimeType: string }) {
    this.mimeType = opts.mimeType;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    if (this.state === 'inactive') throw new Error('inactive');
    this.state = 'inactive';
    if (!autoStop) return; // simulate onstop never firing
    this.ondataavailable?.({ data: new Blob(['chunk']) });
    this.onstop?.();
  }
}

const getUserMediaMock = vi.fn();

beforeEach(() => {
  autoStop = true;
  getUserMediaMock.mockReset();
  Object.defineProperty(globalThis, 'MediaRecorder', {
    value: FakeMediaRecorder,
    configurable: true,
  });
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: getUserMediaMock },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const audioStream = () => {
  const s = new FakeStream(['audio']);
  getUserMediaMock.mockResolvedValue(s);
  return s;
};

describe('useInterviewRecording', () => {
  it('arms by acquiring a stream and attaching track listeners', async () => {
    const s = audioStream();
    const { result } = renderHook(() => useInterviewRecording('AUDIO'));
    let ok = false;
    await act(async () => {
      ok = await result.current.arm();
    });
    expect(ok).toBe(true);
    expect(result.current.armed).toBe(true);
    expect(result.current.stream).toBe(s);
    expect(result.current.deadTrack).toBeNull();
  });

  it('detects a dead microphone track and un-arms', async () => {
    const s = audioStream();
    const { result } = renderHook(() => useInterviewRecording('AUDIO'));
    await act(async () => {
      await result.current.arm();
    });
    act(() => {
      s.tracks[0].fireEnded();
    });
    expect(result.current.deadTrack).toBe('audio');
    expect(result.current.armed).toBe(false);
  });

  it('re-acquires a fresh stream after the device dies', async () => {
    const s1 = audioStream();
    const { result } = renderHook(() => useInterviewRecording('AUDIO'));
    await act(async () => {
      await result.current.arm();
    });
    act(() => {
      s1.tracks[0].fireEnded();
    });
    const s2 = audioStream();
    let ok = false;
    await act(async () => {
      ok = await result.current.arm();
    });
    expect(ok).toBe(true);
    expect(result.current.deadTrack).toBeNull();
    expect(result.current.stream).toBe(s2);
    expect(getUserMediaMock).toHaveBeenCalledTimes(2);
  });

  it('refuses to start a recording on a dead stream', async () => {
    const s = audioStream();
    const { result } = renderHook(() => useInterviewRecording('AUDIO'));
    await act(async () => {
      await result.current.arm();
    });
    // Device ended without the event (e.g. OS stole it) — start() must
    // detect the dead stream rather than produce a silent recording.
    s.tracks[0].readyState = 'ended';
    let started = true;
    act(() => {
      started = result.current.start();
    });
    expect(started).toBe(false);
    expect(result.current.state).not.toBe('recording');
  });

  it('collects recorded chunks into a blob on stop', async () => {
    audioStream();
    const { result } = renderHook(() => useInterviewRecording('AUDIO'));
    await act(async () => {
      await result.current.arm();
    });
    act(() => {
      result.current.start();
    });
    let media: Awaited<
      ReturnType<typeof result.current.stopAndCollect>
    > = null;
    await act(async () => {
      media = await result.current.stopAndCollect();
    });
    expect(media).not.toBeNull();
    expect(media!.blob.size).toBeGreaterThan(0);
    expect(media!.mimeType).toBe('audio/webm;codecs=opus');
  });

  it('times out instead of hanging when onstop never fires', async () => {
    vi.useFakeTimers();
    audioStream();
    const { result } = renderHook(() => useInterviewRecording('AUDIO'));
    await act(async () => {
      await result.current.arm();
    });
    act(() => {
      result.current.start();
    });
    autoStop = false;
    let resolved: unknown = 'pending';
    act(() => {
      void result.current.stopAndCollect().then((m) => {
        resolved = m;
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(resolved).toBeNull();
  });

  it('release stops every track and disarms', async () => {
    const s = audioStream();
    const { result } = renderHook(() => useInterviewRecording('AUDIO'));
    await act(async () => {
      await result.current.arm();
    });
    act(() => {
      result.current.release();
    });
    expect(result.current.armed).toBe(false);
    expect(s.tracks[0].readyState).toBe('ended');
    expect(result.current.stream).toBeNull();
  });

  it('rejects arm in TEXT mode', async () => {
    const { result } = renderHook(() => useInterviewRecording('TEXT'));
    let ok = true;
    await act(async () => {
      ok = await result.current.arm();
    });
    expect(ok).toBe(false);
    expect(getUserMediaMock).not.toHaveBeenCalled();
  });
});
