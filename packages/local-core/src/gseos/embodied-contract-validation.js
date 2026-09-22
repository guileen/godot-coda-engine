import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";

const versionedRef = /^[-\w.]+@\d+$/u;
const push = (items, code, message, path) => items.push(gseosDiagnostic(code, message, { path }));
const headerOk = (value, type) => value && typeof value === "object" && value.contract_type === type && value.schema_version === 1;

export function validateObservationContract(contract, { known_guard_refs = [] } = {}) {
  const diagnostics = [];
  if (!headerOk(contract, "ObservationContract")) return gseosReceipt([gseosDiagnostic("INVALID_OBSERVATION_CONTRACT", "ObservationContract 类型或版本无效。")]);
  if (!Array.isArray(contract.observations) || contract.observations.length === 0) push(diagnostics, "OBSERVATION_CONTRACT_EMPTY", "至少声明一个 observation。", "/observations");
  const refs = new Set();
  for (const [index, observation] of (contract.observations ?? []).entries()) {
    if (!observation || typeof observation.observation_ref !== "string" || !versionedRef.test(observation.observation_ref)) push(diagnostics, "INVALID_OBSERVATION_REF", "observation_ref 必须是版本化引用。", "/observations/" + index + "/observation_ref");
    else if (refs.has(observation.observation_ref)) push(diagnostics, "DUPLICATE_OBSERVATION_REF", "ObservationContract 内 observation_ref 必须唯一。", "/observations/" + index + "/observation_ref");
    else refs.add(observation.observation_ref);
    for (const key of ["unit_ref", "reference_frame_ref", "freshness_ref"]) if (!versionedRef.test(String(observation?.[key] ?? ""))) push(diagnostics, "INVALID_OBSERVATION_BINDING", key + " 必须是版本化引用。", "/observations/" + index + "/" + key);
  }
  if (!["reject", "yield_safety_authority"].includes(contract.on_unresolved)) push(diagnostics, "OBSERVATION_UNKNOWN_NOT_FAIL_CLOSED", "未解析 observation 必须拒绝或让出独立安全权威。", "/on_unresolved");
  const policy = contract.on_insufficient_information;
  if (!policy || !["reject", "active_observation"].includes(policy.policy)) push(diagnostics, "INVALID_OBSERVATION_DEGRADATION", "信息不足策略必须显式拒绝或申请主动观测。", "/on_insufficient_information/policy");
  if (policy?.policy === "active_observation") {
    for (const key of ["active_observation_ref", "retry_budget_ref", "admission_guard_ref"]) if (!versionedRef.test(String(policy[key] ?? ""))) push(diagnostics, "INVALID_ACTIVE_OBSERVATION_BINDING", key + " 必须是版本化引用。", "/on_insufficient_information/" + key);
    if (known_guard_refs.length && !known_guard_refs.includes(policy.admission_guard_ref)) push(diagnostics, "OBSERVATION_GUARD_UNBOUND", "主动观测准入 Guard 未绑定。", "/on_insufficient_information/admission_guard_ref");
  }
  return gseosReceipt(diagnostics);
}

export function validateHybridModeGraph(graph, { known_guard_refs = [] } = {}) {
  const diagnostics = [];
  if (!headerOk(graph, "HybridModeGraph")) return gseosReceipt([gseosDiagnostic("INVALID_HYBRID_MODE_GRAPH", "HybridModeGraph 类型或版本无效。")]);
  if (graph.unknown_input_policy !== "reject_or_yield_safety") push(diagnostics, "HYBRID_UNKNOWN_NOT_FAIL_CLOSED", "未知 guard/input 必须拒绝或让出安全权威。", "/unknown_input_policy");
  const modes = new Map();
  for (const [index, mode] of (graph.modes ?? []).entries()) {
    if (!mode || typeof mode.mode_id !== "string" || !mode.mode_id) { push(diagnostics, "INVALID_HYBRID_MODE", "mode_id 必须非空。", "/modes/" + index); continue; }
    if (modes.has(mode.mode_id)) push(diagnostics, "DUPLICATE_HYBRID_MODE", "mode_id 必须唯一。", "/modes/" + index + "/mode_id");
    modes.set(mode.mode_id, mode);
  }
  if (!modes.has(graph.initial_mode)) push(diagnostics, "HYBRID_INITIAL_MODE_MISSING", "initial_mode 必须引用已声明模式。", "/initial_mode");
  const transitions = new Set();
  for (const [index, transition] of (graph.transitions ?? []).entries()) {
    if (!transition || typeof transition.transition_id !== "string" || transitions.has(transition.transition_id)) push(diagnostics, "INVALID_HYBRID_TRANSITION_ID", "transition_id 必须非空且唯一。", "/transitions/" + index + "/transition_id");
    if (transition?.transition_id) transitions.add(transition.transition_id);
    if (!modes.has(transition?.from_mode) || !modes.has(transition?.to_mode)) push(diagnostics, "HYBRID_TRANSITION_MODE_MISSING", "transition 的源和目标模式都必须存在。", "/transitions/" + index);
    if (!versionedRef.test(String(transition?.guard_ref ?? ""))) push(diagnostics, "INVALID_HYBRID_GUARD_REF", "guard_ref 必须是版本化引用。", "/transitions/" + index + "/guard_ref");
    else if (known_guard_refs.length && !known_guard_refs.includes(transition.guard_ref)) push(diagnostics, "HYBRID_GUARD_UNBOUND", "transition 引用未绑定的 GuardExpression。", "/transitions/" + index + "/guard_ref");
    const expectedCommit = { hard_atomic: "atomic_single_writer", soft_ramp: "profile_approved_ramp", guarded_handoff: "presolve_then_barrier" }[transition?.activation_class];
    if (!expectedCommit || transition.commit_policy !== expectedCommit) push(diagnostics, "HYBRID_ACTIVATION_COMMIT_MISMATCH", "activation class 必须使用对应的提交屏障策略。", "/transitions/" + index + "/commit_policy");
  }
  return gseosReceipt(diagnostics);
}

export function validateTrackingEnvelope(envelope) {
  const diagnostics = [];
  if (!headerOk(envelope, "TrackingEnvelope")) return gseosReceipt([gseosDiagnostic("INVALID_TRACKING_ENVELOPE", "TrackingEnvelope 类型或版本无效。")]);
  if (envelope.supervisor_role !== "monitor_and_pre_authorized_escalation_only") push(diagnostics, "TRACKING_SUPERVISOR_AUTHORITY_ESCALATION", "监督器只能监控并请求预授权升级。", "/supervisor_role");
  if (!["reject", "yield_safety_authority"].includes(envelope.unknown_policy)) push(diagnostics, "TRACKING_UNKNOWN_NOT_FAIL_CLOSED", "未知 tracking predicate 必须拒绝或让出安全权威。", "/unknown_policy");
  const ids = new Set();
  for (const [index, predicate] of (envelope.predicates ?? []).entries()) {
    if (!predicate || !versionedRef.test(String(predicate.predicate_ref ?? "")) || ids.has(predicate.predicate_ref)) push(diagnostics, "INVALID_TRACKING_PREDICATE_REF", "predicate_ref 必须版本化且唯一。", "/predicates/" + index + "/predicate_ref");
    if (predicate?.predicate_ref) ids.add(predicate.predicate_ref);
    if (!versionedRef.test(String(predicate?.observation_ref ?? ""))) push(diagnostics, "INVALID_TRACKING_OBSERVATION_REF", "tracking predicate 必须绑定版本化 observation。", "/predicates/" + index + "/observation_ref");
    if (!["reject", "yield_safety_authority"].includes(predicate?.unknown_value_policy)) push(diagnostics, "TRACKING_PREDICATE_UNKNOWN_NOT_FAIL_CLOSED", "未知 predicate 值不得被当作通过。", "/predicates/" + index + "/unknown_value_policy");
  }
  return gseosReceipt(diagnostics);
}

export function validateControlContract(contract) {
  const diagnostics = [];
  if (!headerOk(contract, "ControlContract")) return gseosReceipt([gseosDiagnostic("INVALID_CONTROL_CONTRACT", "ControlContract 类型或版本无效。")]);
  if (contract.authority !== "controller_single_writer") push(diagnostics, "CONTROL_AUTHORITY_NOT_SINGLE_WRITER", "连续控制输出必须由单一 Controller writer 持有。", "/authority");
  for (const key of ["controller_ref", "control_cycle_ref", "output_reference_ref", "tracking_envelope_ref", "validity_domain_ref"]) if (!versionedRef.test(String(contract[key] ?? ""))) push(diagnostics, "INVALID_CONTROL_BINDING", key + " 必须是版本化引用。", "/" + key);
  for (const key of ["input_observation_refs", "backup_refs", "handoff_refs"]) if (!Array.isArray(contract[key]) || contract[key].some((ref) => !versionedRef.test(String(ref)))) push(diagnostics, "INVALID_CONTROL_REFERENCE_LIST", key + " 必须是版本化引用数组。", "/" + key);
  return gseosReceipt(diagnostics);
}

export function validateContinuationContract(contract) {
  const diagnostics = [];
  if (!headerOk(contract, "ContinuationContract")) return gseosReceipt([gseosDiagnostic("INVALID_CONTINUATION_CONTRACT", "ContinuationContract 类型或版本无效。")]);
  for (const key of ["phase_progress_ref", "capture_region_ref", "viability_gate_ref", "bridge_planner_ref", "commit_alignment_ref"]) if (!versionedRef.test(String(contract[key] ?? ""))) push(diagnostics, "INVALID_CONTINUATION_BINDING", key + " 必须是版本化引用。", "/" + key);
  if (!Array.isArray(contract.resume_modes) || contract.resume_modes.length === 0 || !contract.resume_modes.includes("reject")) push(diagnostics, "CONTINUATION_MISSING_REJECT", "恢复策略必须包含确定的 reject 终态。", "/resume_modes");
  if (!Array.isArray(contract.token_fields) || !contract.token_fields.includes("generation") || !contract.token_fields.includes("state_digest")) push(diagnostics, "CONTINUATION_TOKEN_IDENTITY_MISSING", "ContinuationToken 必须绑定 generation 与当前状态摘要。", "/token_fields");
  if (contract.restore_old_generation !== false) push(diagnostics, "CONTINUATION_REACTIVATES_OLD_GENERATION", "Continuation 不得恢复旧 generation。", "/restore_old_generation");
  if (!["recovery_skill_if_admitted", "replan", "reject", "yield_safety_authority"].includes(contract.on_no_solution)) push(diagnostics, "CONTINUATION_NO_SOLUTION_UNSAFE", "恢复无解时必须进入准入 RecoverySkill、重规划、拒绝或让出安全权威。", "/on_no_solution");
  return gseosReceipt(diagnostics);
}

export function validateTemporalCommandContract(contract) {
  const diagnostics = [];
  if (!headerOk(contract, "TemporalCommandContract")) return gseosReceipt([gseosDiagnostic("INVALID_TEMPORAL_COMMAND_CONTRACT", "TemporalCommandContract 类型或版本无效。")]);
  if (!Array.isArray(contract.clock_domains) || contract.clock_domains.length === 0 || contract.clock_domains.some((ref) => !versionedRef.test(String(ref)))) push(diagnostics, "INVALID_TEMPORAL_CLOCK_DOMAINS", "至少声明一个版本化 clock domain。", "/clock_domains");
  for (const key of ["authority_lease_ref", "observation_freshness_ref", "command_validity_ref", "buffered_horizon_ref", "liveness_ref", "low_watermark_ref", "hysteresis_ref", "deadline_reserve_ref"]) if (!versionedRef.test(String(contract[key] ?? ""))) push(diagnostics, "INVALID_TEMPORAL_BINDING", key + " 必须是版本化引用。", "/" + key);
  if (contract.lease_extension_policy !== "no_implicit_extension") push(diagnostics, "TEMPORAL_IMPLICIT_LEASE_EXTENSION", "TemporalCommand 禁止隐式续租。", "/lease_extension_policy");
  if (contract.old_generation_reactivation !== false) push(diagnostics, "TEMPORAL_OLD_GENERATION_REACTIVATION", "过期 command 不得复活旧 generation。", "/old_generation_reactivation");
  if (!["hold_if_valid", "enter_admitted_backup", "yield_safety_authority", "reject"].includes(contract.on_invalid)) push(diagnostics, "TEMPORAL_INVALID_COMMAND_POLICY", "无效或过期 command 必须进入显式安全策略。", "/on_invalid");
  return gseosReceipt(diagnostics);
}

export function validateAuthorityClaimMatrix(matrix) {
  const diagnostics = [];
  if (!headerOk(matrix, "AuthorityClaimMatrix")) return gseosReceipt([gseosDiagnostic("INVALID_AUTHORITY_CLAIM_MATRIX", "AuthorityClaimMatrix 类型或版本无效。")]);
  if (matrix.local_acceptance_implies_joint_feasible !== false) push(diagnostics, "LOCAL_ACCEPTANCE_OVERCLAIMS_COMPOSITION", "局部合同通过不能推出联合任务集可行。", "/local_acceptance_implies_joint_feasible");
  if (matrix.unknown_conflict_policy !== "reject_or_preempt_by_lease_policy") push(diagnostics, "AUTHORITY_UNKNOWN_CONFLICT_POLICY", "未知冲突必须按租约策略拒绝或抢占。", "/unknown_conflict_policy");
  if (!versionedRef.test(String(matrix.joint_admission_checker_ref ?? ""))) push(diagnostics, "JOINT_ADMISSION_CHECKER_MISSING", "AuthorityClaimMatrix 必须绑定联合准入 checker。", "/joint_admission_checker_ref");
  for (const [index, claim] of (matrix.claims ?? []).entries()) {
    const path = "/claims/" + index;
    if (!versionedRef.test(String(claim?.skill_ref ?? "")) || !Array.isArray(claim?.resource_refs) || claim.resource_refs.length === 0 || claim.resource_refs.some((ref) => !versionedRef.test(String(ref)))) push(diagnostics, "INVALID_AUTHORITY_CLAIM_BINDING", "每项 claim 必须绑定版本化 skill/resource。", path);
    const expected = { exclusive: "single_writer", composed: "composition_controller", nullspace: "composition_controller", observe_only: "none" }[claim?.claim_mode];
    if (!expected || claim.write_authority !== expected) push(diagnostics, "AUTHORITY_CLAIM_WRITE_MISMATCH", "claim mode 与写权必须一一对应。", path + "/write_authority");
    if (["composed", "nullspace"].includes(claim?.claim_mode) && !versionedRef.test(String(claim.composition_controller_ref ?? ""))) push(diagnostics, "AUTHORITY_COMPOSITION_CONTROLLER_MISSING", "composed/nullspace claim 必须绑定唯一 composition controller。", path + "/composition_controller_ref");
  }
  return gseosReceipt(diagnostics);
}
