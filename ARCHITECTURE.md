# Flasher Architecture Guide

This document describes the internal architecture of Flasher, including process separation, drive detection, privilege elevation, the raw block write pipeline, sector alignment, and IPC communication contracts.

## High Level Architecture

Flasher follows a multi process architecture designed to separate untrusted user interface rendering from privileged operating system operations.

```
+-------------------------------------------------------------+
|                      Renderer Process                       |
|               (React 18 + TypeScript + CSS)                 |
|             Runs unprivileged in Chromium sandbox           |
| Image Source -> Target Storage -> Write & Verify -> Confirm |
+------------------------------+------------------------------+
                               |
                   contextBridge IPC (window.flasher)
                               |
+------------------------------v------------------------------+
|                        Preload Script                       |
|               (Secure Typed Surface Exposure)               |
+------------------------------+------------------------------+
                               |
                          Electron IPC
                               |
+------------------------------v------------------------------+
|                         Main Process                        |
|                     (Node.js + Electron)                    |
|       Window management, drive polling, job coordination    |
+------------------------------+------------------------------+
                               |
             pkexec / UAC / osascript (child_process)
                               |
+------------------------------v------------------------------+
|                    Elevated Helper Daemon                   |
|                  (Standalone Node.js script)                |
|       Runs with elevated rights: partition unmounting,      |
|       sector alignment, raw block writes, surface scan,     |
|          checksum verification, and progress emission       |
+-------------------------------------------------------------+
```

## Process Model and Responsibilities

### 1. Renderer Process (`src/renderer/`)

- Framework: React 18, TypeScript, Vanilla CSS design tokens.
- Scope: Handles user interactions, wizard navigation, telemetry display, modal dialogs, and user preferences.
- Security: Node integration is completely disabled (`nodeIntegration: false`). Context isolation is enforced (`contextIsolation: true`). The renderer cannot access disk paths or spawn shell commands directly.
- Workflow Architecture:
  - Image Source: Inspects raw disk images (`.iso`, `.img`, `.raw`), parses partition schemes (MBR, GPT, Hybrid), and checks target system mode (UEFI, BIOS).
  - Target Storage: Lists removable USB drives and SD cards with real time hotplug polling and protected system drive exclusion.
  - Write & Verify: Displays stream topology, filesystem transition previews, capacity constraints, and verification settings.
  - Review & Confirm: Dedicated drive erasure confirmation card requiring explicit approval before invoking destructive write routines.
  - Preferences: Configures verification algorithms, auto ejection, buffer chunking, turbo mode, surface scanning, partition pre wiping, sleep prevention, single USB auto targeting, and desktop alerts.
  - Sidebar Navigation: Tracks step completion using circular checkmark indicators. The Write & Verify step marks completed upon confirming erasure and unchecks if the user navigates back to make adjustments.

### 2. Preload Script (`src/preload/index.ts`)

- Exposes a typed API on `window.flasher` using Electron `contextBridge.exposeInMainWorld`.
- Methods exposed:
  - `listDrives()`: Request current block device list.
  - `openImageDialog()`: Trigger native file picker for raw disk images (`.iso`, `.img`, `.raw`).
  - `checkPermissions(options)`: Query if elevation is required for selected targets.
  - `startFlash(options, forceElevated)`: Initiate write job with structured configuration.
  - `cancelFlash()`: Request graceful job cancellation.
  - `onDrivesChanged(callback)`: Subscribe to drive plug and unplug events.
  - `onFlashProgress(callback)`: Subscribe to live progress events.
  - `minimizeWindow()`, `closeWindow()`: Frameless window controls.

### 3. Main Process (`src/main/`)

- Entry point: `src/main/index.ts`.
- Coordinates application lifecycle, native frameless window management, file dialogs, power management, and background drive polling.
- Subsystems:
  - `drive-scanner.ts`: Uses `drivelist` to enumerate system and removable storage. The `DriveWatcher` class runs a recurring two second background poll, comparing device lists and broadcasting changes when drives are inserted or removed.
  - `privilege.ts`: Inspects target block devices to determine if the current user has direct write access or if administrative elevation is required.
  - `elevated-writer.ts`: Manages execution of the write job. When elevation is needed, it serializes job parameters to a temporary JSON descriptor and spawns the helper using the platform elevation binary (`pkexec` on Linux, UAC on Windows, `osascript` on macOS). It consumes the helper line delimited JSON stream and forwards progress to the renderer.

### 4. Elevated Helper (`src/main/elevated-helper.ts`)

- Runs in an isolated Node process elevated via system privilege escalation.
- Responsibilities:
  1. Parameter Validation: Parses the job descriptor and validates that source image and target devices are accessible.
  2. Multi Platform Partition Unmounting:
     - Linux: Queries mountpoints via `lsblk` and safely executes `umount -l`.
     - Windows: Parses mountpoints, runs `mountvol <letter>: /p`, and executes PowerShell partition dismount commands.
     - macOS: Executes `diskutil unmountDisk force` against the target device node.
  3. Pre Write Surface Scanning: Reads initial device sectors up to 64 MB before writing to catch bad blocks and counterfeit media before modifying data.
  4. Zero Out Partition Pre Wipe: Optionally writes zero blocks across the first 4 MB of the target drive to erase legacy MBR and GPT structures.
  5. Direct Block Writing: Opens the target block device with write flags (`w` or direct I/O). On macOS, targets are mapped from `/dev/disk*` to unbuffered `/dev/rdisk*` character devices. Reads the source file in chunks (standard 2 MB or high speed 4 MB) and streams them sequentially to the destination descriptor.
  6. Sector Alignment: On Windows physical drives, writes are aligned to 512 byte sector boundaries via `alignToSector`, with trailing blocks zero padded to prevent device parameter errors.
  7. Kernel Flush: Calls `fsync` on the target file descriptor to guarantee all cached blocks are committed to physical flash storage before declaring completion.
  8. Post Write Verification: Re reads the written bytes from the block device, calculates running hashes using the configured algorithm (SHA-256 or MD5), and compares them against the source image.
  9. Line Delimited Progress: Outputs single line JSON objects to `stdout` containing the current phase, percentage, write speed, format progress, and estimated time remaining.

### 5. Shared Utilities (`src/shared/write-utils.ts`)

- `selectChunkSize(driveSize, requestedChunkSize)`: Selects optimal buffer chunk sizes based on target hardware capacity and user configuration, choosing between 2 MB, 4 MB, and 8 MB buffers.
- `alignToSector(bufferLength, sectorSize)`: Calculates sector padding requirements (typically 512 bytes on Windows physical drives) to guarantee valid write boundaries.

## Safety and System Protection Invariants

Writing raw bytes to physical disks can permanently destroy data if misdirected. Flasher implements multiple defensive checks:

1. System Drive Flagging:
   - `drive-scanner.ts` evaluates `d.isSystem`.
   - Drives hosting active root (`/`), boot (`/boot`), or home partitions are marked as system drives.
   - The UI disables system drives by default and displays explicit warnings if manual override is attempted.
2. Device Path Validation:
   - Raw write operations target whole block devices (such as `/dev/sdb`, `PhysicalDrive1`, `/dev/rdisk2`) rather than individual partitions, ensuring proper partition tables and bootloaders are cleanly reconstructed.
3. Partition Lock Prevention:
   - Writing fails if a partition is actively mounted and locked. The helper proactively unmounts all children of the target block device before opening the write handle.
4. Review and Confirm Gate:
   - The UI requires users to review target drive capacity, device node, source image details, and format mode on a dedicated confirmation screen before triggering writes.

## IPC Event Flow

### Write Lifecycle Sequence

```
Renderer                     Main Process                 Elevated Helper
   |                              |                              |
   |--- flash:start ------------->|                              |
   |                              |--- spawn helper ------------>|
   |                              |                              |--- unmountDisk()
   |                              |                              |--- scanSurface() [optional]
   |                              |                              |--- preWipe() [optional]
   |                              |                              |--- write blocks & align
   |                              |<-- JSON progress line -------|
   |<-- flash:progress -----------|                              |
   |    (speed, %, eta)           |                              |
   |                              |                              |--- fsync()
   |                              |                              |--- verifyChecksum() [optional]
   |                              |<-- JSON result line ---------|
   |<-- resolve(FlashResult) -----|                              |
   |                              |                              x (helper exits)
```

## Data Contracts (`src/shared/types.ts`)

### `DriveInfo`
Represents an enumerated block device:
- `device`: Device node path (such as `/dev/sdb` or `\\\\.\\PhysicalDrive1`).
- `displayName`: Human readable label (such as `SanDisk Ultra 32GB`).
- `description`: Hardware descriptor string.
- `size`: Device capacity in bytes.
- `mountpoints`: Array of mounted paths and labels.
- `isSystem`: True if drive contains host OS partitions.
- `isRemovable`: True if hardware reports removable media flags.
- `isUSB`: True if connected via USB bus.
- `isCard`: True if identified as an SD or MMC card.
- `isReadOnly`: True if write protection is detected.

### `FlashOptions`
Supplied from renderer to main process to configure the flash job:
- `source`: Source file metadata (path, name, size, extension).
- `targets`: Target drive descriptors.
- `verifyAfterWrite`: Boolean switch for post write checksum comparison.
- `autoUnmountOnSuccess`: Automatically eject drive on finish.
- `surfaceScan`: Optional pre write sector defect scan.
- `checksumAlgorithm`: Hash algorithm selection (`'sha256'` or `'md5'`).
- `writeMode`: Strategy selection (`'dd'` or `'iso'`).
- `formatMode`: Format depth (`'quick'` or `'full'`).
- `chunkSize`: Buffer sizing in bytes (2 MB or 4 MB).

### `FlashProgress`
Streamed during preparation, writing, and verification:
- `phase`: Current stage (`'preparing'` | `'scanning'` | `'formatting'` | `'flashing'` | `'verifying'` | `'completed'` | `'failed'`).
- `percentage`: 0 to 100 progress value.
- `bytesWritten`: Total bytes written so far.
- `totalBytes`: Expected total image size.
- `speed`: Current throughput in bytes per second.
- `etaSeconds`: Estimated time remaining.
- `formatProgress`: Progress percentage during full format passes.
- `badBlocksFound`: Count of defective sectors identified during surface scans.

## Styling and Design System

- Located in `src/renderer/src/index.css`.
- CSS custom properties are defined in `:root` covering palettes, typography, border radii, and elevation levels.
- All icon avatars, badge containers, and step icons use transparent backgrounds.
- Vector graphics are maintained as standalone SVG files in `src/renderer/src/assets/icons/` and exposed as React components in `src/renderer/src/components/icons.tsx`.

