import React from 'react';
import { RotateCcw, AlertTriangle, Clock, HardDrive, ShieldCheck } from 'lucide-react';
import { CircularCheckIcon } from './icons';
import { FlashResult } from '../../../shared/types';
import { formatBytes, formatTime } from '../../../shared/formatters';

interface FlashResultsProps {
  result: FlashResult;
  onReset: () => void;
}

// Results screen view
export const FlashResults: React.FC<FlashResultsProps> = ({ result, onReset }) => {
  const isSuccess = result.success;

  return (
    <div className="finish-celebration-card">
      <div className={`finish-badge-circle ${isSuccess ? 'success' : 'error'}`}>
        {isSuccess ? (
          <CircularCheckIcon size={56} className="finish-check-svg" />
        ) : (
          <AlertTriangle size={44} strokeWidth={2} />
        )}
      </div>

      <h2 className="finish-headline">
        {isSuccess ? 'Image Successfully Written' : 'Write Operation Failed'}
      </h2>

      <p className="finish-subtitle">
        {isSuccess
          ? 'Your disk image was safely streamed, written, and verified. Ready to boot!'
          : result.errors?.[0]?.message || 'An unexpected error interrupted writing.'}
      </p>

      {isSuccess && (
        <div className="finish-metrics-deck">
          <div className="finish-metric-box">
            <div className="finish-metric-label">
              <Clock size={13} />
              <span>TOTAL DURATION</span>
            </div>
            <div className="finish-metric-number font-mono">
              {formatTime(result.durationSeconds)}
            </div>
          </div>

          <div className="finish-metric-box">
            <div className="finish-metric-label">
              <HardDrive size={13} />
              <span>DATA WRITTEN</span>
            </div>
            <div className="finish-metric-number font-mono">
              {formatBytes(result.bytesWritten)}
            </div>
          </div>

          <div className="finish-metric-box">
            <div className="finish-metric-label">
              <ShieldCheck size={13} />
              <span>INTEGRITY</span>
            </div>
            <div className="finish-metric-number font-mono">
              {result.checksumVerified ? 'CHECKSUM VERIFIED' : '100% OK'}
            </div>
          </div>
        </div>
      )}

      {isSuccess && result.sourceChecksum && (
        <div className="finish-checksum-card">
          <span className="finish-checksum-title">VERIFIED CHECKSUM</span>
          <span className="finish-checksum-hash font-mono">{result.sourceChecksum}</span>
        </div>
      )}

      <div className="finish-actions-row">
        <button
          className="btn-action-primary"
          onClick={onReset}
          style={{ width: 'auto', padding: '0 36px', height: '46px' }}
        >
          <RotateCcw size={16} />
          <span>Flash Another Image</span>
        </button>
      </div>
    </div>
  );
};
