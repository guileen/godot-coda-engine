import { createHash } from "node:crypto";
import { stableStringify } from "./asset.js";

const result = (ok, value, diagnostics = []) => ({ ok, value: ok ? value : null, diagnostics });
const diagnostic = (code, message, details = {}) => ({ code, message, ...details });
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const finiteNonnegative = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Validate the deterministic input/decision boundary; this does not assert that a digest matches loaded code. */
export function validateReplayEnvelope(envelope) {
  const diagnostics = [];
  const add = (code, path, message) => diagnostics.push(diagnostic(code, message, { path }));
  if (!envelope || envelope.envelope_type !== "ReplayEnvelope" || envelope.schema_version !== 1) add("INVALID_REPLAY_ENVELOPE", "/", "必须提供 ReplayEnvelope@1。");
  if (envelope && Object.keys(envelope).some((key) => !["envelope_type", "schema_version", "replay_id", "logical_tick", "contract_digests", "request", "snapshot", "decision_record"].includes(key))) add("UNKNOWN_REPLAY_ENVELOPE_FIELD", "/", "ReplayEnvelope 不允许未声明顶层字段。");
  if (!nonempty(envelope?.replay_id)) add("INVALID_REPLAY_ID", "/replay_id", "replay_id 必须是非空字符串。");
  if (!Number.isSafeInteger(envelope?.logical_tick) || envelope.logical_tick < 0) add("INVALID_REPLAY_LOGICAL_TICK", "/logical_tick", "logical_tick 必须是非负安全整数。");
  const digests = envelope?.contract_digests;
  if (!digests || typeof digests !== "object" || Array.isArray(digests) || Object.keys(digests).length === 0 || Object.values(digests).some((value) => !nonempty(value) || !value.startsWith("sha256:"))) add("INVALID_REPLAY_CONTRACT_DIGESTS", "/contract_digests", "contract_digests 必须是非空的 sha256 声明映射。");
  if (!envelope?.request || typeof envelope.request !== "object" || Array.isArray(envelope.request) || Object.keys(envelope.request).length === 0) add("INVALID_REPLAY_REQUEST", "/request", "request 必须是非空对象。");
  if (!envelope?.snapshot || typeof envelope.snapshot !== "object" || !nonempty(envelope.snapshot.revision) || !Number.isSafeInteger(envelope.snapshot.physics_tick) || envelope.snapshot.physics_tick < 0) add("INVALID_REPLAY_SNAPSHOT", "/snapshot", "snapshot 必须绑定 revision 与非负 physics_tick。");
  const decision = envelope?.decision_record;
  if (!decision || !nonempty(decision.decision_id) || !["execute", "reject"].includes(decision.outcome) || !nonempty(decision.source_ref) || !nonempty(decision.plan_id)) add("INVALID_REPLAY_DECISION", "/decision_record", "decision_record 必须绑定 ID、结果、source_ref 与 plan_id。");
  return diagnostics.length ? result(false, null, diagnostics) : result(true, structuredClone(envelope));
}

/** Build a canonical replay envelope without embedding wall-clock or runtime observations. */
export function createReplayEnvelope(input) {
  const envelope = {
    envelope_type: "ReplayEnvelope",
    schema_version: 1,
    replay_id: input?.replay_id,
    logical_tick: input?.logical_tick,
    contract_digests: structuredClone(input?.contract_digests ?? {}),
    request: structuredClone(input?.request ?? {}),
    snapshot: structuredClone(input?.snapshot ?? {}),
    decision_record: structuredClone(input?.decision_record ?? {})
  };
  const checked = validateReplayEnvelope(envelope);
  return checked.ok ? result(true, envelope) : checked;
}

/** Runtime observations are intentionally not canonical replay inputs. */
export function validateRuntimeObservation(observation) {
  const diagnostics = [];
  const add = (code, path, message) => diagnostics.push(diagnostic(code, message, { path }));
  if (!observation || observation.observation_type !== "RuntimeObservation" || observation.schema_version !== 1) add("INVALID_RUNTIME_OBSERVATION", "/", "必须提供 RuntimeObservation@1。");
  if (observation && Object.keys(observation).some((key) => !["observation_type", "schema_version", "observation_id", "decision_id", "frame", "wall", "receipts"].includes(key))) add("UNKNOWN_RUNTIME_OBSERVATION_FIELD", "/", "RuntimeObservation 不允许未声明顶层字段。");
  if (!nonempty(observation?.observation_id) || !nonempty(observation?.decision_id)) add("INVALID_RUNTIME_OBSERVATION_ID", "/observation_id", "observation_id 与 decision_id 必须非空。");
  if (!observation?.frame || !Number.isSafeInteger(observation.frame.physics_tick) || observation.frame.physics_tick < 0 || !observation.frame.state || typeof observation.frame.state !== "object") add("INVALID_RUNTIME_FRAME", "/frame", "frame 必须包含非负 physics_tick 与 state 对象。");
  const wall = observation?.wall;
  if (!wall || !finiteNonnegative(wall.duration_ms) || !finiteNonnegative(wall.p95_ms) || !finiteNonnegative(wall.p99_ms) || wall.p95_ms > wall.p99_ms || !Number.isSafeInteger(wall.memory_bytes) || wall.memory_bytes < 0) add("INVALID_RUNTIME_WALL_PROFILE", "/wall", "wall 必须提供有限非负 duration/p95/p99、单调分位数与 memory_bytes。");
  if (!Array.isArray(observation?.receipts)) add("INVALID_RUNTIME_RECEIPTS", "/receipts", "receipts 必须是数组。");
  else {
    const allowed = new Set(["barrier_receipt", "start_receipt", "terminal_receipt"]);
    const types = observation.receipts.map((receipt) => receipt?.receipt_type);
    if (types.some((type) => !allowed.has(type)) || types.filter((type) => type === "barrier_receipt").length > 1 || types.filter((type) => type === "start_receipt").length > 1 || types.filter((type) => type === "terminal_receipt").length !== 1) add("INVALID_RUNTIME_RECEIPT_SET", "/receipts", "receipt 集合只允许至多一个 barrier/start，且必须恰有一个 terminal。");
    const expected = types.includes("start_receipt") ? ["barrier_receipt", "start_receipt", "terminal_receipt"] : types.includes("barrier_receipt") ? ["barrier_receipt", "terminal_receipt"] : ["terminal_receipt"];
    if (types.length !== expected.length || types.some((type, index) => type !== expected[index])) add("INVALID_RUNTIME_RECEIPT_ORDER", "/receipts", "receipt 必须按 barrier → start(可选) → terminal 的因果顺序排列。");
    if (observation.receipts.some((receipt) => !nonempty(receipt?.status))) add("INVALID_RUNTIME_RECEIPT_STATUS", "/receipts", "每个 receipt 必须有非空 status。");
  }
  return diagnostics.length ? result(false, null, diagnostics) : result(true, structuredClone(observation));
}

export function replayEnvelopeFingerprint(envelope) {
  const checked = validateReplayEnvelope(envelope);
  return checked.ok ? result(true, `sha256:${createHash("sha256").update(stableStringify(checked.value)).digest("hex")}`) : checked;
}
