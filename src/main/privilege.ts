import * as fs from 'fs';
import { execFileSync, spawn } from 'child_process';
import { DriveInfo } from '../shared/types';

// Convert macOS block device to raw character device for faster I/O
export function getRawDevicePath(device: string): string {
  if (process.platform === 'darwin') {
    if (device.startsWith('/dev/disk')) {
      return device.replace('/dev/disk', '/dev/rdisk');
    }
  }
  return device;
}

// Test device writeability
export function canWriteDevice(device: string): boolean {
  try {
    const target = getRawDevicePath(device);
    const fd = fs.openSync(target, fs.constants.O_WRONLY);
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

// Check elevation requirement
export function needsElevation(targets: DriveInfo[]): boolean {
  return targets.some((t) => !t.isSystem && !canWriteDevice(t.device));
}

// Find system node or electron binary capable of running scripts
export function resolveNodeBinary(): string {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  const candidates = [
    process.env.npm_node_execpath,
    process.env.NODE_BINARY,
    isMac ? '/opt/homebrew/bin/node' : null,
    isMac || process.platform === 'linux' ? '/usr/local/bin/node' : null,
    process.platform === 'linux' ? '/usr/bin/node' : null
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }

  try {
    const whichCmd = isWindows ? 'where' : 'which';
    const which = execFileSync(whichCmd, ['node'], { encoding: 'utf8' }).trim();
    const firstLine = which.split('\n')[0].trim();
    if (firstLine && fs.existsSync(firstLine)) return firstLine;
  } catch {}

  // Fallback to current Electron binary with ELECTRON_RUN_AS_NODE=1
  return process.execPath;
}

// Force unmount disk
export function unmountDisk(device: string, mountpoints: Array<{ path: string }> = []): void {
  const platform = process.platform;

  if (platform === 'darwin') {
    // macOS: diskutil unmountDisk force /dev/diskN
    const diskDev = device.replace('/dev/rdisk', '/dev/disk');
    try {
      execFileSync('diskutil', ['unmountDisk', 'force', diskDev], { stdio: 'ignore' });
    } catch {
      try {
        execFileSync('diskutil', ['unmountDisk', diskDev], { stdio: 'ignore' });
      } catch {}
    }
    return;
  }

  if (platform === 'win32') {
    // Windows: Extract disk number (e.g., \\.\PhysicalDrive1 -> 1) and dismount mountpoints
    for (const mp of mountpoints) {
      if (mp?.path) {
        const driveLetter = mp.path.replace(/[\\/].*$/, '').replace(/:?$/, '');
        if (driveLetter && driveLetter.length === 1) {
          try {
            execFileSync('mountvol', [`${driveLetter}:`, '/p'], { stdio: 'ignore' });
          } catch {}
        }
      }
    }

    const match = device.match(/PhysicalDrive(\d+)/i);
    if (match) {
      const diskNum = match[1];
      const psScript = `Get-Partition -DiskNumber ${diskNum} -ErrorAction SilentlyContinue | ForEach-Object { if ($_.DriveLetter) { mountvol "$($_.DriveLetter):" /p } }`;
      try {
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
          stdio: 'ignore'
        });
      } catch {}
    }
    return;
  }

  // Linux: lsblk and umount
  const paths = new Set<string>();
  for (const mp of mountpoints) {
    if (mp?.path) paths.add(mp.path);
  }

  try {
    const out = execFileSync('lsblk', ['-ln', '-o', 'MOUNTPOINT', device], {
      encoding: 'utf8'
    });
    for (const line of out.split('\n')) {
      const mp = line.trim();
      if (mp && mp !== '') paths.add(mp);
    }
  } catch {}

  for (const mp of paths) {
    try {
      execFileSync('umount', ['-l', mp], { stdio: 'ignore' });
    } catch {
      try {
        execFileSync('umount', [mp], { stdio: 'ignore' });
      } catch {}
    }
  }
}

// Attempt user unmount
export function tryUnmountAsUser(targets: DriveInfo[]): void {
  const platform = process.platform;

  for (const target of targets) {
    if (platform === 'darwin') {
      const diskDev = target.device.replace('/dev/rdisk', '/dev/disk');
      try {
        execFileSync('diskutil', ['unmountDisk', diskDev], { stdio: 'ignore' });
      } catch {}
      continue;
    }

    if (platform === 'win32') {
      unmountDisk(target.device, target.mountpoints || []);
      continue;
    }

    // Linux
    for (const mp of target.mountpoints || []) {
      if (!mp.path) continue;
      try {
        spawn('udisksctl', ['unmount', '-b', target.device], { stdio: 'ignore' });
      } catch {}
      try {
        execFileSync('umount', [mp.path], { stdio: 'ignore' });
      } catch {}
    }
  }
}

