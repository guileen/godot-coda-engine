import { stableStringify } from "./asset.js";

const finite = (value) => typeof value === "number" && Number.isFinite(value);

function diagnostic(code, message, details = {}) {
  return { code, message, ...details };
}

function result(ok, value, diagnostics = []) {
  return { ok, value: ok ? value : null, diagnostics };
}

function normalizeIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).map(String))].sort();
}

/**
 * Expand a C1-T ResourceRegistry into a deterministic leaf set. This is a
 * reference implementation only: it owns no Godot node and has no write
 * authority.
 */
export function expandResourceLeaves(registry, requestedIds) {
  const resources = new Map((registry?.resources ?? []).map((item) => [item.id, item]));
  const leaves = new Set();
  const visiting = new Set();
  const diagnostics = [];
  const visit = (requestedId, path = []) => {
    const id = String(requestedId).replace(/@\d+$/, "");
    const resource = resources.get(id);
    if (!resource) {
      diagnostics.push(diagnostic("UNKNOWN_RESOURCE", `未知资源：${id}。`, { resource_id: id }));
      return;
    }
    if (visiting.has(id)) {
      diagnostics.push(diagnostic("RESOURCE_CYCLE", `资源展开出现循环：${[...path, id].join(" → ")}。`, { resource_id: id }));
      return;
    }
    visiting.add(id);
    if (resource.kind === "leaf") leaves.add(`${resource.id}@${resource.version}`);
    else for (const child of resource.leaves ?? []) visit(child, [...path, id]);
    visiting.delete(id);
  };
  for (const id of normalizeIds(requestedIds)) visit(id);
  if (diagnostics.length) return result(false, null, diagnostics);
  if (!leaves.size) return result(false, null, [diagnostic("EMPTY_RESOURCE_SET", "租约至少需要一个叶资源。")]);
  return result(true, [...leaves].sort());
}

function compareLease(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.sequence - b.sequence;
}

/**
 * Deterministic all-or-reject lease arbiter. A successful request is the only
 * operation that changes ownership; no implicit queue or partial lease exists.
 */
export class TransitionLeaseArbiter {
  #registry;
  #leases = new Map();
  #owners = new Map();
  #generations = new Map();

  constructor(registry) {
    this.#registry = structuredClone(registry);
  }

  request({ lease_id, owner_id, resources, priority, sequence = 0 }) {
    if (typeof lease_id !== "string" || !lease_id) return result(false, null, [diagnostic("INVALID_LEASE_ID", "lease_id 必须是非空字符串。")]);
    if (typeof owner_id !== "string" || !owner_id) return result(false, null, [diagnostic("INVALID_OWNER_ID", "owner_id 必须是非空字符串。")]);
    if (!Number.isInteger(priority) || priority < 0) return result(false, null, [diagnostic("INVALID_PRIORITY", "priority 必须是非负整数。")]);
    if (!Number.isInteger(sequence) || sequence < 0) return result(false, null, [diagnostic("INVALID_SEQUENCE", "sequence 必须是非负整数。")]);
    const expanded = expandResourceLeaves(this.#registry, resources);
    if (!expanded.ok) return expanded;
    if (this.#leases.has(lease_id)) return result(false, null, [diagnostic("DUPLICATE_LEASE_ID", `租约已存在：${lease_id}。`)]);
    const candidate = { lease_id, owner_id, resources: expanded.value, priority, sequence };
    const conflicts = expanded.value.map((resource) => this.#owners.get(resource)).filter(Boolean);
    const blocked = conflicts.filter((current) => current.priority >= candidate.priority);
    if (blocked.length) {
      return result(false, null, [diagnostic("LEASE_REJECTED", "资源冲突且候选没有严格更高优先级；全取或全拒。", {
        lease_id,
        conflicts: blocked.map(({ lease_id: id, resources: held }) => ({ lease_id: id, resources: held }))
      })]);
    }
    const preempted = [...new Set(conflicts.map((current) => current.lease_id))].sort();
    for (const oldId of preempted) this.#revoke(oldId, "preempted");
    const generation = Math.max(0, ...candidate.resources.map((resource) => this.#generations.get(resource) ?? 0)) + 1;
    const lease = { ...candidate, generation, mode: "all_or_reject", status: "active" };
    this.#leases.set(lease_id, lease);
    for (const resource of lease.resources) {
      this.#owners.set(resource, lease);
      this.#generations.set(resource, generation);
    }
    return result(true, { lease: structuredClone(lease), preempted });
  }

  #revoke(leaseId, reason) {
    const lease = this.#leases.get(leaseId);
    if (!lease) return;
    this.#leases.set(leaseId, { ...lease, status: "revoked", revoke_reason: reason });
    for (const resource of lease.resources) if (this.#owners.get(resource)?.lease_id === leaseId) this.#owners.delete(resource);
  }

  release({ lease_id, generation }) {
    const lease = this.#leases.get(lease_id);
    if (!lease || lease.generation !== generation || lease.status !== "active") return result(false, null, [diagnostic("LEASE_NOT_ACTIVE", "只能释放当前活动且 generation 匹配的租约。", { lease_id, generation })]);
    this.#revoke(lease_id, "released");
    return result(true, { lease_id, generation, status: "released" });
  }

  checkWrite({ lease_id, generation, resources }) {
    const lease = this.#leases.get(lease_id);
    const requested = normalizeIds(resources);
    if (!lease || lease.status !== "active" || lease.generation !== generation) return result(false, null, [diagnostic("STALE_LEASE", "lease/generation 不匹配，禁止写入。", { lease_id, generation })]);
    const owned = new Set(lease.resources);
    const missing = requested.filter((resource) => !owned.has(resource) || this.#owners.get(resource)?.lease_id !== lease_id);
    if (missing.length) return result(false, null, [diagnostic("RESOURCE_NOT_OWNED", "计划只能写入当前租约的资源。", { missing })]);
    return result(true, { lease_id, generation, resources: requested, barrier: "passed" });
  }

  snapshot() {
    return [...this.#leases.values()].sort((a, b) => a.lease_id.localeCompare(b.lease_id)).map((lease) => structuredClone(lease));
  }
}

export function validateTransitionSnapshot(snapshot) {
  const diagnostics = [];
  if (!snapshot || typeof snapshot !== "object") return result(false, null, [diagnostic("INVALID_SNAPSHOT", "SnapshotBundle 必须是对象。")]);
  if (!Number.isInteger(snapshot.physics_tick) || snapshot.physics_tick < 0) diagnostics.push(diagnostic("INVALID_PHYSICS_TICK", "physics_tick 必须是非负整数。"));
  if ((typeof snapshot.revision !== "string" && !Number.isInteger(snapshot.revision)) || snapshot.revision === "") diagnostics.push(diagnostic("INVALID_SNAPSHOT_REVISION", "revision 必须是非空字符串或非负整数。"));
  if (snapshot.quality?.same_tick !== true) diagnostics.push(diagnostic("SNAPSHOT_NOT_SAME_TICK", "快照必须来自同一 physics tick。"));
  if (snapshot.quality?.finite !== true) diagnostics.push(diagnostic("SNAPSHOT_NOT_FINITE", "快照质量必须明确声明 finite。"));
  const values = snapshot.state ?? snapshot.values ?? {};
  const walk = (value, path = snapshot.state ? "/state" : "/values") => {
    if (typeof value === "number" && !Number.isFinite(value)) diagnostics.push(diagnostic("NON_FINITE_SNAPSHOT_VALUE", "快照不得含 NaN/Infinity。", { path }));
    else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}/${index}`));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => walk(item, `${path}/${key}`));
  };
  walk(values);
  return diagnostics.length ? result(false, null, diagnostics) : result(true, structuredClone(snapshot));
}

export function buildTransitionPlan({ plan_id, intent, lease, snapshot, segments, completion, resources }) {
  const diagnostics = [];
  if (typeof plan_id !== "string" || !plan_id) diagnostics.push(diagnostic("INVALID_PLAN_ID", "plan_id 必须是非空字符串。"));
  if (typeof intent !== "string" || !/@[0-9]+$/.test(intent)) diagnostics.push(diagnostic("INVALID_INTENT_VERSION", "intent 必须带版本后缀。"));
  if (!lease || lease.mode !== "all_or_reject" || !Number.isInteger(lease.generation)) diagnostics.push(diagnostic("INVALID_PLAN_LEASE", "TransitionPlan 必须绑定 all_or_reject lease。"));
  const snapshotResult = validateTransitionSnapshot(snapshot);
  diagnostics.push(...snapshotResult.diagnostics);
  if (!Array.isArray(segments) || segments.length === 0) diagnostics.push(diagnostic("EMPTY_PLAN_SEGMENTS", "TransitionPlan 至少需要一个 segment。"));
  const owned = new Set(lease?.resources ?? []);
  for (const resource of resources ?? []) if (!owned.has(resource)) diagnostics.push(diagnostic("PLAN_RESOURCE_NOT_LEASED", `计划资源未被租约持有：${resource}。`, { resource }));
  for (const [index, segment] of (segments ?? []).entries()) {
    if (!segment || !Number.isInteger(segment.duration_ticks) || segment.duration_ticks <= 0) diagnostics.push(diagnostic("INVALID_SEGMENT_DURATION", "segment duration_ticks 必须是正整数。", { index }));
    if (segment?.start && segment?.end && stableStringify(segment.start) !== stableStringify(segment.end) && index === 0 && segment.start_tick !== 0) diagnostics.push(diagnostic("INVALID_SEGMENT_START", "首个 segment 必须从声明的当前状态边界开始。", { index }));
  }
  if (!completion || !Array.isArray(completion.terminal_states) || !Number.isInteger(completion.dwell_ticks) || completion.dwell_ticks < 0) diagnostics.push(diagnostic("INVALID_COMPLETION", "completion 必须声明 terminal_states 和非负 dwell_ticks。"));
  if (diagnostics.length) return result(false, null, diagnostics);
  return result(true, {
    plan_type: "TransitionPlan",
    schema_version: 1,
    plan_id,
    intent,
    lease: structuredClone(lease),
    snapshot_ref: { revision: snapshot.revision, physics_tick: snapshot.physics_tick },
    resources: normalizeIds(resources ?? lease.resources),
    segments: structuredClone(segments),
    completion: structuredClone(completion),
    execution_authority: "adapter_only"
  });
}

export function transitionDecisionFingerprint(decision) {
  return stableStringify(decision);
}
