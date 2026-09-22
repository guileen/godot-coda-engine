import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";

const ARITY = {
  eq: [2, 2], neq: [2, 2], lt: [2, 2], lte: [2, 2], gt: [2, 2], gte: [2, 2],
  and: [2, 32], or: [2, 32], not: [1, 1], is_known: [1, 1],
};

/** Validate a closed typed guard AST against the observation bindings visible to its owner. */
export function validateGuardExpression(guard, { known_observation_refs = [], max_depth = 32 } = {}) {
  const diagnostics = [];
  const add = (code, path, message) => diagnostics.push(gseosDiagnostic(code, message, { path }));
  if (!guard || typeof guard !== "object" || guard.guard_type !== "GuardExpression" || guard.guard_version !== 1 || typeof guard.guard_id !== "string" || guard.unknown_policy !== "reject_or_yield_safety") {
    return gseosReceipt([gseosDiagnostic("INVALID_GUARD_HEADER", "Guard 必须使用 GuardExpression@1 且对未知值 fail-closed。")]);
  }
  const known = new Set(known_observation_refs);
  const walk = (node, path, depth) => {
    if (depth > max_depth) { add("GUARD_DEPTH_EXCEEDED", path, "Guard 表达式超过 profile 声明的最大深度。"); return; }
    if (!node || typeof node !== "object" || Array.isArray(node)) { add("INVALID_GUARD_NODE", path, "Guard 节点必须是带类型的对象。"); return; }
    if (node.node_type === "literal") {
      if (!(node.value === null || ["string", "boolean"].includes(typeof node.value) || (typeof node.value === "number" && Number.isFinite(node.value)))) add("INVALID_GUARD_LITERAL", `${path}/value`, "Guard literal 仅允许有限 JSON 标量。");
      return;
    }
    if (node.node_type === "observation_ref") {
      if (typeof node.contract_ref !== "string" || !/^[-\w.]+@\d+$/u.test(node.contract_ref) || typeof node.path !== "string" || !node.path.startsWith("/")) add("INVALID_GUARD_OBSERVATION_REF", path, "Observation 引用必须包含版本化 contract_ref 与绝对字段路径。");
      else if (!known.has(`${node.contract_ref}#${node.path}`)) add("GUARD_OBSERVATION_NOT_BOUND", path, "Guard 引用了当前合同未绑定的 observation 字段。");
      return;
    }
    if (node.node_type !== "operation" || !Object.hasOwn(ARITY, node.operator) || !Array.isArray(node.operands)) { add("INVALID_GUARD_OPERATION", path, "Guard 只允许受支持的类型化操作，不接受自由表达式字符串或代码。"); return; }
    const [min, max] = ARITY[node.operator];
    if (node.operands.length < min || node.operands.length > max) add("INVALID_GUARD_ARITY", `${path}/operands`, `${node.operator} 操作数个数不符合合同。`);
    node.operands.forEach((operand, index) => walk(operand, `${path}/operands/${index}`, depth + 1));
  };
  walk(guard.expression, "/expression", 0);
  return gseosReceipt(diagnostics);
}
