# Troubleshooting Guide

This guide covers common issues encountered when running, developing, or flashing images with Flasher.

## Permission and Authentication Issues

### Polkit Dialog Does Not Appear on Linux

When you click "Flash & Make Bootable" or "Erase & Flash", Flasher invokes `pkexec` to execute the disk writing helper with elevated privileges. If the password dialog never appears:

1. Check for an active Polkit authentication agent:
   Minimal window managers (such as i3, bspwm, or Sway) often do not start a Polkit agent automatically.
   Verify if an agent is running:
   ```bash
   ps aux | grep -i polkit
   ```
   If no agent is found, install and start a lightweight Polkit agent for your desktop:
   - On GNOME: `/usr/libexec/polkit-gnome-authentication-agent-1`
   - On KDE: `/usr/lib/x86_64-linux-gnu/libexec/polkit-kde-authentication-agent-1`
   - On Arch Linux or lightweight setups: `lxqt-policykit` or `polkit-gnome`

2. Check pkexec execution directly in a terminal:
   ```bash
   pkexec id
   ```
   If this command returns `uid=0(root) gid=0(root)`, Polkit is working correctly on your machine.

### UAC Prompt Denied or Dismissed on Windows

On Windows, Flasher requests administrator privileges via the native User Account Control prompt. If the prompt is dismissed or times out:
1. Ensure the user account belongs to the local Administrators group.
2. Confirm that corporate group policy does not prevent background scripts from acquiring `SeManageVolumePrivilege`.

### macOS Authorization Failed

On macOS, Flasher prompts for administrative credentials through `osascript`. If the prompt fails:
1. Verify that Terminal or Flasher has accessibility and disk access enabled in System Settings under Privacy and Security.
2. Ensure you have administrator rights on the local machine.

## Drive Detection Issues

### USB Drive Does Not Appear in the List

1. Verify hardware detection by the operating system:
   On Linux, check kernel ring buffer messages:
   ```bash
   dmesg -T | tail -n 20
   ```
   You should see a new SCSI disk device assigned (such as `Attached SCSI removable disk`).
   On Windows, open Disk Management (`diskmgmt.msc`) and verify that the device is online.
   On macOS, run `diskutil list` to verify whether the disk identifier is visible.

2. Check block device properties:
   ```bash
   lsblk -o NAME,SIZE,TYPE,RM,RO,TRAN,MOUNTPOINTS
   ```
   - If `RM` (removable) is `0`, Flasher flags the device as non removable. This occurs with external solid state drives reporting fixed disk geometry.
   - If `RO` (read only) is `1`, the hardware write protect switch is engaged or the flash memory controller has permanently locked itself due to exhausted write cycles.

3. Refresh the drive list:
   Flasher automatically polls for new drives every two seconds. If a drive does not immediately appear, click the "Refresh" button or unplug and reconnect the drive to trigger a hotplug broadcast.

## Write and Unmount Errors

### Device or Resource Busy (`EBUSY`)

An `EBUSY` error occurs when the operating system or a background service holds an exclusive lock on the block device:

1. Automatic unmount failure:
   Flasher attempts to unmount all partitions using `umount -l` on Linux, `mountvol /p` on Windows, and `diskutil unmountDisk force` on macOS. However, active swap partitions or running root mounts cannot be unmounted.
2. File managers or disk automounters holding locks:
   If a file manager has an open terminal or file browser inside a partition mountpoint, change directories out of that path and retry.
3. Manually unmounting partitions on Linux:
   ```bash
   sudo umount /dev/sdX*
   ```

### Permission Denied (`EACCES` or `EPERM`)

If Flasher reports permission denied:
1. Ensure your user account is in the `sudo` (Ubuntu and Debian) or `wheel` (Fedora and Arch) group.
2. Confirm that SELinux or AppArmor is not blocking execution of scripts in `out/main/elevated-helper.js`.

### Windows Sector Alignment Parameter Error (`ERROR_INVALID_PARAMETER` / 87)

Writing directly to Windows physical drives (`\\.\PhysicalDriveN`) requires all I/O write operations to align strictly with the physical sector geometry (typically 512 bytes).
- Flasher uses `alignToSector` to pad buffer chunks with zeroes up to the required sector boundary.
- If this error appears, verify that no third party antivirus software is intercepting raw sector calls or locking the physical disk handle.

## Surface Scan and Bad Block Errors

### Surface Scan Identifies Bad Sectors

When the "Surface scan for bad blocks" preference is enabled, Flasher reads target sectors prior to writing.
- If bad blocks are found, Flasher halts the write process to prevent corrupted installations.
- Defective blocks indicate flash cell exhaustion or counterfeit storage where reported capacity exceeds physical flash memory. Replace the USB drive.

### Full Format Zero Fill Times Out

Full formatting writes zeroes across the entire capacity of the target device to check each block:
- On large USB drives (64 GB or higher) or slow USB 2.0 ports, a full format can take a substantial amount of time.
- If quick deployment is needed, switch the format mode in Preferences or on the Review screen to "Quick Sector Erase".

## Verification Failures

### Checksum Mismatch After Write

If the write phase finishes but verification fails:

1. Flash memory wear:
   USB flash drives and SD cards degrade over time. Bad blocks will silently fail to commit written data. Test the target drive on another machine or try an alternate USB stick.
2. Unstable USB connection:
   Passive USB hubs or loose front panel ports can cause intermittent packet drops during sustained large data transfers. Plug the drive directly into a motherboard rear port.
3. Corrupted source image:
   Verify the checksum of your downloaded image against the official publisher checksum:
   ```bash
   sha256sum path/to/image.iso
   ```
4. Algorithm selection:
   Confirm whether the expected publisher checksum is SHA-256 or MD5, and configure the algorithm matching the publisher specifications in Preferences.

## Unsupported File Formats

### Archive File Rejection (.zip, .tar, .gz)

Flasher supports raw disk images only: `.iso`, `.img`, and `.raw`.
- If your operating system image was downloaded inside an archive (such as `filename.iso.gz` or `filename.img.zip`), extract the raw disk image using your system archive manager prior to selecting it in Flasher.
- Archive decompression on the fly is unsupported to preserve strict write speeds, deterministic buffer sizing, and sector verification accuracy.

## Development Environment Quirks

### Transparent Window Rendering on Linux

Flasher uses transparent visual flags (`--enable-transparent-visuals`) to render rounded corners cleanly. On some older X11 compositors or GPU configurations, this can cause visual artifacts:

- If you see black rectangular borders around the window, ensure your X11 compositor (Picom, Compton, or Mutter) has client side shadows and opacity enabled.
- On Wayland, Electron runs via XWayland by default unless started with Wayland flags:
  ```bash
  npm run dev -- --ozone-platform-hint=auto
  ```

