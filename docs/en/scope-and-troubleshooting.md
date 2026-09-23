# Scope and troubleshooting

## Current scope

The E0 release covers sequence, `if`, local bindings and explicit outputs, constrained `while/each`, synchronous `do`, managed `await`, `call`, `publish`, and constrained `escape`. The reward UI fixture exercises the main end-to-end path.

The release does not cover `spawn/join`, `try/catch/finally`, E1/E2, cross-scene independent runs, background Godot object access, hot-reload recovery, LSP or a long-lived CODA text editor inside Godot, or arbitrary Godot reflection.

## Generated output was rejected

The generator is designed to stop when a managed artifact no longer matches its source fingerprint. Delete only the generated artifact that is inside the tool-owned generated directory, then regenerate from the EventAsset:

```sh
npm run coda -- generate coda/events/ui.reward.apply.gse.json
```

Do not edit generated GDScript to fix the source. If the behavior cannot be represented by the structured backend, use a declared `escape` node or ordinary GDScript outside the generated runner.

## Validation reports a source path

Treat the diagnostic path as part of the contract. It should identify as much of the `event_id → node_id → field → target/version → backend` route as the failure makes available. Fix the EventAsset or contract, then validate again.

## A run settles unexpectedly

Inspect the capability contract and the owner lifecycle. E0 waits can settle on completion, failure, cancellation, timeout, or owner invalidation. A callback arriving after settlement is intentionally ignored. This is a safety property, not a retry mechanism.

## The editor does not show an event

Check that the file is a `.gse.json` asset under `coda/events/`, that the EventAsset validates, and that the `CODA Event Editor` plugin is enabled. The dock rebuilds from the asset; its summary text is not a parseable source.

## Need behavior outside E0

Keep the change out of the current runtime boundary until it has a versioned contract, a minimal counterexample, a source mapping, and a competition/cleanup test where applicable. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
