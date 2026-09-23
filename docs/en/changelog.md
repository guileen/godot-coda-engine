# Changelog

## Unreleased

- New generated GDScript uses the CODA marker. The editor and verifier still recognize legacy GSEOS markers; existing projects are not rewritten in bulk and switch markers only when regenerated.
- New crash-recovery test runs use CODA-prefixed environment variables. Legacy GSEOS-prefixed variables remain supported and are covered by the recovery test.
- The CODA CLI now uses a CODA-named entry point. The old GSEOS CLI file path and `npm run gseos` remain as compatibility entry points.
- The local-core implementation now lives under a CODA-named directory. Legacy `src/gseos/` module paths forward to the same API.
- Prepared the repository for the CODA public GitHub publication flow.
- Added localized public documentation and a bilingual GitHub Pages site.
- Added contribution, security, conduct, issue, and pull-request guidance.

## 0.1.0 — implementation baseline

- Delivered the first CODA E0 structured-event pipeline (then branded GSEOS), runtime boundary, Godot editor surface, reward fixture, deterministic tests, headless integration, and runtime export audit.
- This entry records the implementation baseline; it is not a license grant or a public release announcement.
