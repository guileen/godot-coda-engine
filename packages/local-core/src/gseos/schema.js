import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";

export const CAPABILITY_MANIFEST_VERSION = 1;

export function capabilityKey(value) {
  if (typeof value !== "string") return "";
  return value.includes("@") ? value : `${value}@1`;
}

export function createSchemaRegistry(manifest) {
  const capabilities = new Map((manifest?.capabilities ?? []).map((item) => [capabilityKey(`${item.id}@${item.version}`), item]));
  const topics = new Map((manifest?.topics ?? []).map((item) => [capabilityKey(`${item.id}@${item.version}`), item]));
  return {
    manifest,
    capability(id) { return capabilities.get(capabilityKey(id)) ?? null; },
    topic(id) { return topics.get(capabilityKey(id)) ?? null; },
    checkCapability(id, { awaitable = undefined } = {}) {
      const item = capabilities.get(capabilityKey(id));
      if (!item) return gseosReceipt([gseosDiagnostic("CAPABILITY_VERSION_MISMATCH", `能力 ${id} 未登记。`, { target_id: id })]);
      if (awaitable !== undefined && item.awaitable !== awaitable) return gseosReceipt([gseosDiagnostic("INVALID_LIFECYCLE", `${id} 的 await/do 形式与能力契约不匹配。`, { target_id: id })]);
      if (awaitable === true && (!item.cancellation || item.cancellation === "none" || item.cancellation === "not_applicable")) return gseosReceipt([gseosDiagnostic("MISSING_CANCELLATION_CONTRACT", `${id} 可等待但没有 E0 取消安全点。`, { target_id: id })]);
      return gseosReceipt();
    },
  };
}

export function validateCapabilityManifest(manifest) {
  const diagnostics = [];
  if (manifest?.manifest_type !== "GSEOSCapabilityManifest") diagnostics.push(gseosDiagnostic("INVALID_MANIFEST", "能力清单类型不正确。", { path: "/manifest_type" }));
  if (manifest?.schema_version !== CAPABILITY_MANIFEST_VERSION) diagnostics.push(gseosDiagnostic("UNSUPPORTED_MANIFEST_VERSION", "能力清单版本不受支持。", { path: "/schema_version" }));
  const seen = new Set();
  for (const [index, item] of (manifest?.capabilities ?? []).entries()) {
    const key = capabilityKey(`${item.id}@${item.version}`);
    if (!item.id || !Number.isInteger(item.version) || !item.result) diagnostics.push(gseosDiagnostic("INVALID_CAPABILITY", "能力必须包含 id、整数 version 和 result。", { path: `/capabilities/${index}` }));
    if (seen.has(key)) diagnostics.push(gseosDiagnostic("DUPLICATE_CAPABILITY", `能力重复：${key}。`, { path: `/capabilities/${index}` }));
    seen.add(key);
  }
  return gseosReceipt(diagnostics);
}
