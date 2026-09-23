import { createHash } from "node:crypto";
import { stableStringify } from "./asset.js";
import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";

export function planFingerprint(plan) { return `sha256:${createHash("sha256").update(stableStringify(plan)).digest("hex")}`; }

function expressionToGd(value) {
  if (!value) return "null";
  if (value.kind === "ref") return `ctx.get_value(${JSON.stringify(value.name)})`;
  if (value.kind === "literal") return JSON.stringify(value.value);
  if (value.kind === "op") return `(${expressionToGd(value.left)} ${value.op} ${expressionToGd(value.right)})`;
  if (value.kind === "connect") return `str(${value.items.map(expressionToGd).join(", ")})`;
  if (value.kind === "record") return `{${Object.entries(value.fields).map(([key, item]) => `${JSON.stringify(key)}:${expressionToGd(item)}`).join(",")}}`;
  return "null";
}

function objectToGd(value) {
  if (value && typeof value === "object" && value.kind) return expressionToGd(value);
  if (Array.isArray(value)) return `[${value.map(objectToGd).join(", ")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}:${objectToGd(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function sourceField(opcode) {
  return { Branch: "condition", Bind: "value", ReadCapability: "target", InvokeSync: "capability", AwaitCapability: "capability", MotionIntent: "intent", Publish: "topic", Return: "value", Escape: "code" }[opcode] ?? "node";
}

function traceFields(instruction) {
  const fields = Object.keys(instruction.source_ref?.source_refs ?? {});
  return fields.length ? fields : [instruction.source_ref?.field_id ?? sourceField(instruction.opcode)];
}

function traceLines(instruction, status, indent) {
  const nodeId = instruction.source_ref?.node_id ?? "unknown";
  const targetId = instruction.target ?? "";
  return traceFields(instruction).map((fieldId) => `${indent}ctx.record_step(${JSON.stringify(nodeId)}, ${JSON.stringify(fieldId)}, ${JSON.stringify(status)}, ${JSON.stringify(targetId)})`);
}

function emitInstruction(instruction, lines, map, indent = "  ") {
  const start = lines.length + 1; const mappingStart = map.length; const ref = instruction.source_ref; const baseMapping = { event_id: ref.event_id, node_id: ref.node_id, field_id: ref.field_id ?? sourceField(instruction.opcode), path: ref.path, backend: "gdscript", generated_start: start };
  map.push(baseMapping);
  for (const slotRef of Object.values(ref.source_refs ?? {})) map.push({ ...slotRef, backend: "gdscript", generated_start: start });
  lines.push(`${indent}# gseos:event=${ref.event_id} node=${ref.node_id}`);
  lines.push(...traceLines(instruction, "started", indent));
  switch (instruction.opcode) {
    case "Bind": lines.push(`${indent}ctx.set_value(${JSON.stringify(instruction.name)}, ${expressionToGd(instruction.value)})`); break;
    case "ReadCapability": lines.push(`${indent}ctx.set_value(${JSON.stringify(instruction.bind ?? "result")}, await runtime.read(${JSON.stringify(instruction.target)}, ${objectToGd(instruction.args)}))`); break;
    case "InvokeSync": lines.push(`${indent}${instruction.bind ? `ctx.set_value(${JSON.stringify(instruction.bind)}, ` : ""}runtime.call_sync(${JSON.stringify(instruction.target)}, ${objectToGd(instruction.args)})${instruction.bind ? ")" : ""}`); break;
    case "AwaitCapability": lines.push(`${indent}${instruction.bind ? `ctx.set_value(${JSON.stringify(instruction.bind)}, ` : ""}await runtime.await_capability(${JSON.stringify(instruction.target)}, ${objectToGd(instruction.args)})${instruction.bind ? ")" : ""}`); break;
    case "MotionIntent": lines.push(`${indent}await runtime.request_motion_intent(${JSON.stringify(instruction.target)}, ${objectToGd(instruction.args)})`); break;
    case "Publish": lines.push(`${indent}runtime.publish(${JSON.stringify(instruction.target)}, ${expressionToGd(instruction.payload)})`); break;
    case "Return": lines.push(`${indent}runtime.finish_context(ctx)`); lines.push(`${indent}return ${expressionToGd(instruction.value)}`); break;
    case "Escape": lines.push(`${indent}# gseos:escape inputs=${JSON.stringify(instruction.inputs)} outputs=${JSON.stringify(instruction.outputs)}`); lines.push(`${indent}${instruction.code}`); break;
    case "Branch": lines.push(`${indent}if ${expressionToGd(instruction.condition)}:`); instruction.then.forEach((child) => emitInstruction(child, lines, map, `${indent}  `)); if (instruction.else.length) { lines.push(`${indent}else:`); instruction.else.forEach((child) => emitInstruction(child, lines, map, `${indent}  `)); } break;
    default: lines.push(`${indent}push_error(${JSON.stringify(`Unsupported CODA opcode: ${instruction.opcode}`)})`);
  }
  lines.push(...traceLines(instruction, "completed", indent));
  for (const mapping of map.slice(mappingStart)) mapping.generated_end = lines.length;
}

export function generateGdscript(plan) {
  const fingerprint = planFingerprint(plan); const map = []; const lines = [`# GENERATED BY GSEOS. event=${plan.event_id} plan=${fingerprint}`, "# DO NOT EDIT. source is managed outside the runtime.", `extends RefCounted`, "", `func run(runtime, args: Dictionary, owner: Node) -> Variant:`, `  var ctx: GSEOS_RunContext = runtime.create_context(args, owner, ${JSON.stringify(plan.event_id)}, ${JSON.stringify(fingerprint)})`];
  for (const instruction of plan.instructions) emitInstruction(instruction, lines, map);
  lines.push("  runtime.finish_context(ctx)", "  return null", "");
  const source = `${lines.join("\n")}\n`; const sourceMap = { map_version: 2, event_id: plan.event_id, plan_fingerprint: fingerprint, mappings: map };
  return { source, source_map: sourceMap, fingerprint: `sha256:${createHash("sha256").update(source).digest("hex")}` };
}

export function verifyManagedArtifact(source, expected) {
  const diagnostics = []; const marker = `event=${expected.event_id} plan=${expected.plan_fingerprint}`;
  if (!String(source).includes("GENERATED BY GSEOS")) diagnostics.push(gseosDiagnostic("UNMANAGED_ARTIFACT", "工件缺少项目生成标记。", { path: "/" }));
  if (!String(source).includes(marker)) diagnostics.push(gseosDiagnostic("MANAGED_ARTIFACT_CHANGED", "受管工件的事件或计划指纹已变化；停止覆盖并要求显式接管。", { path: "/" }));
  return gseosReceipt(diagnostics);
}

export function resolveSourceRef(sourceMap, generatedLine) {
  const candidates = (sourceMap?.mappings ?? []).filter((item) => item.generated_start <= generatedLine).sort((left, right) => right.generated_start - left.generated_start);
  return candidates[0]?.event_id ? { ...candidates[0] } : null;
}
