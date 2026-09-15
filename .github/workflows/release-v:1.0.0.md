# Flasher 1.0.0

Flasher version 1.0.0 is the first stable release of the open source disk image burning utility. This release introduces multi platform support for Linux, Windows, and macOS, providing safe, direct block writing of operating system images to removable storage devices.

## Supported Formats

Flasher supports raw disk images:
* `.iso`: Standard optical and hybrid installation images.
* `.img`: Raw disk images and embedded appliance systems.
* `.raw`: Byte for byte storage dumps and virtual machine exports.

Archive formats are intentionally unsupported to guarantee direct block streaming, exact sector alignment, and accurate cryptographic checksum verification.

## Supported Platforms and Binaries

Prebuilt binaries are attached below for all major desktop operating systems:

### Linux
* `flasher-1.0.0-x86_64.AppImage`: Standalone executable running on most modern Linux distributions without installation.
* `flasher_1.0.0_amd64.deb`: Debian and Ubuntu package installer.
* `flasher-1.0.0.x86_64.rpm`: Fedora, RHEL, openSUSE, and CentOS package installer.

### Windows
* `Flasher-Setup-1.0.0-x64.exe`: Windows installer with desktop shortcut, start menu entry, and uninstaller.
* `Flasher-Portable-1.0.0-x64.exe`: Portable single executable requiring no installation.

### macOS
* `Flasher-1.0.0-x64.dmg` / `Flasher-1.0.0-arm64.dmg`: Apple Disk Image installer for Intel and Apple Silicon Macs.
* `Flasher-1.0.0-x64.zip` / `Flasher-1.0.0-arm64.zip`: Standalone application bundle archive.

## Core Capabilities

### Four Stage Workflow and Confirmation
* Structured workflow across Image Source, Target Storage, Write & Verify, and Review & Confirm steps.
* Visual circular checkmark indicators track completion across each workflow stage in the sidebar navigation.
* Dedicated Review & Confirm safety card displays target drive capacity, device node, source image details, format mode, and validation options prior to disk erasure.

### Multi Platform Elevation Architecture
Writing directly to physical block devices requires administrative permissions. Flasher runs the user interface under an unprivileged user session and isolates raw write operations inside a dedicated elevated helper:
* On Linux, privilege escalation is managed through Polkit and `pkexec`.
* On Windows, elevation requests utilize the native User Account Control prompt.
* On macOS, administrator approval is handled via `osascript` with Touch ID and password validation.

### Raw Block Writing and Sector Alignment
* Direct block streaming writes image data in standard 2 MB or high speed 4 MB chunks.
* Windows physical drive handles enforce sector alignment boundaries of 512 bytes, with trailing blocks padded automatically to ensure clean writes without device parameter errors.
* On macOS, target devices are mapped to raw character devices (`/dev/rdisk*`) to eliminate kernel buffer bottlenecks.

### Surface Scanning and Partition Pre Wipe
* Optional surface verification reads initial device sectors before writing to detect bad blocks, worn flash cells, and counterfeit storage devices.
* Optional partition pre wipe zeroes out legacy MBR and GPT structures from sector zero before writing the bootable image.

### Operating System Drive Protection
* Block devices hosting root mountpoints, boot filesystems, swap partitions, or primary system volumes are flagged as protected.
* Target selection blocks write attempts directed at host drives by default.

### Post Write Integrity Verification
* Written sectors are re read and validated block by block against the source image using either SHA-256 or MD5 checksum algorithms.
* Target drives are unmounted and flushed before and after writing to prevent filesystem caching discrepancies.

### Real Time Telemetry and Preferences
* Live telemetry reports write throughput in MB/s, written byte counts, percentage completion, and estimated remaining duration.
* Comprehensive Preferences panel configures verification switches, auto eject behavior, turbo mode, sleep prevention, single USB auto targeting, desktop notifications, and completion audio.

## Source Code and Verification

Source code archives are generated automatically and attached below in zip and tar.gz formats. To build Flasher from source, follow the instructions in the project repository.

