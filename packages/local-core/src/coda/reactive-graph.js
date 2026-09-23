import { codaDiagnostic, codaReceipt } from "./diagnostics.js";

const NODE_KINDS = new Set(["observe", "evaluate_guard", "request_candidate", "verify_candidate", "execution_admission", "lease_barrier", "adapter_command", "emit_receipt", "terminal"]);
const EDGE_OUTCOMES = new Set(["pass", "reject", "unknown", "timeout", "failure", "terminal"]);

/** Validate graph closure and prove every reachable Adapter command follows a passing admission edge. */
export function validateReactiveExecutionGraph(graph) {
  const diagnostics = [];
  const add = (code, message, extra = {}) => diagnostics.push(codaDiagnostic(code, message, extra));
  if (!graph || typeof graph !== "object" || graph.graph_type !== "ReactiveExecutionGraph" || graph.schema_version !== 1) {
    return codaReceipt([codaDiagnostic("INVALID_REACTIVE_GRAPH_HEADER", "ReactiveExecutionGraph 必须使用受支持的类型和版本。")]);
  }
  if (typeof graph.graph_id !== "string" || !/^[-\w.]+@1$/u.test(graph.graph_id) || typeof graph.parent_effect_ref !== "string" || !/^[-\w.]+@\d+$/u.test(graph.parent_effect_ref) || typeof graph.work_budget_ref !== "string" || !/^[-\w.]+@\d+$/u.test(graph.work_budget_ref) || typeof graph.source_ref !== "string" || graph.source_ref.length === 0) add("INVALID_REACTIVE_GRAPH_BINDING", "Reactive graph 必须绑定版本化 graph/effect/work-budget 与 source 引用。", { graph_id: graph.graph_id });
  if (graph.generated_only !== true || graph.arbitrary_source_execution !== false || graph.adapter_authority_without_admission !== false) add("REACTIVE_GRAPH_AUTHORITY_BOUNDARY", "Reactive graph 必须是生成物，禁止任意源码执行和准入前 Adapter 权限。", { graph_id: graph.graph_id });
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0 || !Array.isArray(graph.edges) || !Array.isArray(graph.terminal_nodes)) return codaReceipt([codaDiagnostic("INVALID_REACTIVE_GRAPH_SHAPE", "Reactive graph 必须包含非空 nodes、edges 与 terminal_nodes 数组。", { graph_id: graph.graph_id })]);

  const nodes = new Map();
  for (const node of graph.nodes) {
    if (!node || typeof node.node_id !== "string" || !node.node_id) { add("INVALID_REACTIVE_GRAPH_NODE", "每个节点必须有稳定 node_id。", { graph_id: graph.graph_id }); continue; }
    if (nodes.has(node.node_id)) add("DUPLICATE_REACTIVE_GRAPH_NODE", "Reactive graph node_id 必须唯一。", { graph_id: graph.graph_id, node_id: node.node_id });
    else nodes.set(node.node_id, node);
    if (!NODE_KINDS.has(node.kind) || typeof node.contract_ref !== "string" || !/^[-\w.]+@\d+$/u.test(node.contract_ref)) add("INVALID_REACTIVE_GRAPH_NODE_TYPE", "节点必须绑定受支持 kind 与版本化 contract_ref。", { graph_id: graph.graph_id, node_id: node.node_id });
  }
  if (!nodes.has(graph.entry_node)) add("REACTIVE_GRAPH_ENTRY_MISSING", "entry_node 必须引用已声明节点。", { graph_id: graph.graph_id, node_id: graph.entry_node });
  const outgoing = new Map([...nodes.keys()].map((id) => [id, []]));
  const edgeSet = new Set();
  for (const edge of graph.edges) {
    if (!edge || !nodes.has(edge.from) || !nodes.has(edge.to) || !EDGE_OUTCOMES.has(edge.outcome)) { add("INVALID_REACTIVE_GRAPH_EDGE", "边必须引用存在节点并使用已知 outcome。", { graph_id: graph.graph_id }); continue; }
    const key = `${edge.from}\u0000${edge.to}\u0000${edge.outcome}`;
    if (edgeSet.has(key)) add("DUPLICATE_REACTIVE_GRAPH_EDGE", "Reactive graph 不允许重复边。", { graph_id: graph.graph_id });
    edgeSet.add(key);
    outgoing.get(edge.from).push(edge);
  }
  const terminals = new Set(graph.terminal_nodes);
  if (terminals.size !== graph.terminal_nodes.length || terminals.size === 0) add("INVALID_REACTIVE_GRAPH_TERMINALS", "terminal_nodes 必须是非空且无重复集合。", { graph_id: graph.graph_id });
  for (const id of terminals) if (!nodes.has(id) || nodes.get(id)?.kind !== "terminal") add("INVALID_REACTIVE_GRAPH_TERMINAL", "每个 terminal_nodes 项必须引用 terminal 节点。", { graph_id: graph.graph_id, node_id: id });
  for (const [id, node] of nodes) {
    if (node.kind === "terminal" && !terminals.has(id)) add("UNDECLARED_REACTIVE_GRAPH_TERMINAL", "所有 terminal 节点都必须列入 terminal_nodes。", { graph_id: graph.graph_id, node_id: id });
    if (node.kind === "terminal" && (outgoing.get(id)?.length ?? 0) > 0) add("REACTIVE_TERMINAL_HAS_OUTGOING_EDGE", "terminal 节点不能继续流向其它节点。", { graph_id: graph.graph_id, node_id: id });
    if (node.kind !== "terminal" && (outgoing.get(id)?.length ?? 0) === 0) add("REACTIVE_NONTERMINAL_DEAD_END", "非 terminal 节点必须有显式后继。", { graph_id: graph.graph_id, node_id: id });
  }

  const queue = nodes.has(graph.entry_node) ? [{ node_id: graph.entry_node, admitted: false }] : [];
  const visited = new Set();
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const state = queue[queueIndex];
    const key = `${state.node_id}\u0000${state.admitted}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const node = nodes.get(state.node_id);
    if (node.kind === "adapter_command" && !state.admitted) add("ADAPTER_COMMAND_BEFORE_ADMISSION", "每条到达 Adapter command 的路径都必须先经过成功的 execution admission。", { graph_id: graph.graph_id, node_id: node.node_id });
    for (const edge of outgoing.get(node.node_id) ?? []) {
      const nextAdmitted = state.admitted || (node.kind === "execution_admission" && edge.outcome === "pass");
      queue.push({ node_id: edge.to, admitted: nextAdmitted });
    }
  }
  const reachable = new Set([...visited].map((item) => item.slice(0, item.lastIndexOf("\u0000"))));
  for (const id of nodes.keys()) if (!reachable.has(id)) add("UNREACHABLE_REACTIVE_GRAPH_NODE", "Reactive graph 不允许不可达节点。", { graph_id: graph.graph_id, node_id: id });
  return codaReceipt(diagnostics);
}
