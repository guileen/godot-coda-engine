const finiteArray = (values) => Array.isArray(values) && values.every((value) => typeof value === "number" && Number.isFinite(value));
const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);

function diagnostic(code, message, details = {}) { return { code, message, ...details }; }

export function decodeLinearPrior({ latent, mean = [], basis = [] } = {}) {
  if (!finiteArray(latent) || !finiteArray(mean) || basis.length !== mean.length || basis.some((row) => !finiteArray(row) || row.length !== latent.length)) return { ok: false, diagnostics: [diagnostic("INVALID_DECODER", "linear decoder 的 latent、mean 和 basis 维度必须有限且一致。")] };
  const decoded = mean.map((offset, row) => offset + dot(basis[row], latent));
  return { ok: true, value: decoded, diagnostics: [] };
}

export function evaluateLatentCandidate({ latent, prior, reference_state, decoded_limits = [], metric = {}, support = {}, constraint_checker } = {}) {
  const diagnostics = [];
  if (!finiteArray(latent)) diagnostics.push(diagnostic("LATENT_NOT_FINITE", "latent 向量必须有限。"));
  if (latent.length !== (support.min ?? []).length || latent.length !== (support.max ?? []).length) diagnostics.push(diagnostic("LATENT_DIMENSION_MISMATCH", "latent 维度与 support 不一致。"));
  const support_ok = diagnostics.length === 0 && latent.every((value, index) => value >= support.min[index] && value <= support.max[index]);
  if (!support_ok) diagnostics.push(diagnostic("LATENT_OOD", "latent 位于声明支持域之外。"));
  const sigma_min = metric.sigma_min;
  const condition_number = metric.condition_number;
  const metric_ok = Number.isFinite(sigma_min) && sigma_min >= (metric.min_sigma_min ?? 0.01) && Number.isFinite(condition_number) && condition_number <= (metric.max_condition_number ?? 100);
  if (!metric_ok) diagnostics.push(diagnostic("METRIC_CONDITION_GUARD", "pullback metric 条件不满足，禁止把 latent 距离当作物理距离。", { sigma_min, condition_number }));
  const decodedResult = decodeLinearPrior({ latent, mean: prior?.mean, basis: prior?.basis });
  if (!decodedResult.ok) diagnostics.push(...decodedResult.diagnostics);
  const decoded = decodedResult.value ?? [];
  const decoded_limits_ok = decoded_limits.length === decoded.length && decoded.every((value, index) => value >= decoded_limits[index][0] && value <= decoded_limits[index][1]);
  if (!decoded_limits_ok) diagnostics.push(diagnostic("DECODED_CONSTRAINT_VIOLATION", "decoder 输出超出声明约束。"));
  let constraint_ok = true;
  if (typeof constraint_checker === "function") {
    constraint_ok = constraint_checker(decoded) === true;
    if (!constraint_ok) diagnostics.push(diagnostic("DECODED_CONSTRAINT_REJECTED", "decoded constraint checker 拒绝候选。"));
  }
  const reconstruction_error = finiteArray(reference_state) && reference_state.length === decoded.length ? Math.hypot(...decoded.map((value, index) => value - reference_state[index])) : null;
  const accepted = support_ok && metric_ok && decoded_limits_ok && constraint_ok;
  return {
    ok: true,
    value: {
      latent,
      decoded,
      support_ok,
      metric_ok,
      decoded_limits_ok,
      constraint_ok,
      reconstruction_error,
      decision: accepted ? "execute_candidate" : "fallback_or_reject",
      candidate_only: true,
      accepted
    },
    diagnostics
  };
}

export function buildModelErrorReport({ prediction_receipt_id, reference, errors = {}, decision_flip = {}, drift_window = {}, frontier_impact = {} } = {}) {
  const requiredErrorKeys = ["position", "velocity", "contact", "effort"];
  const requiredFlipKeys = ["execute_to_fallback", "fallback_to_reject", "dangerous_flip"];
  const validErrors = requiredErrorKeys.every((key) => Number.isFinite(errors[key]));
  const validFlips = requiredFlipKeys.every((key) => typeof decision_flip[key] === "boolean");
  if (typeof prediction_receipt_id !== "string" || typeof reference !== "string" || !validErrors || !validFlips) {
    return { ok: false, diagnostics: [diagnostic("INVALID_MODEL_ERROR_REPORT", "ModelErrorReport 必须包含 receipt/reference、四项有限误差和三项 decision flip。")] };
  }
  const dangerous = decision_flip.dangerous_flip || decision_flip.execute_to_fallback || decision_flip.fallback_to_reject;
  return {
    ok: true,
    diagnostics: [],
    value: {
      type: "ModelErrorReport",
      version: 1,
      prediction_receipt_id,
      reference,
      errors: structuredClone(errors),
      decision_flip: structuredClone(decision_flip),
      drift_window: structuredClone(drift_window),
      frontier_impact: structuredClone(frontier_impact),
      candidate_only: true,
      recommendation: dangerous ? "upgrade_or_reject" : "retain_tier"
    }
  };
}
