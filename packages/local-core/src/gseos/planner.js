import { assetFingerprint, validateEventAsset } from "./asset.js";
import { bindEventAsset } from "./frontend.js";
import { gseosDiagnostic, gseosReceipt, sourceRef } from "./diagnostics.js";

const SUPPORTED_COMMANDS = new Set(["if", "let", "read", "do", "await", "motion_intent", "publish", "return", "escape"]);

function literalArgument(args, key) {
  const value = args?.[key];
  return value && typeof value === "object" && value.kind === "literal" ? value.value : value;
}

function validateMotionIntent(node, asset) {
  const diagnostics = [];
  const params = node.params ?? {};
  const args = params.args ?? {};
  if (!/^[-\w.]+@\d+$/u.test(String(params.intent ?? ""))) diagnostics.push(gseosDiagnostic("INVALID_MOTION_INTENT", "motion_intent 必须使用带版本的意图标识。", { event_id: asset.event_id, node_id: node.node_id }));
  for (const field of ["target", "resources", "priority", "safety_profile", "on_no_solution"]) if (args[field] === undefined) diagnostics.push(gseosDiagnostic("MISSING_MOTION_INTENT_CONTRACT", `机器人意图缺少硬契约字段：${field}。`, { event_id: asset.event_id, node_id: node.node_id, target_id: field }));
  const priority = literalArgument(args, "priority");
  if (priority !== undefined && (!Number.isInteger(priority) || priority < 0 || priority > 100)) diagnostics.push(gseosDiagnostic("INVALID_MOTION_INTENT_PRIORITY", "priority 必须是 0..100 的整数。", { event_id: asset.event_id, node_id: node.node_id, target_id: "priority" }));
  const resources = literalArgument(args, "resources");
  if (resources !== undefined && (typeof resources !== "string" || !resources.includes("@"))) diagnostics.push(gseosDiagnostic("INVALID_MOTION_INTENT_RESOURCES", "resources 必须列出带版本的资源能力。", { event_id: asset.event_id, node_id: node.node_id, target_id: "resources" }));
  const fallback = literalArgument(args, "on_no_solution");
  if (fallback !== undefined && !["reject", "fallback", "safe_stop"].includes(fallback)) diagnostics.push(gseosDiagnostic("INVALID_MOTION_INTENT_FALLBACK", "on_no_solution 只能是 reject、fallback 或 safe_stop。", { event_id: asset.event_id, node_id: node.node_id, target_id: "on_no_solution" }));
  return diagnostics;
}

function expression(value) {
  if (value && typeof value === "object" && value.ref) return { kind: "ref", name: value.ref };
  if (value && typeof value === "object" && value.op === "connect") return { kind: "connect", items: (value.items ?? []).map(expression) };
  if (value && typeof value === "object" && (value.op === "record" || value.record)) return { kind: "record", fields: Object.fromEntries(Object.entries(value.fields ?? value.record).map(([key, item]) => [key, expression(item)])) };
  if (value && typeof value === "object" && value.op) return { kind: "op", op: value.op, left: expression(value.left), right: expression(value.right) };
  return { kind: "literal", value };
}

function expressionArguments(args) { return Object.fromEntries(Object.entries(args ?? {}).filter(([key]) => key !== "bind").map(([key, value]) => [key, expression(value)])); }

function pointerJoin(parts) { return `/${parts.map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`; }

function sourceRefsFor(asset, node, nodePath, registry) {
  const refs = {};
  const add = (fieldId, relativePath) => { refs[fieldId] = sourceRef(asset.event_id, node.node_id, fieldId, { path: pointerJoin([...nodePath, ...relativePath]) }); };
  const params = node.params ?? {};
  if (params.capability) {
    const [id, versionText] = String(params.capability).split("@");
    const capability = registry?.capability?.(params.capability);
    for (const item of capability?.params ?? []) add(item.id, ["params", "args", item.id]);
  } else if (node.command_id === "read") {
    add("target", ["params", "target"]); add("field", ["params", "field"]);
  } else if (node.command_id === "if") add("condition", ["params", "condition"]);
  else if (node.command_id === "let") add("value", ["params", "value"]);
  else if (node.command_id === "motion_intent") { for (const key of ["target", "resources", "priority", "safety_profile", "on_no_solution"]) add(key, ["params", "args", key]); }
  else if (node.command_id === "publish") { add("topic", ["params", "topic"]); add("payload", ["params", "payload"]); }
  else if (node.command_id === "return") add("value", ["params", "value"]);
  return refs;
}

export function checkEventAsset(asset, registry) {
  const diagnostics = [];
  diagnostics.push(...validateEventAsset(asset, { capabilities: [...(registry?.manifest?.capabilities ?? [])] }).diagnostics);
  diagnostics.push(...bindEventAsset(asset, registry).receipt.diagnostics);
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      const params = node.params ?? {};
      const capability = params.capability;
      if (capability) {
        const awaited = node.command_id === "await";
        const result = registry?.checkCapability?.(capability, { awaitable: awaited });
        if (result && !result.ok) diagnostics.push(...result.diagnostics.map((item) => ({ ...item, event_id: asset.event_id, node_id: node.node_id })));
      }
      if (!SUPPORTED_COMMANDS.has(node.command_id)) diagnostics.push(gseosDiagnostic("BACKEND_UNSUPPORTED", `${node.command_id} 不在 E0 首发后端范围内。`, { event_id: asset.event_id, node_id: node.node_id }));
      if (node.command_id === "motion_intent") diagnostics.push(...validateMotionIntent(node, asset));
      if (node.command_id === "publish") {
        const topic = registry?.topic?.(params.topic);
        if (!topic) diagnostics.push(gseosDiagnostic("TOPIC_VERSION_MISMATCH", `事件主题未登记：${params.topic}。`, { event_id: asset.event_id, node_id: node.node_id, target_id: params.topic }));
      }
      if (node.command_id === "escape" && (!Array.isArray(params.inputs) || !Array.isArray(params.outputs))) diagnostics.push(gseosDiagnostic("INVALID_ESCAPE_CONTRACT", "escape 必须声明 inputs 和 outputs 数组。", { event_id: asset.event_id, node_id: node.node_id }));
      walk(Object.values(node.children ?? {}).flat());
    }
  };
  walk(asset.root);
  return gseosReceipt(diagnostics);
}

export function lowerToExecutionPlan(asset, registry) {
  const check = checkEventAsset(asset, registry);
  if (!check.ok) return { plan: null, receipt: check };
  const instructions = [];
  const walk = (nodes, parentPath = ["root"]) => {
    for (const [index, node] of (nodes ?? []).entries()) {
      const nodePath = [...parentPath, String(index)];
      const ref = sourceRef(asset.event_id, node.node_id, undefined, { path: pointerJoin(nodePath), source_refs: sourceRefsFor(asset, node, nodePath, registry) });
      const params = node.params ?? {};
      if (node.command_id === "if") {
        const branch = { opcode: "Branch", condition: expression(params.condition), source_ref: ref, then: [], else: [] };
        instructions.push(branch); const before = instructions.length; walk(node.children?.then, [...nodePath, "children", "then"]); branch.then.push(...instructions.splice(before)); const beforeElse = instructions.length; walk(node.children?.else, [...nodePath, "children", "else"]); branch.else.push(...instructions.splice(beforeElse));
      } else if (node.command_id === "let") instructions.push({ opcode: "Bind", name: params.name, value: expression(params.value), source_ref: ref });
      else if (node.command_id === "read") instructions.push({ opcode: "ReadCapability", target: params.capability ?? "read@1", args: expressionArguments(Object.fromEntries(Object.entries(params).filter(([key]) => key !== "bind"))), bind: params.bind, source_ref: ref });
      else if (node.command_id === "do") instructions.push({ opcode: "InvokeSync", target: params.capability, args: expressionArguments(params.args), bind: params.bind ?? params.args?.bind, source_ref: ref });
      else if (node.command_id === "await") instructions.push({ opcode: "AwaitCapability", target: params.capability, args: expressionArguments(params.args), bind: params.bind ?? params.args?.bind, source_ref: ref });
      else if (node.command_id === "motion_intent") instructions.push({ opcode: "MotionIntent", target: params.intent, args: expressionArguments(params.args), source_ref: ref });
      else if (node.command_id === "publish") instructions.push({ opcode: "Publish", target: params.topic, payload: expression(params.payload), source_ref: ref });
      else if (node.command_id === "return") instructions.push({ opcode: "Return", value: expression(params.value), source_ref: ref });
      else if (node.command_id === "escape") instructions.push({ opcode: "Escape", inputs: params.inputs ?? [], outputs: params.outputs ?? [], code: params.code ?? "", source_ref: ref });
      else instructions.push({ opcode: "Unsupported", command_id: node.command_id, source_ref: ref });
    }
  };
  walk(asset.root);
  const plan = { plan_type: "ExecutionPlan", plan_version: 1, event_id: asset.event_id, asset_fingerprint: assetFingerprint(asset), instructions };
  return { plan, receipt: gseosReceipt() };
}
