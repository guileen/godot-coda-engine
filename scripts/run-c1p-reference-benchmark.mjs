import os from "node:os";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { runAnytimeReference, runHybridReference, runReferenceCascade, referenceBenchmarkFingerprint } from "../packages/local-core/src/index.js";

const warmup_iterations = 30;
const sample_iterations = 500;

function percentile(samples, p) {
  const ordered = [...samples].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(p * ordered.length) - 1)];
}

function measure(name, operation, isValid) {
  for (let i = 0; i < warmup_iterations; i++) {
    if (!isValid(operation())) throw new Error(`benchmark warmup failed: ${name}`);
  }
  const memory_before = process.memoryUsage();
  let peak_heap_used = memory_before.heapUsed;
  let peak_rss = memory_before.rss;
  const samples = [];
  for (let i = 0; i < sample_iterations; i++) {
    const started = performance.now();
    const output = operation();
    samples.push(performance.now() - started);
    if (!isValid(output)) throw new Error(`benchmark sample failed: ${name}`);
    const memory = process.memoryUsage();
    peak_heap_used = Math.max(peak_heap_used, memory.heapUsed);
    peak_rss = Math.max(peak_rss, memory.rss);
  }
  const memory_after = process.memoryUsage();
  return {
    name,
    sample_count: samples.length,
    wall_ms: {
      p50: percentile(samples, 0.50),
      p95: percentile(samples, 0.95),
      p99: percentile(samples, 0.99),
      max: Math.max(...samples),
    },
    memory_bytes: {
      heap_used_before_samples: memory_before.heapUsed,
      peak_heap_used_during_samples: peak_heap_used,
      heap_used_after_samples: memory_after.heapUsed,
      rss_before_samples: memory_before.rss,
      peak_rss_during_samples: peak_rss,
      rss_after_samples: memory_after.rss,
    },
  };
}

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
  status: "PASS_REFERENCE_HOST_PROFILE_MEASURED",
  implementation: "packages/local-core/src/gseos/physics-reference.js",
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

const wall_memory_observations = [
  measure("reference_cascade", () => runReferenceCascade(options), (value) => value.ok),
  measure("anytime_reference", () => runAnytimeReference({ ...options, budgets: [8, 200, 4000] }), (value) => Array.isArray(value) && value.length === 3),
  measure("hybrid_reference", () => runHybridReference({ target: 1, horizon_ticks: 30, limits: [-0.2, 0.2], disturbance_envelope: 0.1, jumps: { 8: 0.05, 16: -0.04 }, switches: [12] }), (value) => value.ok),
];
const cpu = os.cpus()[0];
const decision_fingerprint = `sha256:${createHash("sha256").update(referenceBenchmarkFingerprint(report)).digest("hex")}`;
const output = {
  ...report,
  execution_profile: {
    profile_id: "node-reference-current-host@1",
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu_model: cpu?.model ?? "unknown",
    logical_cpu_count: os.cpus().length,
    total_memory_bytes: os.totalmem(),
    warmup_iterations,
    sample_iterations,
  },
  wall_memory_observations,
  decision_fingerprint,
  observation_non_claims: ["wall percentiles and process memory are host-run observations, not deterministic replay evidence", "host measurements do not certify Godot or any target device profile"],
};
const serialized = JSON.stringify(output, null, 2) + "\n";
if (process.argv.includes("--write")) {
  await writeFile(new URL("../tests/reports/c1p-reference-benchmark.json", import.meta.url), serialized, "utf8");
  process.stdout.write(JSON.stringify({ report_type: output.report_type, status: output.status, report_path: "tests/reports/c1p-reference-benchmark.json", execution_profile: output.execution_profile, wall_memory_observations: output.wall_memory_observations, decision_fingerprint: output.decision_fingerprint }, null, 2) + "\n");
} else process.stdout.write(serialized);
