import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import { DriveWatcher, scanDrives } from './drive-scanner';
import { DiskWriter } from './elevated-writer';
import { needsElevation } from './privilege';
import { inspectImage } from './image-inspector';
import { calculateFileChecksum } from './checksum-calculator';
import { DriveInfo, FlashOptions, SourceFile } from '../shared/types';
import { SUPPORTED_EXTENSIONS } from '../shared/constants';

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals');
}

let mainWindow: BrowserWindow | null = null;
let activeWriter: DiskWriter | null = null;
let driveWatcher: DriveWatcher | null = null;
let latestDrives: DriveInfo[] = [];

// Broadcast drive updates
function broadcastDrives(drives: DriveInfo[]): void {
  latestDrives = drives;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('drives:changed', drives);
  }
}

// Create application window
function createWindow(): void {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  mainWindow = new BrowserWindow({
    width: 860,
    height: 540,
    minWidth: 800,
    minHeight: 500,
    show: false,
    frame: false,
    transparent: !isWin,
    hasShadow: true,
    roundedCorners: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 18, y: 18 } } : {}),
    autoHideMenuBar: true,
    backgroundColor: isWin ? '#1c3144' : '#00000000',
    icon: join(__dirname, '../../src/renderer/src/assets/icons/icon.svg'),
    title: 'Flasher - OS Image Burner',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// Initialize application lifecycle
app.whenReady().then(() => {
  createWindow();

  driveWatcher = new DriveWatcher();
  driveWatcher.on('change', (drives: DriveInfo[]) => {
    broadcastDrives(drives);
  });
  driveWatcher.start(2000);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (!driveWatcher) {
        driveWatcher = new DriveWatcher();
        driveWatcher.on('change', (drives: DriveInfo[]) => {
          broadcastDrives(drives);
        });
        driveWatcher.start(2000);
      }
    }
  });
});

app.on('window-all-closed', () => {
  driveWatcher?.stop();
  driveWatcher = null;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// List connected drives
ipcMain.handle('drives:list', async () => {
  if (driveWatcher) {
    const drives = await driveWatcher.refresh(true);
    return drives.length > 0 ? drives : latestDrives;
  }
  return await scanDrives();
});

// Open file dialog
ipcMain.handle('dialog:open-image', async (): Promise<SourceFile | null> => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Disk Image',
    properties: ['openFile'],
    filters: [
      {
        name: 'Disk Images',
        extensions: SUPPORTED_EXTENSIONS
      }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const stat = await fs.promises.stat(filePath);
  const fileName = filePath.split(/[/\\]/).pop() || 'Image';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return null;
  }

  // Inspect partition and boot
  const inspection = await inspectImage(filePath);

  return {
    path: filePath,
    name: fileName,
    size: stat.size,
    extension: ext,
    isArchive: false,
    partitionScheme: inspection.partitionScheme,
    bootMode: inspection.bootMode,
    targetSystemType: inspection.targetSystemType
  };
});

ipcMain.handle('permissions:check', async (_event, options: FlashOptions) => {
  return {
    needsElevation: needsElevation(options.targets)
  };
});

// Calculate image checksum
ipcMain.handle(
  'image:checksum',
  async (_event, filePath: string, algorithm: 'sha256' | 'md5' = 'sha256'): Promise<string> => {
    return await calculateFileChecksum(filePath, algorithm);
  }
);

// Start flash operation
ipcMain.handle(
  'flash:start',
  async (_event, options: FlashOptions, forceElevated = false) => {
    if (activeWriter) {
      activeWriter.cancel();
    }

    activeWriter = new DiskWriter();
    activeWriter.on('progress', (progress) => {
      mainWindow?.webContents.send('flash:progress', progress);
    });

    try {
      const result = await activeWriter.flash(options, forceElevated);
      void driveWatcher?.refresh(true);
      return result;
    } catch (err: any) {
      if (err?.code === 'PERMISSION_REQUIRED' || err?.message === 'PERMISSION_REQUIRED') {
        return {
          success: false,
          permissionRequired: true,
          durationSeconds: 0,
          bytesWritten: 0
        };
      }
      throw err;
    } finally {
      activeWriter = null;
    }
  }
);

// Cancel ongoing flash
ipcMain.handle('flash:cancel', async () => {
  if (activeWriter) {
    activeWriter.cancel();
    return true;
  }
  return false;
});

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});
