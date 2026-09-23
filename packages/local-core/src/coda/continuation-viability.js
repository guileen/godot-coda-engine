import { validateContinuationContract } from "./embodied-contract-validation.js";

const RESUME_ORDER = ["exact_phase", "compatible_phase", "checkpoint", "replan_remaining"];
const EVIDENCE_LEVELS = new Set(["exact", "conservative", "reduced", "sampled", "heuristic"]);
const REQUIRED_GATES = ["model_valid", "contact_valid", "inputs_bounded", "controller_valid", "capture_region", "bridge_residual_ok", "deadline_ok"];

/**
 * Deterministic, fail-closed admission for a continuation proposal.
 * This checks supplied profile predicates; it is not a dynamics solver or certificate.
 */
export function evaluateContinuationViability(contract, context) {
  const diagnostics = [];
  const reject = (code) => diagnostics.push({ code });
  if (!validateContinuationContract(contract).ok) reject("INVALID_CONTINUATION_CONTRACT");
  if (!context || typeof context !== "object") reject("CONTINUATION_CONTEXT_REQUIRED");
  if (diagnostics.length) return result("reject", null, "heuristic", diagnostics);

  const { token, interruption, current, gates, candidates, evidence_level: evidenceLevel } = context;
  if (!token || !interruption || !current) reject("CONTINUATION_IDENTITY_REQUIRED");
  if (!EVIDENCE_LEVELS.has(evidenceLevel)) reject("CONTINUATION_EVIDENCE_LEVEL_INVALID");
  if (token && interruption && token.state_digest !== interruption.state_digest) reject("CONTINUATION_TOKEN_STATE_MISMATCH");
  if (token && current && token.skill_ref !== current.skill_ref) reject("CONTINUATION_SKILL_MISMATCH");
  if (token && current && (!Number.isInteger(token.generation) || !Number.isInteger(current.generation) || current.generation <= token.generation)) reject("CONTINUATION_GENERATION_NOT_ADVANCED");
  if (token && current && token.lease_id === current.lease_id) reject("CONTINUATION_OLD_LEASE_REUSED");
  if (token && current && token.controller_revision !== current.controller_revision) reject("CONTINUATION_CONTROLLER_REVISION_CHANGED");
  if (token && current && token.constraint_revision !== current.constraint_revision) reject("CONTINUATION_CONSTRAINT_REVISION_CHANGED");
  if (!gates || REQUIRED_GATES.some((key) => gates[key] !== true)) reject("CONTINUATION_VIABILITY_GATE_FAILED");
  if (!Array.isArray(candidates)) reject("CONTINUATION_CANDIDATES_REQUIRED");
  if (diagnostics.length) return result("reject", null, evidenceLevel, diagnostics);

  const allowed = new Set(contract.resume_modes);
  const byMode = new Map(candidates.map((candidate) => [candidate?.mode, candidate]));
  for (const mode of RESUME_ORDER) {
    if (!allowed.has(mode)) continue;
    const candidate = byMode.get(mode);
    if (!candidate || candidate.admitted !== true) continue;
    if (mode === "exact_phase" && (token.phase_id !== current.phase_id || token.progress !== current.progress)) continue;
    if (mode === "compatible_phase" && (!Array.isArray(candidate.compatible_phase_refs) || !candidate.compatible_phase_refs.includes(current.phase_id))) continue;
    if (mode === "checkpoint" && (!contract.checkpoint_refs.includes(candidate.checkpoint_ref) || candidate.checkpoint_complete !== true)) continue;
    if (mode === "replan_remaining" && candidate.remaining_task_set_ref !== contract.contract_id) continue;
    if (typeof candidate.bridge_ref !== "string" || !/^[-\w.]+@\d+$/.test(candidate.bridge_ref)) continue;
    return result("admitted", mode, evidenceLevel, []);
  }
  reject("CONTINUATION_NO_VIABLE_CANDIDATE");
  return result("reject", null, evidenceLevel, diagnostics);
}

function result(status, resumeMode, evidenceLevel, diagnostics) {
  return { status, resume_mode: resumeMode, evidence_level: EVIDENCE_LEVELS.has(evidenceLevel) ? evidenceLevel : "heuristic", claims_dynamics_certificate: false, diagnostics };
}
