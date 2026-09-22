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

export function validateEmbodimentProtocolMessage(message, { now_tick = null, clock_domain = null, minimum_epoch = null, minimum_sequence = null } = {}) {
  const diagnostics = [];
  const add = (code, path, text) => push(diagnostics, code, text, path);
  const types = new Set(["capability_query", "capability_report", "observation", "reference", "mode_request", "authority_lease", "handoff", "barrier_receipt", "start_receipt", "transition_receipt", "terminal_receipt", "reject"]);
  if (!message || typeof message !== "object" || message.protocol !== "EmbodimentProtocol" || message.schema_version !== 1) return gseosReceipt([gseosDiagnostic("INVALID_EMBODIMENT_PROTOCOL_HEADER", "消息必须使用 EmbodimentProtocol@1。")]);
  if (typeof message.message_id !== "string" || message.message_id.length === 0) add("INVALID_EMBODIMENT_MESSAGE_ID", "/message_id", "message_id 必须非空。");
  if (!versionedRef.test(String(message.adapter_ref ?? ""))) add("INVALID_EMBODIMENT_ADAPTER_REF", "/adapter_ref", "adapter_ref 必须是版本化引用。");
  if (!types.has(message.message_type)) add("INVALID_EMBODIMENT_MESSAGE_TYPE", "/message_type", "message_type 不属于 EmbodimentProtocol@1。");
  if (!Number.isInteger(message.epoch) || message.epoch < 0 || !Number.isInteger(message.sequence) || message.sequence < 0) add("INVALID_EMBODIMENT_SEQUENCE", "/sequence", "epoch 和 sequence 必须是非负整数。");
  if (minimum_epoch !== null && Number.isInteger(message.epoch) && message.epoch < minimum_epoch) add("EMBODIMENT_EPOCH_STALE", "/epoch", "消息 epoch 早于当前 Adapter epoch。");
  if (minimum_sequence !== null && message.epoch === minimum_epoch && Number.isInteger(message.sequence) && message.sequence <= minimum_sequence) add("EMBODIMENT_SEQUENCE_STALE", "/sequence", "同一 epoch 内消息 sequence 必须严格递增。");
  const expectedDirection = {
    capability_query: "coda_to_adapter", capability_report: "adapter_to_coda", observation: "adapter_to_coda",
    reference: "coda_to_adapter", mode_request: "coda_to_adapter", authority_lease: "coda_to_adapter",
    handoff: "coda_to_adapter", barrier_receipt: "adapter_to_coda", start_receipt: "adapter_to_coda",
    transition_receipt: "adapter_to_coda", terminal_receipt: "adapter_to_coda", reject: "adapter_to_coda",
  }[message.message_type];
  if (expectedDirection && message.direction !== expectedDirection) add("EMBODIMENT_DIRECTION_MISMATCH", "/direction", "message_type 与 direction 不匹配。");
  const clock = message.clock;
  if (!clock || typeof clock.domain !== "string" || clock.domain.length === 0 || !Number.isInteger(clock.tick) || clock.tick < 0 || !["synchronized", "bounded_skew", "uncertain", "invalid"].includes(clock.quality)) add("INVALID_EMBODIMENT_CLOCK", "/clock", "clock 必须包含有效 domain/tick/quality。");
  else {
    if (Object.keys(clock).some((key) => !["domain", "tick", "quality"].includes(key))) add("UNKNOWN_EMBODIMENT_CLOCK_FIELD", "/clock", "clock 不允许未定义字段。");
    if (clock.quality === "invalid") add("EMBODIMENT_CLOCK_INVALID", "/clock/quality", "clock quality=invalid 的消息不可用于协议准入。");
    if (clock_domain !== null && clock.domain !== clock_domain) add("EMBODIMENT_CLOCK_DOMAIN_MISMATCH", "/clock/domain", "消息 clock domain 与当前 profile 不匹配。");
    if (now_tick !== null && Number.isInteger(now_tick) && clock.tick > now_tick) add("EMBODIMENT_MESSAGE_FROM_FUTURE", "/clock/tick", "消息时钟不得晚于当前 profile tick。");
  }
  const validity = message.validity;
  if (!validity || !Number.isInteger(validity.valid_from_tick) || validity.valid_from_tick < 0 || !Number.isInteger(validity.valid_until_tick) || validity.valid_until_tick < validity.valid_from_tick) add("INVALID_EMBODIMENT_VALIDITY", "/validity", "validity 必须是闭区间且结束 tick 不早于起始 tick。");
  else {
    if (Object.keys(validity).some((key) => !["valid_from_tick", "valid_until_tick"].includes(key))) add("UNKNOWN_EMBODIMENT_VALIDITY_FIELD", "/validity", "validity 不允许未定义字段。");
    if (message.message_type === "observation" && Number.isInteger(clock?.tick) && (clock.tick < validity.valid_from_tick || clock.tick > validity.valid_until_tick)) add("EMBODIMENT_OBSERVATION_OUTSIDE_VALIDITY", "/validity", "observation 的签发 tick 必须位于其有效时域内。");
    if (now_tick !== null && Number.isInteger(now_tick) && now_tick > validity.valid_until_tick) add("EMBODIMENT_MESSAGE_EXPIRED", "/validity/valid_until_tick", "消息已超过有效时域。");
  }
  if (!message.payload || typeof message.payload !== "object" || Array.isArray(message.payload) || Object.keys(message.payload).length === 0) add("INVALID_EMBODIMENT_PAYLOAD", "/payload", "payload 必须是非空对象。");
  const payload = message.payload ?? {};
  const requiredByType = {
    capability_query: ["profile_ref", "minimum_protocol_version"], capability_report: ["capabilities", "adapter_revision", "profile_status"],
    observation: ["snapshot_ref", "quality", "reference_frame", "unit_system"], reference: ["representation", "reference_ref", "constraints_ref"],
    mode_request: ["controller_ref", "mode_ref", "handoff_contract_ref"], authority_lease: ["lease_id", "owner", "resources", "valid_until_tick"],
    handoff: ["handoff_contract_ref", "incoming_controller_ref", "barrier_id"],
    barrier_receipt: ["receipt_id", "status", "partial_write"], start_receipt: ["receipt_id", "status", "partial_write"],
    transition_receipt: ["receipt_id", "status", "partial_write"], terminal_receipt: ["receipt_id", "status", "partial_write"],
    reject: ["code", "partial_write"],
  }[message.message_type] ?? [];
  for (const key of requiredByType) if (!Object.hasOwn(payload, key)) add("EMBODIMENT_PAYLOAD_FIELD_MISSING", `/payload/${key}`, `payload 缺少必需字段 ${key}。`);
  const nonemptyString = (value) => typeof value === "string" && value.length > 0;
  const refFields = {
    mode_request: ["controller_ref", "mode_ref", "handoff_contract_ref"],
    handoff: ["handoff_contract_ref", "incoming_controller_ref"],
  }[message.message_type] ?? [];
  for (const key of refFields) if (!versionedRef.test(String(payload[key] ?? ""))) add("INVALID_EMBODIMENT_PAYLOAD_REF", `/payload/${key}`, `${key} 必须是版本化引用。`);
  if (message.message_type === "capability_query" && !nonemptyString(payload.profile_ref)) add("INVALID_EMBODIMENT_PROFILE_REF", "/payload/profile_ref", "profile_ref 必须非空。");
  if (message.message_type === "capability_report" && (!nonemptyString(payload.adapter_revision) || !["available", "degraded", "unsupported"].includes(payload.profile_status))) add("INVALID_EMBODIMENT_CAPABILITY_REPORT", "/payload", "capability_report 必须包含 adapter_revision 和有效 profile_status。");
  if (message.message_type === "observation" && (!nonemptyString(payload.snapshot_ref) || !["valid", "degraded", "stale", "invalid"].includes(payload.quality) || !nonemptyString(payload.reference_frame) || !nonemptyString(payload.unit_system))) add("INVALID_EMBODIMENT_OBSERVATION", "/payload", "observation 必须声明快照、质量、reference frame 与 unit system。");
  if (message.message_type === "reference" && (!new Set(["segment", "spline", "setpoint_sequence", "local_policy", "hold_reference"]).has(payload.representation) || !nonemptyString(payload.reference_ref) || !nonemptyString(payload.constraints_ref))) add("INVALID_EMBODIMENT_REFERENCE", "/payload", "reference 消息必须使用受支持的表示并绑定 reference/constraints。");
  if (message.message_type === "handoff" && !nonemptyString(payload.barrier_id)) add("INVALID_EMBODIMENT_HANDOFF", "/payload/barrier_id", "handoff 必须绑定非空 barrier_id。");
  if (message.message_type === "authority_lease" && (!Number.isInteger(payload.valid_until_tick) || payload.valid_until_tick < 0)) add("INVALID_EMBODIMENT_AUTHORITY_LEASE", "/payload/valid_until_tick", "lease valid_until_tick 必须是非负整数。");
  const leaseRequired = ["reference", "authority_lease", "barrier_receipt", "start_receipt", "transition_receipt", "terminal_receipt"].includes(message.message_type);
  if (leaseRequired && (typeof message.lease_ref !== "string" || message.lease_ref.length === 0 || !Number.isInteger(message.generation) || message.generation < 0)) add("EMBODIMENT_LEASE_BINDING_REQUIRED", "/lease_ref", "该消息类型必须绑定 lease_ref 和非负 generation。");
  if ((message.lease_ref === undefined) !== (message.generation === undefined)) add("EMBODIMENT_LEASE_BINDING_INCOMPLETE", "/generation", "lease_ref 与 generation 必须同时出现或同时省略。");
  if (message.generation !== undefined && (!Number.isInteger(message.generation) || message.generation < 0)) add("INVALID_EMBODIMENT_GENERATION", "/generation", "generation 必须是非负整数。");
  if (message.message_type === "capability_query" && payload.minimum_protocol_version !== 1) add("EMBODIMENT_PROTOCOL_VERSION_UNSUPPORTED", "/payload/minimum_protocol_version", "首版只支持 minimum_protocol_version=1。");
  if (message.message_type === "capability_report" && (!Array.isArray(payload.capabilities) || new Set(payload.capabilities).size !== payload.capabilities.length || payload.capabilities.some((ref) => !versionedRef.test(String(ref))))) add("INVALID_EMBODIMENT_CAPABILITIES", "/payload/capabilities", "capabilities 必须是唯一版本化引用数组。");
  if (message.message_type === "authority_lease") {
    if (payload.owner !== "coda" || !Array.isArray(payload.resources) || payload.resources.length === 0 || new Set(payload.resources).size !== payload.resources.length || payload.resources.some((ref) => !versionedRef.test(String(ref)))) add("INVALID_EMBODIMENT_AUTHORITY_LEASE", "/payload", "authority_lease 必须由 CODA 单一 owner 持有并声明唯一版本化资源。");
    if (Number.isInteger(payload.valid_until_tick) && Number.isInteger(validity?.valid_until_tick) && payload.valid_until_tick > validity.valid_until_tick) add("EMBODIMENT_LEASE_EXCEEDS_MESSAGE_VALIDITY", "/payload/valid_until_tick", "lease 不得超出消息声明的有效时域。");
  }
  if (["barrier_receipt", "start_receipt", "transition_receipt", "terminal_receipt"].includes(message.message_type)) {
    if (payload.partial_write !== false) add("EMBODIMENT_PARTIAL_WRITE_FORBIDDEN", "/payload/partial_write", "Adapter receipt 必须明确证明 partial_write=false。");
    if (!nonemptyString(payload.receipt_id) || Object.keys(payload).some((key) => !["receipt_id", "status", "partial_write"].includes(key))) add("INVALID_EMBODIMENT_RECEIPT_PAYLOAD", "/payload", "Adapter receipt payload 只允许 receipt_id/status/partial_write。");
    if (!new Set(["accepted", "started", "completed", "failed", "rejected", "stale", "owner_lost"]).has(payload.status)) add("INVALID_EMBODIMENT_RECEIPT_STATUS", "/payload/status", "Adapter receipt status 不属于协议枚举。");
  }
  if (message.message_type === "reject" && (payload.partial_write !== false || !/^[A-Z][A-Z0-9_]+$/u.test(String(payload.code ?? "")) || Object.keys(payload).some((key) => !["code", "partial_write"].includes(key)))) add("INVALID_EMBODIMENT_REJECT", "/payload", "reject 只允许稳定 code 与 partial_write=false。");
  const allowed = new Set(["protocol", "schema_version", "message_id", "direction", "message_type", "adapter_ref", "epoch", "sequence", "clock", "validity", "lease_ref", "generation", "payload"]);
  for (const key of Object.keys(message)) if (!allowed.has(key)) add("UNKNOWN_EMBODIMENT_MESSAGE_FIELD", `EmbodimentProtocol@1 不允许字段 ${key}。`, `/${key}`);
  return gseosReceipt(diagnostics);
}
