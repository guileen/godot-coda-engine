import { assetFingerprint } from "./asset.js";
import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";
import { validateGuardExpression } from "./guard-expression.js";
import { lowerToExecutionPlan } from "./planner.js";

const TASK_NODE_KINDS = new Set(["task", "guard", "observation", "mode_transition", "tracking", "control", "intent", "reactive"]);
const TASK_EDGE_RELATIONS = new Set(["requires", "observes", "guards", "hands_off", "completes"]);

/** Validate graph identity, source ownership, references, dependency agreement and acyclicity. */
export function validateTaskGraph(graph) {
  const diagnostics = [];
  const add = (code, message, extra = {}) => diagnostics.push(gseosDiagnostic(code, message, extra));
  if (!graph || typeof graph !== "object" || graph.graph_type !== "TaskGraph" || graph.graph_version !== 1) {
    return gseosReceipt([gseosDiagnostic("INVALID_TASK_GRAPH_HEADER", "TaskGraph 必须声明受支持的图类型和版本。")]);
  }
  if (typeof graph.event_id !== "string" || !/^[a-z][a-z0-9_.-]*$/u.test(graph.event_id)) add("INVALID_TASK_GRAPH_EVENT", "TaskGraph event_id 格式无效。", { event_id: graph.event_id });
  if (typeof graph.source_fingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(graph.source_fingerprint)) add("INVALID_TASK_GRAPH_FINGERPRINT", "TaskGraph 必须绑定 SHA-256 source fingerprint。", { event_id: graph.event_id });
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) add("TASK_GRAPH_EMPTY", "TaskGraph 必须至少包含一个节点。", { event_id: graph.event_id });
  if (!Array.isArray(graph.edges)) add("INVALID_TASK_GRAPH_EDGES", "TaskGraph edges 必须是数组。", { event_id: graph.event_id });
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return gseosReceipt(diagnostics);

  const nodes = new Map();
  for (const [index, node] of graph.nodes.entries()) {
    if (!node || typeof node !== "object" || typeof node.node_id !== "string" || node.node_id.length === 0) {
      add("INVALID_TASK_GRAPH_NODE", "TaskGraph 节点必须有稳定 node_id。", { event_id: graph.event_id, path: `/nodes/${index}` });
      continue;
    }
    if (nodes.has(node.node_id)) add("DUPLICATE_TASK_GRAPH_NODE", "TaskGraph node_id 必须唯一。", { event_id: graph.event_id, node_id: node.node_id });
    else nodes.set(node.node_id, node);
    if (!TASK_NODE_KINDS.has(node.kind)) add("INVALID_TASK_GRAPH_NODE_KIND", "TaskGraph 节点 kind 必须使用已知类型。", { event_id: graph.event_id, node_id: node.node_id });
    if (typeof node.contract_ref !== "string" || !/^[a-z][a-z0-9_.-]*@\d+$/u.test(node.contract_ref)) add("INVALID_TASK_GRAPH_CONTRACT_REF", "TaskGraph contract_ref 必须是带版本的稳定引用。", { event_id: graph.event_id, node_id: node.node_id });
    const ref = node.source_ref;
    if (!ref || ref.event_id !== graph.event_id || ref.node_id !== node.node_id || typeof ref.path !== "string" || !ref.path.startsWith("/")) {
      add("TASK_GRAPH_SOURCE_REF_MISMATCH", "source_ref 必须定位到本图同一事件与节点的作者源路径。", { event_id: graph.event_id, node_id: node.node_id });
    }
    if (node.depends_on !== undefined && (!Array.isArray(node.depends_on) || new Set(node.depends_on).size !== node.depends_on.length)) add("INVALID_TASK_GRAPH_DEPENDENCIES", "depends_on 必须是无重复节点 ID 数组。", { event_id: graph.event_id, node_id: node.node_id });
  }

  const adjacency = new Map([...nodes.keys()].map((id) => [id, []]));
  const edgeKeys = new Set();
  for (const [index, edge] of graph.edges.entries()) {
    if (!edge || !nodes.has(edge.from) || !nodes.has(edge.to) || !TASK_EDGE_RELATIONS.has(edge.relation)) {
      add("INVALID_TASK_GRAPH_EDGE", "每条图边必须引用存在的节点并使用已知 relation。", { event_id: graph.event_id, path: `/edges/${index}` });
      continue;
    }
    if (edge.relation === "guards" && (nodes.get(edge.from)?.kind !== "guard" || !["true", "false"].includes(edge.outcome))) add("INVALID_TASK_GRAPH_GUARD_EDGE", "guards 边必须从 Guard 节点发出并标记 true/false outcome。", { event_id: graph.event_id, path: `/edges/${index}` });
    else if (edge.relation !== "guards" && edge.outcome !== undefined) add("INVALID_TASK_GRAPH_EDGE_OUTCOME", "只有 guards 边可以带条件 outcome。", { event_id: graph.event_id, path: `/edges/${index}` });
    const key = `${edge.from}\u0000${edge.to}\u0000${edge.relation}\u0000${edge.outcome ?? ""}`;
    if (edgeKeys.has(key)) add("DUPLICATE_TASK_GRAPH_EDGE", "TaskGraph 不允许重复边。", { event_id: graph.event_id, path: `/edges/${index}` });
    edgeKeys.add(key);
    adjacency.get(edge.from).push(edge.to);
    if (edge.relation === "requires" && !(nodes.get(edge.to).depends_on ?? []).includes(edge.from)) add("TASK_GRAPH_DEPENDENCY_EDGE_MISMATCH", "requires 边必须与目标节点 depends_on 一致。", { event_id: graph.event_id, node_id: edge.to });
  }
  for (const node of nodes.values()) {
    for (const dependency of Array.isArray(node.depends_on) ? node.depends_on : []) {
      if (!nodes.has(dependency)) add("UNKNOWN_TASK_GRAPH_DEPENDENCY", "depends_on 引用了不存在的节点。", { event_id: graph.event_id, node_id: node.node_id, target_id: dependency });
      else if (!edgeKeys.has(`${dependency}\u0000${node.node_id}\u0000requires\u0000`)) add("TASK_GRAPH_DEPENDENCY_EDGE_MISMATCH", "depends_on 必须有对应的 requires 边。", { event_id: graph.event_id, node_id: node.node_id, target_id: dependency });
    }
  }
  for (const node of nodes.values()) {
    if (node.kind !== "guard") continue;
    const outcomes = adjacency.get(node.node_id) ?? [];
    const guardEdges = graph.edges.filter((edge) => edge.from === node.node_id && edge.relation === "guards");
    const labels = guardEdges.map((edge) => edge.outcome);
    if (guardEdges.length !== 2 || new Set(labels).size !== 2 || !labels.includes("true") || !labels.includes("false")) add("TASK_GRAPH_GUARD_OUTCOMES_INCOMPLETE", "每个 Guard 必须恰有 true/false 两个分支出口。", { event_id: graph.event_id, node_id: node.node_id });
    if (outcomes.length !== guardEdges.length) add("TASK_GRAPH_GUARD_HAS_NONCONDITIONAL_EDGE", "Guard 节点的所有出口都必须是条件边。", { event_id: graph.event_id, node_id: node.node_id });
  }

  const indegree = new Map([...nodes.keys()].map((id) => [id, 0]));
  for (const nextNodes of adjacency.values()) for (const next of nextNodes) if (indegree.has(next)) indegree.set(next, indegree.get(next) + 1);
  const ready = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visitedCount = 0;
  while (ready.length > 0) {
    const id = ready.pop();
    visitedCount += 1;
    for (const next of adjacency.get(id) ?? []) {
      if (!indegree.has(next)) continue;
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) ready.push(next);
    }
  }
  if (visitedCount !== nodes.size) add("TASK_GRAPH_CYCLE", "TaskGraph 必须是有向无环图。", { event_id: graph.event_id });
  return gseosReceipt(diagnostics);
}

/** Lower supported linear MotionIntent plans or a GuardExpression-bound two-arm Intent branch. */
export function lowerToTaskGraph(asset, registry, { guard_bindings = {}, known_observation_refs = [] } = {}) {
  const lowered = lowerToExecutionPlan(asset, registry);
  if (!lowered.receipt.ok) return { task_graph: null, receipt: lowered.receipt };

  const instructions = lowered.plan.instructions;
  if (instructions.length === 0) {
    return {
      task_graph: null,
      receipt: gseosReceipt([gseosDiagnostic("TASK_GRAPH_EMPTY", "空执行计划不能生成 TaskGraph。", { event_id: asset.event_id })]),
    };
  }
  let nodes;
  let edges;
  if (instructions.length === 1 && instructions[0].opcode === "Branch") {
    const branch = instructions[0];
    const guard = guard_bindings[branch.source_ref.node_id];
    const guardReceipt = validateGuardExpression(guard, { known_observation_refs });
    if (!guard || !guardReceipt.ok || branch.condition?.kind !== "ref" || guard.condition_ref !== branch.condition.name || guard.source_ref.event_id !== asset.event_id || guard.source_ref.node_id !== branch.source_ref.node_id || guard.source_ref.path !== branch.source_ref.path) {
      return { task_graph: null, receipt: gseosReceipt([gseosDiagnostic("TASK_GRAPH_GUARD_UNBOUND", "Branch 必须绑定同一 source node/path 的有效 GuardExpression@1。", { event_id: asset.event_id, node_id: branch.source_ref.node_id, diagnostics: guardReceipt.diagnostics })]) };
    }
    const containsObservationRef = (expression) => expression?.node_type === "observation_ref" || (expression?.node_type === "operation" && expression.operands.some(containsObservationRef));
    if (!containsObservationRef(guard.expression)) return { task_graph: null, receipt: gseosReceipt([gseosDiagnostic("TASK_GRAPH_GUARD_NOT_OBSERVATION_BOUND", "可 lower 的分支 Guard 必须依赖至少一个已绑定 observation。", { event_id: asset.event_id, node_id: branch.source_ref.node_id })]) };
    const lowerArm = (arm) => {
      if (!Array.isArray(arm) || arm.length === 0 || arm.some((instruction) => instruction.opcode !== "MotionIntent")) return null;
      return arm.map((instruction, index) => ({
        node_id: instruction.source_ref.node_id,
        kind: "intent",
        contract_ref: instruction.target,
        source_ref: instruction.source_ref,
        ...(index > 0 ? { depends_on: [arm[index - 1].source_ref.node_id] } : {}),
      }));
    };
    const thenNodes = lowerArm(branch.then);
    const elseNodes = lowerArm(branch.else);
    if (!thenNodes || !elseNodes) return { task_graph: null, receipt: gseosReceipt([gseosDiagnostic("TASK_GRAPH_UNSUPPORTED_BRANCH_ARM", "if/else 两侧都必须是非空的纯 MotionIntent 序列；未生成部分图。", { event_id: asset.event_id, node_id: branch.source_ref.node_id })]) };
    nodes = [{ node_id: branch.source_ref.node_id, kind: "guard", contract_ref: guard.guard_id, source_ref: branch.source_ref }, ...thenNodes, ...elseNodes];
    edges = [
      { from: branch.source_ref.node_id, to: thenNodes[0].node_id, relation: "guards", outcome: "true" },
      { from: branch.source_ref.node_id, to: elseNodes[0].node_id, relation: "guards", outcome: "false" },
      ...thenNodes.slice(1).map((node, index) => ({ from: thenNodes[index].node_id, to: node.node_id, relation: "requires" })),
      ...elseNodes.slice(1).map((node, index) => ({ from: elseNodes[index].node_id, to: node.node_id, relation: "requires" })),
    ];
  } else if (instructions.every((instruction) => instruction.opcode === "MotionIntent")) {
    nodes = instructions.map((instruction, index) => ({
      node_id: instruction.source_ref.node_id,
      kind: "intent",
      contract_ref: instruction.target,
      source_ref: instruction.source_ref,
      ...(index > 0 ? { depends_on: [instructions[index - 1].source_ref.node_id] } : {}),
    }));
    edges = nodes.slice(1).map((node, index) => ({ from: nodes[index].node_id, to: node.node_id, relation: "requires" }));
  } else {
    const unsupported = instructions.find((instruction) => instruction.opcode !== "MotionIntent") ?? instructions[0];
    return { task_graph: null, receipt: gseosReceipt([gseosDiagnostic("TASK_GRAPH_UNSUPPORTED_INSTRUCTION", `TaskGraph lowering 暂不支持此组合中的 ${unsupported.opcode}；未生成部分图。`, { event_id: asset.event_id, node_id: unsupported.source_ref?.node_id })]) };
  }

  const task_graph = {
      graph_type: "TaskGraph",
      graph_version: 1,
      event_id: asset.event_id,
      source_fingerprint: assetFingerprint(asset),
      nodes,
      edges,
    };
  const receipt = validateTaskGraph(task_graph);
  return { task_graph: receipt.ok ? task_graph : null, receipt };
}
