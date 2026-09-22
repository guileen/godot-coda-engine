import { assetFingerprint } from "./asset.js";
import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";
import { lowerToExecutionPlan } from "./planner.js";

/** Lower the currently supported linear MotionIntent subset into a typed TaskGraph. */
export function lowerToTaskGraph(asset, registry) {
  const lowered = lowerToExecutionPlan(asset, registry);
  if (!lowered.receipt.ok) return { task_graph: null, receipt: lowered.receipt };

  const instructions = lowered.plan.instructions;
  if (instructions.length === 0) {
    return {
      task_graph: null,
      receipt: gseosReceipt([gseosDiagnostic("TASK_GRAPH_EMPTY", "空执行计划不能生成 TaskGraph。", { event_id: asset.event_id })]),
    };
  }
  const unsupported = instructions.find((instruction) => instruction.opcode !== "MotionIntent");
  if (unsupported) {
    return {
      task_graph: null,
      receipt: gseosReceipt([gseosDiagnostic(
        "TASK_GRAPH_UNSUPPORTED_INSTRUCTION",
        `TaskGraph lowering 暂不支持 ${unsupported.opcode}；未生成部分图。`,
        { event_id: asset.event_id, node_id: unsupported.source_ref?.node_id },
      )]),
    };
  }

  const nodes = instructions.map((instruction, index) => ({
    node_id: instruction.source_ref.node_id,
    kind: "intent",
    contract_ref: instruction.target,
    source_ref: instruction.source_ref,
    ...(index > 0 ? { depends_on: [instructions[index - 1].source_ref.node_id] } : {}),
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    from: nodes[index].node_id,
    to: node.node_id,
    relation: "requires",
  }));

  return {
    task_graph: {
      graph_type: "TaskGraph",
      graph_version: 1,
      event_id: asset.event_id,
      source_fingerprint: assetFingerprint(asset),
      nodes,
      edges,
    },
    receipt: gseosReceipt(),
  };
}
