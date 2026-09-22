import { stableStringify } from "./asset.js";
import { TransitionRun } from "./hooks.js";
import { TransitionLeaseArbiter, buildTransitionPlan, validateTransitionSnapshot } from "./transition.js";

const reject = (caseId, code, details = {}) => ({
  case_id: caseId,
  outcome: "reject",
  failure_code: code,
  ...details
});

/**
 * Offline C1-T semantic harness. It produces DecisionRecord-like data only;
 * no Adapter, Godot node, or external writer is touched.
 */
export function evaluateTransitionCase(input) {
  const caseId = String(input?.case_id ?? "case.unknown");
  const request = input?.request ?? {};
  const arbiter = new TransitionLeaseArbiter(input?.registry ?? { resources: [] });
  const leaseResult = arbiter.request({
    lease_id: request.lease_id,
    owner_id: request.owner_id,
    resources: request.resources,
    priority: request.priority,
    sequence: request.sequence ?? 0
  });
  if (!leaseResult.ok) return reject(caseId, leaseResult.diagnostics[0]?.code ?? "LEASE_REJECTED", { diagnostics: leaseResult.diagnostics });
  const snapshotResult = validateTransitionSnapshot(input.snapshot, input.snapshot_binding);
  if (!snapshotResult.ok) return reject(caseId, snapshotResult.diagnostics[0]?.code ?? "INVALID_SNAPSHOT", { diagnostics: snapshotResult.diagnostics });
  const planResult = buildTransitionPlan({
    ...(input.plan ?? {}),
    lease: leaseResult.value.lease,
    snapshot: input.snapshot,
    snapshot_binding: input.snapshot_binding,
    resources: leaseResult.value.lease.resources
  });
  if (!planResult.ok) return reject(caseId, planResult.diagnostics[0]?.code ?? "INVALID_PLAN", { diagnostics: planResult.diagnostics });
  if (input.adapter_ownership === "external_owned") return reject(caseId, "EXTERNAL_WRITER_ACTIVE", { partial_write: false, ownership: "external_owned", plan_id: planResult.value.plan_id });
  const run = new TransitionRun();
  run.start();
  run.finish("completed", { plan_id: planResult.value.plan_id });
  return {
    case_id: caseId,
    outcome: "execute",
    plan_id: planResult.value.plan_id,
    lease_id: leaseResult.value.lease.lease_id,
    generation: leaseResult.value.lease.generation,
    preempted: leaseResult.value.preempted,
    execution_authority: "adapter_only",
    terminal: run.terminal
  };
}

export function replayTransitionCase(input, repetitions = 2) {
  const records = Array.from({ length: repetitions }, () => evaluateTransitionCase(structuredClone(input)));
  const fingerprints = records.map((record) => stableStringify(record));
  return {
    records,
    deterministic: fingerprints.every((fingerprint) => fingerprint === fingerprints[0]),
    fingerprint: fingerprints[0]
  };
}

export function runTransitionMatrix(cases) {
  return (Array.isArray(cases) ? cases : []).map((input) => replayTransitionCase(input));
}
