import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  useInterviewMedia,
  type DeviceState,
} from '@/components/interview/useInterviewMedia';
import type { InterviewMode } from '@/types';

interface InterviewDeviceCheckProps {
  mode: InterviewMode;
  onReady: () => void;
  onSwitchMode: (mode: InterviewMode) => void;
  onCancel: () => void;
}

const rowContent = (
  name: string,
  state: DeviceState
): { text: string; tone: string } => {
  switch (state) {
    case 'checking':
      return { text: 'Checking...', tone: 'text-gray-500' };
    case 'ready':
      return { text: `\u2713 ${name} ready`, tone: 'text-green-700' };
    case 'denied':
      return { text: `\u26A0 ${name} permission denied`, tone: 'text-red-700' };
    case 'unavailable':
      return {
        text: `\u26A0 No ${name.toLowerCase()} detected`,
        tone: 'text-amber-700',
      };
    case 'error':
      return { text: `\u26A0 Could not access ${name.toLowerCase()}`, tone: 'text-red-700' };
    default:
      return { text: 'Not checked', tone: 'text-gray-500' };
  }
};

const DeviceRow: React.FC<{ name: string; state: DeviceState }> = ({ name, state }) => {
  const { text, tone } = rowContent(name, state);
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
      <span className="text-sm font-medium text-gray-900">{name}</span>
      <span className={`text-sm font-medium ${tone}`}>{text}</span>
    </div>
  );
};

export const InterviewDeviceCheck: React.FC<InterviewDeviceCheckProps> = ({
  mode,
  onReady,
  onSwitchMode,
  onCancel,
}) => {
  const media = useInterviewMedia(mode);
  const isVideo = mode === 'VIDEO';
  const { status } = media;
  const failed =
    status === 'permission_denied' ||
    status === 'device_unavailable' ||
    status === 'unsupported' ||
    status === 'error';

  const deviceName = isVideo ? 'camera and microphone' : 'microphone';

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-2 text-2xl font-bold text-gray-900">Check your devices</h2>
      <p className="mb-6 text-sm text-gray-600">
        This interview uses your {deviceName}. We will check that{' '}
        {isVideo ? 'they work' : 'it works'} before you begin. Nothing is recorded
        during this check.
      </p>
      <Card>
        <div className="space-y-3" aria-live="polite">
          {isVideo && <DeviceRow name="Camera" state={media.camera} />}
          <DeviceRow name="Microphone" state={media.microphone} />
        </div>

        {media.message && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {media.message}
          </p>
        )}
        {status === 'ready' && (
          <p className="mt-4 text-sm text-green-700">
            Your devices are ready. You can start the interview.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {status === 'idle' && (
            <Button onClick={() => void media.check()}>
              Check {deviceName}
            </Button>
          )}
          {status === 'checking' && <Button disabled>Checking your devices...</Button>}
          {status === 'ready' && (
            <>
              <Button
                onClick={() => {
                  media.stop();
                  onReady();
                }}
              >
                Start {isVideo ? 'video' : 'audio'} interview
              </Button>
              <Button variant="secondary" onClick={() => void media.check()}>
                Check again
              </Button>
            </>
          )}
          {failed && (
            <>
              {status !== 'unsupported' && (
                <Button onClick={() => void media.check()}>Retry</Button>
              )}
              {isVideo && media.microphone === 'ready' && (
                <Button variant="secondary" onClick={() => onSwitchMode('AUDIO')}>
                  Switch to audio interview
                </Button>
              )}
              <Button variant="secondary" onClick={() => onSwitchMode('TEXT')}>
                Switch to text interview
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={onCancel}>
            Back to setup
          </Button>
        </div>
      </Card>
    </div>
  );
};
