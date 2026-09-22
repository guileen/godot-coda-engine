import { assetFingerprint } from "./asset.js";
import { gseosDiagnostic } from "./diagnostics.js";

const refPattern = /^[-\w.]+@\d+$/u;
const blockedPathSegments = new Set(["__proto__", "prototype", "constructor"]);

export function authoringNodeIdentityDigest(source) {
  const ids = [];
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      if (node && typeof node.node_id === "string") ids.push(node.node_id);
      if (node?.children && typeof node.children === "object") for (const children of Object.values(node.children)) if (Array.isArray(children)) walk(children);
    }
  };
  walk(source?.root);
  ids.sort();
  return assetFingerprint({ node_ids: ids });
}

function pointerSegments(pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return null;
  const parts = pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  return parts.some((part) => blockedPathSegments.has(part)) ? null : parts;
}

function findNode(source, nodeId) {
  let result = null;
  const walk = (nodes, path) => {
    if (result || !Array.isArray(nodes)) return;
    nodes.forEach((node, index) => {
      if (result) return;
      const nodePath = [...path, String(index)];
      if (node?.node_id === nodeId) { result = { node, nodes, index, path: nodePath }; return; }
      for (const [slot, children] of Object.entries(node?.children ?? {})) walk(children, [...nodePath, "children", slot]);
    });
  };
  walk(source?.root, ["root"]);
  return result;
}

function resolveContainer(root, segments) {
  let current = root;
  for (const segment of segments) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, segment)) return null;
    current = current[segment];
  }
  return current;
}

function setExistingPath(root, segments, value) {
  if (segments.length === 0) return false;
  const parent = resolveContainer(root, segments.slice(0, -1));
  const key = segments.at(-1);
  if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, key)) return false;
  parent[key] = structuredClone(value);
  return true;
}

function collectAllNodeIds(source) {
  const ids = [];
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      if (typeof node?.node_id === "string") ids.push(node.node_id);
      for (const children of Object.values(node?.children ?? {})) if (Array.isArray(children)) walk(children);
    }
  };
  walk(source?.root);
  return ids;
}

function makeReceipt(transaction, ownership, status, codes = [], changed = []) {
  return {
    receipt_type: "AuthoringTransactionReceipt",
    schema_version: 1,
    transaction_id: transaction?.transaction_id ?? "invalid",
    status,
    asset_id: transaction?.asset_id ?? ownership?.asset_id ?? "invalid@1",
    authoring_mode: ownership?.authoring_mode ?? transaction?.expected_mode ?? "graph_owned",
    owner_revision: ownership?.owner_revision ?? 0,
    source_fingerprint: ownership?.source?.fingerprint ?? "sha256:" + "0".repeat(64),
    changed_node_ids: changed,
    diagnostics: codes.map((code) => ({ code })),
  };
}

/**
 * Apply an edit transaction to a single graph-owned JSON source in memory.
 * Persistence remains the caller's responsibility and must use source CAS.
 */
export function applyAuthoringTransaction(ownership, sourceDocument, transaction) {
  const reject = (code, status = "rejected") => ({
    source: null,
    ownership,
    receipt: makeReceipt(transaction, ownership, status, [code]),
  });
  if (!ownership || ownership.contract_type !== "AuthoringOwnership" || ownership.schema_version !== 1) return reject("INVALID_AUTHORING_OWNERSHIP");
  if (!transaction || transaction.transaction_type !== "AuthoringTransaction" || transaction.schema_version !== 1 || typeof transaction.transaction_id !== "string" || transaction.transaction_id.length === 0 || !Array.isArray(transaction.operations) || transaction.operations.length === 0) return reject("INVALID_AUTHORING_TRANSACTION");
  if (transaction.asset_id !== ownership.asset_id || !refPattern.test(String(transaction.asset_id ?? ""))) return reject("AUTHORING_ASSET_ID_MISMATCH");
  if (transaction.expected_mode !== ownership.authoring_mode) return reject("AUTHORING_OWNER_MODE_CHANGED", "stale_owner");
  if (!sourceDocument || typeof sourceDocument !== "object" || !ownership.source || ownership.node_identity?.policy !== "stable_node_id@1" || ownership.node_identity.mapping_digest !== authoringNodeIdentityDigest(sourceDocument)) return reject("AUTHORING_NODE_IDENTITY_MISMATCH", "conflict");
  if (transaction.expected_owner_revision !== ownership.owner_revision || transaction.expected_source_fingerprint !== ownership.source?.fingerprint || assetFingerprint(sourceDocument) !== ownership.source?.fingerprint) return reject("AUTHORING_SOURCE_CHANGED", "conflict");
  if (!transaction.target_source || typeof transaction.target_source.candidate_fingerprint !== "string" || typeof transaction.target_source.node_identity_digest !== "string") return reject("INVALID_AUTHORING_TARGET_SOURCE");
  if (ownership.authoring_mode !== "graph_owned" || ownership.source?.source_type !== "event_asset") return reject("AUTHORING_SOURCE_ADAPTER_REQUIRED");
  if (transaction.operation !== "edit" || transaction.target_mode !== ownership.authoring_mode || transaction.target_source?.source_type !== "event_asset" || transaction.target_source?.source_ref !== ownership.source.source_ref) return reject("AUTHORING_MIGRATION_ADAPTER_REQUIRED");
  if (!refPattern.test(transaction.asset_id) || !Number.isInteger(ownership.owner_revision) || ownership.owner_revision < 0) return reject("INVALID_AUTHORING_REVISION");

  const originalIds = collectAllNodeIds(sourceDocument);
  if (new Set(originalIds).size !== originalIds.length) return reject("DUPLICATE_AUTHORING_NODE_ID");
  const preflight = new Map();
  const addedIds = new Set();
  for (const operation of transaction.operations) {
    if (!operation || !["add_node", "replace_field", "remove_node"].includes(operation.operation) || typeof operation.node_id !== "string" || !/^[\w.-]+$/u.test(operation.node_id)) return reject("INVALID_AUTHORING_OPERATION");
    if (operation.operation === "add_node") {
      const segments = pointerSegments(operation.field_path);
      const targetArray = segments ? resolveContainer(sourceDocument, segments) : null;
      if (!Array.isArray(targetArray) || !operation.value || operation.value.node_id !== operation.node_id || originalIds.includes(operation.node_id) || addedIds.has(operation.node_id)) return reject("INVALID_AUTHORING_NODE_ADDITION");
      addedIds.add(operation.node_id);
      continue;
    }
    const found = findNode(sourceDocument, operation.node_id);
    if (!found || typeof operation.expected_node_fingerprint !== "string" || assetFingerprint(found.node) !== operation.expected_node_fingerprint) return reject("AUTHORING_NODE_CHANGED", "conflict");
    if (preflight.has(operation.node_id) && (operation.operation === "remove_node" || preflight.get(operation.node_id) === "remove_node")) return reject("CONFLICTING_AUTHORING_OPERATIONS");
    preflight.set(operation.node_id, operation.operation);
    if (operation.operation === "replace_field") {
      const segments = pointerSegments(operation.field_path);
      if (!segments || segments.length === 0 || segments[0] === "node_id" || !resolveContainer(found.node, segments.slice(0, -1)) || !Object.hasOwn(resolveContainer(found.node, segments.slice(0, -1)), segments.at(-1))) return reject("INVALID_AUTHORING_FIELD_PATH");
    }
  }

  const next = structuredClone(sourceDocument);
  const changed = new Set();
  for (const operation of transaction.operations) {
    if (operation.operation === "add_node") {
      resolveContainer(next, pointerSegments(operation.field_path)).push(structuredClone(operation.value));
      changed.add(operation.node_id);
      continue;
    }
    const found = findNode(next, operation.node_id);
    if (!found) return reject("AUTHORING_NODE_CHANGED", "conflict");
    if (operation.operation === "replace_field") {
      if (!setExistingPath(found.node, pointerSegments(operation.field_path), operation.value)) return reject("INVALID_AUTHORING_FIELD_PATH");
    } else found.nodes.splice(found.index, 1);
    changed.add(operation.node_id);
  }

  const fingerprint = assetFingerprint(next);
  const identityDigest = authoringNodeIdentityDigest(next);
  if (fingerprint !== transaction.target_source.candidate_fingerprint || identityDigest !== transaction.target_source.node_identity_digest) return reject("AUTHORING_CANDIDATE_FINGERPRINT_MISMATCH");
  const nextOwnership = {
    ...structuredClone(ownership),
    owner_revision: ownership.owner_revision + 1,
    source: { ...ownership.source, fingerprint },
    node_identity: { ...ownership.node_identity, mapping_digest: identityDigest },
  };
  return {
    source: next,
    ownership: nextOwnership,
    receipt: makeReceipt(transaction, nextOwnership, "committed", [], [...changed].sort()),
  };
}

export function authoringSourceNodeFingerprint(node) {
  return assetFingerprint(node);
}
