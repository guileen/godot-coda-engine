export function codaDiagnostic(code, message, extra = {}) {
  return { code, severity: extra.severity ?? "error", message, ...extra };
}

export function codaReceipt(diagnostics = []) {
  return { ok: !diagnostics.some((item) => item.severity === "error"), diagnostics };
}

/** @deprecated Use codaDiagnostic. Kept for existing integrations during migration. */
export const gseosDiagnostic = codaDiagnostic;
/** @deprecated Use codaReceipt. Kept for existing integrations during migration. */
export const gseosReceipt = codaReceipt;

export function sourceRef(eventId, nodeId, fieldId = undefined, extra = {}) {
  return { event_id: eventId, node_id: nodeId, ...(fieldId ? { field_id: fieldId } : {}), ...extra };
}
