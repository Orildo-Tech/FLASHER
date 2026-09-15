import React from 'react';
import { Usb, Check, ArrowRight, ShieldCheck, Layers } from 'lucide-react';
import { DriveInfo } from '../../../shared/types';
import { formatBytes } from '../../../shared/formatters';

interface StepTargetProps {
  selectedDrives: DriveInfo[];
  onOpenModal: () => void;
  canSelect: boolean;
  availableDrivesCount?: number;
  disabled?: boolean;
}

// Target selection step
export const StepTarget: React.FC<StepTargetProps> = ({
  selectedDrives,
  onOpenModal,
  canSelect,
  availableDrivesCount = 0,
  disabled
}) => {
  const isSelected = selectedDrives.length > 0;
  const isEnabled = canSelect && !disabled;

  return (
    <div
      className={`bento-card step-card ${isSelected ? 'is-completed' : isEnabled ? 'is-active' : 'is-disabled'}`}
    >
      <div className="card-top-indicator">
        <div
          className={`step-badge-number ${isSelected ? 'completed' : isEnabled ? 'active' : ''}`}
        >
          {isSelected ? <Check size={13} strokeWidth={3} /> : '02'}
        </div>
        <span className="step-badge-label">TARGET DRIVE</span>
      </div>

      <div className="card-center-content">
        {isSelected ? (
          <div className="selected-artifact-wrap">
            <div className="artifact-icon-glow">
              <Usb size={36} strokeWidth={1.75} />
            </div>

            <div className="artifact-meta">
              <div className="artifact-type-tag">
                {selectedDrives.length > 1
                  ? `${selectedDrives.length} DRIVES`
                  : 'USB STORAGE'}
              </div>
              <h4
                className="artifact-title"
                title={selectedDrives[0].description || selectedDrives[0].device}
              >
                {selectedDrives[0].description || selectedDrives[0].device}
              </h4>
              <div className="drive-tags-row">
                <span className="artifact-size-pill">
                  {formatBytes(selectedDrives[0].size)}
                </span>
                <span className="drive-dev-pill">
                  {selectedDrives[0].device}
                </span>
                {selectedDrives[0].fileSystem && (
                  <span className="drive-fs-pill">
                    {selectedDrives[0].fileSystem}
                  </span>
                )}
                {selectedDrives.length > 1 && (
                  <span className="drive-multi-pill">
                    <Layers size={11} />
                    +{selectedDrives.length - 1} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="idle-state-wrap">
            <div
              className={`idle-icon-wrap ${!isEnabled ? 'muted-icon' : ''}`}
              onClick={isEnabled ? onOpenModal : undefined}
            >
              <Usb size={34} strokeWidth={1.5} />
            </div>
            <h4 className="idle-heading">Select Target</h4>
            <p className="idle-subtext">
              {canSelect
                ? availableDrivesCount > 0
                  ? `${availableDrivesCount} external drive${availableDrivesCount > 1 ? 's' : ''} ready`
                  : 'Connect a USB flash drive'
                : 'Select an image first'}
            </p>
            <div className="safety-badge-pill">
              <ShieldCheck size={13} />
              <span>System Disks Protected</span>
            </div>
          </div>
        )}
      </div>

      <div className="card-action-footer">
        {isSelected ? (
          <button
            className="btn-ghost-action"
            onClick={onOpenModal}
            disabled={disabled}
          >
            Change Target
          </button>
        ) : (
          <button
            className="btn-action-primary"
            onClick={onOpenModal}
            disabled={!isEnabled}
          >
            <Usb size={16} />
            <span>Select Target</span>
            <ArrowRight size={14} className="btn-arrow-icon" />
          </button>
        )}
      </div>
    </div>
  );
};
