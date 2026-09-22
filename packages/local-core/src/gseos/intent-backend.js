import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";

function literal(value) {
  return value && typeof value === "object" && value.kind === "literal" ? value.value : value;
}

function motionArgs(instruction) {
  return Object.fromEntries(Object.entries(instruction?.args ?? {}).map(([key, value]) => [key, literal(value)]));
}

/**
 * Lower one backend-neutral MotionIntent into an explicitly bounded adapter envelope.
 * This is a contract-level split: it does not execute Godot or hardware commands.
 */
export function lowerMotionIntentToBackend(instruction, backend) {
  const diagnostics = [];
  if (instruction?.opcode !== "MotionIntent") diagnostics.push(gseosDiagnostic("INVALID_MOTION_INTENT_PLAN", "backend lowering 只接受 MotionIntent 计划指令。"));
  if (!["game", "robot"].includes(backend)) diagnostics.push(gseosDiagnostic("UNKNOWN_INTENT_BACKEND", "intent backend 必须是 game 或 robot。", { target_id: backend }));
  if (diagnostics.length) return { envelope: null, receipt: gseosReceipt(diagnostics) };

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
  return { envelope, receipt: gseosReceipt() };
}
