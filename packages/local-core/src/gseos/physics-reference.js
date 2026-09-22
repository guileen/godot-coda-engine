import { stableStringify } from "./asset.js";

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function bad(code, message, details = {}) { return { ok: false, diagnostics: [{ code, message, ...details }], value: null }; }

export const REFERENCE_TIERS = Object.freeze({
  kinematic: { substeps: 1, kp: 7.0, damping: 1.2, max_acceleration: 22.0, base_work: 8 },
  reduced: { substeps: 4, kp: 8.0, damping: 1.8, max_acceleration: 18.0, base_work: 28 },
  high: { substeps: 16, kp: 8.5, damping: 2.4, max_acceleration: 16.0, base_work: 96 }
});

export function simulateDoubleIntegrator({ initial = { position: 0, velocity: 0 }, target = 1, dt = 1 / 60, horizon_ticks = 60, tier = "reduced", limits = { position: [-2, 2], velocity: [-4, 4] } } = {}) {
  const config = REFERENCE_TIERS[tier];
  if (!config) return bad("UNKNOWN_FIDELITY_TIER", `未知 fidelity tier：${tier}。`);
  if (![initial.position, initial.velocity, target, dt].every(finite) || !Number.isInteger(horizon_ticks) || horizon_ticks < 1 || !finite(limits?.position?.[0]) || !finite(limits?.position?.[1]) || !finite(limits?.velocity?.[0]) || !finite(limits?.velocity?.[1])) return bad("INVALID_REFERENCE_INPUT", "参考模拟输入必须有限且 horizon_ticks 为正整数。");
  if (dt <= 0 || limits.position[0] >= limits.position[1] || limits.velocity[0] >= limits.velocity[1]) return bad("INVALID_REFERENCE_DOMAIN", "dt 与状态边界必须定义有效域。");
  let position = initial.position;
  let velocity = initial.velocity;
  const states = [{ tick: 0, position, velocity }];
  const subDt = dt / config.substeps;
  for (let tick = 1; tick <= horizon_ticks; tick += 1) {
    for (let substep = 0; substep < config.substeps; substep += 1) {
      const acceleration = clamp(config.kp * (target - position) - config.damping * velocity, -config.max_acceleration, config.max_acceleration);
      velocity += acceleration * subDt;
      position += velocity * subDt;
    }
    states.push({ tick, position, velocity });
  }
  const work_units = config.base_work + horizon_ticks * config.substeps * 3;
  const finite_state = states.every((state) => finite(state.position) && finite(state.velocity));
  const in_domain = states.every((state) => state.position >= limits.position[0] && state.position <= limits.position[1] && state.velocity >= limits.velocity[0] && state.velocity <= limits.velocity[1]);
  return { ok: true, value: { tier, states, final: states.at(-1), work_units, finite_state, in_domain, dt, horizon_ticks }, diagnostics: [] };
}

export function certifyReferenceCandidate({ simulation, budget_units = Infinity, target = 1, target_tolerance = 0.05, deadline_reserve_ms = 0, required_reserve_ms = 0 } = {}) {
  if (!simulation?.ok) return bad("INVALID_CANDIDATE", "候选必须来自成功的参考模拟。");
  const final = simulation.value.final;
  const target_error = Math.abs(final.position - target);
  const hard_safe = simulation.value.finite_state && simulation.value.in_domain;
  const budget_ok = simulation.value.work_units <= budget_units;
  const deadline_ok = required_reserve_ms <= deadline_reserve_ms;
  const target_reached = target_error <= target_tolerance;
  const certified = hard_safe && budget_ok && deadline_ok && target_reached;
  return { ok: true, value: {
    tier: simulation.value.tier,
    work_units: simulation.value.work_units,
    target_error,
    hard_safe,
    budget_ok,
    deadline_ok,
    target_reached,
    certified,
    decision: certified ? "execute" : "reject",
    rejection_reasons: [
      ...(!hard_safe ? ["HARD_SAFETY_OR_DOMAIN"] : []),
      ...(!budget_ok ? ["WORK_BUDGET"] : []),
      ...(!deadline_ok ? ["DEADLINE_RESERVE"] : [])
      ,...(!target_reached ? ["INTENT_ACCEPTANCE_FLOOR"] : [])
    ]
  }, diagnostics: [] };
}

export function runReferenceCascade({ initial, target, dt = 1 / 60, horizon_ticks = 60, limits, budget_units = Infinity, deadline_reserve_ms = Infinity, required_reserve_ms = 0, target_tolerance = 0.05, tiers = ["kinematic", "reduced", "high"] } = {}) {
  const high = simulateDoubleIntegrator({ initial, target, dt, horizon_ticks, tier: "high", limits });
  if (!high.ok) return high;
  const referenceFinal = high.value.final;
  const candidates = [];
  for (const tier of tiers) {
    const simulation = simulateDoubleIntegrator({ initial, target, dt, horizon_ticks, tier, limits });
    if (!simulation.ok) return simulation;
    const candidate = certifyReferenceCandidate({ simulation, budget_units, target, target_tolerance, deadline_reserve_ms, required_reserve_ms });
    const state_error = Math.hypot(simulation.value.final.position - referenceFinal.position, simulation.value.final.velocity - referenceFinal.velocity);
    candidates.push({ id: `${tier}-reference`, ...candidate.value, state_error, reference_tier: "high" });
  }
  const selected = candidates.find((candidate) => candidate.certified) ?? null;
  return { ok: true, value: { candidates, selected, reference: { tier: "high", final: referenceFinal }, decision: selected ? selected.decision : "fallback", execution_authority: "candidate_only" }, diagnostics: [] };
}

export function runAnytimeReference({ budgets = [8, 40, 160], ...options } = {}) {
  return budgets.map((budget_units) => {
    const cascade = runReferenceCascade({ ...options, budget_units });
    if (!cascade.ok) return { budget_units, outcome: "fallback", certified: false, diagnostics: cascade.diagnostics };
    const selected = cascade.value.selected;
    return { budget_units, outcome: selected ? "execute" : "fallback", certified: Boolean(selected), candidate: selected, candidates: cascade.value.candidates };
  });
}

export function referenceBenchmarkFingerprint(report) { return stableStringify(report); }
