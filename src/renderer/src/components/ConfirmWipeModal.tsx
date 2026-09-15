import React from 'react';
import { X, AlertTriangle, HardDrive, FileText, ArrowRight } from 'lucide-react';
import { DriveInfo, SourceFile } from '../../../shared/types';
import { formatBytes } from '../../../shared/formatters';

interface ConfirmWipeModalProps {
  isOpen: boolean;
  source: SourceFile;
  target: DriveInfo;
  onCancel: () => void;
  onConfirm: () => void;
}

// Drive wipe confirmation dialog
export const ConfirmWipeModal: React.FC<ConfirmWipeModalProps> = ({
  isOpen,
  source,
  target,
  onCancel,
  onConfirm
}) => {
  if (!isOpen) return null;

  const partitionCount = target.mountpoints?.length || 0;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-container confirm-wipe-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-header-left">
            <h3 className="modal-title">Confirm Drive Erasure</h3>
            <span className="modal-subtitle">Review target before raw data write</span>
          </div>
          <button className="icon-btn" onClick={onCancel} title="Close">
            <X size={17} />
          </button>
        </div>

        <div className="modal-body confirm-wipe-body">
          <div className="wipe-banner-warning">
            <div className="wipe-banner-icon">
              <AlertTriangle size={26} strokeWidth={2.2} />
            </div>
            <div className="wipe-banner-texts">
              <h4 className="wipe-banner-title">Permanent Data Destruction Notice</h4>
              <p className="wipe-banner-subtext">
                All existing volumes, filesystems, and files on the destination block
                device will be completely erased and overwritten with raw image bytes.
              </p>
            </div>
          </div>

          <div className="wipe-inspection-grid">
            <div className="wipe-inspect-card">
              <div className="inspect-header-row">
                <HardDrive size={16} />
                <span>TARGET STORAGE DEVICE</span>
              </div>
              <div className="inspect-device-name font-mono">
                {target.description || target.device}
              </div>
              <div className="inspect-meta-tags">
                <span className="inspect-tag-pill">{target.device}</span>
                <span className="inspect-tag-pill">{formatBytes(target.size)}</span>
                {target.fileSystem && (
                  <span className="inspect-tag-pill fs">{target.fileSystem}</span>
                )}
              </div>
              <div className="inspect-status-note">
                {partitionCount > 0
                  ? `${partitionCount} mounted volume(s) will be unmounted and wiped`
                  : 'Storage will be re-partitioned from sector zero'}
              </div>
            </div>

            <div className="wipe-inspect-card">
              <div className="inspect-header-row">
                <FileText size={16} />
                <span>INCOMING BOOTABLE IMAGE</span>
              </div>
              <div className="inspect-device-name" title={source.name}>
                {source.name}
              </div>
              <div className="inspect-meta-tags">
                <span className="inspect-tag-pill">{source.extension.toUpperCase()}</span>
                <span className="inspect-tag-pill">{formatBytes(source.size)}</span>
                {source.partitionScheme && (
                  <span className="inspect-tag-pill scheme">{source.partitionScheme}</span>
                )}
                {source.bootMode && (
                  <span className="inspect-tag-pill boot">{source.bootMode}</span>
                )}
              </div>
              <div className="inspect-status-note">
                {source.targetSystemType || 'Target: Standard BIOS / UEFI'}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer confirm-wipe-footer">
          <button className="btn-secondary-flat" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-action-destructive" onClick={onConfirm}>
            <span>Erase Drive &amp; Flash</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
