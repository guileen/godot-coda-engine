import { createHash } from "node:crypto";
import { assetFingerprint, stableStringify, validateEventAsset } from "./asset.js";
import { codaDiagnostic, codaReceipt } from "./diagnostics.js";

export const PROJECTION_SCHEMA_VERSION = 1;
export const ALIAS_REGISTRY_SCHEMA_VERSION = 1;
export const PATCH_SCHEMA_VERSION = 1;
export const CANDIDATE_SCHEMA_VERSION = 1;

const LAYERS = ["official", "project", "personal"];
const CONTROLS = new Set(["number", "duration", "node_ref", "text", "enum", "json"]);
const TYPES = new Set(["Int", "Float", "Duration", "NodeRef", "Text", "Topic", "Any"]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

export function normalizeAlias(value) {
  return normalizeText(value).toLocaleLowerCase("en-US");
}

function pointerEscape(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointerJoin(parts) {
  return `/${parts.map(pointerEscape).join("/")}`;
}

function pointerParts(pointer) {
  if (pointer === "") return [];
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return null;
  return pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function getPointer(value, pointer) {
  const parts = pointerParts(pointer);
  if (!parts) return undefined;
  let current = value;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(part)) return undefined;
      current = current[Number(part)];
    } else if (typeof current === "object") current = current[part];
    else return undefined;
  }
  return current;
}

function setPointer(value, pointer, nextValue) {
  const parts = pointerParts(pointer);
  if (!parts || parts.length === 0) return false;
  let current = value;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (current === null || current === undefined) return false;
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(part) || Number(part) >= current.length) return false;
      current = current[Number(part)];
    } else if (typeof current === "object" && Object.hasOwn(current, part)) current = current[part];
    else return false;
  }
  const last = parts.at(-1);
  if (current === null || current === undefined) return false;
  if (Array.isArray(current)) {
    if (!/^\d+$/.test(last) || Number(last) >= current.length) return false;
    current[Number(last)] = clone(nextValue);
  } else if (typeof current === "object" && Object.hasOwn(current, last)) current[last] = clone(nextValue);
  else return false;
  return true;
}

function equalValue(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function diagnostic(code, message, extra = {}) {
  return codaDiagnostic(code, message, extra);
}

function validTargetId(targetId) {
  return typeof targetId === "string" && targetId.length > 0 && /^(capability|topic|command|field):[^:]+$/.test(targetId);
}

function validateSlot(slot, path, diagnostics) {
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
    diagnostics.push(diagnostic("INVALID_ALIAS_SLOT", "别名槽位必须是对象。", { path }));
    return;
  }
  if (!slot.type || !TYPES.has(slot.type)) diagnostics.push(diagnostic("INVALID_ALIAS_SLOT_TYPE", `不支持的槽位类型：${slot.type}。`, { path: `${path}/type` }));
  if (!slot.control || !CONTROLS.has(slot.control)) diagnostics.push(diagnostic("INVALID_ALIAS_CONTROL", `不支持的槽位控件：${slot.control}。`, { path: `${path}/control` }));
  if (!slot.label || typeof slot.label !== "object" || Object.values(slot.label).every((item) => !normalizeText(item))) diagnostics.push(diagnostic("MISSING_ALIAS_SLOT_LABEL", "别名槽位必须提供至少一个本地化 label。", { path: `${path}/label` }));
  if (slot.type === "Duration" && slot.control !== "duration") diagnostics.push(diagnostic("INVALID_DURATION_CONTROL", "Duration 槽位必须使用 duration 控件。", { path: `${path}/control` }));
  if (slot.control === "duration" && (!Number.isFinite(slot.min) || !Number.isFinite(slot.max) || slot.min < 0 || slot.max < slot.min || !slot.unit)) diagnostics.push(diagnostic("INVALID_DURATION_CONSTRAINT", "duration 控件必须声明非负范围和单位。", { path }));
  if (slot.control === "node_ref" && slot.type !== "NodeRef") diagnostics.push(diagnostic("INVALID_NODE_REF_CONTROL", "node_ref 控件只能绑定 NodeRef。", { path: `${path}/type` }));
  if (slot.allowed_refs !== undefined && (!Array.isArray(slot.allowed_refs) || slot.allowed_refs.some((item) => typeof item !== "string"))) diagnostics.push(diagnostic("INVALID_ALLOWED_REFS", "allowed_refs 必须是字符串数组。", { path: `${path}/allowed_refs` }));
}

function validateAliasEntry(entry, path, diagnostics) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    diagnostics.push(diagnostic("INVALID_ALIAS_ENTRY", "别名条目必须是对象。", { path }));
    return;
  }
  if (!validTargetId(entry.target_id)) diagnostics.push(diagnostic("INVALID_ALIAS_TARGET", "别名条目必须绑定带 kind 前缀的稳定 target_id。", { path: `${path}/target_id` }));
  if (!["capability", "topic", "command", "field"].includes(entry.kind)) diagnostics.push(diagnostic("INVALID_ALIAS_KIND", `不支持的别名 kind：${entry.kind}。`, { path: `${path}/kind` }));
  if (!Array.isArray(entry.group_path) || entry.group_path.some((item) => !normalizeText(item))) diagnostics.push(diagnostic("INVALID_ALIAS_GROUP", "group_path 必须是非空字符串数组。", { path: `${path}/group_path` }));
  for (const [locale, label] of Object.entries(entry.labels ?? {})) if (!normalizeText(label)) diagnostics.push(diagnostic("INVALID_ALIAS_LABEL", `locale ${locale} 的 label 不能为空。`, { path: `${path}/labels/${locale}` }));
  for (const [locale, aliases] of Object.entries(entry.aliases ?? {})) if (!Array.isArray(aliases) || aliases.some((item) => !normalizeText(item))) diagnostics.push(diagnostic("INVALID_ALIAS_NAMES", `locale ${locale} 的 aliases 必须是非空字符串数组。`, { path: `${path}/aliases/${locale}` }));
  for (const [slotId, slot] of Object.entries(entry.slots ?? {})) validateSlot(slot, `${path}/slots/${slotId}`, diagnostics);
}

export function validateAliasRegistry(registry) {
  const diagnostics = [];
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) return codaReceipt([diagnostic("INVALID_ALIAS_REGISTRY", "AliasRegistry 必须是对象。", { path: "/" })]);
  if (registry.registry_type !== "AliasRegistry") diagnostics.push(diagnostic("INVALID_ALIAS_REGISTRY_TYPE", "registry_type 必须为 AliasRegistry。", { path: "/registry_type" }));
  if (registry.schema_version !== ALIAS_REGISTRY_SCHEMA_VERSION) diagnostics.push(diagnostic("UNSUPPORTED_ALIAS_REGISTRY_VERSION", "AliasRegistry 版本不受支持。", { path: "/schema_version" }));
  if (!normalizeText(registry.registry_version)) diagnostics.push(diagnostic("MISSING_ALIAS_REGISTRY_VERSION", "registry_version 不能为空。", { path: "/registry_version" }));
  const layers = registry.layers ?? {};
  for (const layer of LAYERS) {
    if (!Array.isArray(layers[layer])) {
      diagnostics.push(diagnostic("INVALID_ALIAS_LAYER", `别名层 ${layer} 必须是数组。`, { path: `/layers/${layer}` }));
      continue;
    }
    const targets = new Set();
    const aliases = new Map();
    for (const [index, entry] of layers[layer].entries()) {
      validateAliasEntry(entry, `/layers/${layer}/${index}`, diagnostics);
      if (targets.has(entry?.target_id)) diagnostics.push(diagnostic("DUPLICATE_ALIAS_TARGET", `同一别名层重复绑定 target_id：${entry.target_id}。`, { path: `/layers/${layer}/${index}/target_id` }));
      targets.add(entry?.target_id);
      for (const names of Object.values(entry?.aliases ?? {})) for (const name of names) {
        const key = normalizeAlias(name);
        const prior = aliases.get(key);
        if (prior && prior !== entry.target_id) diagnostics.push(diagnostic("AMBIGUOUS_ALIAS", `同一别名层存在歧义：${name}。`, { path: `/layers/${layer}/${index}/aliases` , target_id: entry.target_id }));
        aliases.set(key, entry.target_id);
      }
    }
  }
  return codaReceipt(diagnostics);
}

function localeValue(values, locale, fallbackLocale = "en") {
  const candidates = [locale, fallbackLocale, "en", "zh-CN"].filter((item, index, all) => item && all.indexOf(item) === index);
  for (const candidate of candidates) if (typeof values?.[candidate] === "string" && values[candidate].trim()) return { value: values[candidate], locale: candidate };
  const first = Object.keys(values ?? {}).sort()[0];
  return first ? { value: values[first], locale: first } : { value: "", locale: null };
}

function entriesForTarget(registry, targetId) {
  return LAYERS.flatMap((layer) => (registry.layers?.[layer] ?? []).filter((entry) => entry.target_id === targetId).map((entry) => ({ layer, entry })));
}

export function resolveAlias(registry, query, { locale = registry?.default_locale ?? "en" } = {}) {
  const checked = validateAliasRegistry(registry);
  if (!checked.ok) return { target_id: null, receipt: checked };
  const direct = normalizeText(query);
  if (!direct) return { target_id: null, receipt: codaReceipt([diagnostic("EMPTY_ALIAS_QUERY", "别名查询不能为空。", { path: "/query" })]) };
  if (validTargetId(direct)) {
    const entries = entriesForTarget(registry, direct);
    if (!entries.length) return { target_id: null, receipt: codaReceipt([diagnostic("UNKNOWN_ALIAS_TARGET", `未找到别名目标：${direct}。`, { target_id: direct })]) };
    const selected = entries.at(-1);
    return { target_id: direct, layer: selected.layer, entry: selected.entry, label: localeValue(selected.entry.labels, locale, registry.default_locale), receipt: codaReceipt() };
  }
  const key = normalizeAlias(direct);
  for (const layer of [...LAYERS].reverse()) {
    const matches = [];
    for (const entry of registry.layers?.[layer] ?? []) {
      const names = Object.values(entry.aliases ?? {}).flat();
      if (names.some((name) => normalizeAlias(name) === key)) matches.push(entry);
    }
    const targets = [...new Set(matches.map((entry) => entry.target_id))];
    if (targets.length > 1) return { target_id: null, receipt: codaReceipt([diagnostic("AMBIGUOUS_ALIAS", `别名存在多个候选：${direct}。`, { target_id: targets.join(",") })]) };
    if (targets.length === 1) {
      const entry = matches.find((item) => item.target_id === targets[0]);
      return { target_id: targets[0], layer, entry, label: localeValue(entry.labels, locale, registry.default_locale), receipt: codaReceipt() };
    }
  }
  return { target_id: null, receipt: codaReceipt([diagnostic("ALIAS_NOT_FOUND", `未找到别名：${direct}。`, { target_id: direct })]) };
}

function contractFingerprint(manifest) {
  return `sha256:${createHash("sha256").update(stableStringify({ capabilities: manifest?.capabilities ?? [], topics: manifest?.topics ?? [] })).digest("hex")}`;
}

function manifestItem(manifest, id, kind) {
  const [base, versionText] = String(id ?? "").split("@");
  const version = Number(versionText ?? 1);
  const list = kind === "topic" ? manifest?.topics ?? [] : manifest?.capabilities ?? [];
  return list.find((item) => item.id === base && item.version === version) ?? null;
}

function inferControl(type) {
  if (type === "Duration") return "duration";
  if (type === "NodeRef") return "node_ref";
  if (type === "Int" || type === "Float") return "number";
  if (type === "Text") return "text";
  if (type === "Topic") return "enum";
  return "json";
}

function referenceIds(asset, manifest) {
  const refs = new Set((asset.args ?? []).filter((arg) => arg.type === "NodeRef").map((arg) => arg.id));
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      const params = node.params ?? {};
      const capability = params.capability;
      const item = capability ? manifestItem(manifest, capability, "capability") : null;
      if (item?.result === "NodeRef") {
        const bind = params.bind ?? params.args?.bind;
        if (bind) refs.add(bind);
      }
      for (const children of Object.values(node.children ?? {})) walk(children);
    }
  };
  walk(asset.root);
  return [...refs].sort();
}

function entryFor(registry, targetId) {
  const matches = entriesForTarget(registry, targetId);
  return matches.at(-1)?.entry ?? null;
}

function commandTarget(node) {
  const params = node.params ?? {};
  if (params.capability) return `capability:${params.capability}`;
  if (params.topic) return `topic:${params.topic}`;
  return `command:${node.command_id}`;
}

function commandFields(node, entry, manifest) {
  const params = node.params ?? {};
  const targetId = commandTarget(node);
  const kind = targetId.startsWith("topic:") ? "topic" : targetId.startsWith("capability:") ? "capability" : "command";
  const item = kind === "capability" || kind === "topic" ? manifestItem(manifest, targetId.slice(kind.length + 1), kind) : null;
  if (item?.params) return item.params.map((param) => ({ field_id: param.id, type: param.type, relative: ["params", "args", param.id], value: params.args?.[param.id], control: null }));
  if (node.command_id === "read") return [{ field_id: "target", type: "NodeRef", relative: ["params", "target"], value: params.target }, { field_id: "field", type: "Text", relative: ["params", "field"], value: params.field }];
  if (node.command_id === "if") return [{ field_id: "condition", type: "Any", relative: ["params", "condition"], value: params.condition, control: "json" }];
  if (node.command_id === "let") return [{ field_id: "value", type: "Any", relative: ["params", "value"], value: params.value, control: "json" }];
  if (node.command_id === "publish") return [{ field_id: "topic", type: "Topic", relative: ["params", "topic"], value: params.topic, control: "enum" }, { field_id: "payload", type: "Any", relative: ["params", "payload"], value: params.payload, control: "json" }];
  return [];
}

function walkNodes(nodes, prefix = ["root"], output = []) {
  (nodes ?? []).forEach((node, index) => {
    const path = [...prefix, String(index)];
    output.push({ node, path });
    for (const [slot, children] of Object.entries(node.children ?? {})) walkNodes(children, [...path, "children", slot], output);
  });
  return output;
}

export function validateSemanticProjectionMap(map) {
  const diagnostics = [];
  if (!map || typeof map !== "object" || Array.isArray(map)) return codaReceipt([diagnostic("INVALID_SEMANTIC_MAP", "SemanticProjectionMap 必须是对象。", { path: "/" })]);
  if (map.projection_type !== "SemanticProjectionMap") diagnostics.push(diagnostic("INVALID_SEMANTIC_MAP_TYPE", "projection_type 必须为 SemanticProjectionMap。", { path: "/projection_type" }));
  if (map.schema_version !== PROJECTION_SCHEMA_VERSION) diagnostics.push(diagnostic("UNSUPPORTED_SEMANTIC_MAP_VERSION", "SemanticProjectionMap 版本不受支持。", { path: "/schema_version" }));
  for (const field of ["event_id", "asset_fingerprint", "contract_fingerprint", "alias_registry_version"]) if (!normalizeText(map[field])) diagnostics.push(diagnostic("MISSING_SEMANTIC_MAP_FIELD", `缺少投影字段：${field}。`, { path: `/${field}` }));
  if (!Array.isArray(map.nodes)) diagnostics.push(diagnostic("INVALID_SEMANTIC_NODES", "投影 nodes 必须是数组。", { path: "/nodes" }));
  const nodes = new Set();
  for (const [index, node] of (map.nodes ?? []).entries()) {
    if (!node || !node.node_id || !node.semantic_id) diagnostics.push(diagnostic("INVALID_SEMANTIC_NODE", "投影节点必须包含 node_id 和 semantic_id。", { path: `/nodes/${index}` }));
    if (nodes.has(node?.node_id)) diagnostics.push(diagnostic("DUPLICATE_SEMANTIC_NODE", `投影节点重复：${node?.node_id}。`, { path: `/nodes/${index}/node_id` }));
    nodes.add(node?.node_id);
    const paths = new Set();
    for (const [slotIndex, slot] of (node?.slots ?? []).entries()) {
      if (!slot.path?.startsWith("/")) diagnostics.push(diagnostic("INVALID_SEMANTIC_SLOT_PATH", "投影槽位必须使用 JSON Pointer。", { path: `/nodes/${index}/slots/${slotIndex}/path` }));
      if (paths.has(slot.path)) diagnostics.push(diagnostic("DUPLICATE_SEMANTIC_SLOT", `投影槽位路径重复：${slot.path}。`, { path: `/nodes/${index}/slots/${slotIndex}/path` }));
      paths.add(slot.path);
    }
  }
  return codaReceipt(diagnostics);
}

export function validateRuntimeTrace(trace) {
  const diagnostics = [];
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) return codaReceipt([diagnostic("INVALID_RUNTIME_TRACE", "RuntimeTrace 必须是对象。", { path: "/" })]);
  if (trace.trace_type !== "RuntimeTrace") diagnostics.push(diagnostic("INVALID_RUNTIME_TRACE_TYPE", "trace_type 必须为 RuntimeTrace。", { path: "/trace_type" }));
  if (trace.schema_version !== 1) diagnostics.push(diagnostic("UNSUPPORTED_RUNTIME_TRACE_VERSION", "RuntimeTrace 版本不受支持。", { path: "/schema_version" }));
  if (trace.run_id === undefined || trace.run_id === null) diagnostics.push(diagnostic("MISSING_RUNTIME_RUN_ID", "RuntimeTrace 必须包含 run_id。", { path: "/run_id" }));
  if (!normalizeText(trace.event_id)) diagnostics.push(diagnostic("MISSING_RUNTIME_EVENT_ID", "RuntimeTrace 必须包含 event_id。", { path: "/event_id" }));
  if (!Array.isArray(trace.steps)) diagnostics.push(diagnostic("INVALID_RUNTIME_STEPS", "RuntimeTrace steps 必须是数组。", { path: "/steps" }));
  for (const [index, step] of (trace.steps ?? []).entries()) {
    if (step?.step_id === undefined || !normalizeText(step?.node_id) || !normalizeText(step?.slot)) diagnostics.push(diagnostic("INVALID_RUNTIME_STEP", "运行步骤必须包含 step_id、node_id 和 slot。", { path: `/steps/${index}` }));
    if (!["started", "completed", "failed", "cancelled", "skipped"].includes(step?.status)) diagnostics.push(diagnostic("INVALID_RUNTIME_STEP_STATUS", `不支持的运行步骤状态：${step?.status}。`, { path: `/steps/${index}/status` }));
  }
  return codaReceipt(diagnostics);
}

export function validateSemanticCandidate(candidate) {
  const diagnostics = [];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return codaReceipt([diagnostic("INVALID_SEMANTIC_CANDIDATE", "SemanticCandidate 必须是对象。", { path: "/" })]);
  if (candidate.candidate_type !== "SemanticCandidate") diagnostics.push(diagnostic("INVALID_SEMANTIC_CANDIDATE_TYPE", "candidate_type 必须为 SemanticCandidate。", { path: "/candidate_type" }));
  if (candidate.schema_version !== CANDIDATE_SCHEMA_VERSION) diagnostics.push(diagnostic("UNSUPPORTED_SEMANTIC_CANDIDATE_VERSION", "SemanticCandidate 版本不受支持。", { path: "/schema_version" }));
  for (const field of ["candidate_id", "status"]) if (!normalizeText(candidate[field])) diagnostics.push(diagnostic("MISSING_SEMANTIC_CANDIDATE_FIELD", `缺少候选字段：${field}。`, { path: `/${field}` }));
  if (!["proposed", "needs_review", "rejected"].includes(candidate.status)) diagnostics.push(diagnostic("INVALID_SEMANTIC_CANDIDATE_STATUS", "候选状态不受支持。", { path: "/status" }));
  if (!candidate.source || !normalizeText(candidate.source.kind)) diagnostics.push(diagnostic("MISSING_SEMANTIC_CANDIDATE_SOURCE", "候选必须声明来源。", { path: "/source" }));
  if (!candidate.confidence || !["low", "medium", "high"].includes(candidate.confidence.state)) diagnostics.push(diagnostic("INVALID_SEMANTIC_CANDIDATE_CONFIDENCE", "候选必须声明置信状态。", { path: "/confidence" }));
  if (candidate.authoritative_target_id !== undefined || candidate.write_confirmed === true) diagnostics.push(diagnostic("CANDIDATE_CANNOT_AUTHORIZE_WRITE", "候选不能建立权威锚点或静默确认写回。", { path: "/" }));
  return codaReceipt(diagnostics);
}

export function buildSemanticProjectionMap(asset, manifest, registry, { sourceMap = null } = {}) {
  const diagnostics = [];
  const assetCheck = validateEventAsset(asset, { capabilities: manifest?.capabilities ?? [] });
  diagnostics.push(...assetCheck.diagnostics);
  const manifestCheck = manifest ? { ok: true, diagnostics: [] } : { ok: false, diagnostics: [diagnostic("MISSING_CONTRACT_MANIFEST", "生成语义投影必须提供 capability/topic 契约。", { path: "/manifest" })] };
  diagnostics.push(...manifestCheck.diagnostics);
  const aliasCheck = validateAliasRegistry(registry);
  diagnostics.push(...aliasCheck.diagnostics);
  if (diagnostics.some((item) => item.severity === "error")) return { map: null, receipt: codaReceipt(diagnostics) };
  const refs = referenceIds(asset, manifest);
  const nodes = [];
  for (const { node, path } of walkNodes(asset.root)) {
    const semanticId = commandTarget(node);
    const entry = entryFor(registry, semanticId);
    if (!entry) {
      diagnostics.push(diagnostic("MISSING_SEMANTIC_ALIAS", `没有为 ${semanticId} 提供语义别名。`, { event_id: asset.event_id, node_id: node.node_id, target_id: semanticId }));
      continue;
    }
    const source = { event_id: asset.event_id, node_id: node.node_id };
    const sourceMappings = sourceMap?.mappings?.filter((mapping) => mapping.node_id === node.node_id) ?? [];
    const nodeMapping = sourceMappings[0];
    if (nodeMapping) Object.assign(source, { generated_start: nodeMapping.generated_start, generated_end: nodeMapping.generated_end ?? nodeMapping.generated_start, backend: nodeMapping.backend, plan_fingerprint: sourceMap.plan_fingerprint });
    const fieldSpecs = commandFields(node, entry, manifest);
    const slots = fieldSpecs.map((spec) => {
      const slotDefinition = entry.slots?.[spec.field_id] ?? {};
      const pathValue = pointerJoin([...path, ...spec.relative]);
      const mapping = sourceMappings.find((item) => item.field_id === spec.field_id);
      const slot = { slot_id: `${node.node_id}.${spec.field_id}`, field_id: spec.field_id, path: pathValue, type: spec.type, control: slotDefinition.control ?? spec.control ?? inferControl(spec.type), value: clone(spec.value) };
      if (slotDefinition.type && slotDefinition.type !== spec.type) diagnostics.push(diagnostic("SEMANTIC_SLOT_TYPE_MISMATCH", `槽位 ${spec.field_id} 的词典类型与能力契约不一致。`, { event_id: asset.event_id, node_id: node.node_id, slot_id: slot.slot_id, expected: spec.type, actual: slotDefinition.type }));
      if (slotDefinition.label) slot.label = clone(slotDefinition.label);
      if (slotDefinition.description) slot.description = clone(slotDefinition.description);
      for (const key of ["min", "max", "unit"]) if (slotDefinition[key] !== undefined) slot[key] = slotDefinition[key];
      if (slot.type === "NodeRef") slot.allowed_refs = slotDefinition.allowed_refs ?? refs;
      if (mapping) slot.source = { event_id: asset.event_id, node_id: node.node_id, field_id: spec.field_id, generated_start: mapping.generated_start, generated_end: mapping.generated_end ?? mapping.generated_start, backend: mapping.backend, plan_fingerprint: sourceMap.plan_fingerprint };
      return slot;
    });
    const label = localeValue(entry.labels, registry.default_locale ?? "zh-CN", "en");
    nodes.push({ node_id: node.node_id, command_id: node.command_id, semantic_id: semanticId, group_path: clone(entry.group_path), labels: clone(entry.labels), descriptions: clone(entry.descriptions), slots, source });
  }
  const map = { projection_type: "SemanticProjectionMap", schema_version: PROJECTION_SCHEMA_VERSION, event_id: asset.event_id, asset_fingerprint: assetFingerprint(asset), contract_fingerprint: contractFingerprint(manifest), alias_registry_version: registry.registry_version, nodes };
  const mapCheck = validateSemanticProjectionMap(map);
  diagnostics.push(...mapCheck.diagnostics);
  return { map: mapCheck.ok ? map : null, receipt: codaReceipt(diagnostics) };
}

function valueMatchesType(value, type) {
  if (type === "Int") return Number.isInteger(value);
  if (type === "Float") return typeof value === "number" && Number.isFinite(value);
  if (type === "Duration") return typeof value === "number" && Number.isFinite(value);
  if (type === "NodeRef") return value && typeof value === "object" && typeof value.ref === "string";
  if (type === "Text") return typeof value === "string";
  if (type === "Topic") return typeof value === "string";
  return value !== undefined;
}

function slotsByPath(projection) {
  const result = new Map();
  for (const node of projection?.nodes ?? []) for (const slot of node.slots ?? []) result.set(slot.path, { ...slot, node_id: node.node_id });
  return result;
}

export function createSemanticPatch({ asset, manifest, registry, projection, operations = [] }) {
  const slots = slotsByPath(projection);
  const diagnostics = [];
  const normalized = operations.map((operation, index) => {
    const slot = operation.path ? slots.get(operation.path) : projection?.nodes?.flatMap((node) => node.slots ?? []).find((item) => item.slot_id === operation.slot_id);
    if (!slot) {
      diagnostics.push(diagnostic("PATCH_SLOT_NOT_FOUND", `找不到可编辑槽位：${operation.slot_id ?? operation.path}。`, { path: `/operations/${index}` }));
      return operation;
    }
    return { op: "replace", slot_id: slot.slot_id, path: slot.path, expected: clone(getPointer(asset, slot.path)), value: clone(operation.value), type: slot.type };
  });
  const patch = { patch_type: "SemanticPatch", schema_version: PATCH_SCHEMA_VERSION, event_id: asset?.event_id, base_asset_fingerprint: assetFingerprint(asset), contract_fingerprint: contractFingerprint(manifest), alias_registry_version: registry?.registry_version, operations: normalized };
  return { patch, receipt: codaReceipt(diagnostics) };
}

export function previewSemanticPatch(asset, patch, { manifest, registry, projection } = {}) {
  const diagnostics = [];
  if (!patch || patch.patch_type !== "SemanticPatch" || patch.schema_version !== PATCH_SCHEMA_VERSION) diagnostics.push(diagnostic("INVALID_SEMANTIC_PATCH", "结构化 patch 版本或类型不受支持。", { path: "/" }));
  if (patch?.event_id !== asset?.event_id) diagnostics.push(diagnostic("PATCH_EVENT_MISMATCH", "patch 与 EventAsset 的 event_id 不匹配。", { path: "/event_id" }));
  if (patch?.base_asset_fingerprint !== assetFingerprint(asset)) diagnostics.push(diagnostic("PATCH_STALE_ASSET", "预览基于过期 EventAsset，必须重新生成预览。", { path: "/base_asset_fingerprint" }));
  if (patch?.contract_fingerprint !== contractFingerprint(manifest)) diagnostics.push(diagnostic("PATCH_STALE_CONTRACT", "预览基于过期契约，必须重新生成预览。", { path: "/contract_fingerprint" }));
  if (patch?.alias_registry_version !== registry?.registry_version) diagnostics.push(diagnostic("PATCH_STALE_ALIAS_REGISTRY", "预览基于过期词典，必须重新生成预览。", { path: "/alias_registry_version" }));
  const slots = slotsByPath(projection);
  const next = clone(asset);
  for (const [index, operation] of (patch?.operations ?? []).entries()) {
    const slot = slots.get(operation.path);
    if (!slot || slot.slot_id !== operation.slot_id) { diagnostics.push(diagnostic("PATCH_PATH_NOT_ALLOWED", `patch 路径未声明为可编辑槽位：${operation.path}。`, { path: `/operations/${index}/path` })); continue; }
    const current = getPointer(asset, operation.path);
    if (!equalValue(current, operation.expected)) diagnostics.push(diagnostic("PATCH_EXPECTED_VALUE_MISMATCH", `槽位 ${operation.slot_id} 的旧值已经变化。`, { path: `/operations/${index}/expected`, slot_id: operation.slot_id }));
    if (operation.type !== slot.type || !valueMatchesType(operation.value, slot.type)) diagnostics.push(diagnostic("PATCH_VALUE_TYPE_MISMATCH", `槽位 ${operation.slot_id} 的新值类型不匹配。`, { path: `/operations/${index}/value`, slot_id: operation.slot_id }));
    if (slot.type === "Duration" && (operation.value < slot.min || operation.value > slot.max)) diagnostics.push(diagnostic("PATCH_VALUE_OUT_OF_RANGE", `槽位 ${operation.slot_id} 超出允许范围。`, { path: `/operations/${index}/value`, slot_id: operation.slot_id }));
    if (slot.type === "NodeRef" && Array.isArray(slot.allowed_refs) && !slot.allowed_refs.includes(operation.value.ref)) diagnostics.push(diagnostic("PATCH_REFERENCE_NOT_ALLOWED", `槽位 ${operation.slot_id} 不允许引用 ${operation.value.ref}。`, { path: `/operations/${index}/value`, slot_id: operation.slot_id }));
    if (!setPointer(next, operation.path, operation.value)) diagnostics.push(diagnostic("PATCH_PATH_INVALID", `patch 路径不存在：${operation.path}。`, { path: `/operations/${index}/path` }));
  }
  const assetCheck = validateEventAsset(next, { capabilities: manifest?.capabilities ?? [] });
  diagnostics.push(...assetCheck.diagnostics);
  const ok = !diagnostics.some((item) => item.severity === "error");
  return { ok, asset: ok ? next : clone(asset), before: clone(asset), after: ok ? next : clone(asset), changed: ok && !equalValue(asset, next), receipt: codaReceipt(diagnostics) };
}

export function applySemanticPatch(asset, patch, context = {}) {
  return previewSemanticPatch(asset, patch, context);
}
