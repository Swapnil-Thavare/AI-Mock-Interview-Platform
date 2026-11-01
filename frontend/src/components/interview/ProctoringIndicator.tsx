import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { ProctoringStatus } from '@/components/interview/useProctoring';

interface ProctoringIndicatorProps {
  status: ProctoringStatus;
}

/**
 * Non-blocking session-integrity indicator for AUDIO/VIDEO interviews.
 * Renders a subtle persistent badge plus transient warnings that clear on
 * recovery. Never gates submission, navigation, or completion.
 */
export const ProctoringIndicator: React.FC<ProctoringIndicatorProps> = ({
  status,
}) => {
  const warnings: { key: string; text: string }[] = [];
  if (status.faceAbsent) {
    warnings.push({
      key: 'face',
      text: 'No face detected — please return to the camera frame.',
    });
  }
  if (status.multipleFaces) {
    warnings.push({ key: 'multi', text: 'Multiple people detected.' });
  }
  if (status.cameraDisconnected) {
    warnings.push({
      key: 'cam-gone',
      text: 'Camera disconnected — please reconnect your camera.',
    });
  } else if (status.cameraInterrupted) {
    warnings.push({
      key: 'cam',
      text: 'Camera interrupted — please check your camera.',
    });
  }
  if (status.detectorFailed) {
    warnings.push({
      key: 'detector',
      text: 'Session monitoring unavailable.',
    });
  }

  if (!status.active && warnings.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="status">
      {status.active && (
        <Badge color="gray">
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500"
            aria-hidden="true"
          />
          Session monitoring active
        </Badge>
      )}
      {warnings.map((w) => (
        <Badge key={w.key} color="yellow">
          {w.text}
        </Badge>
      ))}
    </div>
  );
};
