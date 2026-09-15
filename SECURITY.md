# Security Policy

## Supported Versions

We provide security patches for the following versions of Flasher:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | Yes                |

## Reporting a Vulnerability

The Flasher project takes security vulnerabilities seriously. Because this software interacts directly with raw hardware block devices and system privilege escalation utilities, maintaining safe boundaries is critical.

If you discover a security vulnerability in Flasher, please do not report it through a public GitHub issue.

Instead, please send an encrypted or private email to:
`security.flasher@orildo.sbs`

Please include:
1. A description of the vulnerability and its potential impact.
2. Step by step instructions or proof of concept code to reproduce the issue.
3. Affected operating system distributions and desktop environments.
4. Any suggested mitigations or patches.

You should receive an acknowledgment within 48 hours. We will coordinate a disclosure timeline once the vulnerability is verified and a patch is prepared.

## Threat Model and Defensive Design

Flasher operates under a strict principle of least privilege:

1. Unprivileged User Interface:
   The main Electron process and Chromium browser window run strictly as an unprivileged user process. Even if malicious web content were injected into the UI, it would have no direct access to root capabilities or physical block devices.

2. Isolated Helper Execution:
   Raw disk writes are delegated to `elevated-helper.js`. This script is launched on demand via `pkexec` and runs only for the duration of the write and verify phases. Once the write completes, the helper process exits immediately.

3. Parameter Validation:
   The elevated helper receives a structured JSON payload over a private temporary file rather than unstructured shell arguments. It verifies the source image path and destination block device before opening write handles.

4. System Disk Protection:
   Drive enumeration flags drives containing active system partitions (e.g. `/`, `/boot`, `/home`). The UI prevents accidental flashing of system drives by requiring explicit, multi stage confirmation for non removable devices.
