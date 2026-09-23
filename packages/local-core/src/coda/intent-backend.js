import { codaDiagnostic, codaReceipt } from "./diagnostics.js";

function literal(value) {
  return value && typeof value === "object" && value.kind === "literal" ? value.value : value;
}

function motionArgs(instruction) {
  return Object.fromEntries(Object.entries(instruction?.args ?? {}).map(([key, value]) => [key, literal(value)]));
}

function requiredBackendCapabilities(instruction, backend) {
  return backend === "game"
    ? ["godot.animation.play_profile@1", "godot.expression.apply_profile@1"]
    : ["robot.motion.request@1"];
}

function replaceCapabilityBindings(value, from, to) {
  if (Array.isArray(value)) return value.map((item) => replaceCapabilityBindings(item, from, to));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      ["capability", "adapter_command"].includes(key) && item === from ? to : replaceCapabilityBindings(item, from, to),
    ]));
  }
  return value;
}

/**
 * Lower one backend-neutral MotionIntent into an explicitly bounded adapter envelope.
 * This is a contract-level split: it does not execute Godot or hardware commands.
 */
export function lowerMotionIntentToBackend(instruction, backend) {
  const diagnostics = [];
  if (instruction?.opcode !== "MotionIntent") diagnostics.push(codaDiagnostic("INVALID_MOTION_INTENT_PLAN", "backend lowering 只接受 MotionIntent 计划指令。"));
  if (!["game", "robot"].includes(backend)) diagnostics.push(codaDiagnostic("UNKNOWN_INTENT_BACKEND", "intent backend 必须是 game 或 robot。", { target_id: backend }));
  if (diagnostics.length) return { envelope: null, receipt: codaReceipt(diagnostics) };

  const args = motionArgs(instruction);
  const common = {
    schema_version: 1,
    intent: instruction.target,
    target: args.target,
    resources: args.resources,
    priority: args.priority,
    safety_profile: args.safety_profile,
    on_no_solution: args.on_no_solution,
    source_ref: instruction.source_ref,
    execution_authority: "adapter_only",
    llm_direct_write: false,
  };
  const envelope = backend === "game"
    ? {
        envelope_type: "GameIntentPlan",
        backend: "godot.motion@1",
        ...common,
        godot_actions: [
          { capability: "godot.animation.play_profile@1", profile: args.target },
          { capability: "godot.expression.apply_profile@1", profile: args.expression ?? "backend_default" },
        ],
        visual_fidelity: "practical_perceptual",
      }
    : {
        envelope_type: "RobotMotionEnvelope",
        backend: "robot.motion@1",
        ...common,
        joint_profile: args.target,
        safety_boundary: { profile: args.safety_profile, independent_mechanism_required: true },
        adapter_command: "robot.motion.request@1",
        motor_write: "adapter_owned_only",
      };
  return { envelope, receipt: codaReceipt() };
}

/**
 * Resolve a backend-neutral intent against one versioned target profile.
 * Profile fallbacks are explicit capability substitutions; unresolved requirements fail closed.
 */
export function lowerMotionIntentForProfile(instruction, profile) {
  const diagnostics = [];
  if (profile?.profile_type !== "IntentBackendProfile" || profile?.schema_version !== 1 || typeof profile?.profile_id !== "string" || !profile.profile_id) {
    diagnostics.push(codaDiagnostic("INVALID_INTENT_BACKEND_PROFILE", "目标必须是完整的 IntentBackendProfile@1。"));
  }
  if (!Array.isArray(profile?.capabilities) || profile.capabilities.some((item) => typeof item !== "string" || !/^[-\w.]+@\d+$/u.test(item)) || new Set(profile.capabilities).size !== (profile.capabilities ?? []).length) {
    diagnostics.push(codaDiagnostic("INVALID_INTENT_BACKEND_PROFILE", "Profile capabilities 必须是无重复的能力 ID 数组。"));
  }
  const lowered = lowerMotionIntentToBackend(instruction, profile?.backend);
  diagnostics.push(...lowered.receipt.diagnostics);
  if (diagnostics.length) return { envelope: null, receipt: codaReceipt(diagnostics) };

  const available = new Set(profile.capabilities);
  const required = requiredBackendCapabilities(instruction, profile.backend);
  const fallbackMap = profile.capability_fallbacks ?? {};
  if (!fallbackMap || typeof fallbackMap !== "object" || Array.isArray(fallbackMap) || Object.entries(fallbackMap).some(([from, to]) => !/^[-\w.]+@\d+$/u.test(from) || typeof to !== "string" || !/^[-\w.]+@\d+$/u.test(to))) {
    return { envelope: null, receipt: codaReceipt([codaDiagnostic("INVALID_INTENT_BACKEND_PROFILE", "capability_fallbacks 必须是能力到能力的显式映射。")]) };
  }
  let envelope = lowered.envelope;
  const resolved = [];
  const missing = [];
  for (const capability of required) {
    if (available.has(capability)) {
      resolved.push({ requested: capability, resolved: capability, fallback_used: false });
      continue;
    }
    const substitute = Object.hasOwn(fallbackMap, capability) ? fallbackMap[capability] : undefined;
    if (typeof substitute === "string" && available.has(substitute)) {
      envelope = replaceCapabilityBindings(envelope, capability, substitute);
      resolved.push({ requested: capability, resolved: substitute, fallback_used: true });
      continue;
    }
    missing.push(capability);
  }
  if (missing.length) {
    return {
      envelope: null,
      receipt: codaReceipt([codaDiagnostic("INTENT_BACKEND_CAPABILITY_UNSUPPORTED", "目标 Profile 缺少意图所需能力，且没有可用的显式 fallback。", { target_id: profile.profile_id, missing_capabilities: missing })]),
    };
  }
  envelope.target_profile = profile.profile_id;
  envelope.capability_resolution = resolved;
  return { envelope, receipt: codaReceipt() };
}
