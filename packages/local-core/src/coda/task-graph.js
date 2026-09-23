import { assetFingerprint } from "./asset.js";
import { codaDiagnostic, codaReceipt } from "./diagnostics.js";
import { validateGuardExpression } from "./guard-expression.js";
import { lowerToExecutionPlan } from "./planner.js";

const TASK_NODE_KINDS = new Set(["task", "guard", "observation", "mode_transition", "tracking", "control", "intent", "reactive"]);
const TASK_EDGE_RELATIONS = new Set(["requires", "observes", "guards", "hands_off", "completes"]);

/** Validate graph identity, source ownership, references, dependency agreement and acyclicity. */
export function validateTaskGraph(graph) {
  const diagnostics = [];
  const add = (code, message, extra = {}) => diagnostics.push(codaDiagnostic(code, message, extra));
  if (!graph || typeof graph !== "object" || graph.graph_type !== "TaskGraph" || graph.graph_version !== 1) {
    return codaReceipt([codaDiagnostic("INVALID_TASK_GRAPH_HEADER", "TaskGraph 必须声明受支持的图类型和版本。")]);
  }
  if (typeof graph.event_id !== "string" || !/^[a-z][a-z0-9_.-]*$/u.test(graph.event_id)) add("INVALID_TASK_GRAPH_EVENT", "TaskGraph event_id 格式无效。", { event_id: graph.event_id });
  if (typeof graph.source_fingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(graph.source_fingerprint)) add("INVALID_TASK_GRAPH_FINGERPRINT", "TaskGraph 必须绑定 SHA-256 source fingerprint。", { event_id: graph.event_id });
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) add("TASK_GRAPH_EMPTY", "TaskGraph 必须至少包含一个节点。", { event_id: graph.event_id });
  if (!Array.isArray(graph.edges)) add("INVALID_TASK_GRAPH_EDGES", "TaskGraph edges 必须是数组。", { event_id: graph.event_id });
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return codaReceipt(diagnostics);

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
    if (node.activation_policy !== undefined && node.activation_policy !== "any_predecessor") add("INVALID_TASK_GRAPH_ACTIVATION_POLICY", "TaskGraph 当前只允许显式 any_predecessor 合流策略。", { event_id: graph.event_id, node_id: node.node_id });
    const ref = node.source_ref;
    if (!ref || ref.event_id !== graph.event_id || ref.node_id !== node.node_id || typeof ref.path !== "string" || !ref.path.startsWith("/")) {
      add("TASK_GRAPH_SOURCE_REF_MISMATCH", "source_ref 必须定位到本图同一事件与节点的作者源路径。", { event_id: graph.event_id, node_id: node.node_id });
    }
    if (node.depends_on !== undefined && (!Array.isArray(node.depends_on) || new Set(node.depends_on).size !== node.depends_on.length)) add("INVALID_TASK_GRAPH_DEPENDENCIES", "depends_on 必须是无重复节点 ID 数组。", { event_id: graph.event_id, node_id: node.node_id });
    if (node.branch_context !== undefined && (!Array.isArray(node.branch_context) || node.branch_context.some((item) => !item || typeof item.guard_node_id !== "string" || !["true", "false"].includes(item.outcome)))) add("INVALID_TASK_GRAPH_BRANCH_CONTEXT", "branch_context 必须是 Guard ID 与 true/false outcome 组成的数组。", { event_id: graph.event_id, node_id: node.node_id });
  }
  for (const node of nodes.values()) {
    const context = Array.isArray(node.branch_context) ? node.branch_context : [];
    const contextGuards = new Set();
    for (const item of context) {
      if (contextGuards.has(item.guard_node_id)) add("DUPLICATE_TASK_GRAPH_BRANCH_CONTEXT", "branch_context 不得重复声明同一 Guard。", { event_id: graph.event_id, node_id: node.node_id, target_id: item.guard_node_id });
      contextGuards.add(item.guard_node_id);
      if (nodes.get(item.guard_node_id)?.kind !== "guard") add("TASK_GRAPH_BRANCH_CONTEXT_GUARD_MISSING", "branch_context 必须引用本图中的 Guard 节点。", { event_id: graph.event_id, node_id: node.node_id, target_id: item.guard_node_id });
    }
  }

  const adjacency = new Map([...nodes.keys()].map((id) => [id, []]));
  const edgeKeys = new Set();
  for (const [index, edge] of graph.edges.entries()) {
    if (!edge || !nodes.has(edge.from) || !nodes.has(edge.to) || !TASK_EDGE_RELATIONS.has(edge.relation)) {
      add("INVALID_TASK_GRAPH_EDGE", "每条图边必须引用存在的节点并使用已知 relation。", { event_id: graph.event_id, path: `/edges/${index}` });
      continue;
    }
    if (edge.relation === "guards" && (nodes.get(edge.from)?.kind !== "guard" || !["true", "false"].includes(edge.outcome))) add("INVALID_TASK_GRAPH_GUARD_EDGE", "guards 边必须从 Guard 节点发出并标记 true/false outcome。", { event_id: graph.event_id, path: `/edges/${index}` });
    else if (edge.relation === "completes" && edge.outcome !== "complete") add("INVALID_TASK_GRAPH_COMPLETION_EDGE", "completes 边必须标记 complete outcome。", { event_id: graph.event_id, path: `/edges/${index}` });
    else if (edge.relation === "hands_off" && (!new Set(["control", "mode_transition"]).has(nodes.get(edge.from)?.kind) || !new Set(["control", "mode_transition"]).has(nodes.get(edge.to)?.kind) || !/^[a-z][a-z0-9_.-]*@\d+$/u.test(String(edge.contract_ref ?? "")))) add("INVALID_TASK_GRAPH_HANDOFF_EDGE", "hands_off 必须连接 Controller/ModeTransition 节点并绑定版本化 HandoffContract。", { event_id: graph.event_id, path: `/edges/${index}` });
    else if (edge.relation !== "hands_off" && edge.contract_ref !== undefined) add("INVALID_TASK_GRAPH_EDGE_CONTRACT", "只有 hands_off 边可以绑定 HandoffContract。", { event_id: graph.event_id, path: `/edges/${index}` });
    if (!["guards", "completes"].includes(edge.relation) && edge.outcome !== undefined) add("INVALID_TASK_GRAPH_EDGE_OUTCOME", "guards/completes 边之外不得携带 outcome。", { event_id: graph.event_id, path: `/edges/${index}` });
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
    const incomingCompletionEdges = graph.edges.filter((edge) => edge.to === node.node_id && edge.relation === "completes");
    if (node.activation_policy === "any_predecessor") {
      if (incomingCompletionEdges.length < 2 || incomingCompletionEdges.some((edge) => edge.outcome !== "complete") || (node.depends_on?.length ?? 0) > 0) add("TASK_GRAPH_ANY_PREDECESSOR_INVALID", "any_predecessor 节点必须由至少两个 complete 边作为互斥路径入口，且不得混入全体依赖。", { event_id: graph.event_id, node_id: node.node_id });
      const contexts = incomingCompletionEdges.map((edge) => new Map((nodes.get(edge.from)?.branch_context ?? []).map((item) => [item.guard_node_id, item.outcome])));
      for (let left = 0; left < contexts.length; left += 1) {
        for (let right = left + 1; right < contexts.length; right += 1) {
          const mutuallyExclusive = [...contexts[left]].some(([guardId, outcome]) => contexts[right].has(guardId) && contexts[right].get(guardId) !== outcome);
          if (!mutuallyExclusive) add("TASK_GRAPH_JOIN_PATHS_NOT_EXCLUSIVE", "any_predecessor 的每一对 completes 前驱都必须由矛盾的 Guard outcome 证明互斥。", { event_id: graph.event_id, node_id: node.node_id, source_id: incomingCompletionEdges[left].from, target_id: incomingCompletionEdges[right].from });
        }
      }
    } else if (incomingCompletionEdges.length > 0) {
      add("TASK_GRAPH_COMPLETION_POLICY_MISSING", "接收 completes 边的节点必须声明 any_predecessor。", { event_id: graph.event_id, node_id: node.node_id });
    }
    if (node.kind !== "guard") {
      if (node.branch_entries !== undefined) add("TASK_GRAPH_BRANCH_ENTRIES_ON_NON_GUARD", "只有 Guard 节点可以声明分支入口。", { event_id: graph.event_id, node_id: node.node_id });
      continue;
    }
    const outcomes = adjacency.get(node.node_id) ?? [];
    const guardEdges = graph.edges.filter((edge) => edge.from === node.node_id && edge.relation === "guards");
    const labels = guardEdges.map((edge) => edge.outcome);
    if (guardEdges.length !== 2 || new Set(labels).size !== 2 || !labels.includes("true") || !labels.includes("false")) add("TASK_GRAPH_GUARD_OUTCOMES_INCOMPLETE", "每个 Guard 必须恰有 true/false 两个分支出口。", { event_id: graph.event_id, node_id: node.node_id });
    if (outcomes.length !== guardEdges.length) add("TASK_GRAPH_GUARD_HAS_NONCONDITIONAL_EDGE", "Guard 节点的所有出口都必须是条件边。", { event_id: graph.event_id, node_id: node.node_id });
    const entries = node.branch_entries;
    if (!entries || typeof entries.true !== "string" || typeof entries.false !== "string" || entries.true === entries.false) {
      add("TASK_GRAPH_GUARD_ENTRIES_INVALID", "Guard 必须分别声明不同的 true/false 分支入口。", { event_id: graph.event_id, node_id: node.node_id });
    } else {
      for (const outcome of ["true", "false"]) {
        const edge = guardEdges.find((candidate) => candidate.outcome === outcome);
        if (!nodes.has(entries[outcome]) || edge?.to !== entries[outcome]) add("TASK_GRAPH_GUARD_ENTRY_MISMATCH", `${outcome} Guard 边必须指向其声明的分支入口。`, { event_id: graph.event_id, node_id: node.node_id, outcome, target_id: entries[outcome] });
        const entryContext = nodes.get(entries[outcome])?.branch_context ?? [];
        if (!entryContext.some((item) => item.guard_node_id === node.node_id && item.outcome === outcome)) add("TASK_GRAPH_GUARD_CONTEXT_MISMATCH", `${outcome} 分支入口必须记录对应 Guard path condition。`, { event_id: graph.event_id, node_id: node.node_id, outcome, target_id: entries[outcome] });
      }
    }
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
  return codaReceipt(diagnostics);
}

/** Lower MotionIntent sequences and guarded branches with explicit any-predecessor joins. */
export function lowerToTaskGraph(asset, registry, { guard_bindings = {}, known_observation_refs = [] } = {}) {
  const lowered = lowerToExecutionPlan(asset, registry);
  if (!lowered.receipt.ok) return { task_graph: null, receipt: lowered.receipt };

  const instructions = lowered.plan.instructions;
  if (instructions.length === 0) {
    return {
      task_graph: null,
      receipt: codaReceipt([codaDiagnostic("TASK_GRAPH_EMPTY", "空执行计划不能生成 TaskGraph。", { event_id: asset.event_id })]),
    };
  }
  const nodes = [];
  const edges = [];
  const makeIntentNode = (instruction, branchContext) => ({ node_id: instruction.source_ref.node_id, kind: "intent", contract_ref: instruction.target, source_ref: instruction.source_ref, ...(branchContext.length > 0 ? { branch_context: structuredClone(branchContext) } : {}) });
  const lowerSequence = (sequence, branchContext = []) => {
    if (!Array.isArray(sequence) || sequence.length === 0) return { error: codaDiagnostic("TASK_GRAPH_UNSUPPORTED_BRANCH_ARM", "每个受支持的控制流分支必须包含至少一个可 lower 的节点；未生成部分图。", { event_id: asset.event_id }) };
    let entry = null;
    let frontier = [];
    let frontierIsAlternative = false;
    for (const instruction of sequence) {
      if (instruction.opcode === "MotionIntent") {
        const node = makeIntentNode(instruction, branchContext);
        nodes.push(node);
        if (entry === null) entry = node.node_id;
        if (frontierIsAlternative) {
          node.activation_policy = "any_predecessor";
          for (const from of frontier) edges.push({ from, to: node.node_id, relation: "completes", outcome: "complete" });
        } else if (frontier.length > 0) {
          node.depends_on = [...frontier];
          for (const from of frontier) edges.push({ from, to: node.node_id, relation: "requires" });
        }
        frontier = [node.node_id];
        frontierIsAlternative = false;
        continue;
      }
      if (instruction.opcode !== "Branch") {
        return { error: codaDiagnostic("TASK_GRAPH_UNSUPPORTED_INSTRUCTION", `TaskGraph lowering 暂不支持此组合中的 ${instruction.opcode}；未生成部分图。`, { event_id: asset.event_id, node_id: instruction.source_ref?.node_id }) };
      }
      const branch = instruction;
    const guard = guard_bindings[branch.source_ref.node_id];
    const guardReceipt = validateGuardExpression(guard, { known_observation_refs });
    if (!guard || !guardReceipt.ok || branch.condition?.kind !== "ref" || guard.condition_ref !== branch.condition.name || guard.source_ref.event_id !== asset.event_id || guard.source_ref.node_id !== branch.source_ref.node_id || guard.source_ref.path !== branch.source_ref.path) {
        return { error: codaDiagnostic("TASK_GRAPH_GUARD_UNBOUND", "Branch 必须绑定同一 source node/path 的有效 GuardExpression@1。", { event_id: asset.event_id, node_id: branch.source_ref.node_id, diagnostics: guardReceipt.diagnostics }) };
    }
      const containsObservationRef = (expression) => expression?.node_type === "observation_ref" || (expression?.node_type === "operation" && expression.operands.some(containsObservationRef));
      if (!containsObservationRef(guard.expression)) return { error: codaDiagnostic("TASK_GRAPH_GUARD_NOT_OBSERVATION_BOUND", "可 lower 的分支 Guard 必须依赖至少一个已绑定 observation。", { event_id: asset.event_id, node_id: branch.source_ref.node_id }) };
      const guardNode = { node_id: branch.source_ref.node_id, kind: "guard", contract_ref: guard.guard_id, source_ref: branch.source_ref, ...(branchContext.length > 0 ? { branch_context: structuredClone(branchContext) } : {}) };
      nodes.push(guardNode);
      if (entry === null) entry = guardNode.node_id;
      if (frontierIsAlternative) {
        guardNode.activation_policy = "any_predecessor";
        for (const from of frontier) edges.push({ from, to: guardNode.node_id, relation: "completes", outcome: "complete" });
      } else if (frontier.length > 0) {
        guardNode.depends_on = [...frontier];
        for (const from of frontier) edges.push({ from, to: guardNode.node_id, relation: "requires" });
      }
      const thenArm = lowerSequence(branch.then, [...branchContext, { guard_node_id: guardNode.node_id, outcome: "true" }]);
      const elseArm = lowerSequence(branch.else, [...branchContext, { guard_node_id: guardNode.node_id, outcome: "false" }]);
      if (thenArm.error || elseArm.error) return { error: thenArm.error ?? elseArm.error };
      guardNode.branch_entries = { true: thenArm.entry, false: elseArm.entry };
      edges.push(
        { from: guardNode.node_id, to: thenArm.entry, relation: "guards", outcome: "true" },
        { from: guardNode.node_id, to: elseArm.entry, relation: "guards", outcome: "false" },
      );
      frontier = [...thenArm.terminals, ...elseArm.terminals];
      frontierIsAlternative = true;
    }
    return { entry, terminals: frontier };
  };
  const loweredSequence = lowerSequence(instructions);
  if (loweredSequence.error) return { task_graph: null, receipt: codaReceipt([loweredSequence.error]) };

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
