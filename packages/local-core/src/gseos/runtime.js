import { gseosDiagnostic } from "./diagnostics.js";

export const RunStatus = Object.freeze({ RUNNING: "RUNNING", WAITING: "WAITING", COMPLETED: "COMPLETED", FAILED: "FAILED", CANCELLED: "CANCELLED" });

export class RunContext {
  constructor(args = {}, owner = null) { this.values = { ...args }; this.owner = owner; this.cancelled = false; this.cancel_reason = null; this.current_source_ref = null; }
  get(name, fallback = null) { return this.values[name] ?? fallback; }
  set(name, value) { this.values[name] = value; }
  ownerIsValid() { return this.owner == null || this.owner.valid !== false; }
  cancel(reason = "cancelled") { this.cancelled = true; this.cancel_reason = reason; }
}

export class WaitRegistration {
  constructor({ timeoutMs = 0, cleanup = () => {} } = {}) { this.generation = 1; this.status = "OPEN"; this.timeoutMs = timeoutMs; this.cleanup = cleanup; this.timer = null; this.promise = new Promise((resolve) => { this.resolve = resolve; }); if (timeoutMs > 0) this.timer = setTimeout(() => this.finish({ status: "timeout", reason: "timeout" }), timeoutMs); }
  finish(result) { if (this.status !== "OPEN") return false; this.status = "FINISHED"; if (this.timer) clearTimeout(this.timer); try { this.cleanup(); } finally { this.resolve(result); } return true; }
  cancel(reason = "cancelled") { return this.finish({ status: "cancelled", reason }); }
  async wait() { return this.promise; }
}

export class RunHandle {
  constructor(runId) { this.run_id = runId; this.status = RunStatus.RUNNING; this.result = null; this.listeners = []; }
  onComplete(listener) { if (this.status !== RunStatus.RUNNING && this.status !== RunStatus.WAITING) listener(this.result); else this.listeners.push(listener); return () => { this.listeners = this.listeners.filter((item) => item !== listener); }; }
  finish(result) { if (![RunStatus.RUNNING, RunStatus.WAITING].includes(this.status)) return false; this.status = result.status; this.result = result; const listeners = this.listeners.splice(0); listeners.forEach((listener) => listener(result)); return true; }
  cancel(reason = "cancelled") { return this.finish({ status: RunStatus.CANCELLED, reason }); }
}

export class EventRegistry {
  constructor() { this.events = new Map(); this.capabilities = new Map(); this.topics = new Map(); this.nextRunId = 1; }
  register(eventId, runner, { reentry = "reject" } = {}) { this.events.set(eventId, { runner, reentry, active: new Set() }); }
  registerCapability(id, adapter) { this.capabilities.set(id, adapter); }
  subscribe(topicId, listener) { if (!this.topics.has(topicId)) this.topics.set(topicId, new Set()); this.topics.get(topicId).add(listener); return () => this.topics.get(topicId)?.delete(listener); }
  publish(topicId, payload) { const errors = []; for (const listener of this.topics.get(topicId) ?? []) { try { listener(payload); } catch (error) { errors.push(gseosDiagnostic("LISTENER_FAILED", error.message, { target_id: topicId, severity: "warning" })); } } return { ok: errors.length === 0, diagnostics: errors }; }
  start(eventId, args = {}, owner = null) { const event = this.events.get(eventId); if (!event) { const handle = new RunHandle(this.nextRunId++); handle.finish({ status: RunStatus.FAILED, diagnostics: [gseosDiagnostic("EVENT_NOT_FOUND", `事件未注册：${eventId}。`, { event_id: eventId })] }); return handle; } if (event.reentry === "reject" && event.active.size) { const handle = new RunHandle(this.nextRunId++); handle.finish({ status: RunStatus.FAILED, diagnostics: [gseosDiagnostic("REENTRY_REJECTED", `事件拒绝重入：${eventId}。`, { event_id: eventId })] }); return handle; }
    const handle = new RunHandle(this.nextRunId++); event.active.add(handle); Promise.resolve().then(() => event.runner({ args, owner, registry: this, handle })).then((result) => handle.finish({ status: RunStatus.COMPLETED, value: result }), (error) => handle.finish({ status: RunStatus.FAILED, error: error.message })).finally(() => event.active.delete(handle)); handle.status = RunStatus.WAITING; return handle;
  }
  async callSync(eventId, args = {}, owner = null) { const handle = this.start(eventId, args, owner); if (handle.status === RunStatus.WAITING) throw new Error("CALL_SYNC_REQUIRES_ASYNC"); const result = await new Promise((resolve) => handle.onComplete(resolve)); if (result.status !== RunStatus.COMPLETED) throw new Error(result.error ?? result.reason ?? "event failed"); return result.value; }
}
