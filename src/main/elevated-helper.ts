import * as fs from 'fs';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import { FlashOptions, FlashProgress, FlashResult } from '../shared/types';
import { FULL_FORMAT_CHUNK } from '../shared/constants';
import { selectChunkSize, alignToSector } from '../shared/write-utils';

// Job chunk size
let JOB_CHUNK_SIZE = 1024 * 1024 * 2;

let progressLogPath: string | null = null;

// Emit progress event
function emit(payload: FlashProgress | { type: 'result'; result: FlashResult }) {
  const line = JSON.stringify(payload);
  process.stdout.write(line + '\n');

  // Poll progress log
  if (progressLogPath) {
    try {
      fs.writeFileSync(progressLogPath, line + '\n', { flag: 'w' });
    } catch {}
  }
}

// Emit progress helper
function emitProgress(
  phase: FlashProgress['phase'],
  percentage: number,
  bytesWritten: number,
  totalBytes: number,
  speed: number,
  etaSeconds: number,
  extra?: Partial<Pick<FlashProgress, 'formatProgress' | 'badBlocksFound' | 'error'>>
) {
  emit({
    phase,
    percentage,
    bytesWritten,
    totalBytes,
    speed,
    etaSeconds,
    ...extra
  });
}

// Resolve device path
function resolveTargetDevicePath(device: string): string {
  if (process.platform === 'darwin' && device.startsWith('/dev/disk')) {
    return device.replace('/dev/disk', '/dev/rdisk');
  }
  return device;
}

// Open target device
function openDeviceForWrite(devicePath: string): number {
  const O_WRONLY = fs.constants.O_WRONLY;
  const O_SYNC = fs.constants.O_SYNC ?? 1052672;
  return fs.openSync(devicePath, O_WRONLY | O_SYNC);
}

// Unmount target device
function unmountDisk(device: string, mountpoints: Array<{ path: string }> = []): void {
  const platform = process.platform;

  if (platform === 'darwin') {
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
    for (const mp of mountpoints) {
      if (mp?.path) {
        const driveLetter = mp.path.replace(/[\\\/].*$/, '').replace(/:?$/, '');
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

  // Linux unmount sequence
  const paths = new Set<string>();
  for (const mp of mountpoints) {
    if (mp?.path) paths.add(mp.path);
  }
  try {
    const out = execFileSync('lsblk', ['-ln', '-o', 'MOUNTPOINT', device], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    for (const line of out.split('\n')) {
      const mp = line.trim();
      if (mp) paths.add(mp);
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

// Scan device surface
function scanSurface(device: string, bytesToScan: number): number {
  const targetDevice = resolveTargetDevicePath(device);
  const fd = fs.openSync(targetDevice, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  let offset = 0;
  let badBlocks = 0;
  const scanLimit = Math.min(bytesToScan, 64 * 1024 * 1024);

  try {
    while (offset < scanLimit) {
      const toRead = Math.min(buffer.length, scanLimit - offset);
      try {
        const bytesRead = fs.readSync(fd, buffer, 0, toRead, offset);
        if (bytesRead === 0) break;
        offset += bytesRead;
      } catch {
        badBlocks++;
        offset += 512;
      }
    }
    return badBlocks;
  } finally {
    try { fs.closeSync(fd); } catch {}
  }
}

// Full device format
function fullFormat(
  device: string,
  driveBytes: number,
  onProgress: (done: number, total: number, bad: number) => void
): number {
  const targetDevice = resolveTargetDevicePath(device);
  const fd = openDeviceForWrite(targetDevice);
  const zeroBuf = Buffer.alloc(FULL_FORMAT_CHUNK, 0);
  let offset = 0;
  let badBlocks = 0;

  try {
    while (offset < driveBytes) {
      const toWrite = Math.min(FULL_FORMAT_CHUNK, driveBytes - offset);
      const chunk = toWrite < FULL_FORMAT_CHUNK ? zeroBuf.subarray(0, toWrite) : zeroBuf;
      const buf = alignToSector(chunk);
      try {
        let written = 0;
        while (written < buf.length) {
          written += fs.writeSync(fd, buf, written, buf.length - written);
        }
      } catch {
        // Handle write error
        badBlocks++;
        offset += 512;
        continue;
      }
      offset += toWrite;
      onProgress(offset, driveBytes, badBlocks);
    }
    // Flush to device
    try { fs.fsyncSync(fd); } catch {}
  } finally {
    try { fs.closeSync(fd); } catch {}
  }

  return badBlocks;
}

// Verify written image
function verifySync(
  sourcePath: string,
  device: string,
  totalBytes: number,
  algorithm: 'sha256' | 'md5',
  onProgress: (verified: number) => void
): { sourceChecksum: string; targetChecksum: string } {
  const targetDevice = resolveTargetDevicePath(device);
  const srcFd = fs.openSync(sourcePath, 'r');
  const dstFd = fs.openSync(targetDevice, 'r');
  const bufSrc = Buffer.alloc(JOB_CHUNK_SIZE);
  const bufDst = Buffer.alloc(JOB_CHUNK_SIZE);
  const srcHash = crypto.createHash(algorithm);
  const dstHash = crypto.createHash(algorithm);
  let offset = 0;

  try {
    while (offset < totalBytes) {
      const toRead = Math.min(JOB_CHUNK_SIZE, totalBytes - offset);
      const n1 = fs.readSync(srcFd, bufSrc, 0, toRead, offset);
      const n2 = fs.readSync(dstFd, bufDst, 0, toRead, offset);
      if (n1 !== n2 || !bufSrc.subarray(0, n1).equals(bufDst.subarray(0, n2))) {
        throw new Error('Verification failed: data mismatch detected on device');
      }
      srcHash.update(bufSrc.subarray(0, n1));
      dstHash.update(bufDst.subarray(0, n2));
      offset += n1;
      onProgress(offset);
    }
    return {
      sourceChecksum: srcHash.digest('hex'),
      targetChecksum: dstHash.digest('hex')
    };
  } finally {
    try { fs.closeSync(srcFd); } catch {}
    try { fs.closeSync(dstFd); } catch {}
  }
}

// Double buffer write
async function writeImageDoubleBuf(
  sourcePath: string,
  fds: number[],
  totalBytes: number,
  onProgress: (written: number, speed: number, eta: number) => void
): Promise<number> {
  const srcFd = fs.openSync(sourcePath, 'r');
  const bufA = Buffer.allocUnsafe(JOB_CHUNK_SIZE);
  const bufB = Buffer.allocUnsafe(JOB_CHUNK_SIZE);
  let bytesWritten = 0;
  let offset = 0;
  let lastProgressTime = Date.now();
  let lastBytes = 0;

  // Pre fill slot
  let activeSlot: Buffer = bufA;
  let nextSlot: Buffer = bufB;
  let activeLen = 0;

  try {
    activeLen = fs.readSync(srcFd, activeSlot, 0, Math.min(JOB_CHUNK_SIZE, totalBytes), offset);
    offset += activeLen;

    while (activeLen > 0) {
      // Read next chunk
      const nextOffset = offset;
      const toReadNext = Math.min(JOB_CHUNK_SIZE, totalBytes - nextOffset);
      const nextLen = toReadNext > 0
        ? fs.readSync(srcFd, nextSlot, 0, toReadNext, nextOffset)
        : 0;

      // Write current buffer
      const unaligned = activeSlot.subarray(0, activeLen);
      const buf = alignToSector(unaligned);

      for (const fd of fds) {
        let written = 0;
        while (written < buf.length) {
          written += fs.writeSync(fd, buf, written, buf.length - written);
        }
      }

      bytesWritten += activeLen;
      offset = nextOffset + nextLen;

      const now = Date.now();
      const timeDiff = (now - lastProgressTime) / 1000;
      if (timeDiff >= 0.4) {
        const speed = (bytesWritten - lastBytes) / timeDiff;
        const remaining = Math.max(0, totalBytes - bytesWritten);
        const eta = speed > 0 ? Math.round(remaining / speed) : 0;
        onProgress(bytesWritten, speed, eta);
        lastProgressTime = now;
        lastBytes = bytesWritten;
      }

      // Swap buffer slots
      const tmp = activeSlot;
      activeSlot = nextSlot;
      nextSlot = tmp;
      activeLen = nextLen;
    }
  } finally {
    try { fs.closeSync(srcFd); } catch {}
  }

  return bytesWritten;
}

// Execute write job
async function run(jobPath: string): Promise<void> {
  progressLogPath = jobPath.replace(/\.json$/i, '.progress.json');

  const options: FlashOptions = JSON.parse(await fs.promises.readFile(jobPath, 'utf8'));

  for (const target of options.targets) {
    if (target.isSystem) {
      throw new Error(`Security Violation: ${target.device} is a system drive.`);
    }
  }

  const { source, targets, verifyAfterWrite, surfaceScan } = options;
  const formatMode = options.formatMode ?? 'quick';
  const stat = await fs.promises.stat(source.path);
  const totalBytes = stat.size;
  const startTime = Date.now();
  let bytesWritten = 0;
  let badBlocksDetected = 0;
  let fullFormatBadBlocks = 0;

  // Adaptive chunk size
  JOB_CHUNK_SIZE = selectChunkSize(targets[0]?.size ?? 0, options.chunkSize);

  // Unmount all targets
  for (const target of targets) {
    unmountDisk(target.device, target.mountpoints || []);
  }

  // Scan target surface
  if (surfaceScan) {
    emitProgress('scanning', 0, 0, totalBytes, 0, 0);
    for (const target of targets) {
      const bad = scanSurface(target.device, totalBytes);
      if (bad > 0) {
        badBlocksDetected += bad;
        throw new Error(`Drive ${target.device} has ${bad} bad block(s) — aborting`);
      }
    }
  }

  // Full format pass
  if (formatMode === 'full') {
    emitProgress('formatting', 0, 0, totalBytes, 0, 0, { badBlocksFound: 0 });
    for (const target of targets) {
      const driveSize = target.size;
      const bad = fullFormat(target.device, driveSize, (done, total, badCount) => {
        const pct = Math.min(99, Math.round((done / total) * 100));
        emitProgress('formatting', pct, 0, totalBytes, 0, 0, {
          formatProgress: pct,
          badBlocksFound: badCount
        });
      });
      fullFormatBadBlocks += bad;
      if (bad > 0) {
        emitProgress('formatting', 100, 0, totalBytes, 0, 0, { badBlocksFound: bad });
      }
    }
    emitProgress('formatting', 100, 0, totalBytes, 0, 0, {
      formatProgress: 100,
      badBlocksFound: fullFormatBadBlocks
    });
  }

  emitProgress('preparing', 0, 0, totalBytes, 0, 0);

  const fds: number[] = [];

  try {
    // Open target devices
    for (const target of targets) {
      const targetPath = resolveTargetDevicePath(target.device);
      try {
        fds.push(openDeviceForWrite(targetPath));
      } catch (err: any) {
        throw new Error(
          `Cannot open ${target.device}: ${err.message}. Make sure the drive is plugged in and not in use.`
        );
      }
    }

    emitProgress('flashing', 0, 0, totalBytes, 0, 0);

    // Double buffer write
    bytesWritten = await writeImageDoubleBuf(
      source.path,
      fds,
      totalBytes,
      (written, speed, eta) => {
        const pct = Math.min(99, Math.round((written / totalBytes) * 100));
        emitProgress('flashing', pct, written, totalBytes, speed, eta);
      }
    );

    // Flush and close
    for (const fd of fds) {
      try { fs.fsyncSync(fd); } catch {}
      try { fs.closeSync(fd); } catch {}
    }
    fds.length = 0;

    emitProgress('flashing', 100, bytesWritten, totalBytes, 0, 0);

    let sourceChecksum: string | undefined;
    let targetChecksum: string | undefined;
    let checksumVerified = false;

    if (verifyAfterWrite) {
      emitProgress('verifying', 0, bytesWritten, totalBytes, 0, 0);
      const algorithm = options.checksumAlgorithm ?? 'sha256';
      const hashes = verifySync(source.path, targets[0].device, totalBytes, algorithm, (verified) => {
        emitProgress(
          'verifying',
          Math.min(100, Math.round((verified / totalBytes) * 100)),
          bytesWritten,
          totalBytes,
          0,
          0
        );
      });
      sourceChecksum = hashes.sourceChecksum;
      targetChecksum = hashes.targetChecksum;
      checksumVerified = sourceChecksum === targetChecksum;
    }

    emitProgress('completed', 100, bytesWritten, totalBytes, 0, 0);
    emit({
      type: 'result',
      result: {
        success: true,
        durationSeconds: Math.round((Date.now() - startTime) / 1000),
        bytesWritten,
        sourceChecksum,
        targetChecksum,
        checksumVerified,
        badBlocksDetected,
        fullFormatBadBlocks
      }
    });
  } catch (error: any) {
    for (const fd of fds) {
      try { fs.closeSync(fd); } catch {}
    }

    const message = error?.message || String(error);
    emitProgress('failed', 0, bytesWritten, totalBytes, 0, 0, { error: message });
    emit({
      type: 'result',
      result: {
        success: false,
        durationSeconds: Math.round((Date.now() - startTime) / 1000),
        bytesWritten,
        errors: [{ device: options.targets[0]?.device || 'all', message }]
      }
    });
    process.exitCode = 1;
  } finally {
    try { await fs.promises.unlink(jobPath); } catch {}
  }
}

const jobPath = process.argv[2];
if (!jobPath) {
  console.error('Usage: elevated-helper <job.json>');
  process.exit(1);
}

run(jobPath).catch((err) => {
  const message = err?.message || String(err);
  process.stderr.write(message + '\n');
  emit({
    type: 'result',
    result: {
      success: false,
      durationSeconds: 0,
      bytesWritten: 0,
      errors: [{ device: 'all', message }]
    }
  });
  process.exit(1);
});
