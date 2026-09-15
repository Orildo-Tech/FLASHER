// Format byte size
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Format transfer speed
export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

// Format remaining duration
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return 'Calculating...';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  const hours = Math.floor(mins / 60);
  if (hours === 0) return `${mins}m ${secs}s`;
  return `${hours}h ${mins % 60}m`;
}
