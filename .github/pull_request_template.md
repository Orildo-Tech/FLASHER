## Description

Briefly describe what this pull request changes and why.

## Related Issue

Fixes #(issue number) or Closes #(issue number)

## Type of Change

- [ ] Bug fix (non breaking change resolving an issue)
- [ ] New feature (non breaking change adding functionality)
- [ ] Breaking change (fix or feature modifying existing behavior or IPC contracts)
- [ ] Documentation update (improving guides, README, or code documentation)
- [ ] Code maintenance (refactoring, dependency updates, performance tuning)

## How Has This Been Tested?

Describe the tests conducted to verify your changes.

- [ ] Physical USB drive test (Drive Model: _______________, Size: _____)
- [ ] Virtual loop block device (`losetup`) test
- [ ] UI layout and navigation test
- [ ] Build verification (`npm run build`)

Operating System & Environment:
- Distribution / OS:
- Desktop Environment / Display Server (e.g. GNOME Wayland, KDE X11):

## Contributor Checklist

- [ ] My code adheres to the project's coding standards.
- [ ] I have not imported Node.js built in modules (`fs`, `child_process`) in the renderer process.
- [ ] Any new icons are SVG files in `src/renderer/src/assets/icons/` and exposed via `icons.tsx`.
- [ ] All avatar and icon containers have transparent backgrounds.
- [ ] My code compiles without TypeScript errors (`npm run build`).
- [ ] I have updated relevant documentation where appropriate.
- [ ] My commit messages and PR description contain no emojis and use clear, active voice.
