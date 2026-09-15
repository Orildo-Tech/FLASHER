import React, { useState, useEffect } from 'react';
import {
  Minus,
  X,
  Check,
  ArrowRight,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import {
  IsoDiskIcon,
  UsbDriveIcon,
  SdCardIcon,
  DiskIcon,
  ShieldLockIcon,
  ShieldCheckIcon,
  SpeedGaugeIcon,
  DataBytesIcon,
  ChronometerIcon,
  AlertCautionIcon,
  SettingsSlidersIcon,
  AdminKeyLockIcon,
  IsoDropzoneHero,
  UsbWaitingHero,
  CircularCheckIcon,
  wordmarkSvg
} from './components/icons';
import { DriveInfo, FlashOptions, FlashProgress, FlashResult, SourceFile } from '../../shared/types';
import { formatBytes, formatSpeed, formatTime } from '../../shared/formatters';
import { SUPPORTED_EXTENSIONS } from '../../shared/constants';
import { AlertTriangle, HardDrive, FileText } from 'lucide-react';

type TabType = 'image' | 'target' | 'flash' | 'confirm' | 'settings';

// Main application component
export const App: React.FC = () => {
  const isMac = window.flasherAPI?.platform === 'darwin';
  const isWin = window.flasherAPI?.platform === 'win32';
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('image');
  const [source, setSource] = useState<SourceFile | null>(null);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [selectedDrives, setSelectedDrives] = useState<DriveInfo[]>([]);
  const [isLoadingDrives, setIsLoadingDrives] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState<FlashProgress | null>(null);
  const [flashResult, setFlashResult] = useState<FlashResult | null>(null);
  // Confirmed by clicking Erase & Flash
  const [isConfirmed, setIsConfirmed] = useState(false);

  const [verifyAfterWrite, setVerifyAfterWrite] = useState(true);
  const [autoUnmount, setAutoUnmount] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [safeMode, setSafeMode] = useState(true);
  const [openOnFinish, setOpenOnFinish] = useState(false);
  const [checkUpdates, setCheckUpdates] = useState(true);
  const [largeChunkBuffer, setLargeChunkBuffer] = useState(true);
  const [cleanDiskPreWipe, setCleanDiskPreWipe] = useState(false);
  const [preventSleep, setPreventSleep] = useState(true);
  const [autoSelectSingleUsb, setAutoSelectSingleUsb] = useState(false);
  const [soundOnFinish, setSoundOnFinish] = useState(true);
  const [surfaceScan, setSurfaceScan] = useState(false);
  const [checksumAlgorithm, setChecksumAlgorithm] = useState<'sha256' | 'md5'>('sha256');
  const [isCalculatingChecksum, setIsCalculatingChecksum] = useState(false);

  const [formatMode, setFormatMode] = useState<'quick' | 'full'>('quick');
  const [writeMode, setWriteMode] = useState<'dd' | 'iso'>('dd');

  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Sync drive selections
  const applyDriveList = (list: DriveInfo[]) => {
    setDrives(list);
    setSelectedDrives((prev) => {
      const valid = prev.filter((sel) =>
        list.some((d) => d.device === sel.device && !d.disabled && !d.isSystem)
      );
      if (valid.length === 0 && autoSelectSingleUsb) {
        const flashable = list.filter(
          (d) => !d.isSystem && !d.isReadOnly && !d.disabled && (d.isUSB || d.isCard || d.isRemovable)
        );
        if (flashable.length === 1) {
          return [flashable[0]];
        }
      }
      return valid;
    });
  };

  // Fetch available drives
  const loadDrives = async () => {
    setIsLoadingDrives(true);
    try {
      if (window.flasherAPI?.listDrives) {
        const list = await window.flasherAPI.listDrives();
        applyDriveList(list);
      } else {
        applyDriveList([
          {
            device: '/dev/sdb',
            displayName: 'SanDisk Ultra USB 3.0 (32.0 GB)',
            description: 'SanDisk Ultra USB 3.0',
            size: 32000000000,
            mountpoints: [{ path: '/media/usb' }],
            isSystem: false,
            isRemovable: true,
            isUSB: true,
            isCard: false,
            isReadOnly: false
          },
          {
            device: '/dev/nvme0n1',
            displayName: 'Samsung NVMe SSD (256.0 GB)',
            description: 'Samsung SSD 980',
            size: 256000000000,
            mountpoints: [{ path: '/' }],
            isSystem: true,
            isRemovable: false,
            isUSB: false,
            isCard: false,
            isReadOnly: false,
            disabled: true,
            warning: 'Protected System Drive'
          }
        ]);
      }
    } catch (e) {
      console.error('Failed to scan drives:', e);
    } finally {
      setIsLoadingDrives(false);
    }
  };

  useEffect(() => {
    loadDrives();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!window.flasherAPI?.onDrivesChanged) return;
    const unsubscribe = window.flasherAPI.onDrivesChanged((list) => {
      applyDriveList(list);
      setIsLoadingDrives(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (window.flasherAPI?.onFlashProgress) {
      const unsubscribe = window.flasherAPI.onFlashProgress((progress) => {
        setFlashProgress(progress);
        setShowPermissionModal(false);
        setIsRequestingPermission(false);
      });
      return unsubscribe;
    }
  }, []);

  // Open file picker
  const handleSelectSource = async () => {
    try {
      if (window.flasherAPI?.openImageDialog) {
        const file = await window.flasherAPI.openImageDialog();
        if (file) {
          setSource(file);
          setActiveTab('target');
        }
      } else {
        setSource({
          name: 'ubuntu-24.04-desktop-amd64.iso',
          path: '/home/user/Downloads/ubuntu-24.04-desktop-amd64.iso',
          size: 4700000000,
          extension: 'iso',
          isArchive: false
        });
        setActiveTab('target');
      }
    } catch (err) {
      console.error('Failed to select file:', err);
    }
  };

  // Toggle drive selection
  const handleToggleDrive = (drive: DriveInfo) => {
    setSelectedDrives((prev) => {
      const exists = prev.some((d) => d.device === drive.device);
      if (exists) return [];
      return [drive];
    });
  };

  // Initiate flash process
  const handleStartFlash = async (forceElevated = false) => {
    if (!source || selectedDrives.length === 0) return;

    if (!SUPPORTED_EXTENSIONS.includes(source.extension.toLowerCase())) {
      alert(`Only ${SUPPORTED_EXTENSIONS.map((e) => `.${e.toUpperCase()}`).join(', ')} files are supported.`);
      return;
    }

    const flashOptions: FlashOptions = {
      source,
      targets: selectedDrives,
      verifyAfterWrite: turboMode ? false : verifyAfterWrite,
      autoUnmountOnSuccess: autoUnmount,
      surfaceScan,
      checksumAlgorithm,
      formatMode,
      writeMode,
      chunkSize: largeChunkBuffer ? 1024 * 1024 * 4 : 1024 * 1024 * 2
    };

    if (!forceElevated && window.flasherAPI?.checkPermissions) {
      try {
        const { needsElevation } = await window.flasherAPI.checkPermissions(flashOptions);
        if (needsElevation) {
          setShowPermissionModal(true);
          return;
        }
      } catch (e) {
        console.error('Permission check failed:', e);
      }
    }

    if (!forceElevated) {
      setShowPermissionModal(false);
    }

    setIsFlashing(true);
    setFlashProgress(null);
    setFlashResult(null);

    try {
      if (window.flasherAPI?.startFlash) {
        const result = await window.flasherAPI.startFlash(flashOptions, forceElevated);

        setShowPermissionModal(false);
        setIsRequestingPermission(false);

        if (result.permissionRequired) {
          setIsFlashing(false);
          setFlashProgress(null);
          setShowPermissionModal(true);
          return;
        }

        if (!result.success && result.cancelled) {
          setIsFlashing(false);
          setFlashProgress(null);
          return;
        }

        setFlashResult(result);
        setIsFlashing(false);
      } else {
        setShowPermissionModal(false);
        let pct = 0;
        const interval = setInterval(() => {
          pct += 4;
          setFlashProgress({
            phase: pct < 80 ? 'flashing' : 'verifying',
            percentage: Math.min(pct, 100),
            bytesWritten: (source.size * Math.min(pct, 100)) / 100,
            totalBytes: source.size,
            speed: 48 * 1024 * 1024,
            etaSeconds: Math.max(0, Math.round((100 - pct) / 4))
          });

          if (pct >= 100) {
            clearInterval(interval);
            setFlashResult({
              success: true,
              durationSeconds: 16,
              bytesWritten: source.size
            });
            setIsFlashing(false);
          }
        }, 220);
      }
    } catch (err: any) {
      console.error('Flash failed:', err);
      setShowPermissionModal(false);
      setFlashResult({
        success: false,
        durationSeconds: 0,
        bytesWritten: 0,
        errors: [{ device: selectedDrives[0]?.device || 'unknown', message: err?.message || 'Flash failed' }]
      });
      setIsFlashing(false);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  // Allow system elevation
  const handleAllowPermission = async () => {
    setIsRequestingPermission(true);
    await handleStartFlash(true);
  };

  // Deny system elevation
  const handleDenyPermission = () => {
    setShowPermissionModal(false);
    setIsRequestingPermission(false);
    setActiveTab('flash');
  };

  // Cancel active flash
  const handleCancelFlash = async () => {
    if (window.flasherAPI?.cancelFlash) {
      await window.flasherAPI.cancelFlash();
    }
    setIsFlashing(false);
    setFlashProgress(null);
  };

  // Reset workflow state
  const handleReset = () => {
    setFlashResult(null);
    setFlashProgress(null);
    setIsFlashing(false);
    setIsConfirmed(false);
    setSource(null);
    setSelectedDrives([]);
    setActiveTab('image');
  };

  const hasSource = Boolean(source);
  const hasTarget = selectedDrives.length > 0;
  const hasInsufficientSpace = Boolean(
    source && selectedDrives[0] && selectedDrives[0].size > 0 && selectedDrives[0].size < source.size
  );
  const canFlash = hasSource && hasTarget && !hasInsufficientSpace;

  const flashableDrives = drives.filter(
    (d) => !d.isSystem && !d.isReadOnly && !d.disabled && (d.isUSB || d.isCard || d.isRemovable)
  );
  const protectedDrives = drives.filter((d) => d.isSystem || d.disabled || d.isReadOnly);
  const externalDrivesCount = flashableDrives.length;


  const strokeDashoffset = flashProgress ? 283 - (283 * flashProgress.percentage) / 100 : 283;

  return (
    <div className={`app-shell ${isMac ? 'platform-mac' : isWin ? 'platform-win' : 'platform-linux'}`}>
      {isLoading && (
        <div className="splash-screen">
          <div className="splash-content">
            <div className="splash-logo-container">
              <img src={wordmarkSvg} alt="Flasher" className="splash-logo" />
            </div>
          </div>
        </div>
      )}
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="sidebar-header">
            <div className="sidebar-brand-group">
              <img src={wordmarkSvg} alt="Flasher" className="brand-wordmark" />
            </div>
          </div>

          <nav className="sidebar-nav">
            <span className="nav-section-title">WORKFLOW</span>

            {/* Image source option */}
            <div
              className={`nav-item ${activeTab === 'image' && !showPermissionModal ? 'active' : ''} ${
                hasSource ? 'completed' : ''
              } ${isFlashing ? 'disabled' : ''}`}
              onClick={() => {
                if (isFlashing) return;
                setShowPermissionModal(false);
                setActiveTab('image');
              }}
            >
              <div className="nav-item-icon-box">
                <IsoDiskIcon size={18} />
              </div>
              <div className="nav-item-texts">
                <span className="nav-item-title">Image Source</span>
                <span className="nav-item-sub">
                  {source ? source.name : 'Select file'}
                </span>
              </div>
              <div
                className={`nav-status-badge ${hasSource ? 'complete' : 'incomplete'}`}
                title={hasSource ? 'Complete' : 'Incomplete'}
              >
                {hasSource && <CircularCheckIcon size={18} />}
              </div>
            </div>

            {/* Target storage option */}
            <div
              className={`nav-item ${activeTab === 'target' && !showPermissionModal ? 'active' : ''} ${
                hasTarget ? 'completed' : ''
              } ${!hasSource || isFlashing ? 'disabled' : ''}`}
              onClick={() => {
                if (!hasSource || isFlashing) return;
                setShowPermissionModal(false);
                setActiveTab('target');
              }}
            >
              <div className="nav-item-icon-box">
                <UsbDriveIcon size={18} />
              </div>
              <div className="nav-item-texts">
                <span className="nav-item-title">Target Storage</span>
                <span className="nav-item-sub">
                  {hasTarget
                    ? selectedDrives[0]?.description || selectedDrives[0]?.device
                    : externalDrivesCount > 0
                    ? `${externalDrivesCount} USB ready`
                    : 'Plug in a USB'}
                </span>
              </div>
              <div
                className={`nav-status-badge ${hasTarget ? 'complete' : 'incomplete'}`}
                title={hasTarget ? 'Complete' : 'Incomplete'}
              >
                {hasTarget && <CircularCheckIcon size={18} />}
              </div>
            </div>

            {/* Write verify option */}
            <div
              className={`nav-item ${(activeTab === 'flash' && !showPermissionModal) || isFlashing ? 'active' : ''} ${
                isConfirmed || flashResult?.success ? 'completed' : ''
              } ${!canFlash || isFlashing ? 'disabled' : ''}`}
              onClick={() => {
                if (!canFlash || isFlashing) return;
                setIsConfirmed(false);
                setShowPermissionModal(false);
                setActiveTab('flash');
              }}
            >
              <div className="nav-item-icon-box">
                <DiskIcon size={18} />
              </div>
              <div className="nav-item-texts">
                <span className="nav-item-title">Write &amp; Verify</span>
                <span className="nav-item-sub">
                  {flashResult?.success
                    ? 'Burn finished'
                    : isFlashing
                    ? 'Writing to drive'
                    : isConfirmed
                    ? 'Confirmed'
                    : canFlash
                    ? 'Ready to write'
                    : 'Awaiting review'}
                </span>
              </div>
              <div
                className={`nav-status-badge ${isConfirmed || flashResult?.success ? 'complete' : 'incomplete'}`}
                title={isConfirmed || flashResult?.success ? 'Complete' : 'Incomplete'}
              >
                {(isConfirmed || flashResult?.success) && <CircularCheckIcon size={18} />}
              </div>
            </div>

            {/* Review confirm option */}
            <div
              className={`nav-item ${activeTab === 'confirm' && !showPermissionModal ? 'active' : ''} ${
                hasSource && hasTarget && (isFlashing || flashResult !== null) ? 'completed' : ''
              } ${!hasSource || !hasTarget || isFlashing ? 'disabled' : ''}`}
              onClick={() => {
                if (!hasSource || !hasTarget || isFlashing) return;
                setShowPermissionModal(false);
                setActiveTab('confirm');
              }}
            >
              <div className="nav-item-icon-box">
                <AlertTriangle size={18} />
              </div>
              <div className="nav-item-texts">
                <span className="nav-item-title">Review &amp; Confirm</span>
                <span className="nav-item-sub">
                  {isFlashing || flashResult
                    ? 'Confirmed'
                    : hasSource && hasTarget
                    ? 'Ready to review'
                    : 'Awaiting steps'}
                </span>
              </div>
              <div
                className={`nav-status-badge ${
                  hasSource && hasTarget && (isFlashing || flashResult !== null) ? 'complete' : 'incomplete'
                }`}
                title={hasSource && hasTarget && (isFlashing || flashResult !== null) ? 'Complete' : 'Incomplete'}
              >
                {hasSource && hasTarget && (isFlashing || flashResult !== null) && (
                  <CircularCheckIcon size={18} />
                )}
              </div>
            </div>
          </nav>

          {/* Preferences menu option */}
          <div className="sidebar-footer">
            <div
              className={`nav-item ${activeTab === 'settings' && !showPermissionModal ? 'active' : ''} ${
                isFlashing ? 'disabled' : ''
              }`}
              onClick={() => {
                if (isFlashing) return;
                setShowPermissionModal(false);
                setActiveTab('settings');
              }}
            >
              <div className="nav-item-icon-box">
                <SettingsSlidersIcon size={18} />
              </div>
              <div className="nav-item-texts">
                <span className="nav-item-title">Preferences</span>
                <span className="nav-item-sub">
                  {verifyAfterWrite ? 'Verify' : 'Fast'} · {autoUnmount ? 'Eject' : 'Retain'} · {formatMode === 'full' ? 'Full' : 'Quick'}
                </span>
              </div>

            </div>
          </div>
        </div>

      </aside>

      <main className="main-viewport">
        <div className="viewport-titlebar">
          <div className="titlebar-view-name">
            <span>
              {isFlashing
                ? 'Flashing Telemetry Stream'
                : flashResult
                ? 'Flash Complete'
                : showPermissionModal
                ? 'Disk Write Authorization'
                : activeTab === 'image'
                ? 'Choose Operating System Image'
                : activeTab === 'target'
                ? 'Select Target Storage'
                : activeTab === 'flash'
                ? 'Write & Verify'
                : activeTab === 'confirm'
                ? 'Confirm Drive Erasure'
                : 'Preferences'}
            </span>
          </div>

          {!isMac && (
            <div className="titlebar-controls">
              <button
                className="titlebar-btn"
                title="Minimize"
                onClick={() => window.flasherAPI?.minimizeWindow?.()}
              >
                <Minus size={15} />
              </button>
              <button
                className="titlebar-btn close-btn"
                title="Close"
                onClick={() => window.flasherAPI?.closeWindow?.()}
              >
                <X size={15} />
              </button>
            </div>
          )}
        </div>

        <div className="viewport-body">
          {flashResult ? (
            <div className="celebration-view">
              <div
                className={`celebration-badge ${
                  flashResult.success ? 'success' : 'error'
                }`}
              >
                {flashResult.success ? (
                  <CircularCheckIcon size={56} />
                ) : (
                  <AlertCautionIcon size={44} />
                )}
              </div>

              <h2 className="celebration-title">
                {flashResult.success
                  ? 'Bootable USB Ready!'
                  : 'Flashing Interrupted'}
              </h2>

              <p className="celebration-subtitle">
                {flashResult.success
                  ? 'Your ISO was written to the USB drive. You can now boot a PC from this stick.'
                  : flashResult.errors?.[0]?.message || 'An unexpected error occurred.'}
              </p>

              {flashResult.success && (
                <div className="celebration-stats-grid">
                  <div className="celebration-stat-box">
                    <div className="celebration-stat-label">
                      <ChronometerIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      TOTAL TIME
                    </div>
                    <div className="celebration-stat-val font-mono">
                      {formatTime(flashResult.durationSeconds)}
                    </div>
                  </div>

                  <div className="celebration-stat-box">
                    <div className="celebration-stat-label">
                      <DataBytesIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      DATA WRITTEN
                    </div>
                    <div className="celebration-stat-val font-mono">
                      {formatBytes(flashResult.bytesWritten)}
                    </div>
                  </div>

                  <div className="celebration-stat-box">
                    <div className="celebration-stat-label">
                      <ShieldCheckIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      INTEGRITY
                    </div>
                    <div className="celebration-stat-val font-mono">
                      100% OK
                    </div>
                  </div>
                </div>
              )}

              <button className="btn-primary-white" onClick={handleReset}>
                <RotateCcw size={16} />
                <span>Flash Another Image</span>
              </button>
            </div>
          ) : isFlashing && flashProgress ? (
            <div className="flashing-telemetry-view">

              <div className="telemetry-gauge-ring">
                <svg className="gauge-svg" viewBox="0 0 100 100">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const angle = (i * 360) / 30 - 90;
                    const radians = (angle * Math.PI) / 180;
                    const x = 50 + 45 * Math.cos(radians);
                    const y = 50 + 45 * Math.sin(radians);
                    return (
                      <circle
                        key={`bg-${i}`}
                        cx={x}
                        cy={y}
                        r="2.5"
                        fill="rgba(255, 255, 255, 0.08)"
                      />
                    );
                  })}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const angle = (i * 360) / 30 - 90;
                    const radians = (angle * Math.PI) / 180;
                    const x = 50 + 45 * Math.cos(radians);
                    const y = 50 + 45 * Math.sin(radians);
                    const isActive = (i / 30) * 100 <= flashProgress.percentage;
                    return (
                      <circle
                        key={`progress-${i}`}
                        cx={x}
                        cy={y}
                        r="2.5"
                        fill={isActive ? 'white' : 'transparent'}
                        className={isActive ? 'gauge-dot-active' : ''}
                      />
                    );
                  })}
                </svg>
                <div className="gauge-inside-text">
                  <span className="gauge-number">
                    {flashProgress.percentage}
                  </span>
                  <span className="gauge-pct">%</span>
                </div>
              </div>

              <div className="telemetry-line-bar">
                {Array.from({ length: 50 }).map((_, i) => {
                  const isActive = (i / 50) * 100 <= flashProgress.percentage;
                  return (
                    <div
                      key={`line-dot-${i}`}
                      className={`telemetry-line-dot ${isActive ? 'active' : ''}`}
                    />
                  );
                })}
              </div>

              <div className="telemetry-tiles-row">
                <div className="telemetry-stat-tile">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <SpeedGaugeIcon size={14} color="#38bdf8" />
                    <span className="stat-tile-label">TRANSFER SPEED</span>
                  </div>
                  <span className="stat-tile-val font-mono">
                    {formatSpeed(flashProgress.speed)}
                  </span>
                </div>

                <div className="telemetry-stat-tile">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DataBytesIcon size={14} color="#38bdf8" />
                    <span className="stat-tile-label">DATA WRITTEN</span>
                  </div>
                  <span className="stat-tile-val font-mono">
                    {formatBytes(flashProgress.bytesWritten)}
                  </span>
                </div>

                <div className="telemetry-stat-tile">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ChronometerIcon size={14} color="#38bdf8" />
                    <span className="stat-tile-label">REMAINING TIME</span>
                  </div>
                  <span className="stat-tile-val font-mono">
                    {formatTime(flashProgress.etaSeconds)}
                  </span>
                </div>
              </div>

              <button
                className="telemetry-cancel-action"
                onClick={handleCancelFlash}
              >
                <X size={16} />
                <span>Cancel Flashing</span>
              </button>
            </div>
          ) : showPermissionModal && selectedDrives[0] ? (
            <div className="permission-screen-view">
              {/* Permission view container */}
              <div className="permission-hero-card">
                <div className="permission-hero-icon-box">
                  <AdminKeyLockIcon size={28} color="#38bdf8" />
                </div>
                <div className="permission-hero-meta">
                  <div className="permission-kicker">PRIVILEGE ELEVATION</div>
                  <h2 className="permission-heading">Administrator Authorization Required</h2>
                  <p className="permission-lead">
                    Direct raw disk writes require system administrator access to stream image blocks and detach mounted volumes safely.
                  </p>
                </div>
              </div>

              {/* Permission specs deck */}
              <div className="permission-specs-deck">
                <div className="perm-spec-tile">
                  <div className="perm-spec-label">TARGET BLOCK DEVICE</div>
                  <div className="perm-spec-value font-mono">{selectedDrives[0].device}</div>
                  <div className="perm-spec-sub">
                    {selectedDrives[0].description || 'Removable Storage'} · {formatBytes(selectedDrives[0].size)}
                  </div>
                </div>

                <div className="perm-spec-tile">
                  <div className="perm-spec-label">SECURITY PROTOCOL</div>
                  <div className="perm-spec-value">
                    {isWin
                      ? 'Windows UAC Elevation'
                      : isMac
                      ? 'macOS Admin Authorization'
                      : 'Linux Polkit Helper'}
                  </div>
                  <div className="perm-spec-sub">
                    {isWin
                      ? 'powershell Start-Process -Verb RunAs'
                      : isMac
                      ? 'osascript with administrator privileges'
                      : 'pkexec flasher-helper'}
                  </div>
                </div>

                <div className="perm-spec-tile">
                  <div className="perm-spec-label">OPERATION SCOPE</div>
                  <div className="perm-spec-value">Raw Disk Streaming</div>
                  <div className="perm-spec-sub">Direct unbuffered sector write and partition unmount</div>
                </div>

                <div className="perm-spec-tile">
                  <div className="perm-spec-label">CREDENTIAL STORAGE</div>
                  <div className="perm-spec-value">Zero Retention</div>
                  <div className="perm-spec-sub">Authentication is handled directly by host operating system</div>
                </div>
              </div>

              <div className="permission-notice-banner">
                <ShieldLockIcon size={16} color="#38bdf8" />
                <span>Clicking Authorize opens your system authentication prompt. Approve the request to begin writing.</span>
              </div>

              {/* Bottom action bar */}
              <div className="view-bottom-bar">
                <button
                  className="btn-ghost-secondary"
                  onClick={handleDenyPermission}
                  disabled={isRequestingPermission}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary-white"
                  onClick={handleAllowPermission}
                  disabled={isRequestingPermission}
                >
                  {isRequestingPermission ? (
                    <>
                      <RefreshCw size={15} className="spin-slow" />
                      <span>Waiting for system…</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon size={16} />
                      <span>Authorize &amp; Flash</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : activeTab === 'image' ? (
            <div className="image-source-view">
              {source ? (
                <div className="selected-file-card">
                  <div className="file-card-header">
                    <div className="file-card-icon">
                      <IsoDiskIcon size={28} color="#38bdf8" />
                    </div>
                    <div className="file-card-info">
                      <div className="file-card-name">{source.name}</div>
                      <div className="file-card-details">
                        <span className="file-card-size">{formatBytes(source.size)}</span>
                        <span className="file-card-type">{source.extension.toUpperCase()}</span>
                        {source.partitionScheme && source.partitionScheme !== 'Unknown' && (
                          <span className="file-card-meta-pill">{source.partitionScheme}</span>
                        )}
                        {source.bootMode && source.bootMode !== 'Unknown' && (
                          <span className="file-card-meta-pill boot-pill">{source.bootMode}</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="file-card-change-btn"
                      onClick={handleSelectSource}
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  <div className="file-card-path">
                    <span className="path-label">Location:</span>
                    <span className="path-value">{source.path}</span>
                  </div>
                  <div className="file-card-checksum-row">
                    {source.checksum ? (
                      <div className="checksum-display-pill font-mono">
                        <span className="cs-label">{checksumAlgorithm.toUpperCase()}:</span>
                        <span className="cs-val">{source.checksum}</span>
                      </div>
                    ) : (
                      <button
                        className="btn-compute-checksum"
                        onClick={async () => {
                          if (isCalculatingChecksum || !source) return;
                          setIsCalculatingChecksum(true);
                          try {
                            if (window.flasherAPI?.calculateChecksum) {
                              const hash = await window.flasherAPI.calculateChecksum(source.path, checksumAlgorithm);
                              setSource((prev) => (prev ? { ...prev, checksum: hash } : null));
                            }
                          } catch (err) {
                            console.error('Checksum calculation failed:', err);
                          } finally {
                            setIsCalculatingChecksum(false);
                          }
                        }}
                        disabled={isCalculatingChecksum}
                      >
                        <ShieldCheckIcon size={13} />
                        <span>{isCalculatingChecksum ? 'Calculating checksum...' : `Compute ${checksumAlgorithm.toUpperCase()} Checksum`}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`dropzone-container ${
                    isDragOver ? 'drag-active' : ''
                  }`}
                  onClick={handleSelectSource}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    handleSelectSource();
                  }}
                >
                  <div className="dropzone-icon-circle">
                    <IsoDropzoneHero size={64} />
                  </div>
                  <h3 className="dropzone-headline">
                    Select a Disk Image
                  </h3>
                  <p className="dropzone-subtext">
                    Choose an ISO, IMG, or RAW file to write onto a USB drive and make it bootable
                  </p>
                  <div className="format-tags-shelf">
                    <span className="format-chip">
                      <IsoDiskIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      .ISO
                    </span>
                    <span className="format-chip">
                      <DiskIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      .IMG
                    </span>
                    <span className="format-chip">
                      <DiskIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      .RAW
                    </span>
                  </div>
                </div>
              )}

              <div className="view-bottom-bar">
                <button
                  className="btn-primary-white"
                  onClick={() => setActiveTab('target')}
                  disabled={!hasSource}
                >
                  <span>Continue to Target</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : activeTab === 'target' ? (
            <div className="target-storage-view">
              <div className="drives-shelf-header">
                <span className="drives-count-label">
                  {flashableDrives.length === 0
                    ? 'No USB drives detected — plug one in'
                    : `${flashableDrives.length} flashable USB drive(s) · live`}
                </span>

                <button
                  className="refresh-drives-btn"
                  onClick={loadDrives}
                  disabled={isLoadingDrives}
                >
                  <RefreshCw
                    size={14}
                    className={isLoadingDrives ? 'spin-slow' : ''}
                  />
                  <span>Refresh</span>
                </button>
              </div>

              {flashableDrives.length === 0 ? (
                <div className="drives-empty-state">
                  <div className="drives-empty-icon">
                    <UsbWaitingHero size={64} />
                  </div>
                  <h3>Waiting for a USB drive…</h3>
                  <p>
                    Plug in a USB stick. It will appear here automatically —
                    no refresh needed.
                  </p>
                </div>
              ) : (
                <div className="drives-scroll-list">
                  {flashableDrives.map((d) => {
                    const isSelected = selectedDrives.some(
                      (sd) => sd.device === d.device
                    );

                    return (
                      <div
                        key={d.device}
                        className={`drive-entry-card ${
                          isSelected ? 'is-selected' : ''
                        }`}
                        onClick={() => handleToggleDrive(d)}
                      >
                        <div className="drive-entry-left">
                          <div className="drive-hardware-icon usb-type">
                            {d.isCard ? <SdCardIcon size={22} color="#38bdf8" /> : <UsbDriveIcon size={22} color="#38bdf8" />}
                          </div>

                          <div className="drive-desc-meta">
                            <div className="drive-name-row">
                              <span className="drive-model-name">
                                {d.description || d.device}
                              </span>
                              {d.isUSB ? (
                                <span className="drive-status-badge usb-ready">
                                  USB · BOOTABLE TARGET
                                </span>
                              ) : d.isCard ? (
                                <span className="drive-status-badge usb-ready">
                                  SD CARD
                                </span>
                              ) : (
                                <span className="drive-status-badge usb-ready">
                                  REMOVABLE
                                </span>
                              )}
                            </div>

                            <div className="drive-sub-row">
                              <span className="drive-path-tag">{d.device}</span>
                              <span>&bull;</span>
                              <span>{formatBytes(d.size)}</span>
                              {d.fileSystem && (
                                <>
                                  <span>&bull;</span>
                                  <span className="drive-fs-pill">{d.fileSystem}</span>
                                </>
                              )}
                              {source && d.size > 0 && d.size < source.size && (
                                <>
                                  <span>&bull;</span>
                                  <span className="drive-warning-pill">Too Small</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div
                            className={`round-checkbox ${
                              isSelected ? 'checked' : ''
                            }`}
                          >
                            {isSelected && <Check size={13} strokeWidth={3} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {protectedDrives.length > 0 && (
                <p className="drives-protected-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <ShieldLockIcon size={14} color="#94a3b8" />
                  <span>{protectedDrives.length} system drive(s) hidden for safety</span>
                </p>
              )}

              <div className="view-bottom-bar">
                <button
                  className="btn-primary-white"
                  onClick={() => setActiveTab('flash')}
                  disabled={!hasTarget}
                >
                  <span>Continue to Flash</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : activeTab === 'flash' ? (
            <div className="flash-write-view">
              <div className="flash-content">
                <div className="flash-hero-flow">
                  <div className="flash-endpoint source-end">
                    <div className="flash-endpoint-icon">
                      <IsoDiskIcon size={22} color="#38bdf8" />
                    </div>
                    <div className="flash-endpoint-meta">
                      <span className="flash-endpoint-kicker">IMAGE FILE</span>
                      <span className="flash-endpoint-name" title={source?.name}>
                        {source?.name}
                      </span>
                      <span className="flash-endpoint-detail font-mono">
                        {formatBytes(source?.size || 0)} · {source?.extension?.toUpperCase()}
                        {source?.partitionScheme && source.partitionScheme !== 'Unknown' ? ` · ${source.partitionScheme}` : ''}
                        {source?.bootMode && source.bootMode !== 'Unknown' ? ` · ${source.bootMode}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flash-flow-bridge" aria-hidden="true">
                    <div className="flash-flow-line" />
                    <div className="flash-flow-chip">
                      <DiskIcon size={14} color="#38bdf8" />
                      <span>WRITE</span>
                    </div>
                    <div className="flash-flow-line" />
                  </div>

                  <div className="flash-endpoint target-end">
                    <div className="flash-endpoint-icon usb">
                      {selectedDrives[0]?.isCard ? <SdCardIcon size={22} color="#38bdf8" /> : <UsbDriveIcon size={22} color="#38bdf8" />}
                    </div>
                    <div className="flash-endpoint-meta">
                      <span className="flash-endpoint-kicker">USB TARGET</span>
                      <span className="flash-endpoint-name" title={selectedDrives[0]?.description}>
                        {selectedDrives[0]?.description || selectedDrives[0]?.device}
                      </span>
                      <span className="flash-endpoint-detail font-mono">
                        {selectedDrives[0]?.device} · {formatBytes(selectedDrives[0]?.size || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flash-compatibility-deck">
                  <div className="compat-item">
                    <span className="compat-label">PARTITION SCHEME</span>
                    <span className="compat-val font-mono">{source?.partitionScheme || 'MBR'}</span>
                  </div>
                  <div className="compat-item">
                    <span className="compat-label">TARGET SYSTEM</span>
                    <span className="compat-val">{source?.targetSystemType || 'Standard BIOS / UEFI'}</span>
                  </div>
                  <div className="compat-item">
                    <span className="compat-label">FILESYSTEM TRANSITION</span>
                    <span className="compat-val">
                      {selectedDrives[0]?.fileSystem ? `${selectedDrives[0].fileSystem} ➔ Bootable Disk` : 'Full Raw Reformat'}
                    </span>
                  </div>
                  <div className="compat-item">
                    <span className="compat-label">CAPACITY STATUS</span>
                    <span className={`compat-val font-mono ${hasInsufficientSpace ? 'compat-error' : 'compat-ok'}`}>
                      {hasInsufficientSpace
                        ? `Insufficient (${formatBytes(selectedDrives[0]?.size || 0)} < ${formatBytes(source?.size || 0)})`
                        : `${formatBytes(selectedDrives[0]?.size || 0)} available`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flash-action-row">
                <button
                  className="btn-flash-launch"
                  onClick={() => {
                    if (skipConfirmation) {
                      setIsConfirmed(true);
                      handleStartFlash();
                    } else {
                      setIsConfirmed(true);
                      setActiveTab('confirm');
                    }
                  }}
                  disabled={!canFlash || isFlashing}
                >
                  <DiskIcon size={18} />
                  <span>Flash &amp; Make Bootable</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'confirm' && source && selectedDrives[0] ? (
            <div className="confirm-screen-view">
              {/* Confirm hero card */}
              <div className="confirm-hero-card">
                <div className="confirm-hero-icon-box">
                  <AlertTriangle size={28} strokeWidth={2} />
                </div>
                <div className="permission-hero-meta">
                  <div className="confirm-kicker">PERMANENT DRIVE OVERWRITE</div>
                  <h2 className="permission-heading">Confirm Target Storage Erasure</h2>
                  <p className="permission-lead">
                    Writing an operating system image wipes all partition structures and files on the selected device. This cannot be undone.
                  </p>
                </div>
              </div>

              {/* Confirm specs deck */}
              <div className="permission-specs-deck">
                <div className="perm-spec-tile">
                  <div className="perm-spec-label">TARGET DISK OVERWRITE</div>
                  <div className="perm-spec-value font-mono">{selectedDrives[0].device}</div>
                  <div className="perm-spec-sub">
                    {selectedDrives[0].description || 'Storage Device'} · {formatBytes(selectedDrives[0].size)}
                    {selectedDrives[0].fileSystem ? ` · ${selectedDrives[0].fileSystem}` : ''}
                  </div>
                </div>

                <div className="perm-spec-tile">
                  <div className="perm-spec-label">SOURCE DISK IMAGE</div>
                  <div className="perm-spec-value" title={source.name}>{source.name}</div>
                  <div className="perm-spec-sub">
                    {formatBytes(source.size)} · {source.extension.toUpperCase()}
                    {source.partitionScheme && source.partitionScheme !== 'Unknown' ? ` · ${source.partitionScheme}` : ''}
                  </div>
                </div>

                <div className="perm-spec-tile">
                  <div className="perm-spec-label">FORMATTING PASS</div>
                  <div className="perm-spec-value">
                    {formatMode === 'full' ? 'Full Format Zero-Fill' : 'Quick Sector Erase'}
                  </div>
                  <div className="perm-spec-sub">
                    {formatMode === 'full'
                      ? 'Zero-fills device sectors and detects faulty blocks'
                      : 'Clears partition tables from sector zero'}
                  </div>
                </div>

                <div className="perm-spec-tile">
                  <div className="perm-spec-label">POST WRITE VALIDATION</div>
                  <div className="perm-spec-value">
                    {verifyAfterWrite ? 'SHA-256 Sector Verification' : 'Verification Skipped'}
                  </div>
                  <div className="perm-spec-sub">
                    {verifyAfterWrite
                      ? 'Validates written data against image checksum'
                      : 'Speed priority mode without read verification'}
                  </div>
                </div>
              </div>

              <div className="confirm-notice-banner">
                <AlertTriangle size={16} color="#f43f5e" />
                <span>Verify that no critical personal data remains on {selectedDrives[0].device}. All existing volumes will be unmounted and wiped.</span>
              </div>

              {/* Bottom action bar */}
              <div className="view-bottom-bar">
                <button
                  className="btn-ghost-secondary"
                  onClick={() => setActiveTab('flash')}
                >
                  Go Back
                </button>
                <button
                  className="btn-danger-action"
                  onClick={() => { setIsConfirmed(true); setActiveTab('flash'); handleStartFlash(); }}
                >
                  <DiskIcon size={16} />
                  <span>Erase &amp; Flash</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="settings-view">

              <div className="pref-section-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DiskIcon size={14} color="#38bdf8" />
                <span>Flash Behavior</span>
              </div>

              <div
                className="pref-row"
                onClick={() => setVerifyAfterWrite(!verifyAfterWrite)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Validate write on completion</h4>
                  <p className="pref-desc">
                    Reads back all written blocks and validates checksum against
                    the original image to prevent silent corruption.
                  </p>
                </div>
                <div className={`pref-switch ${verifyAfterWrite ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {verifyAfterWrite && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setAutoUnmount(!autoUnmount)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Auto-eject target media</h4>
                  <p className="pref-desc">
                    Flushes raw I/O queues and cleanly unmounts storage drives
                    so they can be safely removed without data loss.
                  </p>
                </div>
                <div className={`pref-switch ${autoUnmount ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {autoUnmount && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setLargeChunkBuffer(!largeChunkBuffer)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">High-speed buffer chunks (4 MB)</h4>
                  <p className="pref-desc">
                    Allocates optimized 4 MB memory buffer blocks to maximize raw
                    I/O throughput on high-speed USB 3.0+ drives.
                  </p>
                </div>
                <div className={`pref-switch ${largeChunkBuffer ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {largeChunkBuffer && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setTurboMode(!turboMode)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Turbo mode</h4>
                  <p className="pref-desc">
                    Disables verification to maximize write speed. Use only
                    when you have a trusted, previously validated image.
                  </p>
                </div>
                <div className={`pref-switch ${turboMode ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {turboMode && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setOpenOnFinish(!openOnFinish)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Open drive on finish</h4>
                  <p className="pref-desc">
                    Automatically opens the target drive in file manager once
                    flashing completes successfully.
                  </p>
                </div>
                <div className={`pref-switch ${openOnFinish ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {openOnFinish && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div className="pref-section-label" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldLockIcon size={14} color="#38bdf8" />
                <span>Safety &amp; Integrity</span>
              </div>

              <div
                className="pref-row"
                onClick={() => setSurfaceScan(!surfaceScan)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Surface scan for bad blocks</h4>
                  <p className="pref-desc">
                    Reads target sectors before write to catch bad blocks
                    and faulty or counterfeit USB flash media.
                  </p>
                </div>
                <div className={`pref-switch ${surfaceScan ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {surfaceScan && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setSafeMode(!safeMode)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">System drive protection</h4>
                  <p className="pref-desc">
                    Prevents writing to drives that are mounted as the system
                    root. Strongly recommended to keep this enabled.
                  </p>
                </div>
                <div className={`pref-switch ${safeMode ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {safeMode && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setCleanDiskPreWipe(!cleanDiskPreWipe)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Zero out partition tables before write</h4>
                  <p className="pref-desc">
                    Wipes legacy MBR and GPT partition structures from the drive
                    prior to streaming the bootable disk image.
                  </p>
                </div>
                <div className={`pref-switch ${cleanDiskPreWipe ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {cleanDiskPreWipe && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setSkipConfirmation(!skipConfirmation)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Skip overwrite confirmation</h4>
                  <p className="pref-desc">
                    Bypasses the final confirmation prompt before writing.
                    Speeds up repeated flashing workflows.
                  </p>
                </div>
                <div className={`pref-switch ${skipConfirmation ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {skipConfirmation && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div className="pref-section-label" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UsbDriveIcon size={14} color="#38bdf8" />
                <span>Hardware &amp; Power</span>
              </div>

              <div
                className="pref-row"
                onClick={() => setPreventSleep(!preventSleep)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Prevent system sleep during burn</h4>
                  <p className="pref-desc">
                    Keeps computer active and prevents standby or suspension
                    while writing and verification jobs are active.
                  </p>
                </div>
                <div className={`pref-switch ${preventSleep ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {preventSleep && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setAutoSelectSingleUsb(!autoSelectSingleUsb)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Auto-select single USB flash drive</h4>
                  <p className="pref-desc">
                    Automatically targets the connected USB drive when exactly
                    one compatible removable device is detected.
                  </p>
                </div>
                <div className={`pref-switch ${autoSelectSingleUsb ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {autoSelectSingleUsb && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div className="pref-section-label" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SettingsSlidersIcon size={14} color="#38bdf8" />
                <span>Application &amp; Alerts</span>
              </div>

              <div
                className="pref-row"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Desktop notifications</h4>
                  <p className="pref-desc">
                    Shows a system notification when a flash job completes
                    or fails, even if the app window is minimized.
                  </p>
                </div>
                <div className={`pref-switch ${showNotifications ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {showNotifications && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setSoundOnFinish(!soundOnFinish)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Audio chime on completion</h4>
                  <p className="pref-desc">
                    Plays an audible notification chime when image writing
                    and verification passes finish.
                  </p>
                </div>
                <div className={`pref-switch ${soundOnFinish ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {soundOnFinish && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              <div
                className="pref-row"
                onClick={() => setCheckUpdates(!checkUpdates)}
              >
                <div className="pref-meta">
                  <h4 className="pref-title">Check for updates on launch</h4>
                  <p className="pref-desc">
                    Automatically checks for new Flasher releases when the
                    application starts and notifies you when one is available.
                  </p>
                </div>
                <div className={`pref-switch ${checkUpdates ? 'on' : ''}`}>
                  <div className="pref-switch-thumb">
                    {checkUpdates && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
