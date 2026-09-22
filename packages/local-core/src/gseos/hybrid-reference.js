import { REFERENCE_TIERS } from "./physics-reference.js";

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function reject(code, message, details = {}) {
  return { ok: false, diagnostics: [{ code, message, ...details }], value: null };
}

export function applyTaggedExternalJump({ state, impulse = 0, envelope = 0 } = {}) {
  if (!finite(state?.position) || !finite(state?.velocity) || !finite(impulse) || !finite(envelope) || envelope < 0) {
    return reject("INVALID_JUMP_INPUT", "jump 状态、冲量和 envelope 必须有限。");
  }
  if (Math.abs(impulse) > envelope) {
    return reject("DISTURBANCE_OUTSIDE_ENVELOPE", "外部 jump 超出声明 disturbance envelope。", { impulse, envelope });
  }
  return { ok: true, diagnostics: [], value: { state: { ...state, velocity: state.velocity + impulse }, ledger: { external_impulse: impulse, envelope, admitted: true } } };
}

export function enforceOneSidedJointLimit({ state, limits = [-1, 1], restitution = 0 } = {}) {
  if (!finite(state?.position) || !finite(state?.velocity) || !Array.isArray(limits) || limits.length !== 2 || !limits.every(finite) || limits[0] >= limits[1] || !finite(restitution) || restitution < 0 || restitution > 1) {
    return reject("INVALID_JOINT_LIMIT_INPUT", "单侧关节限位输入必须有限且有序。");
  }
  let { position, velocity } = state;
  let contact = "none";
  if (position < limits[0]) {
    position = limits[0];
    velocity = Math.max(0, -velocity) * restitution;
    contact = "lower_limit";
  } else if (position > limits[1]) {
    position = limits[1];
    velocity = Math.min(0, -velocity) * restitution;
    contact = "upper_limit";
  }
  return { ok: true, diagnostics: [], value: { state: { position, velocity }, contact_receipt: { contact, restitution, state_safe_admissible: true } } };
}

export function admitFiniteFieldSwitch({ from = "finite", to = "field", source_in_domain = false, target_in_domain = false, state_safe_admissible = false, input_intersection = false } = {}) {
  const validModes = ["finite", "field"];
  if (!validModes.includes(from) || !validModes.includes(to)) return reject("UNKNOWN_POLICY_MODE", "只允许 finite/field policy mode。");
  const compatible = source_in_domain && target_in_domain && state_safe_admissible && input_intersection;
  if (!compatible) return reject("SWITCH_DOMAIN_REJECTED", "策略切换不在兼容有效域、安全域和输入交集中。");
  return { ok: true, diagnostics: [], value: { mode_from: from, mode_to: to, switch_admissible: true, execution_authority: "candidate_only", receipt: { barrier: "accepted", terminal: "pending" } } };
}

export function runHybridReference({ initial = { position: 0, velocity: 0 }, target = 1, dt = 1 / 60, horizon_ticks = 30, tier = "reduced", limits = [-2, 2], disturbance_envelope = 0, jumps = {}, restitution = 0, switches = [] } = {}) {
  const config = REFERENCE_TIERS[tier];
  if (!config || !finite(initial.position) || !finite(initial.velocity) || !finite(target) || !finite(dt) || dt <= 0 || !Number.isInteger(horizon_ticks) || horizon_ticks < 1) return reject("INVALID_HYBRID_INPUT", "hybrid reference 输入无效。");
  let state = { ...initial };
  const states = [{ tick: 0, ...state }];
  const jump_ledger = [];
  const contact_receipts = [];
  const switch_receipts = [];
  for (let tick = 1; tick <= horizon_ticks; tick += 1) {
    const acceleration = clamp(config.kp * (target - state.position) - config.damping * state.velocity, -config.max_acceleration, config.max_acceleration);
    state = { position: state.position + (state.velocity + acceleration * dt) * dt, velocity: state.velocity + acceleration * dt };
    if (Object.hasOwn(jumps, tick)) {
      const jump = applyTaggedExternalJump({ state, impulse: jumps[tick], envelope: disturbance_envelope });
      if (!jump.ok) return jump;
      state = jump.value.state;
      jump_ledger.push({ tick, ...jump.value.ledger });
    }
    const contact = enforceOneSidedJointLimit({ state, limits, restitution });
    if (!contact.ok) return contact;
    state = contact.value.state;
    if (contact.value.contact_receipt.contact !== "none") contact_receipts.push({ tick, ...contact.value.contact_receipt });
    if (switches.includes(tick)) {
      const switched = admitFiniteFieldSwitch({ source_in_domain: true, target_in_domain: true, state_safe_admissible: true, input_intersection: true });
      if (!switched.ok) return switched;
      switch_receipts.push({ tick, ...switched.value });
    }
    states.push({ tick, ...state });
  }
  return { ok: true, diagnostics: [], value: { states, final: states.at(-1), jump_ledger, contact_receipts, switch_receipts, work_units: config.base_work + horizon_ticks * 4, execution_authority: "candidate_only" } };
}
