// Block device metadata
export interface DriveInfo {
  device: string;
  displayName: string;
  description: string;
  size: number;
  mountpoints: Array<{ path: string; label?: string }>;
  fileSystem?: string;
  isSystem: boolean;
  isRemovable: boolean;
  isUSB: boolean;
  isCard: boolean;
  isReadOnly: boolean;
  disabled?: boolean;
  warning?: string;
}

// Source image descriptor
export interface SourceFile {
  path: string;
  name: string;
  size: number;
  extension: string;
  isArchive: boolean;
  partitionScheme?: 'MBR' | 'GPT' | 'Hybrid' | 'Unknown';
  bootMode?: 'UEFI' | 'BIOS' | 'UEFI + BIOS' | 'Unknown';
  targetSystemType?: string;
  checksum?: string;
}

// Flash pipeline states
export type FlashPhase =
  | 'idle'
  | 'preparing'
  | 'scanning'
  | 'formatting'
  | 'decompressing'
  | 'flashing'
  | 'verifying'
  | 'completed'
  | 'failed';

// Write strategy
export type WriteMode = 'dd' | 'iso';

// Format depth
export type FormatMode = 'quick' | 'full';

// Write progress payload
export interface FlashProgress {
  phase: FlashPhase;
  percentage: number;
  bytesWritten: number;
  totalBytes: number;
  speed: number;
  etaSeconds: number;
  formatProgress?: number;
  badBlocksFound?: number;
  currentDevice?: string;
  error?: string;
}

// Flash execution options
export interface FlashOptions {
  source: SourceFile;
  targets: DriveInfo[];
  verifyAfterWrite: boolean;
  autoUnmountOnSuccess: boolean;
  surfaceScan?: boolean;
  checksumAlgorithm?: 'sha256' | 'md5';
  writeMode?: WriteMode;
  formatMode?: FormatMode;
  chunkSize?: number;
}

// Operation outcome summary
export interface FlashResult {
  success: boolean;
  cancelled?: boolean;
  permissionRequired?: boolean;
  errors?: Array<{ device: string; message: string }>;
  durationSeconds: number;
  bytesWritten: number;
  sourceChecksum?: string;
  targetChecksum?: string;
  checksumVerified?: boolean;
  badBlocksDetected?: number;
  fullFormatBadBlocks?: number;
}
