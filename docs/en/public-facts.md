# Public facts and evidence

Public pages describe only behavior that can be traced to a checked-in fixture, source location, or repeatable command. This page is the compact evidence map for the current E0 release candidate.

## Claim-to-evidence map

| Public claim | Evidence | Reproduce it with |
| --- | --- | --- |
| CODA stores a versioned `EventAsset@1` with stable IDs and preserves unknown fields. | `packages/local-core/src/gseos/asset.js`, `contracts/gseos/event-asset.schema.json`, and the asset tests. | `npm test` |
| The generation path is `EventAsset → ExecutionPlan → GDScript`, with source maps and deterministic output. | `packages/local-core/src/gseos/planner.js`, `packages/local-core/src/gseos/codegen.js`, `tests/golden/ui.reward.apply.source-map.json`, and the checked-in reward fixture. | `npm run coda -- validate gseos/events/ui.reward.apply.gse.json` then `npm run coda -- generate gseos/events/ui.reward.apply.gse.json` |
| The E0 runtime makes waits, cancellation, timeout, owner invalidation, and late callbacks explicit. | `addons/gseos/runtime/`, especially `wait_registration.gd`, `run_handle.gd`, and `event_registry.gd`; the competition integration covers the terminal-state rules. | `npm run test:godot` |
| English, Chinese, and mixed-language import surfaces normalize to the same structured model. | `packages/local-core/src/gseos/frontend.js` and the bilingual frontend tests. | `npm test` |
| The editor surface supports asset transactions and source-map lookup. | `addons/gseos/editor/event_dock.gd`, `tests/integration/event_dock_smoke.gd`, and `tests/reports/t2-editor-smoke.json`. | `npm run test:godot:gui` |
| The exported runtime excludes the editor, frontend, legacy dictionary, and EventAsset interpretation layers. | `export_presets.cfg`, `scripts/gseos-pack-audit.js`, and `tests/reports/t2-export-audit.json`. | `npm run export:pack` |
| The bilingual static site has responsive, keyboard, reduced-motion, and no-tracking checks. | `website/`, `i18n/`, and `tests/reports/t2-pages-visual-qa.json`. | Run the visual-QA command recorded in that report against a local Pages preview. |

## Evidence boundaries

The recorded performance values describe the exact Godot version, platform, event shape, and measurement method in [`tests/reports/t2-performance.json`](../../tests/reports/t2-performance.json). They are not universal performance guarantees. The project does not claim complete runtime coverage, zero overhead, or support for features listed as out of scope in the [scope guide](scope-and-troubleshooting.md).

The full project name is Godot CODA Engine and CODA is the short name. Godot is the host engine; the project does not claim endorsement by the Godot Foundation. See [`TRADEMARKS.md`](../../TRADEMARKS.md) for the separate brand policy.

After the first commit, [`npm run verify:clean-clone`](../../scripts/verify-clean-clone.mjs) provides the clean-checkout verification required by the publication checklist.
