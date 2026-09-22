# C1 Owner Input Packet

This file is the smallest external input packet needed to move the remaining C1 gates. It does not grant runtime or hardware authority by itself; each response must be recorded in a versioned fixture/review and re-run through the listed evidence command.

| Gate | Required owner/external input | Evidence after input | If not supplied |
| --- | --- | --- | --- |
| `G-C1-L` | Approve the concrete Text-Owned migration scope, select a feasible cross-embodiment task and two target device profiles, and define shared postconditions/safety invariants before viewing results. | Freeze `AuthoringOwnership@1`, the typed embodied contracts, both protocol families, `ContinuationContract@1`, `EmbodimentDynamicsProfile@1`, `TemporalCommandContract@1`, `AuthorityClaimMatrix@1`, `TaskActivationContract@1`, `ModelValidityEnvelope@1`, `StateAlignmentContract@1` and `HandoffContract@1`; add migration/conflict, viability/re-entry, online model drift, multi-clock/epoch, dynamic task-set and physical handoff fixtures; rerun `C1-T.0.6`. | Keep the current `MotionIntent` as a minimum compiler slice; do not claim the full embodied language, natural resumption, dynamics-safe re-entry, passivity-preserving handoff or cross-device portability. |
| `G-C1-T-A` | Approve GDBot prototype asset/license, controlled semantic poses, external-writer/AnimationTree/root-motion rejection, trusted deterministic hooks, and the first-response/duration/tolerance/velocity/acceleration/contact-drift thresholds. | Update `gseos/fixtures/c1t/skeleton-gdbot-draft.json` and `tests/reports/c1t-design-review.json`; run `npm test && npm run check`. | Keep C1-T runtime on `HOLD`; reference slices remain non-authoritative. |
| `G-C1-T-C` | Approve the threshold profile and authorize a Godot observation run on the selected fixture. | Run `npm run demo:acceptance`; attach the corresponding `RuntimeObservation` and decision correlation. | D3 remains a scoped smoke, not a closed Godot gate. |
| `G-C1-T-N` | Provide a pre-registered blind perception protocol, participant pool, baseline, randomization and acceptance threshold. | Add the protocol/results under `tests/reports/`; preserve negative results; do not infer naturalness from hashes or smoke tests. | Do not claim “more natural”. |
| `G-C1-P-B` | Select target device/profile and provide p95/p99 wall time, memory ceiling, contact model and deadline reserve. | Run `npm run benchmark:c1p:reference` plus the authorized device benchmark; version the profile and receipt. | Keep budget frontier `partial`; no runtime downgrade is allowed. |
| `G-C1-P-D` | Provide an authorized latent dataset/model and Skeleton/contact error envelope. | Add the model/profile and OOD, metric, decoded-constraint and contact-error report. | Keep latent path shadow-only. |
| `G-C1-P-E` | Select an authorized profile and define the observable value baseline/threshold. | Add the same-hard-gate Pareto comparison and stable selection report. | Do not claim product-level hybrid value. |
| `G-P3-U` | Recruit at least three users not involved in implementation; at least two must complete the full task without maintainer hints. | Use `npm run validate:p3-users -- <report.json>` with de-identified observations. | Keep P4 and `G-P3-U` on `HOLD`. |

## Current local evidence

- `npm run audit:tasks` verifies the task index, local links, six Demo reports, six replay fixtures and visual hash distinction.
- `npm run demo:acceptance` verifies the current D2/D3 Godot smoke path.
- `npm test` and `npm run check` verify the offline reference slices.

None of these commands supplies the missing owner decision, perception sample, target-device calibration, latent model, hardware evidence or external-user observation.
