import { stableStringify } from "./asset.js";

const result = (ok, value, diagnostics = []) => ({ ok, value: ok ? value : null, diagnostics });
const diag = (code, message, details = {}) => ({ code, message, ...details });

export function validateHookManifest(manifest) {
  const diagnostics = [];
  if (manifest?.manifest_type !== "HookManifest") diagnostics.push(diag("INVALID_HOOK_MANIFEST", "manifest_type 必须为 HookManifest。"));
  if (manifest?.schema_version !== 1) diagnostics.push(diag("UNSUPPORTED_HOOK_MANIFEST", "只支持 HookManifest@1。"));
  const hooks = Array.isArray(manifest?.hooks) ? manifest.hooks : [];
  if (!hooks.length) diagnostics.push(diag("EMPTY_HOOK_PIPELINE", "hook pipeline 不能为空。"));
  const seen = new Set();
  let previousOrder = -1;
  for (const [index, hook] of hooks.entries()) {
    if (!hook || typeof hook !== "object") {
      diagnostics.push(diag("INVALID_HOOK", "hook 必须是对象。", { index }));
      continue;
    }
    if (seen.has(hook.hook_id)) diagnostics.push(diag("DUPLICATE_HOOK", `hook 重复：${hook.hook_id}。`, { index }));
    seen.add(hook.hook_id);
    if (!Number.isInteger(hook.order) || hook.order < 0 || hook.order <= previousOrder) diagnostics.push(diag("HOOK_ORDER_NOT_STRICT", "hook order 必须严格递增。", { index }));
    previousOrder = hook.order;
    if (hook.determinism !== "trusted_deterministic") diagnostics.push(diag("UNTRUSTED_HOOK", "首版只允许 trusted_deterministic hook。", { hook_id: hook.hook_id }));
    if (!/^sha256:/.test(String(hook.artifact_sha256 ?? ""))) diagnostics.push(diag("HOOK_DIGEST_MISSING", "hook 必须绑定 artifact_sha256。", { hook_id: hook.hook_id }));
    if (!Number.isInteger(hook.work_budget) || hook.work_budget < 1) diagnostics.push(diag("INVALID_HOOK_WORK_BUDGET", "hook work_budget 必须为正整数。", { hook_id: hook.hook_id }));
    if (!Number.isInteger(hook.wall_watchdog_ms) || hook.wall_watchdog_ms < 1) diagnostics.push(diag("INVALID_HOOK_WATCHDOG", "hook wall_watchdog_ms 必须为正整数。", { hook_id: hook.hook_id }));
  }
  if (manifest?.trust_boundary?.allow_third_party !== false || manifest?.trust_boundary?.allow_learning_models !== false || manifest?.trust_boundary?.execution_mode !== "repository_trusted_only") diagnostics.push(diag("INVALID_TRUST_BOUNDARY", "首版 hook 只能运行仓库内受信任确定代码。"));
  if (manifest?.fallback_policy?.max_depth !== 1 || manifest?.fallback_policy?.resource_rule !== "same_or_subset" || manifest?.fallback_policy?.safety_rule !== "never_relax" || manifest?.fallback_policy?.runtime_selects !== true) diagnostics.push(diag("INVALID_FALLBACK_POLICY", "fallback 必须是单级、同资源或子集且不能放宽安全约束。"));
  return result(diagnostics.length === 0, manifest, diagnostics);
}

export class TrustedHookPipeline {
  #manifest;
  #hooks;

  constructor(manifest, hooks = {}) {
    const checked = validateHookManifest(manifest);
    if (!checked.ok) throw new Error(checked.diagnostics.map((item) => item.code).join(","));
    this.#manifest = structuredClone(manifest);
    this.#hooks = new Map(Object.entries(hooks));
  }

  async run(input) {
    let current = structuredClone(input);
    const trace = [];
    for (const spec of this.#manifest.hooks) {
      const hook = this.#hooks.get(spec.hook_id);
      if (typeof hook !== "function") return result(false, null, [diag("HOOK_NOT_REGISTERED", `hook 未注册：${spec.hook_id}。`, { hook_id: spec.hook_id })]);
      let work = 0;
      const started = Date.now();
      try {
        const output = await hook(structuredClone(current), {
          hook_id: spec.hook_id,
          work_budget: spec.work_budget,
          consume(units = 1) {
            if (!Number.isInteger(units) || units < 0 || work + units > spec.work_budget) throw Object.assign(new Error("work budget exceeded"), { code: "HOOK_WORK_BUDGET_EXCEEDED" });
            work += units;
          }
        });
        if (!output || typeof output !== "object" || Array.isArray(output)) return result(false, null, [diag("HOOK_INVALID_OUTPUT", `hook 输出不是对象：${spec.hook_id}。`, { hook_id: spec.hook_id })]);
        if (Date.now() - started > spec.wall_watchdog_ms) return result(false, null, [diag("HOOK_TIMEOUT", `hook 超过 wall watchdog：${spec.hook_id}。`, { hook_id: spec.hook_id })]);
        current = output;
        trace.push({ hook_id: spec.hook_id, order: spec.order, work_units: work, status: "passed" });
      } catch (error) {
        const code = error.code === "HOOK_WORK_BUDGET_EXCEEDED" ? error.code : (spec.failure_codes.includes(error.code) ? error.code : "HOOK_REJECTED");
        trace.push({ hook_id: spec.hook_id, order: spec.order, work_units: work, status: "failed", code });
        return result(false, null, [diag(code, error.message, { hook_id: spec.hook_id, trace })]);
      }
    }
    return result(true, { output: current, trace, execution_authority: "candidate_only" });
  }
}

function resourceSet(value) {
  return new Set((value ?? []).map(String));
}

export async function runWithSingleFallback({ pipeline, input, fallback, fallbackInput, safetySignature, fallbackSafetySignature, resources, fallbackResources }) {
  const primary = await pipeline.run(input);
  if (primary.ok) return { ...primary, path: "primary" };
  if (typeof fallback !== "function") return { ...primary, path: "reject" };
  const allowed = resourceSet(resources);
  const fallbackSet = resourceSet(fallbackResources ?? resources);
  const sameOrSubset = [...fallbackSet].every((item) => allowed.has(item));
  if (!sameOrSubset || stableStringify(safetySignature) !== stableStringify(fallbackSafetySignature ?? safetySignature)) {
    return result(false, null, [diag("FALLBACK_POLICY_VIOLATION", "fallback 不能扩大资源或放宽安全签名。", { primary_diagnostics: primary.diagnostics })]);
  }
  try {
    const output = await fallback(structuredClone(fallbackInput ?? input));
    if (!output || typeof output !== "object" || Array.isArray(output)) return result(false, null, [diag("FALLBACK_INVALID_OUTPUT", "fallback 输出不是对象。")]);
    return { ...result(true, { output, primary_diagnostics: primary.diagnostics, execution_authority: "candidate_only" }), path: "fallback" };
  } catch (error) {
    return result(false, null, [diag("FALLBACK_REJECTED", error.message, { primary_diagnostics: primary.diagnostics })]);
  }
}

export class TransitionRun {
  #state = "planned";
  #terminal = null;

  get state() { return this.#state; }
  get terminal() { return this.#terminal ? structuredClone(this.#terminal) : null; }

  start() {
    if (this.#state !== "planned") return false;
    this.#state = "started";
    return true;
  }

  finish(status, details = {}) {
    if (this.#terminal) return false;
    if (!["completed", "failed", "cancelled", "owner_lost", "preempted", "rejected"].includes(status)) return false;
    this.#state = "terminal";
    this.#terminal = { status, ...structuredClone(details) };
    return true;
  }

  cancel(reason = "cancelled") { return this.finish("cancelled", { reason }); }
  ownerLost() { return this.finish("owner_lost"); }
  preempt() { return this.finish("preempted"); }
}
