import React, { useState } from 'react';
import { X, RefreshCw, HardDrive, ShieldAlert, Check, Usb, Search } from 'lucide-react';
import { DriveInfo } from '../../../shared/types';
import { formatBytes } from '../../../shared/formatters';

interface DriveModalProps {
  drives: DriveInfo[];
  selectedDrives: DriveInfo[];
  isOpen: boolean;
  onClose: () => void;
  onToggleDrive: (drive: DriveInfo) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

// Drive selector dialog
export const DriveModal: React.FC<DriveModalProps> = ({
  drives,
  selectedDrives,
  isOpen,
  onClose,
  onToggleDrive,
  onRefresh,
  isLoading
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredDrives = drives.filter((d) =>
    (d.description || d.device).toLowerCase().includes(search.toLowerCase()) ||
    d.device.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container drive-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <h3 className="modal-title">Select Target Storage</h3>
            <span className="modal-subtitle">
              Choose destination disks to flash
            </span>
          </div>

          <div className="modal-header-right">
            <button
              className="icon-btn"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh drives"
            >
              <RefreshCw size={15} className={isLoading ? 'spin-animation' : ''} />
            </button>
            <button className="icon-btn" onClick={onClose} title="Close">
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="modal-search-bar">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Filter drives by name or device path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="modal-body drive-list-body">
          {filteredDrives.length === 0 ? (
            <div className="empty-drives-wrap">
              <Usb size={36} strokeWidth={1.5} />
              <h4>No matching drives found</h4>
              <p>Please insert a USB flash drive or memory card</p>
            </div>
          ) : (
            filteredDrives.map((d) => {
              const isSelected = selectedDrives.some((sd) => sd.device === d.device);

              return (
                <div
                  key={d.device}
                  className={`drive-card-item ${isSelected ? 'selected' : ''} ${
                    d.disabled ? 'disabled-system' : ''
                  }`}
                  onClick={() => !d.disabled && onToggleDrive(d)}
                >
                  <div className="drive-card-left">
                    <div className={`drive-card-icon ${d.isSystem ? 'system' : 'usb'}`}>
                      {d.isSystem ? <ShieldAlert size={22} /> : <HardDrive size={22} />}
                    </div>

                    <div className="drive-card-details">
                      <div className="drive-card-title-row">
                        <span className="drive-card-title">
                          {d.description || d.device}
                        </span>
                        {d.isSystem ? (
                          <span className="drive-tag-badge system-badge">
                            SYSTEM OS DISK
                          </span>
                        ) : d.isUSB ? (
                          <span className="drive-tag-badge usb-badge">
                            REMOVABLE USB
                          </span>
                        ) : null}
                      </div>

                      <div className="drive-card-meta-row">
                        <span className="drive-device-path font-mono">
                          {d.device}
                        </span>
                        <span className="meta-bullet">&bull;</span>
                        <span className="drive-size-val">
                          {formatBytes(d.size)}
                        </span>
                        {d.fileSystem && (
                          <>
                            <span className="meta-bullet">&bull;</span>
                            <span className="drive-fs-val">{d.fileSystem}</span>
                          </>
                        )}
                        {d.warning && (
                          <span className="drive-warning-val">
                            &bull; {d.warning}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="drive-card-right">
                    {!d.disabled ? (
                      <div className={`custom-checkbox-round ${isSelected ? 'checked' : ''}`}>
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                    ) : (
                      <div className="system-locked-label">PROTECTED</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-footer-summary">
            <span>{selectedDrives.length} target drive(s) selected</span>
          </div>

          <div className="modal-footer-actions">
            <button className="btn-secondary-flat" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-action-primary"
              style={{ width: 'auto', padding: '0 24px' }}
              onClick={onClose}
              disabled={selectedDrives.length === 0}
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
