import * as fs from 'fs';
import * as crypto from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { FlashOptions, FlashProgress, FlashResult } from '../shared/types';
import { DEFAULT_CHUNK_SIZE } from '../shared/constants';
import { alignToSector } from '../shared/write-utils';
import { canWriteDevice, resolveNodeBinary, tryUnmountAsUser, getRawDevicePath } from './privilege';

// Disk writer pipeline
export class DiskWriter extends EventEmitter {
  private isCancelled = false;
  private activeFds: number[] = [];
  private elevatedChild: ChildProcess | null = null;

  // Cancel ongoing write
  public cancel() {
    this.isCancelled = true;
    for (const fd of this.activeFds) {
      try {
        fs.closeSync(fd);
      } catch { }
    }
    this.activeFds = [];

    if (this.elevatedChild) {
      try {
        this.elevatedChild.kill('SIGTERM');
      } catch { }
      this.elevatedChild = null;
    }
  }

  // Execute write job
  public async flash(options: FlashOptions, forceElevated = false): Promise<FlashResult> {
    this.isCancelled = false;
    this.activeFds = [];
    this.elevatedChild = null;

    for (const target of options.targets) {
      if (target.isSystem) {
        throw new Error(`Security Violation: ${target.device} is a system drive and cannot be written to.`);
      }
    }

    // Unmount target partitions
    tryUnmountAsUser(options.targets);

    // Check elevation status
    const needsElevated =
      forceElevated || options.targets.some((t) => !canWriteDevice(t.device));

    if (needsElevated) {
      return this.flashElevated(options);
    }

    return this.flashDirect(options);
  }

  // Run elevated helper
  private async flashElevated(options: FlashOptions): Promise<FlashResult> {
    const startTime = Date.now();
    const jobPath = join(tmpdir(), `flasher-job-${process.pid}-${Date.now()}.json`);
    const progressLogPath = jobPath.replace(/\.json$/i, '.progress.json');
    let runnerScriptPath: string | null = null;

    await fs.promises.writeFile(jobPath, JSON.stringify(options), 'utf8');
    try {
      fs.chmodSync(jobPath, 0o644);
    } catch {}

    // Resolve helper path
    let helperPath = join(__dirname, 'elevated-helper.js');
    if (helperPath.includes('app.asar')) {
      const unpacked = helperPath.replace('app.asar', 'app.asar.unpacked');
      if (fs.existsSync(unpacked)) {
        helperPath = unpacked;
      }
    }

    const nodeBin = resolveNodeBinary();
    const platform = process.platform;

    let cmd = '';
    let args: string[] = [];

    const q = (s: string) => `'${s.replace(/'/g, `'\"'\"'`)}'`;

    if (platform === 'linux') {
      const shellCmd = [
        'set -e',
        `export DISPLAY=${q(process.env.DISPLAY || ':0')}`,
        `export XAUTHORITY=${q(process.env.XAUTHORITY || '')}`,
        `export WAYLAND_DISPLAY=${q(process.env.WAYLAND_DISPLAY || '')}`,
        `export HOME=${q(process.env.HOME || '/root')}`,
        'export ELECTRON_RUN_AS_NODE=1',
        `exec ${q(nodeBin)} ${q(helperPath)} ${q(jobPath)}`
      ].join('; ');

      cmd = 'pkexec';
      args = ['bash', '-c', shellCmd];
    } else if (platform === 'darwin') {
      // macOS: osascript with administrator privileges
      runnerScriptPath = join(tmpdir(), `flasher-run-${process.pid}-${Date.now()}.sh`);
      const scriptContent = [
        '#!/bin/bash',
        'export ELECTRON_RUN_AS_NODE=1',
        `exec "${nodeBin}" "${helperPath}" "${jobPath}"`
      ].join('\n');
      fs.writeFileSync(runnerScriptPath, scriptContent, { mode: 0o755 });

      cmd = 'osascript';
      args = ['-e', `do shell script "${runnerScriptPath}" with administrator privileges`];
    } else if (platform === 'win32') {
      // Windows: PowerShell Start-Process with -Verb RunAs (UAC Prompt)
      cmd = 'powershell.exe';
      const escapedNode = nodeBin.replace(/"/g, '`"');
      const escapedHelper = helperPath.replace(/'/g, "''");
      const escapedJob = jobPath.replace(/'/g, "''");
      const psScript = `$env:ELECTRON_RUN_AS_NODE="1"; Start-Process -FilePath "${escapedNode}" -ArgumentList "'${escapedHelper}' '${escapedJob}'" -Verb RunAs -Wait -WindowStyle Hidden`;
      args = ['-NoProfile', '-NonInteractive', '-Command', psScript];
    } else {
      cmd = 'sudo';
      args = [nodeBin, helperPath, jobPath];
    }

    return new Promise<FlashResult>((resolve) => {
      let settled = false;
      let result: FlashResult | null = null;
      let stdoutBuf = '';
      let stderrBuf = '';
      let pollTimer: NodeJS.Timeout | null = null;
      let lastProgressLine = '';

      // Clean job descriptor
      const finish = (value: FlashResult) => {
        if (settled) return;
        settled = true;
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        this.elevatedChild = null;
        try {
          fs.unlinkSync(jobPath);
        } catch {}
        try {
          fs.unlinkSync(progressLogPath);
        } catch {}
        if (runnerScriptPath) {
          try {
            fs.unlinkSync(runnerScriptPath);
          } catch {}
        }
        resolve(value);
      };

      // Periodic file poller for UAC / osascript decoupled stdout
      pollTimer = setInterval(() => {
        try {
          if (fs.existsSync(progressLogPath)) {
            const content = fs.readFileSync(progressLogPath, 'utf8').trim();
            if (content && content !== lastProgressLine) {
              lastProgressLine = content;
              const msg = JSON.parse(content);
              if (msg.type === 'result') {
                result = msg.result as FlashResult;
              } else if (msg.phase) {
                this.emit('progress', msg as FlashProgress);
              }
            }
          }
        } catch {}
      }, 150);

      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          DISPLAY: process.env.DISPLAY || ':0',
          WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || '',
          XAUTHORITY: process.env.XAUTHORITY || ''
        }
      });
      this.elevatedChild = child;

      child.stdout?.on('data', (data: Buffer) => {
        stdoutBuf += data.toString('utf8');
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'result') {
              result = msg.result as FlashResult;
            } else if (msg.phase) {
              this.emit('progress', msg as FlashProgress);
            }
          } catch {}
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        stderrBuf += text;
        console.error('[elevated-helper]', text);
      });

      child.on('error', (err) => {
        this.emitProgress('failed', 0, 0, 0, 0, 0, err.message);
        finish({
          success: false,
          durationSeconds: Math.round((Date.now() - startTime) / 1000),
          bytesWritten: 0,
          errors: [
            {
              device: options.targets[0]?.device || 'all',
              message: `Failed to start elevated flash: ${err.message}`
            }
          ]
        });
      });

      child.on('close', (code) => {
        // Read progress file one final time
        try {
          if (fs.existsSync(progressLogPath)) {
            const content = fs.readFileSync(progressLogPath, 'utf8').trim();
            if (content) {
              const msg = JSON.parse(content);
              if (msg.type === 'result') {
                result = msg.result as FlashResult;
              }
            }
          }
        } catch {}

        if (this.isCancelled) {
          finish({
            success: false,
            cancelled: true,
            durationSeconds: Math.round((Date.now() - startTime) / 1000),
            bytesWritten: 0
          });
          return;
        }

        if (result) {
          finish(result);
          return;
        }

        const stderr = stderrBuf.trim();
        let message: string;
        let cancelled = false;

        const dismissed =
          /Request dismissed|not authorized|authentication.*fail|User cancelled|cancelled|User denied|canceled/i.test(
            stderr
          );

        if (code === 126 || code === 127 || dismissed) {
          message = 'Permission was denied or authentication was cancelled.';
          cancelled = true;
        } else if (code === 0 && !result) {
          message = 'Elevated flash finished without a result. Check console logs.';
        } else if (stderr) {
          message = stderr.split('\n').filter(Boolean).slice(-3).join(' ');
        } else if (code === 1) {
          message =
            'Authentication failed or the elevated helper crashed. Please try again with administrator rights.';
        } else {
          message = `Elevated flash exited with code ${code}`;
        }

        this.emitProgress('failed', 0, 0, 0, 0, 0, message);
        finish({
          success: false,
          cancelled,
          durationSeconds: Math.round((Date.now() - startTime) / 1000),
          bytesWritten: 0,
          errors: [{ device: options.targets[0]?.device || 'all', message }]
        });
      });
    });
  }

  // Direct write path
  private async flashDirect(options: FlashOptions): Promise<FlashResult> {
    const startTime = Date.now();
    const { source, targets, verifyAfterWrite } = options;

    const stat = await fs.promises.stat(source.path);
    const totalBytes = stat.size;

    // Scan target surface
    if (options.surfaceScan) {
      this.emitProgress('scanning', 0, 0, totalBytes, 0, 0);
      for (const target of targets) {
        const targetPath = getRawDevicePath(target.device);
        try {
          const testFd = fs.openSync(targetPath, fs.constants.O_RDONLY);
          const testBuf = Buffer.alloc(1024 * 1024);
          let testOffset = 0;
          const limit = Math.min(totalBytes, 64 * 1024 * 1024);
          while (testOffset < limit) {
            const toRead = Math.min(testBuf.length, limit - testOffset);
            const n = fs.readSync(testFd, testBuf, 0, toRead, testOffset);
            if (n === 0) break;
            testOffset += n;
          }
          fs.closeSync(testFd);
        } catch (scanErr: any) {
          throw new Error(`Surface scan failed for ${target.device}: ${scanErr.message}`);
        }
      }
    }

    this.emitProgress('preparing', 0, 0, totalBytes, 0, 0);

    let bytesWritten = 0;
    let lastProgressTime = Date.now();
    let lastBytes = 0;

    try {
      const O_WRONLY = fs.constants.O_WRONLY;
      // Bypass disk cache
      const O_SYNC = fs.constants.O_SYNC ?? 1052672;
      const fds: number[] = [];

      for (const target of targets) {
        let fd: number;
        const targetPath = getRawDevicePath(target.device);
        try {
          fd = fs.openSync(targetPath, O_WRONLY | O_SYNC);
        } catch (err: any) {
          if (err.code === 'EACCES' || err.code === 'EPERM') {
            const permissionError = new Error('PERMISSION_REQUIRED') as Error & {
              code: string;
            };
            permissionError.code = 'PERMISSION_REQUIRED';
            throw permissionError;
          }
          throw err;
        }
        fds.push(fd);
        this.activeFds.push(fd);
      }

      this.emitProgress('flashing', 0, 0, totalBytes, 0, 0);

      // Stream image data
      const readStream = fs.createReadStream(source.path, {
        highWaterMark: DEFAULT_CHUNK_SIZE
      });

      await new Promise<void>((resolve, reject) => {
        readStream.on('data', (chunk: string | Buffer) => {
          let buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (this.isCancelled) {
            readStream.destroy();
            return reject(new Error('Flashing cancelled by user'));
          }

          // Align to sector
          buf = alignToSector(buf);

          for (const fd of fds) {
            try {
              let offset = 0;
              while (offset < buf.length) {
                const written = fs.writeSync(fd, buf, offset, buf.length - offset);
                offset += written;
              }
            } catch (err: any) {
              readStream.destroy();
              return reject(new Error(`Write error: ${err.message}`));
            }
          }

          bytesWritten += chunk.length;

          const now = Date.now();
          const timeDiff = (now - lastProgressTime) / 1000;
          if (timeDiff >= 0.5) {
            const bytesDiff = bytesWritten - lastBytes;
            const speed = bytesDiff / timeDiff;
            const percentage = Math.min(100, Math.round((bytesWritten / totalBytes) * 100));
            const remainingBytes = Math.max(0, totalBytes - bytesWritten);
            const etaSeconds = speed > 0 ? Math.round(remainingBytes / speed) : 0;
            this.emitProgress('flashing', percentage, bytesWritten, totalBytes, speed, etaSeconds);
            lastProgressTime = now;
            lastBytes = bytesWritten;
          }
        });

        readStream.on('end', () => resolve());
        readStream.on('error', (err) => reject(err));
      });

      for (const fd of fds) {
        try {
          fs.fsyncSync(fd);
          fs.closeSync(fd);
        } catch { }
      }
      this.activeFds = [];

      this.emitProgress('flashing', 100, bytesWritten, totalBytes, 0, 0);

      let sourceChecksum: string | undefined;
      let targetChecksum: string | undefined;
      let checksumVerified = false;

      // Verify written data
      if (verifyAfterWrite && !this.isCancelled) {
        this.emitProgress('verifying', 0, bytesWritten, totalBytes, 0, 0);

        const verifyPath = getRawDevicePath(targets[0].device);
        const srcFd = fs.openSync(source.path, 'r');
        const dstFd = fs.openSync(verifyPath, 'r');
        const bufSrc = Buffer.alloc(DEFAULT_CHUNK_SIZE);
        const bufDst = Buffer.alloc(DEFAULT_CHUNK_SIZE);
        const algorithm = options.checksumAlgorithm || 'sha256';
        const srcHash = crypto.createHash(algorithm);
        const dstHash = crypto.createHash(algorithm);
        let offset = 0;

        try {
          while (offset < totalBytes) {
            if (this.isCancelled) throw new Error('Flashing cancelled by user');
            const toRead = Math.min(DEFAULT_CHUNK_SIZE, totalBytes - offset);
            const n1 = fs.readSync(srcFd, bufSrc, 0, toRead, offset);
            const n2 = fs.readSync(dstFd, bufDst, 0, toRead, offset);
            if (n1 !== n2 || !bufSrc.subarray(0, n1).equals(bufDst.subarray(0, n2))) {
              throw new Error('Verification failed: data mismatch detected on device');
            }
            srcHash.update(bufSrc.subarray(0, n1));
            dstHash.update(bufDst.subarray(0, n2));
            offset += n1;
            this.emitProgress(
              'verifying',
              Math.min(100, Math.round((offset / totalBytes) * 100)),
              bytesWritten,
              totalBytes,
              0,
              0
            );
          }
          sourceChecksum = srcHash.digest('hex');
          targetChecksum = dstHash.digest('hex');
          checksumVerified = sourceChecksum === targetChecksum;
        } finally {
          try {
            fs.closeSync(srcFd);
          } catch { }
          try {
            fs.closeSync(dstFd);
          } catch { }
        }
      }

      this.emitProgress('completed', 100, bytesWritten, totalBytes, 0, 0);

      return {
        success: true,
        durationSeconds: Math.round((Date.now() - startTime) / 1000),
        bytesWritten,
        sourceChecksum,
        targetChecksum,
        checksumVerified,
        badBlocksDetected: 0
      };
    } catch (error: any) {
      for (const fd of this.activeFds) {
        try {
          fs.closeSync(fd);
        } catch { }
      }
      this.activeFds = [];

      if (error?.code === 'PERMISSION_REQUIRED' || error?.message === 'PERMISSION_REQUIRED') {
        throw error;
      }

      this.emitProgress('failed', 0, bytesWritten, totalBytes, 0, 0, error.message);

      return {
        success: false,
        cancelled: this.isCancelled,
        durationSeconds: Math.round((Date.now() - startTime) / 1000),
        bytesWritten,
        errors: [{ device: options.targets[0]?.device || 'all', message: error.message }]
      };
    }
  }

  private emitProgress(
    phase: FlashProgress['phase'],
    percentage: number,
    bytesWritten: number,
    totalBytes: number,
    speed: number,
    etaSeconds: number,
    error?: string
  ) {
    this.emit('progress', {
      phase,
      percentage,
      bytesWritten,
      totalBytes,
      speed,
      etaSeconds,
      ...(error ? { error } : {})
    } as FlashProgress);
  }
}
