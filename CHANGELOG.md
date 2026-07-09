# Changelog

## 2026-07-09

### Features
- Added **offline route navigation** with spoken off-route alerts while running.
- Added **altitude correction** and the ability to **merge GPX routes with FIT heart-rate data**.
- Added full **backup and restore** so users can export and import their local data safely.
- Added an offline **Virtual Partner (Ghost Runner)** to pace against goals or previous workouts.
- Added **Bluetooth heart-rate monitor support** for compatible watches and chest straps.
- Added a **fullscreen training mode** with large metrics and screen wake lock during recording.
- Added **personal achievements** and **equipment analytics** to track progress and gear usage.
- Added an **advanced statistics dashboard** with richer charts and historical insights.
- Added an **onboarding wizard** for first-time setup.
- Added **multilingual support** for Brazilian Portuguese and English.
- Added automatic **Personal Records (PRs)** tracking.

### Bug Fixes
- Improved BLE integration by moving workout recording to a native-compatible `BleClient`, improving Android reliability.

### Chores
- Updated README and roadmap documentation to reflect delivered features.
- Added and refined project build rules/documentation.
- Improved app performance in GPS calculations, database read loops, map rendering, and pagination responsiveness.
- Updated onboarding/profile regional flag assets for localization consistency.

### Breaking Changes
- None.
