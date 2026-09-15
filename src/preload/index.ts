// Preload context bridge
import { contextBridge, ipcRenderer } from 'electron';
import { DriveInfo, FlashOptions, FlashProgress, FlashResult, SourceFile } from '../shared/types';

export interface FlashStartResult extends FlashResult {
  permissionRequired?: boolean;
}

// Renderer API interface
export interface FlasherAPI {
  platform: NodeJS.Platform;
  openImageDialog: () => Promise<SourceFile | null>;
  listDrives: () => Promise<DriveInfo[]>;
  onDrivesChanged: (callback: (drives: DriveInfo[]) => void) => () => void;
  checkPermissions: (options: FlashOptions) => Promise<{ needsElevation: boolean }>;
  startFlash: (options: FlashOptions, forceElevated?: boolean) => Promise<FlashStartResult>;
  cancelFlash: () => Promise<boolean>;
  calculateChecksum: (filePath: string, algorithm?: 'sha256' | 'md5') => Promise<string>;
  onFlashProgress: (callback: (progress: FlashProgress) => void) => () => void;
  minimizeWindow: () => void;
  closeWindow: () => void;
}

// IPC bridge implementation
const api: FlasherAPI = {
  platform: process.platform,
  openImageDialog: () => ipcRenderer.invoke('dialog:open-image'),
  listDrives: () => ipcRenderer.invoke('drives:list'),
  onDrivesChanged: (callback: (drives: DriveInfo[]) => void) => {
    const handler = (_event: any, drives: DriveInfo[]) => callback(drives);
    ipcRenderer.on('drives:changed', handler);
    return () => {
      ipcRenderer.removeListener('drives:changed', handler);
    };
  },
  checkPermissions: (options: FlashOptions) => ipcRenderer.invoke('permissions:check', options),
  startFlash: (options: FlashOptions, forceElevated = false) =>
    ipcRenderer.invoke('flash:start', options, forceElevated),
  cancelFlash: () => ipcRenderer.invoke('flash:cancel'),
  calculateChecksum: (filePath: string, algorithm = 'sha256') =>
    ipcRenderer.invoke('image:checksum', filePath, algorithm),
  onFlashProgress: (callback: (progress: FlashProgress) => void) => {
    const handler = (_event: any, progress: FlashProgress) => callback(progress);
    ipcRenderer.on('flash:progress', handler);
    return () => {
      ipcRenderer.removeListener('flash:progress', handler);
    };
  },
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close')
};

// Expose protected API
contextBridge.exposeInMainWorld('flasherAPI', api);

declare global {
  interface Window {
    flasherAPI: FlasherAPI;
  }
}
