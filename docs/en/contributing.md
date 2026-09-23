# Contributing to CODA

CODA is a structured event authoring and generation layer for Godot. Contributions should preserve the boundary between the structured asset, the generated runner, and the small E0 runtime.

## Before opening a pull request

Run the checks that match your change:

```sh
npm test
npm run check
npm run coda -- validate coda/events/ui.reward.apply.gse.json
npm run coda -- generate coda/events/ui.reward.apply.gse.json
godot --headless --path . --editor --quit
```

For Godot integration, runtime, generated output, or export changes, also run `npm run test:godot` and `npm run export:pack`.

## Design rules

- Add behavior as a versioned schema, capability, or topic contract before wiring it through the asset, planner, generator, and adapter.
- Use stable machine IDs across boundaries. Display names and aliases are not ABI identifiers.
- Keep `EventAsset` as the semantic source of truth. Generated GDScript is a managed artifact, not a parallel authoring format.
- Do not add runtime parsing of Chinese/English text or EventAssets.
- Do not add arbitrary Godot reflection. Unsupported logic belongs in ordinary GDScript or a declared `escape` node with explicit inputs and outputs.
- Preserve source maps and diagnostics when changing lowering or code generation.

`.coda/generated/` and `coda/generated/` are tool-owned. Do not edit or commit them. Keep pull requests focused and explain changes to the E0 boundary, cancellation semantics, ownership, or generated artifact format.

Software contributions are released under MIT; documentation contributions are released under CC BY 4.0. The recommended `Made with CODA` badge is governed by [`TRADEMARKS.md`](../../TRADEMARKS.md) and is not a condition of using the software.
