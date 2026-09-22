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
