# Contributing to Flasher

Thank you for your interest in contributing to Flasher. This document provides guidelines and instructions for submitting bug reports, feature suggestions, and code changes.

## Code of Conduct

All contributors and maintainers are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md). Please treat others with respect and professionalism.

## Getting Started

### Prerequisites

Ensure your system has the following tools installed:

- Node.js 18.x or later (Node 20 LTS recommended)
- npm 9.x or later
- Git
- On Linux: `pkexec` (part of `policykit-1` or `polkit`), `lsblk`, `umount`

### Fork and Clone

1. Fork the repository on GitHub.
2. Clone your fork locally:

```bash
git clone https://github.com/<your-username>/flasher.git
cd flasher
```

3. Install project dependencies:

```bash
npm install
```

4. Start the development environment:

```bash
npm run dev
```

The application window should open with hot reloading enabled.

## Development Workflow

### Branch Naming

Create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
# or for bug fixes:
git checkout -b fix/issue-description
```

Use descriptive branch names:
- `feature/sparse-image-support`
- `fix/partition-unmount-race`
- `docs/troubleshooting-polkit`

### Coding Standards

- Supported Image Formats:
  - Flasher supports raw disk images: `.iso`, `.img`, and `.raw`.
  - Only raw disk images are supported. Do not introduce handlers for archive formats or compressed containers.
- TypeScript:
  - Maintain strict typing throughout the codebase. Avoid `any` except when required by third party library boundaries.
- Architecture Boundaries:
  - Do not import Node.js built in modules (`fs`, `child_process`, `path`) directly in the renderer process. All system operations must go through the IPC layer defined in `src/preload/index.ts` and `src/main/index.ts`.
  - Shared models, write utilities, and formatters belong in `src/shared/`.
- UI and Styling:
  - Styling is handled in `src/renderer/src/index.css` using CSS custom properties. Avoid inline style objects except for dynamic layout values like progress percentages.
  - Avatars, badge containers, and step icon boxes must have transparent backgrounds.
  - Do not embed inline `<svg>` blocks inside component TSX files. Place vector assets in `src/renderer/src/assets/icons/` and export them through `src/renderer/src/components/icons.tsx`.
  - Maintain consistent icon sizing (14px, 18px, 22px, 28px, 44px).
- Code Comments:
  - Write concise, purposeful comments that explain the rationale behind non obvious operations, hardware quirks, or platform workarounds.
  - Avoid redundant comments that merely restate what the code does.
- Commits:
  - Follow the conventional commit format: `<type>(<scope>): <summary>` (for example, `feat(writer): add sector alignment check`).
  - Use imperative mood ("Add", "Fix", "Refactor").
  - Keep each commit focused on one logical change.

## Testing Guidelines

Because Flasher writes directly to raw block devices, testing requires caution.

### Safe Hardware Testing

1. Use dedicated, expendable USB flash drives for end to end testing.
2. Never test against drives containing irreplaceable personal data.
3. Keep backup copies of test images (such as lightweight Alpine Linux or Debian raw disk images).

### Testing Without Physical USB Hardware (Linux Loop Devices)

You can create a dummy loop block device on Linux to safely test the writer pipeline, surface scanner, and verification logic without risking physical hardware:

```bash
# 1. Create a 1GB sparse test image file
truncate -s 1G /tmp/virtual-usb.img

# 2. Attach it as a loop block device
sudo losetup -fP /tmp/virtual-usb.img

# 3. View the allocated loop device name (such as /dev/loop0)
losetup -a

# 4. When finished testing, detach the loop device
sudo losetup -d /dev/loop0
rm /tmp/virtual-usb.img
```

## Submitting a Pull Request

Before opening a pull request, run the build to verify TypeScript compilation:

```bash
npm run build
```

Verify that:
1. The project builds without TypeScript errors or warnings.
2. The Electron main process starts and packages cleanly.
3. No personal paths, credentials, or test artifacts are committed.
4. Documentation is updated if user facing behavior or configurations changed.

### Pull Request Description

When opening your pull request:
- Provide a clear summary of what changed and why.
- Reference any related issue numbers (e.g., `Closes #42`).
- Include steps to reproduce or test the change.
- Note which platforms (Linux distribution, Windows, macOS) were tested.

## Reporting Bugs

If you discover a bug, please file an issue on GitHub with:
- Operating system version (e.g., Ubuntu 24.04 LTS, Fedora 40, Arch Linux).
- Desktop environment (GNOME, KDE Plasma, XFCE, Sway, etc.).
- Target drive model and capacity.
- Image format and approximate size.
- Exact error messages from the application or terminal output.

## Feature Requests

Feature ideas are welcome. Please open a feature request issue describing:
- The problem you want to solve.
- Your proposed solution or user workflow.
- Any alternative approaches considered.
