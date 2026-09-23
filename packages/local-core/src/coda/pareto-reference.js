const dimensions = ["target_error", "state_error", "work_units", "energy_proxy"];

function dominates(left, right) {
  const noWorse = dimensions.every((dimension) => Number.isFinite(left[dimension]) && Number.isFinite(right[dimension]) && left[dimension] <= right[dimension]);
  const strictlyBetter = dimensions.some((dimension) => left[dimension] < right[dimension]);
  return noWorse && strictlyBetter;
}

function hardGate(candidate) {
  return candidate?.schema_valid === true && candidate?.resource_valid === true && candidate?.numerical_valid === true && candidate?.hard_safe === true && candidate?.deadline_ok === true;
}

export function buildSafeParetoFrontier(candidates = []) {
  const safe = [];
  const rejected = [];
  for (const candidate of candidates) {
    if (hardGate(candidate)) safe.push({ ...candidate, hard_gate: "passed" });
    else rejected.push({ ...candidate, hard_gate: "rejected", decision: "reject" });
  }
  const frontier = safe.filter((candidate, index) => !safe.some((other, otherIndex) => otherIndex !== index && dominates(other, candidate))).sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const dominated = safe.filter((candidate) => !frontier.some((item) => item.id === candidate.id)).map((candidate) => ({ ...candidate, frontier_status: "dominated" }));
  return { safe, rejected, frontier, dominated, dimensions: [...dimensions] };
}

export function selectStableParetoCandidate(frontier, { preferred_tier_order = [], tie_break = "work_units" } = {}) {
  const candidates = Array.isArray(frontier) ? [...frontier] : [];
  if (!candidates.length) return { outcome: "fallback", candidate: null, reason: "NO_SAFE_PARETO_CANDIDATE" };
  const tierRank = (candidate) => {
    const rank = preferred_tier_order.indexOf(candidate.tier);
    return rank < 0 ? preferred_tier_order.length : rank;
  };
  candidates.sort((left, right) => tierRank(left) - tierRank(right) || (left[tie_break] ?? Infinity) - (right[tie_break] ?? Infinity) || String(left.id).localeCompare(String(right.id)));
  return { outcome: "execute_candidate", candidate: candidates[0], execution_authority: "candidate_only" };
}
