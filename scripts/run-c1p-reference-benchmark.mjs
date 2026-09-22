import { runAnytimeReference, runHybridReference, runReferenceCascade, referenceBenchmarkFingerprint } from "../packages/local-core/src/index.js";

const options = {
  initial: { position: 0, velocity: 0 },
  target: 1,
  target_tolerance: 0.45,
  horizon_ticks: 60,
  limits: { position: [-2, 2], velocity: [-4, 4] },
  deadline_reserve_ms: 2,
  required_reserve_ms: 1
};

const report = {
  report_type: "C1PReferenceBenchmark",
  schema_version: 1,
  status: "PASS_SCOPED_REFERENCE_ONLY",
  options,
  cascade: runReferenceCascade(options).value,
  anytime: runAnytimeReference({ ...options, budgets: [8, 200, 4000] }),
  hybrid_reference: runHybridReference({ target: 1, horizon_ticks: 30, limits: [-0.2, 0.2], disturbance_envelope: 0.1, jumps: { 8: 0.05, 16: -0.04 }, switches: [12] }).value,
  verified_hybrid_invariants: [
    "tagged external jump is admitted only inside the declared disturbance envelope",
    "one-sided joint limit produces an explicit contact receipt and clamps state",
    "finite/field switch requires source/target domain, state safety and input intersection",
    "hybrid reference remains candidate_only and does not write an Adapter"
  ],
  non_claims: ["target-device wall calibration pending", "not contact/friction or hardware evidence"]
};

console.log(JSON.stringify({ ...report, fingerprint: referenceBenchmarkFingerprint(report) }, null, 2));
