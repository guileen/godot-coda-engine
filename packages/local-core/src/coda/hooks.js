import { stableStringify } from "./asset.js";

const result = (ok, value, diagnostics = []) => ({ ok, value: ok ? value : null, diagnostics });
const diag = (code, message, details = {}) => ({ code, message, ...details });
const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const versionedRefPattern = /^[-\w.]+@1$/u;

export function validateHookManifest(manifest) {
  const diagnostics = [];
  if (manifest?.manifest_type !== "HookManifest") diagnostics.push(diag("INVALID_HOOK_MANIFEST", "manifest_type 必须为 HookManifest。"));
  if (manifest?.schema_version !== 1) diagnostics.push(diag("UNSUPPORTED_HOOK_MANIFEST", "只支持 HookManifest@1。"));
  if (manifest && Object.keys(manifest).some((key) => !["manifest_type", "schema_version", "hooks", "trust_boundary", "fallback_policy"].includes(key))) diagnostics.push(diag("UNKNOWN_HOOK_MANIFEST_FIELD", "HookManifest 含未定义字段。"));
  const hooks = Array.isArray(manifest?.hooks) ? manifest.hooks : [];
  if (!hooks.length) diagnostics.push(diag("EMPTY_HOOK_PIPELINE", "hook pipeline 不能为空。"));
  const seen = new Set();
  let previousOrder = -1;
  for (const [index, hook] of hooks.entries()) {
    if (!hook || typeof hook !== "object") {
      diagnostics.push(diag("INVALID_HOOK", "hook 必须是对象。", { index }));
      continue;
    }
    if (Object.keys(hook).some((key) => !["hook_id", "version", "order", "artifact_sha256", "input_schema", "output_schema", "determinism", "work_budget", "wall_watchdog_ms", "failure_codes"].includes(key))) diagnostics.push(diag("UNKNOWN_HOOK_FIELD", "hook 含未定义字段。", { index }));
    if (typeof hook.hook_id !== "string" || !/^[-\w.]+$/u.test(hook.hook_id)) diagnostics.push(diag("INVALID_HOOK_ID", "hook_id 必须是稳定 ID。", { index }));
    if (seen.has(hook.hook_id)) diagnostics.push(diag("DUPLICATE_HOOK", `hook 重复：${hook.hook_id}。`, { index }));
    seen.add(hook.hook_id);
    if (!Number.isInteger(hook.order) || hook.order < 0 || hook.order <= previousOrder) diagnostics.push(diag("HOOK_ORDER_NOT_STRICT", "hook order 必须严格递增。", { index }));
    previousOrder = hook.order;
    if (hook.determinism !== "trusted_deterministic") diagnostics.push(diag("UNTRUSTED_HOOK", "首版只允许 trusted_deterministic hook。", { hook_id: hook.hook_id }));
    if (!digestPattern.test(String(hook.artifact_sha256 ?? ""))) diagnostics.push(diag("HOOK_DIGEST_INVALID", "hook 必须绑定完整 SHA-256 artifact digest。", { hook_id: hook.hook_id }));
    if (hook.version !== 1 || !versionedRefPattern.test(String(hook.input_schema ?? "")) || !versionedRefPattern.test(String(hook.output_schema ?? ""))) diagnostics.push(diag("HOOK_SCHEMA_BINDING_INVALID", "hook version 和输入/输出 schema 必须绑定支持的版本。", { hook_id: hook.hook_id }));
    if (!Array.isArray(hook.failure_codes) || hook.failure_codes.length === 0 || new Set(hook.failure_codes).size !== hook.failure_codes.length || hook.failure_codes.some((code) => typeof code !== "string" || !/^[A-Z][A-Z0-9_]+$/u.test(code))) diagnostics.push(diag("HOOK_FAILURE_CODES_INVALID", "hook 必须声明唯一、稳定的失败码集合。", { hook_id: hook.hook_id }));
    if (!Number.isInteger(hook.work_budget) || hook.work_budget < 1) diagnostics.push(diag("INVALID_HOOK_WORK_BUDGET", "hook work_budget 必须为正整数。", { hook_id: hook.hook_id }));
    if (!Number.isInteger(hook.wall_watchdog_ms) || hook.wall_watchdog_ms < 1) diagnostics.push(diag("INVALID_HOOK_WATCHDOG", "hook wall_watchdog_ms 必须为正整数。", { hook_id: hook.hook_id }));
  }
  if (manifest?.trust_boundary?.allow_third_party !== false || manifest?.trust_boundary?.allow_learning_models !== false || manifest?.trust_boundary?.execution_mode !== "repository_trusted_only" || Object.keys(manifest?.trust_boundary ?? {}).some((key) => !["allow_third_party", "allow_learning_models", "execution_mode"].includes(key))) diagnostics.push(diag("INVALID_TRUST_BOUNDARY", "首版 hook 只能运行仓库内受信任确定代码。"));
  if (manifest?.fallback_policy?.max_depth !== 1 || manifest?.fallback_policy?.resource_rule !== "same_or_subset" || manifest?.fallback_policy?.safety_rule !== "never_relax" || manifest?.fallback_policy?.runtime_selects !== true || Object.keys(manifest?.fallback_policy ?? {}).some((key) => !["max_depth", "resource_rule", "safety_rule", "runtime_selects"].includes(key))) diagnostics.push(diag("INVALID_FALLBACK_POLICY", "fallback 必须是单级、同资源或子集且不能放宽安全约束。"));
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
      let timeoutHandle;
      const controller = new AbortController();
      try {
        const context = {
          hook_id: spec.hook_id,
          work_budget: spec.work_budget,
          signal: controller.signal,
          consume(units = 1) {
            if (!Number.isInteger(units) || units < 0 || work + units > spec.work_budget) throw Object.assign(new Error("work budget exceeded"), { code: "HOOK_WORK_BUDGET_EXCEEDED" });
            work += units;
          }
        };
        const output = await Promise.race([
          Promise.resolve().then(() => hook(structuredClone(current), context)),
          new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
              controller.abort();
              reject(Object.assign(new Error("hook wall watchdog exceeded"), { code: "HOOK_TIMEOUT" }));
            }, spec.wall_watchdog_ms);
          })
        ]);
        if (!output || typeof output !== "object" || Array.isArray(output)) return result(false, null, [diag("HOOK_INVALID_OUTPUT", `hook 输出不是对象：${spec.hook_id}。`, { hook_id: spec.hook_id })]);
        current = output;
        trace.push({ hook_id: spec.hook_id, order: spec.order, work_units: work, status: "passed" });
      } catch (error) {
        const code = error.code === "HOOK_WORK_BUDGET_EXCEEDED" ? error.code : (spec.failure_codes.includes(error.code) ? error.code : "HOOK_REJECTED");
        trace.push({ hook_id: spec.hook_id, order: spec.order, work_units: work, status: "failed", code });
        return result(false, null, [diag(code, error.message, { hook_id: spec.hook_id, trace })]);
      } finally {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      }
    }
    return result(true, { output: current, trace, execution_authority: "candidate_only" });
  }
}

/** Execute the same trusted pipeline repeatedly and compare canonical decisions. */
export async function verifyHookReplay(pipeline, input, repetitions = 2) {
  if (!Number.isInteger(repetitions) || repetitions < 2 || repetitions > 8) return result(false, null, [diag("INVALID_HOOK_REPLAY_COUNT", "hook replay repetitions 必须在 2..8 之间。")]);
  const runs = [];
  for (let index = 0; index < repetitions; index++) {
    const run = await pipeline.run(structuredClone(input));
    if (!run.ok) return result(false, { deterministic: false, run_index: index, diagnostics: run.diagnostics }, [diag("HOOK_REPLAY_RUN_FAILED", "hook 重放中至少一次执行失败。", { run_index: index })]);
    runs.push(stableStringify(run.value));
  }
  const deterministic = runs.every((fingerprint) => fingerprint === runs[0]);
  return { ok: deterministic, value: { deterministic, repetitions, fingerprint: runs[0] }, diagnostics: deterministic ? [] : [diag("HOOK_REPLAY_DIVERGED", "相同输入的 hook 输出或 trace 不一致。" )] };
}

function resourceSet(value) {
  return new Set((Array.isArray(value) ? value : []).map(String));
}

export async function runWithSingleFallback({ pipeline, input, fallback, validateFallback, fallbackInput, safetySignature, fallbackSafetySignature, resources, fallbackResources }) {
  const primary = await pipeline.run(input);
  if (primary.ok) return { ...primary, path: "primary" };
  if (typeof fallback !== "function") return { ...primary, path: "reject" };
  const allowed = resourceSet(resources);
  const fallbackSet = resourceSet(fallbackResources ?? resources);
  if (!safetySignature || typeof safetySignature !== "object" || Array.isArray(safetySignature)) return result(false, null, [diag("FALLBACK_SAFETY_SIGNATURE_REQUIRED", "fallback 必须绑定显式核心安全签名。", { primary_diagnostics: primary.diagnostics })]);
  const sameOrSubset = [...fallbackSet].every((item) => allowed.has(item));
  if (!sameOrSubset || stableStringify(safetySignature) !== stableStringify(fallbackSafetySignature ?? safetySignature)) {
    return result(false, null, [diag("FALLBACK_POLICY_VIOLATION", "fallback 不能扩大资源或放宽安全签名。", { primary_diagnostics: primary.diagnostics })]);
  }
  const fallbackResourceList = fallbackResources ?? resources;
  if (!Array.isArray(resources) || !resources.length || resources.some((ref) => typeof ref !== "string" || !versionedRefPattern.test(ref)) || new Set(resources).size !== resources.length || !Array.isArray(fallbackResourceList) || fallbackResourceList.some((ref) => typeof ref !== "string" || !versionedRefPattern.test(ref)) || new Set(fallbackResourceList).size !== fallbackResourceList.length) return result(false, null, [diag("FALLBACK_RESOURCE_BINDING_INVALID", "fallback 必须绑定显式唯一的版本化资源集合。", { primary_diagnostics: primary.diagnostics })]);
  if (typeof validateFallback !== "function") return result(false, null, [diag("FALLBACK_VALIDATOR_REQUIRED", "fallback 输出必须重新通过核心 validator。", { primary_diagnostics: primary.diagnostics })]);
  try {
    const output = await fallback(structuredClone(fallbackInput ?? input));
    if (!output || typeof output !== "object" || Array.isArray(output)) return result(false, null, [diag("FALLBACK_INVALID_OUTPUT", "fallback 输出不是对象。")]);
    const inputTarget = input?.semantic_target_ref ?? input?.intent;
    const outputTarget = output.semantic_target_ref ?? output.intent;
    if (inputTarget !== undefined && outputTarget !== inputTarget) return result(false, null, [diag("FALLBACK_SEMANTIC_TARGET_CHANGED", "fallback 不得改变或丢弃原语义目标。")]);
    if (output.resources !== undefined && (!Array.isArray(output.resources) || output.resources.some((ref) => !fallbackSet.has(ref)))) return result(false, null, [diag("FALLBACK_OUTPUT_RESOURCE_WIDENED", "fallback 输出声明了未准入的资源。")]);
    const validation = await validateFallback(structuredClone(output), { resources: [...fallbackSet].sort(), safety_signature: fallbackSafetySignature ?? safetySignature });
    if (!validation?.ok) return result(false, null, [diag("FALLBACK_CORE_VALIDATION_FAILED", "fallback 输出未通过核心 validator。", { primary_diagnostics: primary.diagnostics, validation_diagnostics: validation?.diagnostics ?? [] })]);
    return { ...result(true, { output, primary_diagnostics: primary.diagnostics, core_validation: "passed", execution_authority: "candidate_only" }), path: "fallback" };
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
