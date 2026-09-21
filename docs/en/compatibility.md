# Compatibility

## Tested environment

The checked-in evidence was produced with:

- Node.js 22.16.0 for the recorded offline run; the package declares Node.js 20+.
- Godot 4.7.2 stable for headless, editor, and export checks.
- macOS host-native launch evidence and Linux/X11 runtime-pack export configuration.

The CI workflow runs the deterministic Node.js checks on Ubuntu with Node.js 20. Godot integration is kept as a local or platform-specific check because the repository's current evidence depends on the Godot editor/runtime and native GUI environment.

## Compatibility policy

Changes to EventAsset, capability, topic, or runtime contracts must use explicit versions and migration behavior. A compatible-looking display-name change must not change a machine ID. Changes that affect generated output must preserve or intentionally update the source-map and fingerprint evidence.

## Godot naming

CODA is an independent project that works with Godot. It does not claim endorsement by the Godot Foundation and does not use the Godot logo as project branding. Refer to Godot as the engine compatibility target, using its official capitalization.
