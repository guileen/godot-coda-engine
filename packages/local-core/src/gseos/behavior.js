import { createHash } from "node:crypto";
import { assetFingerprint, stableStringify, validateEventAsset } from "./asset.js";
import { gseosDiagnostic, gseosReceipt, sourceRef } from "./diagnostics.js";

const STABLE_ID = /^[a-z][a-z0-9]*(?:\.[a-z0-9]+)*$/;
const SIMPLE_ID = /^[a-z][a-z0-9._-]*$/;

function diagnostic(code, message, path, extra = {}) { return gseosDiagnostic(code, message, { path, ...extra }); }
function indexBy(items, key) { return new Map((items ?? []).map((item) => [item[key], item])); }
function extension(asset) { return asset?.behavior_runtime; }
function validValue(field, value) {
  if (field.type === "number" && typeof value !== "number") return false;
  if (field.type === "string" && typeof value !== "string") return false;
  if (field.type === "boolean" && typeof value !== "boolean") return false;
  if (typeof value === "number" && field.minimum !== undefined && value < field.minimum) return false;
  if (typeof value === "number" && field.maximum !== undefined && value > field.maximum) return false;
  return true;
}
function uniqueDiagnostics(items, property, path, diagnostics, code) {
  const seen = new Set();
  for (const [index, item] of (items ?? []).entries()) {
    const id = item?.[property];
    if (typeof id !== "string" || !SIMPLE_ID.test(id)) diagnostics.push(diagnostic("INVALID_BEHAVIOR_ID", `${property} 必须是稳定机器标识。`, `${path}/${index}/${property}`));
    if (seen.has(id)) diagnostics.push(diagnostic(code, `${property} 重复：${id}。`, `${path}/${index}/${property}`));
    seen.add(id);
  }
}
function ref(asset, path, nodeId = undefined, fieldId = undefined) { return sourceRef(asset.event_id ?? asset.event_asset_id, nodeId, fieldId, { path }); }

export function validateBehaviorRuntime(asset, registry = null) {
  const diagnostics = [...validateEventAsset(asset, { capabilities: registry?.manifest?.capabilities ?? [] }).diagnostics];
  const behavior = extension(asset);
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) return gseosReceipt([...diagnostics, diagnostic("BEHAVIOR_EXTENSION_REQUIRED", "C0 行为必须保存在 EventAsset.behavior_runtime。", "/behavior_runtime")]);
  if (typeof behavior.behavior_type !== "string" || !/^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/.test(behavior.behavior_type)) diagnostics.push(diagnostic("INVALID_BEHAVIOR_TYPE", "behavior_type 必须是稳定的小写行为类型 ID。", "/behavior_runtime/behavior_type"));
  if (behavior.schema_version !== 1) diagnostics.push(diagnostic("UNSUPPORTED_BEHAVIOR_VERSION", "C0 只支持 behavior_runtime@1。", "/behavior_runtime/schema_version"));
  if (typeof behavior.behavior_id !== "string" || !STABLE_ID.test(behavior.behavior_id)) diagnostics.push(diagnostic("INVALID_BEHAVIOR_ID", "behavior_id 必须是稳定小写点分 ID。", "/behavior_runtime/behavior_id"));
  for (const key of ["states", "events", "blackboard", "effects", "rules"]) if (!Array.isArray(behavior[key])) diagnostics.push(diagnostic("INVALID_BEHAVIOR_COLLECTION", `${key} 必须是数组。`, `/behavior_runtime/${key}`));
  uniqueDiagnostics(behavior.states, "state_id", "/behavior_runtime/states", diagnostics, "DUPLICATE_STATE_ID");
  uniqueDiagnostics(behavior.events, "event_id", "/behavior_runtime/events", diagnostics, "DUPLICATE_BEHAVIOR_EVENT_ID");
  uniqueDiagnostics(behavior.blackboard, "field_id", "/behavior_runtime/blackboard", diagnostics, "DUPLICATE_BLACKBOARD_FIELD");
  uniqueDiagnostics(behavior.effects, "effect_id", "/behavior_runtime/effects", diagnostics, "DUPLICATE_EFFECT_ID");
  uniqueDiagnostics(behavior.rules, "rule_id", "/behavior_runtime/rules", diagnostics, "DUPLICATE_RULE_ID");
  const states = indexBy(behavior.states, "state_id"); const events = indexBy(behavior.events, "event_id"); const fields = indexBy(behavior.blackboard, "field_id"); const effects = indexBy(behavior.effects, "effect_id");
  if (!states.has(behavior.initial_state)) diagnostics.push(diagnostic("INITIAL_STATE_NOT_DECLARED", "initial_state 必须引用已声明状态。", "/behavior_runtime/initial_state"));
  for (const [index, state] of (behavior.states ?? []).entries()) {
    if (state?.parent_state_id && !states.has(state.parent_state_id)) diagnostics.push(diagnostic("UNKNOWN_PARENT_STATE", "parent_state_id 必须引用已声明状态。", `/behavior_runtime/states/${index}/parent_state_id`));
    const seen = new Set([state?.state_id]); let parent = state?.parent_state_id;
    while (parent) { if (seen.has(parent)) { diagnostics.push(diagnostic("CYCLIC_STATE_HIERARCHY", "状态父级不能形成环。", `/behavior_runtime/states/${index}/parent_state_id`)); break; } seen.add(parent); parent = states.get(parent)?.parent_state_id; }
  }
  for (const [index, event] of (behavior.events ?? []).entries()) {
    if (!Number.isInteger(event?.priority) || event.priority < 0) diagnostics.push(diagnostic("INVALID_EVENT_PRIORITY", "事件 priority 必须是非负整数。", `/behavior_runtime/events/${index}/priority`));
    if (event?.completion_effect_id && !effects.has(event.completion_effect_id)) diagnostics.push(diagnostic("UNKNOWN_COMPLETION_EFFECT", "completion_effect_id 未声明。", `/behavior_runtime/events/${index}/completion_effect_id`));
  }
  for (const [index, field] of (behavior.blackboard ?? []).entries()) {
    if (!['number', 'string', 'boolean'].includes(field?.type)) diagnostics.push(diagnostic("INVALID_BLACKBOARD_TYPE", "Blackboard 字段类型必须是 number、string 或 boolean。", `/behavior_runtime/blackboard/${index}/type`));
    if (!Array.isArray(field?.writable_by_events)) diagnostics.push(diagnostic("INVALID_BLACKBOARD_WRITE_RULE", "writable_by_events 必须是事件 ID 数组。", `/behavior_runtime/blackboard/${index}/writable_by_events`));
    if (!validValue(field ?? {}, field?.default)) diagnostics.push(diagnostic("INVALID_BLACKBOARD_DEFAULT", "Blackboard 默认值与类型或范围不匹配。", `/behavior_runtime/blackboard/${index}/default`));
    if (field?.minimum !== undefined && field?.maximum !== undefined && field.minimum > field.maximum) diagnostics.push(diagnostic("INVALID_BLACKBOARD_RANGE", "Blackboard minimum 不能大于 maximum。", `/behavior_runtime/blackboard/${index}`));
    for (const eventId of field?.writable_by_events ?? []) if (!events.has(eventId)) diagnostics.push(diagnostic("UNKNOWN_BLACKBOARD_WRITE_EVENT", "Blackboard 写入规则引用了未知事件。", `/behavior_runtime/blackboard/${index}/writable_by_events`));
  }
  for (const [index, effect] of (behavior.effects ?? []).entries()) {
    if (!states.has(effect?.owner_state)) diagnostics.push(diagnostic("UNKNOWN_EFFECT_OWNER_STATE", "效果 owner_state 未声明。", `/behavior_runtime/effects/${index}/owner_state`));
    if (typeof effect?.cancellable !== "boolean") diagnostics.push(diagnostic("INVALID_EFFECT_CANCELLATION", "效果必须明确 cancellable。", `/behavior_runtime/effects/${index}/cancellable`));
    if (effect?.cancellable && (!effect.convergence_effect_id || !effects.has(effect.convergence_effect_id))) diagnostics.push(diagnostic("MISSING_EFFECT_CONVERGENCE", "可取消效果必须声明已存在的 convergence_effect_id。", `/behavior_runtime/effects/${index}/convergence_effect_id`));
    if (!registry?.capability?.(effect?.capability)) diagnostics.push(diagnostic("CAPABILITY_VERSION_MISMATCH", `未声明的行为效果能力：${effect?.capability ?? ""}。`, `/behavior_runtime/effects/${index}/capability`, { target_id: effect?.capability ?? "" }));
  }
  const rulePairs = new Set();
  for (const [index, rule] of (behavior.rules ?? []).entries()) {
    const base = `/behavior_runtime/rules/${index}`;
    if (!states.has(rule?.from_state) || !states.has(rule?.to_state)) diagnostics.push(diagnostic("UNKNOWN_RULE_STATE", "规则状态必须已声明。", base));
    if (!events.has(rule?.event_id)) diagnostics.push(diagnostic("UNKNOWN_RULE_EVENT", "规则事件必须已声明。", `${base}/event_id`));
    const pair = `${rule?.from_state}:${rule?.event_id}`; if (rulePairs.has(pair)) diagnostics.push(diagnostic("AMBIGUOUS_TRANSITION", "同一状态和事件只能有一条规则。", base)); rulePairs.add(pair);
    if (!Array.isArray(rule?.effects)) diagnostics.push(diagnostic("INVALID_RULE_EFFECTS", "规则 effects 必须是数组。", `${base}/effects`));
    for (const effectId of rule?.effects ?? []) if (!effects.has(effectId)) diagnostics.push(diagnostic("UNKNOWN_RULE_EFFECT", "规则引用了未声明效果。", `${base}/effects`));
    if (!rule?.blackboard_writes || typeof rule.blackboard_writes !== "object" || Array.isArray(rule.blackboard_writes)) diagnostics.push(diagnostic("INVALID_BLACKBOARD_WRITES", "blackboard_writes 必须是对象。", `${base}/blackboard_writes`));
    for (const [fieldId, value] of Object.entries(rule?.blackboard_writes ?? {})) {
      const field = fields.get(fieldId);
      if (!field) diagnostics.push(diagnostic("UNKNOWN_BLACKBOARD_FIELD", "规则写入了未声明 Blackboard 字段。", `${base}/blackboard_writes/${fieldId}`));
      else if (!field.writable_by_events.includes(rule.event_id)) diagnostics.push(diagnostic("BLACKBOARD_WRITE_FORBIDDEN", "该事件不允许写入 Blackboard 字段。", `${base}/blackboard_writes/${fieldId}`));
      else if (!validValue(field, value)) diagnostics.push(diagnostic("BLACKBOARD_WRITE_OUT_OF_RANGE", "Blackboard 写入值不符合类型或范围。", `${base}/blackboard_writes/${fieldId}`));
    }
  }
  return gseosReceipt(diagnostics);
}

export function compileBehaviorRuntime(asset, registry = null) {
  const receipt = validateBehaviorRuntime(asset, registry);
  if (!receipt.ok) return { plan: null, receipt };
  const behavior = structuredClone(extension(asset));
  const plan = { plan_type: "BehaviorPlan", plan_version: 1, event_asset_id: asset.event_id, asset_fingerprint: assetFingerprint(asset), behavior, source_map: { states: Object.fromEntries(behavior.states.map((item, index) => [item.state_id, ref(asset, `/behavior_runtime/states/${index}`, item.state_id)])), events: Object.fromEntries(behavior.events.map((item, index) => [item.event_id, ref(asset, `/behavior_runtime/events/${index}`, item.event_id)])), effects: Object.fromEntries(behavior.effects.map((item, index) => [item.effect_id, ref(asset, `/behavior_runtime/effects/${index}`, item.effect_id)])), rules: Object.fromEntries(behavior.rules.map((item, index) => [item.rule_id, ref(asset, `/behavior_runtime/rules/${index}`, item.rule_id)])) } };
  plan.plan_fingerprint = `sha256:${createHash("sha256").update(stableStringify(plan)).digest("hex")}`;
  return { plan, receipt };
}

export class BehaviorRuntime {
  constructor(plan) {
    if (!plan || plan.plan_type !== "BehaviorPlan") throw new Error("BEHAVIOR_PLAN_REQUIRED");
    this.plan = plan; this.behavior = plan.behavior; this.state = this.behavior.initial_state; this.blackboard = Object.fromEntries(this.behavior.blackboard.map((field) => [field.field_id, structuredClone(field.default)]));
    this.events = indexBy(this.behavior.events, "event_id"); this.states = indexBy(this.behavior.states, "state_id"); this.effects = indexBy(this.behavior.effects, "effect_id"); this.rules = new Map(this.behavior.rules.map((rule) => [`${rule.from_state}:${rule.event_id}`, rule]));
    this.fields = indexBy(this.behavior.blackboard, "field_id"); this.activeEffects = new Map(); this.queue = []; this.nextSequence = 1; this.entries = []; this.nextEntryId = 1;
  }
  add(kind, source_ref, extra = {}) { this.entries.push({ entry_id: this.nextEntryId++, kind, source_ref, ...extra }); }
  enqueue(event_id, { source = "local", sequence = undefined } = {}) {
    const event = this.events.get(event_id);
    const assigned = sequence ?? this.nextSequence++;
    if (!Number.isInteger(assigned) || assigned < 1) throw new Error("INVALID_EVENT_SEQUENCE");
    this.nextSequence = Math.max(this.nextSequence, assigned + 1);
    if (!event) { this.add("EventRejected", ref(this.plan, `/behavior_runtime/events`, event_id), { event_id, source, sequence: assigned, reason: "UNKNOWN_EVENT" }); return assigned; }
    this.queue.push({ event, event_id, source, sequence: assigned }); return assigned;
  }
  drain() { this.queue.sort((left, right) => right.event.priority - left.event.priority || left.sequence - right.sequence); const batch = this.queue.splice(0); for (const item of batch) this.process(item); return this.trace(); }
  process(item) {
    const eventRef = this.plan.source_map.events[item.event_id];
    const completion = item.event.completion_effect_id;
    if (completion && !this.activeEffects.has(completion)) { this.add("EventIgnored", eventRef, { event_id: item.event_id, sequence: item.sequence, reason: "STALE_COMPLETION", completion_effect_id: completion }); return; }
    const rule = this.ruleFor(this.state, item.event_id);
    if (!rule) { this.add("EventRejected", eventRef, { event_id: item.event_id, sequence: item.sequence, reason: "NO_MATCHING_RULE", state: this.state }); return; }
    const writes = Object.entries(rule.blackboard_writes);
    for (const [fieldId, value] of writes) { const field = this.fields.get(fieldId); if (!field || !field.writable_by_events.includes(item.event_id) || !validValue(field, value)) { this.add("EventRejected", this.plan.source_map.rules[rule.rule_id], { event_id: item.event_id, sequence: item.sequence, reason: "INVALID_BLACKBOARD_WRITE" }); return; } }
    this.add("EventArbitrated", eventRef, { event_id: item.event_id, priority: item.event.priority, sequence: item.sequence, source: item.source, rule_id: rule.rule_id });
    if (completion) { this.activeEffects.delete(completion); this.add("EffectCompleted", this.plan.source_map.effects[completion], { effect_id: completion, event_id: item.event_id }); }
    const previous = this.state;
    if (!completion && previous !== rule.to_state) this.cancelEffectsOwnedBy(previous, item.event_id);
    for (const [fieldId, value] of writes) { this.blackboard[fieldId] = structuredClone(value); this.add("BlackboardWritten", this.plan.source_map.rules[rule.rule_id], { field_id: fieldId, value: structuredClone(value), event_id: item.event_id }); }
    this.state = rule.to_state; this.add("StateTransition", this.plan.source_map.rules[rule.rule_id], { rule_id: rule.rule_id, from_state: previous, to_state: this.state, event_id: item.event_id });
    for (const effectId of rule.effects) { const effect = this.effects.get(effectId); if (effect.cancellable) this.activeEffects.set(effectId, effect); this.add("EffectStarted", this.plan.source_map.effects[effectId], { effect_id: effectId, capability: effect.capability, owner_state: effect.owner_state }); }
  }
  ruleFor(stateId, eventId) { let cursor = stateId; while (cursor) { const rule = this.rules.get(`${cursor}:${eventId}`); if (rule) return rule; cursor = this.states.get(cursor)?.parent_state_id; } return null; }
  cancelEffectsOwnedBy(state, eventId) {
    for (const [effectId, effect] of [...this.activeEffects.entries()]) if (effect.owner_state === state) { this.activeEffects.delete(effectId); this.add("EffectCancelled", this.plan.source_map.effects[effectId], { effect_id: effectId, event_id: eventId }); if (effect.cancellable) this.add("EffectConverged", this.plan.source_map.effects[effect.convergence_effect_id], { effect_id: effect.convergence_effect_id, cancelled_effect_id: effectId, event_id: eventId }); }
  }
  trace() { return { trace_type: "BehaviorRuntimeTrace", schema_version: 1, behavior_id: this.behavior.behavior_id, event_asset_id: this.plan.event_asset_id, plan_fingerprint: this.plan.plan_fingerprint, final_state: this.state, blackboard: structuredClone(this.blackboard), entries: structuredClone(this.entries) }; }
}

export function validateBehaviorRuntimeTrace(trace) {
  const diagnostics = [];
  if (trace?.trace_type !== "BehaviorRuntimeTrace" || trace?.schema_version !== 1) diagnostics.push(diagnostic("INVALID_BEHAVIOR_TRACE", "行为轨迹必须是 BehaviorRuntimeTrace@1。", "/"));
  for (const [index, entry] of (trace?.entries ?? []).entries()) { if (entry?.entry_id !== index + 1) diagnostics.push(diagnostic("INVALID_TRACE_ENTRY_ID", "轨迹 entry_id 必须连续且确定。", `/entries/${index}/entry_id`)); if (!entry?.source_ref?.event_id || !entry?.source_ref?.path) diagnostics.push(diagnostic("MISSING_TRACE_SOURCE_REF", "每条行为轨迹必须可回溯到 EventAsset。", `/entries/${index}/source_ref`)); }
  return gseosReceipt(diagnostics);
}
