# Changelog

## Unreleased

- The GSEOS-to-CODA rename is complete. Directories (`addons/coda/`, `contracts/coda/`, `coda/`), schema identifiers (`CODA_CapabilityManifest`, contract `$id` and titles), environment variables, diagnostic codes and generated markers now use CODA only.
- The retired compatibility entries are gone: `packages/local-core/src/gseos/`, `gseos-cli.js`, the `npm run gseos` script, the `scripts/gseos-*` launchers, and legacy `GSEOS_*` environment variables were removed rather than kept as aliases.
- Generated GDScript is written with the CODA marker. The editor and verifier still recognize legacy GSEOS markers on read for existing generated files; those files are not rewritten in bulk and are only replaced when regenerated.
- Evidence reports, docs, website copy and the asset register were updated to the CODA paths; historical release notes keep the name that was in use at the time.
- Prepared the repository for the CODA public GitHub publication flow.
- Added localized public documentation and a bilingual GitHub Pages site.
- Added contribution, security, conduct, issue, and pull-request guidance.

## 0.1.0 — implementation baseline

- Delivered the first CODA E0 structured-event pipeline (then branded GSEOS), runtime boundary, Godot editor surface, reward fixture, deterministic tests, headless integration, and runtime export audit.
- This entry records the implementation baseline; it is not a license grant or a public release announcement.
