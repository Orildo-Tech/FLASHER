import { CHUNK_SIZE_USB2, CHUNK_SIZE_USB3, CHUNK_SIZE_MAX } from './constants';

// Select buffer size
export function selectChunkSize(driveBytes: number, explicitBytes?: number): number {
  if (explicitBytes && explicitBytes > 0) return explicitBytes;
  if (driveBytes < 64 * 1024 * 1024 * 1024) return CHUNK_SIZE_USB2;
  if (driveBytes < 256 * 1024 * 1024 * 1024) return CHUNK_SIZE_USB3;
  return CHUNK_SIZE_MAX;
}

// Estimate format duration
export function estimateFullFormatSeconds(driveBytes: number, speedMBps = 30): number {
  return Math.ceil(driveBytes / (speedMBps * 1024 * 1024));
}

// Format duration estimate
export function formatEstimate(seconds: number): string {
  if (seconds < 90) return `~${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `~${minutes} min`;
  return `~${Math.round(minutes / 60)} hr`;
}

// Pad to sector
export function alignToSector(buf: Uint8Array): Buffer {
  const remainder = buf.length % 512;
  if (remainder === 0) {
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  return Buffer.concat([buf, Buffer.alloc(512 - remainder)]);
}
