# Quick start

Want an intuitive first look at CODA syntax rather than an environment check? Start with [Meet CODA in 5 minutes](5-minutes-coda.md). This page is for developers ready to open the current repository and run Godot checks.

This guide runs the checked-in reward event from a clean checkout. It assumes Node.js 20+ and Godot 4.7.2 are available on `PATH`.

## 1. Install the repository

No third-party runtime package installation is required for the current workspace. Clone the repository and enter it:

```sh
git clone https://github.com/guileen/godot-coda-engine.git
cd godot-coda-engine
```

## 2. Validate the event asset

The fixture is a structured `EventAsset`, not a text script:

```sh
npm test
npm run gseos -- validate gseos/events/ui.reward.apply.gse.json
```

The validator should report `ok: true` with no diagnostics.

## 3. Generate the runner

```sh
npm run gseos -- generate gseos/events/ui.reward.apply.gse.json
```

This produces a generated GDScript runner and a JSON source map under `.gseos/generated/`. The generated header contains the plan fingerprint; the source map maps event nodes and fields to generated lines.

## 4. Open the project in Godot

```sh
godot --editor --path .
```

Enable the `CODA Event Editor` plugin if it is not already enabled. The event dock reads assets from `gseos/events/` and rebuilds its preview from the structured asset.

## 5. Run the checks

For a headless editor smoke check:

```sh
godot --headless --path . --editor --quit
```

For the full local suite:

```sh
npm run test:all
```

The full suite includes the offline core tests, Godot headless integration, generated-runner checks, cancellation/owner competition, and the runtime export-pack audit.

## If a check fails

Keep the original diagnostic and source path. Do not repair a generated file by hand. Re-run generation from the source asset, then inspect [scope and troubleshooting](scope-and-troubleshooting.md) for the relevant boundary.
