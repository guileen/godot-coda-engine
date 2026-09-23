export function gseosDiagnostic(code, message, extra = {}) {
  return { code, severity: extra.severity ?? "error", message, ...extra };
}

export function gseosReceipt(diagnostics = []) {
  return { ok: !diagnostics.some((item) => item.severity === "error"), diagnostics };
}

export function sourceRef(eventId, nodeId, fieldId = undefined, extra = {}) {
  return { event_id: eventId, node_id: nodeId, ...(fieldId ? { field_id: fieldId } : {}), ...extra };
}
