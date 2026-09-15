# Changelog

All notable changes to Flasher are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [1.0.0] - 2026-09-15


### Added
- Support for raw disk image formats: `.iso`, `.img`, and `.raw`.
- Four stage visual workflow containing Image Source, Target Storage, Write & Verify, and Review & Confirm steps.
- Interactive circular checkmark badges in sidebar navigation tracking completion status across each workflow stage.
- Dedicated Review & Confirm erasure view detailing target device path, capacity, source file information, format pass mode, and post write checksum verification.
- Comprehensive Preferences view managing write validation, media auto ejection, turbo mode, sleep prevention, single USB auto selection, desktop notifications, and completion chimes.
- High speed buffer chunk allocation (4 MB) alongside standard 2 MB streaming for fast USB 3.0+ storage devices.
- Surface scanning engine inspecting initial device sectors before writing to detect bad blocks and counterfeit media.
- Zero out partition table pre wipe mode to clear legacy MBR and GPT partition structures before streaming images.
- Dual formatting modes: quick sector erasure and full format zero fill with defect detection.
- Windows physical disk sector alignment enforcing 512 byte boundaries with trailing block zero padding.
- macOS character device acceleration mapping `/dev/disk*` nodes to unbuffered `/dev/rdisk*` character devices.
- Multi algorithm integrity validation supporting sequential SHA-256 and MD5 checksum passes.
- Automated partition unmounting orchestration across Linux (`umount -l`), Windows (`mountvol /p` and PowerShell dismount), and macOS (`diskutil unmountDisk force`).
- System sleep prevention via power save blocking during active flashing and verification operations.
- Hotplug drive monitoring polling removable storage every two seconds.
- Operating system drive protection safeguards preventing destructive writes to internal OS volumes.
- Clean desktop interface built with Electron 29, React 18, and TypeScript.
- Complete SVG icon library with transparent avatar containers and custom hero illustrations.

