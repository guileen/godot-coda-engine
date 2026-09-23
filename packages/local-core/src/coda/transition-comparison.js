const outcomeFor = (decision) => decision?.outcome === "execute" ? "execute" : "reject";

function issue(code, message, details = {}) { return { code, message, ...details }; }

/**
 * Compare deterministic Node decision semantics with non-deterministic Godot
 * observation semantics. Wall time is intentionally excluded from equivalence.
 */
export function compareTransitionDecisionObservation(decision, observation) {
  const issues = [];
  const expected = outcomeFor(decision);
  const receipts = Array.isArray(observation?.receipts) ? observation.receipts : [];
  const types = receipts.map((receipt) => receipt.receipt_type);
  const terminal = receipts.filter((receipt) => receipt.receipt_type === "terminal_receipt");
  const barrier = receipts.find((receipt) => receipt.receipt_type === "barrier_receipt");
  const start = receipts.find((receipt) => receipt.receipt_type === "start_receipt");
  if (observation?.decision_id !== decision?.decision_id) issues.push(issue("DECISION_ID_MISMATCH", "RuntimeObservation 必须关联同一个 decision_id。"));
  if (terminal.length !== 1) issues.push(issue("TERMINAL_CARDINALITY", "执行观察必须有且只有一个 terminal receipt。", { count: terminal.length }));
  if (expected === "execute") {
    if (barrier?.status !== "accepted") issues.push(issue("BARRIER_OUTCOME_MISMATCH", "Node execute 决策需要 Godot accepted barrier。"));
    if (start?.status !== "started") issues.push(issue("START_OUTCOME_MISMATCH", "Node execute 决策需要 Godot started receipt。"));
    if (!['completed', 'preempted', 'failed', 'owner_lost'].includes(terminal[0]?.status)) issues.push(issue("TERMINAL_STATUS_INVALID", "执行决策的终态 receipt 不合法。"));
  } else {
    if (barrier && !['rejected', 'stale', 'accepted'].includes(barrier.status)) issues.push(issue("REJECT_BARRIER_INVALID", "拒绝决策的 barrier 状态不合法。"));
    if (start) issues.push(issue("REJECT_STARTED", "拒绝决策不得产生 start receipt。"));
    if (!['rejected', 'stale', 'owner_lost', 'failed'].includes(terminal[0]?.status)) issues.push(issue("REJECT_TERMINAL_INVALID", "拒绝决策的终态 receipt 不合法。"));
  }
  const expectedOrder = start ? ["barrier_receipt", "start_receipt", "terminal_receipt"] : ["barrier_receipt", "terminal_receipt"];
  if (types.some((type, index) => type !== expectedOrder[index])) issues.push(issue("RECEIPT_CAUSAL_ORDER", "receipt 顺序必须保持 barrier → start(可选) → terminal。", { types }));
  return {
    equivalent: issues.length === 0,
    decision_id: decision?.decision_id ?? null,
    expected,
    observed_terminal: terminal[0]?.status ?? null,
    issues,
    wall_time_comparable: false
  };
}
