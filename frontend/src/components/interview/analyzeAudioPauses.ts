// Phase 7E — client-side pause estimation for answer recordings.
//
// Decodes the just-recorded blob with the Web Audio API and estimates pauses
// from RMS energy windows. Values are approximations (energy-based silence
// detection, not a speech recognizer). Returns null when decoding or
// analysis is unavailable (e.g. Safari's incomplete WebM/Opus decode
// support) so the upload pipeline is never blocked.

export interface PauseStats {
  pause_count: number;
  pause_total_seconds: number;
  pause_longest_seconds: number;
  speech_seconds: number;
}

const WINDOW_MS = 50;
const MIN_PAUSE_MS = 400;
const MERGE_GAP_MS = 200;
const ABSOLUTE_SILENCE_FLOOR = 0.004;

export async function analyzeAudioPauses(
  blob: Blob
): Promise<PauseStats | null> {
  try {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return null;

    const ctx = new AudioCtor();
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    } finally {
      void ctx.close().catch(() => {});
    }

    const samples = buffer.getChannelData(0);
    if (samples.length === 0 || buffer.duration <= 0) return null;

    const windowSize = Math.max(
      1,
      Math.round((buffer.sampleRate * WINDOW_MS) / 1000)
    );
    const rms: number[] = [];
    for (let start = 0; start < samples.length; start += windowSize) {
      const end = Math.min(start + windowSize, samples.length);
      let sum = 0;
      for (let i = start; i < end; i += 1) sum += samples[i] * samples[i];
      rms.push(Math.sqrt(sum / (end - start)));
    }
    if (rms.length === 0) return null;

    // Adaptive silence threshold: a window is silent when its RMS is well
    // below the loud part of the recording, bounded by an absolute floor so
    // a quiet microphone still detects pauses.
    const sorted = [...rms].sort((a, b) => a - b);
    const peak = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    if (peak <= 0) return null;
    const threshold = Math.max(
      ABSOLUTE_SILENCE_FLOOR,
      Math.min(peak * 0.15, median * 0.6 || peak * 0.15)
    );

    // Collect contiguous silent-window runs.
    const windowSec = windowSize / buffer.sampleRate;
    const runs: { start: number; end: number }[] = [];
    let runStart: number | null = null;
    for (let i = 0; i < rms.length; i += 1) {
      if (rms[i] < threshold) {
        if (runStart === null) runStart = i;
      } else if (runStart !== null) {
        runs.push({ start: runStart, end: i });
        runStart = null;
      }
    }
    if (runStart !== null) runs.push({ start: runStart, end: rms.length });

    // Merge silent runs separated by a gap shorter than MERGE_GAP_MS — a
    // brief energy blip inside a pause does not split it. A sub-threshold
    // merged segment still counts toward the merged pause duration.
    const mergeGapWindows = Math.ceil(MERGE_GAP_MS / WINDOW_MS);
    const mergedRuns: { start: number; end: number }[] = [];
    for (const run of runs) {
      const last = mergedRuns[mergedRuns.length - 1];
      if (last && run.start - last.end <= mergeGapWindows) {
        last.end = run.end;
      } else {
        mergedRuns.push({ ...run });
      }
    }
    const mergedDurations = mergedRuns
      .map((r) => (r.end - r.start) * windowSec)
      .filter((d) => d * 1000 >= MIN_PAUSE_MS);

    const pauseTotal = mergedDurations.reduce((a, b) => a + b, 0);
    const pauseLongest = mergedDurations.reduce(
      (a, b) => Math.max(a, b),
      0
    );
    const speechSeconds = Math.max(0, buffer.duration - pauseTotal);
    return {
      pause_count: mergedDurations.length,
      pause_total_seconds: Math.round(pauseTotal * 1000) / 1000,
      pause_longest_seconds: Math.round(pauseLongest * 1000) / 1000,
      speech_seconds: Math.round(speechSeconds * 1000) / 1000,
    };
  } catch {
    return null;
  }
}
