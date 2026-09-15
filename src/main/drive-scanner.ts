import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { DriveInfo } from '../shared/types';

const execAsync = promisify(exec);

// Query system drivelist
async function scanDrivesViaDrivelist(): Promise<DriveInfo[] | null> {
  try {
    const drivelist = await import('drivelist');
    const rawDrives = await drivelist.list();
    return rawDrives.map((d) => {
      let isSystem = Boolean(d.isSystem);
      const isRemovable = Boolean(d.isRemovable || d.isUSB || d.isCard);
      const isUSB = Boolean(d.isUSB);
      const isCard = Boolean(d.isCard);
      const isReadOnly = Boolean(d.isReadOnly);

      // Additional platform safety checks
      const mountPaths = (d.mountpoints || []).map((m) => m.path || '');
      if (process.platform === 'darwin') {
        if (mountPaths.some((p) => p === '/' || p.startsWith('/System') || p.includes('/System/Volumes/Data'))) {
          isSystem = true;
        }
      } else if (process.platform === 'win32') {
        if (
          d.device.includes('PhysicalDrive0') ||
          mountPaths.some((p) => p.toUpperCase().startsWith('C:'))
        ) {
          isSystem = true;
        }
      }

      let warning: string | undefined;
      if (isSystem) {
        warning = 'System Drive (Protected)';
      } else if (isReadOnly) {
        warning = 'Read-only device';
      }

      const desc = d.description || (isUSB ? 'USB Drive' : isCard ? 'SD Card' : 'External Disk');
      const sizeStr = d.size ? `(${(d.size / 1024 / 1024 / 1024).toFixed(1)} GB)` : '';
      const displayName = `${desc} - ${d.device} ${sizeStr}`.trim();

      // Extract filesystem format
      let fileSystem: string | undefined;
      const rawFs = (d as any).filesystem || (d as any).fileSystem;
      if (rawFs) {
        const lower = String(rawFs).toLowerCase();
        if (lower.includes('fat')) fileSystem = 'FAT32';
        else if (lower.includes('ntfs')) fileSystem = 'NTFS';
        else if (lower.includes('exfat')) fileSystem = 'exFAT';
        else fileSystem = String(rawFs).toUpperCase();
      }

      return {
        device: d.device,
        displayName,
        description: d.description || 'Unknown Device',
        size: d.size || 0,
        mountpoints: (d.mountpoints || []).map((m) => ({
          path: m.path,
          label: (m as any).label
        })),
        fileSystem,
        isSystem,
        isRemovable,
        isUSB,
        isCard,
        isReadOnly,
        disabled: isSystem || isReadOnly,
        warning
      };
    });
  } catch {
    return null;
  }
}

// Query Linux lsblk
async function scanDrivesViaLsblk(): Promise<DriveInfo[]> {
  try {
    const { stdout } = await execAsync(
      'lsblk --json -b -o NAME,PATH,RM,RO,SIZE,TYPE,MOUNTPOINTS,MODEL,HOTPLUG,TRAN,FSTYPE,LABEL'
    );
    const data = JSON.parse(stdout);
    const devices = data.blockdevices || [];
    const results: DriveInfo[] = [];

    for (const dev of devices) {
      if (dev.type !== 'disk' || dev.name?.startsWith('zram') || dev.name?.startsWith('loop')) {
        continue;
      }

      const allMounts: string[] = [];
      const allFs: string[] = [];
      if (dev.fstype) allFs.push(dev.fstype);

      if (Array.isArray(dev.mountpoints)) {
        allMounts.push(...dev.mountpoints.filter(Boolean));
      }
      if (Array.isArray(dev.children)) {
        for (const child of dev.children) {
          if (child.fstype) allFs.push(child.fstype);
          if (Array.isArray(child.mountpoints)) {
            allMounts.push(...child.mountpoints.filter(Boolean));
          }
        }
      }

      // Parse filesystem type
      let fileSystem: string | undefined;
      if (allFs.length > 0) {
        const primary = allFs[0].toLowerCase();
        if (primary === 'vfat' || primary === 'fat' || primary === 'msdos') {
          fileSystem = 'FAT32';
        } else if (primary === 'ntfs') {
          fileSystem = 'NTFS';
        } else if (primary === 'exfat') {
          fileSystem = 'exFAT';
        } else if (primary.startsWith('ext')) {
          fileSystem = primary.toUpperCase();
        } else {
          fileSystem = primary.toUpperCase();
        }
      }

      const isSystem = allMounts.some(
        (m) => m === '/' || m === '/boot' || m === '/boot/efi' || m === '/etc' || m === '[SWAP]'
      );
      const isUSB = dev.tran === 'usb' || Boolean(dev.hotplug);
      const isRemovable = Boolean(dev.rm || isUSB);
      const isReadOnly = Boolean(dev.ro);

      let warning: string | undefined;
      if (isSystem) {
        warning = 'System Drive (Protected)';
      } else if (isReadOnly) {
        warning = 'Read-only device';
      }

      const model = dev.model
        ? String(dev.model).trim()
        : isUSB
          ? 'USB Drive'
          : isRemovable
            ? 'Removable Disk'
            : 'Drive';
      const sizeStr = dev.size ? `(${(dev.size / 1024 / 1024 / 1024).toFixed(1)} GB)` : '';
      const displayName = `${model} - ${dev.path} ${sizeStr}`.trim();

      results.push({
        device: dev.path,
        displayName,
        description: model,
        size: Number(dev.size) || 0,
        mountpoints: allMounts.map((p) => ({ path: p })),
        fileSystem,
        isSystem,
        isRemovable,
        isUSB,
        isCard: false,
        isReadOnly,
        disabled: isSystem || isReadOnly,
        warning
      });
    }

    return results;
  } catch (err) {
    console.error('Error scanning with lsblk:', err);
    return [];
  }
}

// Fallback for macOS: diskutil
async function scanDrivesViaDiskutil(): Promise<DriveInfo[]> {
  try {
    const { stdout } = await execAsync('diskutil list');
    const sections = stdout.split(/\n(?=\/dev\/disk\d+)/g);
    const results: DriveInfo[] = [];

    for (const sec of sections) {
      const headerMatch = sec.match(/^(\/dev\/disk\d+)\s+\(([^)]+)\)/);
      if (!headerMatch) continue;

      const device = headerMatch[1];
      const flags = headerMatch[2].toLowerCase();
      const isExternal = flags.includes('external');
      const isInternal = flags.includes('internal');

      let size = 0;
      const sizeMatch = sec.match(/\*?(\d+(?:\.\d+)?)\s+(B|KB|MB|GB|TB)/i);
      if (sizeMatch) {
        const val = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();
        const mult =
          unit === 'TB'
            ? 1024 * 1024 * 1024 * 1024
            : unit === 'GB'
              ? 1024 * 1024 * 1024
              : unit === 'MB'
                ? 1024 * 1024
                : unit === 'KB'
                  ? 1024
                  : 1;
        size = Math.round(val * mult);
      }

      const isSystem = isInternal || !isExternal;
      const isUSB = isExternal;
      const isRemovable = isExternal;
      const isReadOnly = false;

      const desc = isUSB ? 'USB Drive' : 'Disk';
      const sizeStr = size ? `(${(size / 1024 / 1024 / 1024).toFixed(1)} GB)` : '';
      const displayName = `${desc} - ${device} ${sizeStr}`.trim();

      results.push({
        device,
        displayName,
        description: desc,
        size,
        mountpoints: [],
        isSystem,
        isRemovable,
        isUSB,
        isCard: false,
        isReadOnly,
        disabled: isSystem || isReadOnly,
        warning: isSystem ? 'System Drive (Protected)' : undefined
      });
    }

    return results;
  } catch (err) {
    console.error('Error scanning with diskutil:', err);
    return [];
  }
}

// Fallback for Windows: PowerShell Get-Disk
async function scanDrivesViaPowerShell(): Promise<DriveInfo[]> {
  try {
    const psCmd =
      'Get-Disk | Select-Object Number, FriendlyName, Size, BusType, IsSystem, IsBoot, IsReadOnly | ConvertTo-Json -Compress';
    const { stdout } = await execAsync(`powershell.exe -NoProfile -NonInteractive -Command "${psCmd}"`);
    if (!stdout.trim()) return [];

    let parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) {
      parsed = [parsed];
    }

    return parsed.map((d: any) => {
      const diskNum = d.Number;
      const device = `\\\\.\\PhysicalDrive${diskNum}`;
      const isSystem = Boolean(d.IsSystem || d.IsBoot || diskNum === 0);
      const isUSB = String(d.BusType).toLowerCase() === 'usb';
      const isRemovable = isUSB || String(d.BusType).toLowerCase() === 'sd';
      const isReadOnly = Boolean(d.IsReadOnly);

      const desc = d.FriendlyName || (isUSB ? 'USB Drive' : 'Disk');
      const size = Number(d.Size) || 0;
      const sizeStr = size ? `(${(size / 1024 / 1024 / 1024).toFixed(1)} GB)` : '';
      const displayName = `${desc} - ${device} ${sizeStr}`.trim();

      return {
        device,
        displayName,
        description: desc,
        size,
        mountpoints: [],
        isSystem,
        isRemovable,
        isUSB,
        isCard: String(d.BusType).toLowerCase() === 'sd',
        isReadOnly,
        disabled: isSystem || isReadOnly,
        warning: isSystem ? 'System Drive (Protected)' : undefined
      };
    });
  } catch (err) {
    console.error('Error scanning with PowerShell:', err);
    return [];
  }
}

// Validate flashable drive
export function isFlashableDrive(drive: DriveInfo): boolean {
  if (drive.isSystem || drive.isReadOnly || drive.disabled) return false;
  return drive.isUSB || drive.isCard || drive.isRemovable;
}

// Scan all drives across platforms
export async function scanDrives(): Promise<DriveInfo[]> {
  const drivelistResults = await scanDrivesViaDrivelist();
  if (drivelistResults && drivelistResults.length > 0) {
    return drivelistResults;
  }

  if (process.platform === 'linux') {
    return await scanDrivesViaLsblk();
  }

  if (process.platform === 'darwin') {
    return await scanDrivesViaDiskutil();
  }

  if (process.platform === 'win32') {
    return await scanDrivesViaPowerShell();
  }

  return [];
}

export async function scanFlashableDrives(): Promise<DriveInfo[]> {
  const all = await scanDrives();
  return all.filter(isFlashableDrive);
}

function drivesFingerprint(drives: DriveInfo[]): string {
  return drives
    .map((d) => `${d.device}|${d.size}|${d.isSystem}|${d.mountpoints.map((m) => m.path).join(',')}`)
    .sort()
    .join(';');
}

// Monitor drive changes
export class DriveWatcher extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private udev: ChildProcess | null = null;
  private lastFingerprint = '';
  private scanning = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private running = false;

  start(pollMs = 2000): void {
    if (this.running) return;
    this.running = true;

    void this.refresh(true);
    this.timer = setInterval(() => void this.refresh(false), pollMs);

    if (process.platform === 'linux') {
      this.startUdevMonitor();
    }
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.udev) {
      try {
        this.udev.kill('SIGTERM');
      } catch {}
      this.udev = null;
    }
  }

  // Listen to udev
  private startUdevMonitor(): void {
    try {
      this.udev = spawn(
        'udevadm',
        ['monitor', '--udev', '--subsystem-match=block'],
        { stdio: ['ignore', 'pipe', 'ignore'] }
      );

      this.udev.stdout?.on('data', () => {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => void this.refresh(true), 400);
      });

      this.udev.on('error', () => {
        this.udev = null;
      });

      this.udev.on('close', () => {
        this.udev = null;
        if (this.running) {
          setTimeout(() => {
            if (this.running && !this.udev) this.startUdevMonitor();
          }, 5000);
        }
      });
    } catch {
      this.udev = null;
    }
  }

  async refresh(force = false): Promise<DriveInfo[]> {
    if (this.scanning) return [];
    this.scanning = true;

    try {
      const drives = await scanDrives();
      const fingerprint = drivesFingerprint(drives);

      if (force || fingerprint !== this.lastFingerprint) {
        this.lastFingerprint = fingerprint;
        this.emit('change', drives);
      }

      return drives;
    } catch (err) {
      console.error('Drive refresh failed:', err);
      return [];
    } finally {
      this.scanning = false;
    }
  }
}
