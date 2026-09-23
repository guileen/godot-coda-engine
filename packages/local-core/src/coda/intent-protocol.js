import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";

const versionedRef = /^[-\w.]+@\d+$/u;
const terminalStatuses = new Set(["rejected", "stale", "cancelled", "preempted", "completed", "failed"]);

export function validateIntentProtocolRequest(request) {
  const diagnostics = [];
  const add = (code, message, path) => diagnostics.push(gseosDiagnostic(code, message, { path }));
  if (!request || typeof request !== "object" || request.protocol !== "IntentProtocol" || request.schema_version !== 1) return gseosReceipt([gseosDiagnostic("INVALID_INTENT_PROTOCOL_HEADER", "请求必须使用 IntentProtocol@1。")]);
  if (typeof request.request_id !== "string" || request.request_id.length === 0) add("INVALID_INTENT_REQUEST_ID", "request_id 必须非空。", "/request_id");
  if (!["invoke", "amend", "interrupt", "pause", "resume", "cancel"].includes(request.operation)) add("INVALID_INTENT_OPERATION", "operation 必须使用 IntentProtocol@1 定义的操作。", "/operation");
  for (const [key, value] of [["skill_ref", request.skill_ref], ["parameter_schema_ref", request.parameter_schema_ref]]) if (typeof value !== "string" || !versionedRef.test(value)) add("INVALID_INTENT_VERSIONED_REF", `${key} 必须是版本化引用。`, `/${key}`);
  if (typeof request.instance_id !== "string" || request.instance_id.length === 0) add("INVALID_INTENT_INSTANCE_ID", "instance_id 必须非空。", "/instance_id");
  if (!Number.isInteger(request.generation) || request.generation < 0) add("INVALID_INTENT_GENERATION", "generation 必须是非负整数。", "/generation");
  if (typeof request.authority_ref !== "string" || request.authority_ref.length === 0) add("INVALID_INTENT_AUTHORITY", "authority_ref 必须非空。", "/authority_ref");
  if (!request.issued_at || typeof request.issued_at.clock_domain !== "string" || request.issued_at.clock_domain.length === 0 || !Number.isInteger(request.issued_at.tick) || request.issued_at.tick < 0) add("INVALID_INTENT_ISSUED_AT", "issued_at 必须声明 clock domain 和非负 tick。", "/issued_at");
  if (!request.deadline || request.deadline.clock_domain !== request.issued_at?.clock_domain || !Number.isInteger(request.deadline.not_after_tick) || request.deadline.not_after_tick < (request.issued_at?.tick ?? 0)) add("INVALID_INTENT_DEADLINE", "deadline 必须与 issued_at 使用相同 clock domain 且不早于签发 tick。", "/deadline");
  if (["invoke", "amend", "interrupt"].includes(request.operation) && (!Number.isInteger(request.priority) || request.priority < 0 || request.priority > 100)) add("INVALID_INTENT_PRIORITY", "invoke/amend/interrupt 必须声明 0–100 priority。", "/priority");
  if (request.operation === "resume" && (typeof request.continuation_ref !== "string" || request.continuation_ref.length === 0)) add("INTENT_RESUME_CONTINUATION_REQUIRED", "resume 必须绑定 ContinuationToken。", "/continuation_ref");
  if (request.parameters !== undefined && (!request.parameters || typeof request.parameters !== "object" || Array.isArray(request.parameters))) add("INVALID_INTENT_PARAMETERS", "parameters 必须是对象。", "/parameters");
  if (request.constraints_ref !== undefined && !versionedRef.test(String(request.constraints_ref))) add("INVALID_INTENT_CONSTRAINTS_REF", "constraints_ref 必须是版本化引用。", "/constraints_ref");
  if (request.continuation_ref !== undefined && (typeof request.continuation_ref !== "string" || request.continuation_ref.length === 0)) add("INVALID_INTENT_CONTINUATION_REF", "continuation_ref 必须非空。", "/continuation_ref");
  if (request.priority !== undefined && (!Number.isInteger(request.priority) || request.priority < 0 || request.priority > 100)) add("INVALID_INTENT_PRIORITY", "priority 必须在 0–100 范围内。", "/priority");
  const allowed = new Set(["protocol", "schema_version", "request_id", "operation", "skill_ref", "instance_id", "generation", "issued_at", "deadline", "priority", "parameter_schema_ref", "parameters", "constraints_ref", "continuation_ref", "authority_ref"]);
  for (const key of Object.keys(request)) if (!allowed.has(key)) add("UNKNOWN_INTENT_REQUEST_FIELD", `IntentProtocol@1 不允许字段 ${key}。`, `/${key}`);
  return gseosReceipt(diagnostics);
}

export function validateIntentProtocolReceipt(receipt) {
  const diagnostics = [];
  const add = (code, message, path) => diagnostics.push(gseosDiagnostic(code, message, { path }));
  if (!receipt || typeof receipt !== "object" || receipt.receipt_type !== "IntentReceipt" || receipt.schema_version !== 1) return gseosReceipt([gseosDiagnostic("INVALID_INTENT_RECEIPT_HEADER", "receipt 必须使用 IntentReceipt@1。")]);
  if (typeof receipt.request_id !== "string" || receipt.request_id.length === 0) add("INVALID_INTENT_RECEIPT_REQUEST_ID", "request_id 必须非空。", "/request_id");
  if (typeof receipt.instance_id !== "string" || receipt.instance_id.length === 0) add("INVALID_INTENT_RECEIPT_INSTANCE_ID", "instance_id 必须非空。", "/instance_id");
  if (!Number.isInteger(receipt.generation) || receipt.generation < 0) add("INVALID_INTENT_RECEIPT_GENERATION", "generation 必须是非负整数。", "/generation");
  const statuses = new Set(["admitted", "rejected", "running", "paused", "resumed", "cancelled", "completed", "preempted", "failed", "stale"]);
  if (!statuses.has(receipt.status)) add("INVALID_INTENT_RECEIPT_STATUS", "status 不属于 IntentReceipt@1。", "/status");
  if (typeof receipt.terminal !== "boolean") add("INVALID_INTENT_RECEIPT_TERMINAL", "terminal 必须是布尔值。", "/terminal");
  else if (receipt.terminal !== terminalStatuses.has(receipt.status)) add("INTENT_RECEIPT_TERMINAL_MISMATCH", "terminal 必须与 IntentReceipt status 的终态语义一致。", "/terminal");
  if (receipt.phase_id !== undefined && (typeof receipt.phase_id !== "string" || receipt.phase_id.length === 0)) add("INVALID_INTENT_RECEIPT_PHASE", "phase_id 必须非空。", "/phase_id");
  if (receipt.degradation_refs !== undefined && !Array.isArray(receipt.degradation_refs)) add("INVALID_INTENT_RECEIPT_DEGRADATIONS", "degradation_refs 必须是数组。", "/degradation_refs");
  else if ((receipt.degradation_refs ?? []).some((ref) => typeof ref !== "string" || !versionedRef.test(ref)) || new Set(receipt.degradation_refs ?? []).size !== (receipt.degradation_refs ?? []).length) add("INVALID_INTENT_RECEIPT_DEGRADATIONS", "degradation_refs 必须是唯一版本化引用。", "/degradation_refs");
  if (!Array.isArray(receipt.diagnostics)) add("INVALID_INTENT_RECEIPT_DIAGNOSTICS", "diagnostics 必须是数组。", "/diagnostics");
  else receipt.diagnostics.forEach((item, index) => {
    if (!item || typeof item !== "object" || !/^[A-Z][A-Z0-9_]+$/u.test(String(item.code ?? "")) || (item.source_ref !== undefined && typeof item.source_ref !== "string")) add("INVALID_INTENT_RECEIPT_DIAGNOSTIC", "diagnostic 必须包含 code 和可选 source_ref。", `/diagnostics/${index}`);
  });
  if (receipt.source_ref !== undefined && typeof receipt.source_ref !== "string") add("INVALID_INTENT_RECEIPT_SOURCE", "source_ref 必须是字符串。", "/source_ref");
  const allowed = new Set(["receipt_type", "schema_version", "request_id", "instance_id", "generation", "status", "terminal", "phase_id", "degradation_refs", "diagnostics", "source_ref"]);
  for (const key of Object.keys(receipt)) if (!allowed.has(key)) add("UNKNOWN_INTENT_RECEIPT_FIELD", `IntentReceipt@1 不允许字段 ${key}。`, `/${key}`);
  return gseosReceipt(diagnostics);
}

export function createIntentProtocolState() {
  return { state_type: "IntentProtocolState", schema_version: 1, instances: {}, request_ids: {} };
}

/** Deterministic in-memory protocol reference; it grants no Adapter or device authority. */
export function applyIntentProtocolRequest(state, request) {
  const invalidState = !state || state.state_type !== "IntentProtocolState" || state.schema_version !== 1 || !state.instances || typeof state.instances !== "object" || !state.request_ids || typeof state.request_ids !== "object";
  const baseState = invalidState ? createIntentProtocolState() : structuredClone(state);
  const receipt = (status, terminal, diagnostics = []) => ({
    receipt_type: "IntentReceipt",
    schema_version: 1,
    request_id: request?.request_id ?? "invalid",
    instance_id: request?.instance_id ?? "invalid",
    generation: Number.isInteger(request?.generation) && request.generation >= 0 ? request.generation : 0,
    status,
    terminal,
    diagnostics: diagnostics.map((item) => ({ code: item.code })),
    ...(request?.skill_ref ? { source_ref: request.skill_ref } : {}),
  });
  if (invalidState) return { state: baseState, receipt: receipt("rejected", true, [gseosDiagnostic("INVALID_INTENT_PROTOCOL_STATE", "IntentProtocolState@1 状态容器无效。")]) };
  const validation = validateIntentProtocolRequest(request);
  if (!validation.ok) return { state: baseState, receipt: receipt("rejected", true, validation.diagnostics) };
  if (Object.hasOwn(baseState.request_ids, request.request_id)) return { state: baseState, receipt: receipt("stale", true, [gseosDiagnostic("INTENT_REQUEST_REPLAY", "request_id 已处理；重放请求不改变实例状态。")]) };

  const instance = baseState.instances[request.instance_id];
  const reject = (code, status = "rejected") => {
    baseState.request_ids[request.request_id] = { instance_id: request.instance_id, generation: request.generation };
    return { state: baseState, receipt: receipt(status, true, [gseosDiagnostic(code, "IntentProtocol 请求与实例当前状态不兼容。")]) };
  };
  const active = instance && !instance.terminal;
  if (request.operation === "invoke") {
    if (active) return reject("INTENT_INSTANCE_ALREADY_ACTIVE");
    if (instance && (request.generation <= instance.generation || request.skill_ref !== instance.skill_ref)) return reject("INTENT_GENERATION_OR_SKILL_MISMATCH", request.generation <= instance.generation ? "stale" : "rejected");
    baseState.instances[request.instance_id] = { skill_ref: request.skill_ref, generation: request.generation, status: "running", terminal: false, parameters: structuredClone(request.parameters ?? {}) };
  } else {
    if (!instance || request.skill_ref !== instance.skill_ref) return reject("INTENT_INSTANCE_OR_SKILL_UNKNOWN");
    const validResumeGeneration = request.operation === "resume" && request.generation === instance.generation + 1;
    if (request.generation !== instance.generation && !validResumeGeneration) return reject("INTENT_GENERATION_STALE", "stale");
    if (instance.terminal) return reject("INTENT_INSTANCE_TERMINAL", "stale");
    if (request.operation === "amend") {
      if (instance.status !== "running") return reject("INTENT_AMEND_REQUIRES_RUNNING");
      instance.parameters = { ...instance.parameters, ...structuredClone(request.parameters ?? {}) };
    } else if (request.operation === "pause") {
      if (instance.status !== "running") return reject("INTENT_PAUSE_REQUIRES_RUNNING");
      instance.status = "paused";
    } else if (request.operation === "resume") {
      if (instance.status !== "paused") return reject("INTENT_RESUME_REQUIRES_PAUSED");
      if (request.generation !== instance.generation + 1) return reject("INTENT_RESUME_GENERATION_MUST_ADVANCE");
      instance.generation = request.generation;
      instance.status = "running";
      instance.continuation_ref = request.continuation_ref;
    } else if (request.operation === "interrupt") {
      instance.status = "preempted";
      instance.terminal = true;
    } else if (request.operation === "cancel") {
      instance.status = "cancelled";
      instance.terminal = true;
    }
  }
  baseState.request_ids[request.request_id] = { instance_id: request.instance_id, generation: request.generation };
  const status = request.operation === "invoke" ? "admitted" : request.operation === "resume" ? "resumed" : request.operation === "amend" ? "running" : request.operation === "pause" ? "paused" : request.operation === "interrupt" ? "preempted" : "cancelled";
  return { state: baseState, receipt: receipt(status, terminalStatuses.has(status)) };
}

/** Accept exactly one generation-bound terminal Adapter receipt per active instance. */
export function settleIntentProtocolInstance(state, { request_id, instance_id, generation, status } = {}) {
  const validState = state?.state_type === "IntentProtocolState" && state.schema_version === 1 && state.instances && typeof state.instances === "object" && state.request_ids && typeof state.request_ids === "object";
  const nextState = validState ? structuredClone(state) : createIntentProtocolState();
  const diagnostic = (code) => [gseosDiagnostic(code, "终态 receipt 与当前实例 generation 或终态不兼容。")];
  const makeReceipt = (receiptStatus, codes = []) => ({
    receipt_type: "IntentReceipt", schema_version: 1, request_id: request_id ?? "invalid", instance_id: instance_id ?? "invalid",
    generation: Number.isInteger(generation) && generation >= 0 ? generation : 0, status: receiptStatus, terminal: true,
    diagnostics: codes.map((item) => ({ code: item.code })),
    ...(nextState.instances[instance_id]?.skill_ref ? { source_ref: nextState.instances[instance_id].skill_ref } : {}),
  });
  if (!validState) return { state: nextState, receipt: makeReceipt("rejected", diagnostic("INVALID_INTENT_PROTOCOL_STATE")) };
  if (typeof request_id !== "string" || request_id.length === 0 || typeof instance_id !== "string" || instance_id.length === 0 || !Number.isInteger(generation) || generation < 0 || !["completed", "failed"].includes(status)) return { state: nextState, receipt: makeReceipt("rejected", diagnostic("INVALID_INTENT_TERMINAL_RECEIPT")) };
  if (Object.hasOwn(nextState.request_ids, request_id)) return { state: nextState, receipt: makeReceipt("stale", diagnostic("INTENT_TERMINAL_RECEIPT_REPLAY")) };
  const instance = nextState.instances[instance_id];
  if (!instance || instance.generation !== generation || instance.terminal) {
    nextState.request_ids[request_id] = { instance_id, generation };
    return { state: nextState, receipt: makeReceipt("stale", diagnostic(instance?.terminal ? "INTENT_INSTANCE_ALREADY_TERMINAL" : "INTENT_GENERATION_STALE")) };
  }
  instance.status = status;
  instance.terminal = true;
  nextState.request_ids[request_id] = { instance_id, generation };
  return { state: nextState, receipt: makeReceipt(status) };
}
