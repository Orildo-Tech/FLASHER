import React, { useState } from 'react';
import { HardDrive, FileUp, Check, ArrowRight, FileCheck } from 'lucide-react';
import { SourceFile } from '../../../shared/types';
import { formatBytes } from '../../../shared/formatters';

interface StepSourceProps {
  source: SourceFile | null;
  onSelectSource: () => void;
  onClearSource: () => void;
  disabled?: boolean;
}

// Image selection step
export const StepSource: React.FC<StepSourceProps> = ({
  source,
  onSelectSource,
  onClearSource,
  disabled
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const isSelected = Boolean(source);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Handle file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file as any).path) {
      onSelectSource();
    }
  };

  return (
    <div
      className={`bento-card step-card ${isSelected ? 'is-completed' : 'is-active'} ${
        isDragOver ? 'drag-active' : ''
      } ${disabled ? 'is-disabled' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="card-top-indicator">
        <div className={`step-badge-number ${isSelected ? 'completed' : 'active'}`}>
          {isSelected ? <Check size={13} strokeWidth={3} /> : '01'}
        </div>
        <span className="step-badge-label">SELECT IMAGE</span>
      </div>

      <div className="card-center-content">
        {isSelected ? (
          <div className="selected-artifact-wrap">
            <div className="artifact-icon-glow">
              <FileCheck size={36} strokeWidth={1.75} />
            </div>

            <div className="artifact-meta">
              <div className="artifact-type-tag">
                {source?.extension.toUpperCase() || 'DISK IMAGE'}
              </div>
              <h4 className="artifact-title" title={source?.name}>
                {source?.name}
              </h4>
              <div className="artifact-pills-row">
                <span className="artifact-size-pill">
                  {formatBytes(source?.size || 0)}
                </span>
                {source?.partitionScheme && source.partitionScheme !== 'Unknown' && (
                  <span className="artifact-scheme-pill">
                    {source.partitionScheme}
                  </span>
                )}
                {source?.bootMode && source.bootMode !== 'Unknown' && (
                  <span className="artifact-boot-pill">
                    {source.bootMode}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="idle-state-wrap">
            <div className="idle-icon-wrap" onClick={onSelectSource}>
              <FileUp size={34} strokeWidth={1.5} />
            </div>
            <h4 className="idle-heading">Choose OS Image</h4>
            <p className="idle-subtext">Click or drag & drop disk file</p>
            <div className="format-pills-row">
              <span className="format-pill">ISO</span>
              <span className="format-pill">IMG</span>
              <span className="format-pill">RAW</span>
            </div>
          </div>
        )}
      </div>

      <div className="card-action-footer">
        {isSelected ? (
          <button
            className="btn-ghost-action"
            onClick={onClearSource}
            disabled={disabled}
          >
            Change Image
          </button>
        ) : (
          <button
            className="btn-action-primary"
            onClick={onSelectSource}
            disabled={disabled}
          >
            <HardDrive size={16} />
            <span>Select File</span>
            <ArrowRight size={14} className="btn-arrow-icon" />
          </button>
        )}
      </div>
    </div>
  );
};
