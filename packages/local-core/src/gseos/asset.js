import { createHash } from "node:crypto";
import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";

const EVENT_ID = /^[a-z][a-z0-9]*(?:\.[a-z0-9]+)*$/;
const NODE_ID = /^[a-z0-9][a-z0-9._-]*$/;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function assetFingerprint(asset) {
  return `sha256:${createHash("sha256").update(stableStringify(asset)).digest("hex")}`;
}

function validateNode(node, path, eventId, diagnostics, seen) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    diagnostics.push(gseosDiagnostic("INVALID_NODE", "节点必须是对象。", { path }));
    return;
  }
  if (typeof node.node_id !== "string" || !NODE_ID.test(node.node_id)) diagnostics.push(gseosDiagnostic("INVALID_NODE_ID", "node_id 必须是稳定的小写机器标识。", { path: `${path}/node_id` }));
  if (seen.has(node.node_id)) diagnostics.push(gseosDiagnostic("DUPLICATE_NODE_ID", `节点 ID 重复：${node.node_id}。`, { path: `${path}/node_id` }));
  seen.add(node.node_id);
  if (typeof node.command_id !== "string" || !node.command_id) diagnostics.push(gseosDiagnostic("INVALID_COMMAND_ID", "command_id 必须是非空字符串。", { path: `${path}/command_id` }));
  if (!node.params || typeof node.params !== "object" || Array.isArray(node.params)) diagnostics.push(gseosDiagnostic("INVALID_NODE_PARAMS", "params 必须是对象。", { path: `${path}/params` }));
  for (const [slot, children] of Object.entries(node.children ?? {})) {
    if (!Array.isArray(children)) diagnostics.push(gseosDiagnostic("INVALID_CHILD_SLOT", `子槽位 ${slot} 必须是数组。`, { path: `${path}/children/${slot}` }));
    else children.forEach((child, index) => validateNode(child, `${path}/children/${slot}/${index}`, eventId, diagnostics, seen));
  }
}

export function validateEventAsset(asset, { capabilities = [] } = {}) {
  const diagnostics = [];
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) return gseosReceipt([gseosDiagnostic("INVALID_ASSET", "EventAsset 必须是对象。", { path: "/" })]);
  if (asset.asset_type !== "EventAsset") diagnostics.push(gseosDiagnostic("INVALID_ASSET_TYPE", "asset_type 必须为 EventAsset。", { path: "/asset_type" }));
  if (asset.schema_version !== 1) diagnostics.push(gseosDiagnostic("UNSUPPORTED_ASSET_VERSION", "首发只支持 EventAsset@1。", { path: "/schema_version" }));
  if (typeof asset.event_id !== "string" || !EVENT_ID.test(asset.event_id)) diagnostics.push(gseosDiagnostic("INVALID_EVENT_ID", "event_id 必须是稳定的小写点分 ID。", { path: "/event_id" }));
  if (typeof asset.display_name !== "string" || !asset.display_name.trim()) diagnostics.push(gseosDiagnostic("REQUIRED_DISPLAY_NAME", "display_name 不能为空。", { path: "/display_name" }));
  if (!Array.isArray(asset.args)) diagnostics.push(gseosDiagnostic("INVALID_ARGS", "args 必须是数组。", { path: "/args" }));
  else {
    const ids = new Set();
    asset.args.forEach((arg, index) => {
      if (!arg || typeof arg !== "object" || !arg.id || !arg.type) diagnostics.push(gseosDiagnostic("INVALID_ARG", "事件参数必须包含 id 和 type。", { path: `/args/${index}` }));
      if (ids.has(arg?.id)) diagnostics.push(gseosDiagnostic("DUPLICATE_ARG_ID", `事件参数 ID 重复：${arg.id}。`, { path: `/args/${index}/id` }));
      ids.add(arg?.id);
    });
  }
  if (!Array.isArray(asset.root)) diagnostics.push(gseosDiagnostic("INVALID_ROOT", "root 必须是节点数组。", { path: "/root" }));
  else { const seen = new Set(); asset.root.forEach((node, index) => validateNode(node, `/root/${index}`, asset.event_id, diagnostics, seen)); }
  if (asset.reentry !== undefined && !["reject", "replace", "parallel"].includes(asset.reentry)) diagnostics.push(gseosDiagnostic("INVALID_REENTRY", "reentry 只能为 reject、replace 或 parallel。", { path: "/reentry" }));
  if (asset.recovery !== undefined && asset.recovery !== "E0") diagnostics.push(gseosDiagnostic("UNSUPPORTED_RECOVERY", "首发只支持 E0。", { path: "/recovery" }));
  if (capabilities.length) {
    const known = new Set(capabilities.map((item) => `${item.id}@${item.version}`));
    const walk = (nodes) => nodes.flatMap((node) => [node, ...Object.values(node.children ?? {}).flatMap(walk)]);
    for (const node of walk(asset.root ?? [])) {
      const capability = node.params?.capability;
      if (capability && !known.has(capability)) diagnostics.push(gseosDiagnostic("CAPABILITY_VERSION_MISMATCH", `未登记的能力：${capability}。`, { path: `/node/${node.node_id}/params/capability`, node_id: node.node_id }));
    }
  }
  return gseosReceipt(diagnostics);
}

export function normalizeEventAsset(asset) {
  const output = clone(asset);
  const assign = (nodes, prefix) => nodes.map((node, index) => {
    const next = { ...node, node_id: node.node_id || `${prefix}.${index + 1}` };
    if (node.children) next.children = Object.fromEntries(Object.entries(node.children).map(([slot, children]) => [slot, assign(children, `${next.node_id}.${slot}`)]));
    return next;
  });
  output.asset_type ??= "EventAsset";
  output.schema_version ??= 1;
  output.args ??= [];
  output.root = assign(output.root ?? [], output.event_id || "event");
  return output;
}

export function migrateEventAsset(source) {
  const original = clone(source);
  const version = source?.schema_version ?? 0;
  if (version === 1) return { asset: normalizeEventAsset(source), original, receipt: gseosReceipt() };
  if (version === 0 && source && typeof source === "object" && Array.isArray(source.root)) {
    const asset = normalizeEventAsset({ ...source, asset_type: "EventAsset", schema_version: 1 });
    return { asset, original, receipt: gseosReceipt([gseosDiagnostic("MIGRATED_EVENT_ASSET", "已将 EventAsset v0 显式迁移到 v1；请复核未知字段和 node_id。", { severity: "warning", path: "/schema_version" })]) };
  }
  return { asset: null, original, receipt: gseosReceipt([gseosDiagnostic("UNSUPPORTED_ASSET_VERSION", `无法从 EventAsset v${version} 迁移到 v1；原始数据已保留。`, { path: "/schema_version" })]) };
}

export function roundTripEventAsset(jsonText) {
  try {
    const source = JSON.parse(String(jsonText).replace(/^\uFEFF/, ""));
    const migrated = migrateEventAsset(source);
    if (!migrated.asset) return { asset: null, json: String(jsonText), receipt: migrated.receipt };
    const receipt = validateEventAsset(migrated.asset);
    return { asset: migrated.asset, json: `${JSON.stringify(migrated.asset, null, 2)}\n`, receipt: gseosReceipt([...migrated.receipt.diagnostics, ...receipt.diagnostics]) };
  } catch (error) {
    return { asset: null, json: String(jsonText), receipt: gseosReceipt([gseosDiagnostic("INVALID_JSON", error.message, { path: "/" })]) };
  }
}
