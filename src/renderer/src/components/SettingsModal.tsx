import React from 'react';
import { X, Check, ShieldCheck, Unplug, Gauge, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  verifyAfterWrite: boolean;
  onToggleVerify: (val: boolean) => void;
  autoUnmount: boolean;
  onToggleAutoUnmount: (val: boolean) => void;
  largeChunkBuffer?: boolean;
  onToggleLargeChunkBuffer?: (val: boolean) => void;
  cleanDiskPreWipe?: boolean;
  onToggleCleanDiskPreWipe?: (val: boolean) => void;
}

// Preferences dialog view
export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  verifyAfterWrite,
  onToggleVerify,
  autoUnmount,
  onToggleAutoUnmount,
  largeChunkBuffer = true,
  onToggleLargeChunkBuffer,
  cleanDiskPreWipe = false,
  onToggleCleanDiskPreWipe
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container settings-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <h3 className="modal-title">Preferences</h3>
            <span className="modal-subtitle">Configure burn & verification behaviors</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={17} />
          </button>
        </div>

        <div className="modal-body settings-card-body">
          <div
            className="setting-toggle-row"
            onClick={() => onToggleVerify(!verifyAfterWrite)}
          >
            <div className="setting-icon-box">
              <ShieldCheck size={20} />
            </div>
            <div className="setting-text-meta">
              <h4 className="setting-name">Validate write on completion</h4>
              <p className="setting-description">
                Performs a checksum validation pass on target blocks to verify zero corruption.
              </p>
            </div>
            <div className={`switch-track ${verifyAfterWrite ? 'is-active' : ''}`}>
              <div className="switch-thumb">
                {verifyAfterWrite && <Check size={11} strokeWidth={3} />}
              </div>
            </div>
          </div>

          <div
            className="setting-toggle-row"
            onClick={() => onToggleAutoUnmount(!autoUnmount)}
          >
            <div className="setting-icon-box">
              <Unplug size={20} />
            </div>
            <div className="setting-text-meta">
              <h4 className="setting-name">Auto-eject target media</h4>
              <p className="setting-description">
                Safely unmounts and flushes I/O queues when finished so media can be unplugged safely.
              </p>
            </div>
            <div className={`switch-track ${autoUnmount ? 'is-active' : ''}`}>
              <div className="switch-thumb">
                {autoUnmount && <Check size={11} strokeWidth={3} />}
              </div>
            </div>
          </div>

          {onToggleLargeChunkBuffer && (
            <div
              className="setting-toggle-row"
              onClick={() => onToggleLargeChunkBuffer(!largeChunkBuffer)}
            >
              <div className="setting-icon-box">
                <Gauge size={20} />
              </div>
              <div className="setting-text-meta">
                <h4 className="setting-name">High-speed buffer chunks (4 MB)</h4>
                <p className="setting-description">
                  Allocates 4 MB memory blocks to maximize throughput on USB 3.0+ drives.
                </p>
              </div>
              <div className={`switch-track ${largeChunkBuffer ? 'is-active' : ''}`}>
                <div className="switch-thumb">
                  {largeChunkBuffer && <Check size={11} strokeWidth={3} />}
                </div>
              </div>
            </div>
          )}

          {onToggleCleanDiskPreWipe && (
            <div
              className="setting-toggle-row"
              onClick={() => onToggleCleanDiskPreWipe(!cleanDiskPreWipe)}
            >
              <div className="setting-icon-box">
                <Trash2 size={20} />
              </div>
              <div className="setting-text-meta">
                <h4 className="setting-name">Zero out partition tables before write</h4>
                <p className="setting-description">
                  Quickly wipes MBR and GPT partition sectors from the disk before streaming image.
                </p>
              </div>
              <div className={`switch-track ${cleanDiskPreWipe ? 'is-active' : ''}`}>
                <div className="switch-thumb">
                  {cleanDiskPreWipe && <Check size={11} strokeWidth={3} />}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn-action-primary"
            style={{ width: 'auto', padding: '0 28px' }}
            onClick={onClose}
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
