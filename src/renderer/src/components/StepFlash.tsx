import React from 'react';
import { AlertCircle, ShieldAlert, Gauge, Clock, HardDrive, X } from 'lucide-react';
import { DiskIcon } from './icons';
import { FlashProgress } from '../../../shared/types';
import { formatBytes, formatSpeed, formatTime } from '../../../shared/formatters';

interface StepFlashProps {
  canFlash: boolean;
  isFlashing: boolean;
  progress: FlashProgress | null;
  targetCount?: number;
  imageSize?: number;
  onStartFlash: () => void;
  onCancelFlash: () => void;
}

// Flash execution step
export const StepFlash: React.FC<StepFlashProps> = ({
  canFlash,
  isFlashing,
  progress,
  targetCount = 1,
  imageSize = 0,
  onStartFlash,
  onCancelFlash
}) => {
  if (isFlashing && progress) {
    const strokeDashoffset = 283 - (283 * progress.percentage) / 100;

    return (
      <div className="telemetry-dashboard-card">
        <div className="telemetry-header">
          <div className="telemetry-phase-tag">
            <span className="live-pulse-dot" />
            <span>
              {progress.phase === 'formatting'
                ? (progress.badBlocksFound && progress.badBlocksFound > 0
                    ? `FULL FORMATTING (${progress.badBlocksFound} BAD BLOCKS)`
                    : 'FULL FORMATTING DEVICE')
                : progress.phase === 'verifying'
                ? 'VERIFYING DATA INTEGRITY'
                : progress.phase === 'scanning'
                ? 'SCANNING SURFACE FOR BAD BLOCKS'
                : progress.phase === 'decompressing'
                ? 'DECOMPRESSING ARCHIVE'
                : 'FLASHING IMAGE TO TARGET'}
            </span>
          </div>

          <button
            className="telemetry-cancel-btn"
            onClick={onCancelFlash}
            title="Cancel flashing"
          >
            <X size={15} />
            <span>Cancel</span>
          </button>
        </div>

        <div className="telemetry-gauge-center">
          <div className="radial-gauge-wrap">
            <svg className="radial-svg" viewBox="0 0 100 100">
              <circle
                className="radial-bg"
                cx="50"
                cy="50"
                r="45"
                strokeWidth="6"
              />
              <circle
                className="radial-progress-bar"
                cx="50"
                cy="50"
                r="45"
                strokeWidth="6"
                style={{ strokeDashoffset }}
              />
            </svg>
            <div className="radial-content">
              <span className="radial-pct-number">{progress.percentage}</span>
              <span className="radial-pct-symbol">%</span>
            </div>
          </div>
        </div>

        <div className="telemetry-bar-wrap">
          <div
            className="telemetry-bar-fill"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        <div className="telemetry-metrics-grid">
          <div className="telemetry-metric-tile">
            <div className="metric-tile-header">
              <Gauge size={13} />
              <span>SPEED</span>
            </div>
            <div className="metric-tile-val font-mono">
              {formatSpeed(progress.speed)}
            </div>
          </div>

          <div className="telemetry-metric-tile">
            <div className="metric-tile-header">
              <HardDrive size={13} />
              <span>WRITTEN</span>
            </div>
            <div className="metric-tile-val font-mono">
              {formatBytes(progress.bytesWritten)}
            </div>
          </div>

          <div className="telemetry-metric-tile">
            <div className="metric-tile-header">
              <Clock size={13} />
              <span>ESTIMATED</span>
            </div>
            <div className="metric-tile-val font-mono">
              {formatTime(progress.etaSeconds)}
            </div>
          </div>
        </div>

        {progress.error && (
          <div className="telemetry-error-banner">
            <AlertCircle size={16} />
            <span>{progress.error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bento-card step-card ${canFlash ? 'is-active is-ready' : 'is-disabled'}`}>
      <div className="card-top-indicator">
        <div className={`step-badge-number ${canFlash ? 'active ready-pulse' : ''}`}>
          03
        </div>
        <span className="step-badge-label">FLASH IMAGE</span>
      </div>

      <div className="card-center-content">
        <div className="idle-state-wrap">
          <div
            className={`idle-icon-wrap flash-icon-wrap ${canFlash ? 'ready-glow' : 'muted-icon'}`}
            onClick={canFlash ? onStartFlash : undefined}
          >
            <DiskIcon size={36} />
          </div>
          <h4 className="idle-heading">
            {canFlash ? 'Ready to Burn' : 'Awaiting Input'}
          </h4>
          <p className="idle-subtext">
            {canFlash
              ? `Write ${formatBytes(imageSize)} to ${targetCount} drive${targetCount > 1 ? 's' : ''}`
              : 'Complete steps 1 & 2 to begin'}
          </p>
          <div className="flash-ready-tags">
            <span className="ready-tag">
              <ShieldAlert size={12} />
              Write Guard Active
            </span>
          </div>
        </div>
      </div>

      <div className="card-action-footer">
        <button
          className="btn-action-primary btn-flash-action"
          onClick={onStartFlash}
          disabled={!canFlash || isFlashing}
        >
          <DiskIcon size={17} className="btn-bolt-icon" />
          <span>Flash Now!</span>
        </button>
      </div>
    </div>
  );
};
