import { stableStringify } from "./asset.js";
import { validateEmbodimentProtocolMessage } from "./embodied-contract-validation.js";

/** Run the hardware-free protocol contract against a caller-supplied Adapter instance. */
export function runEmbodimentAdapterConformance(adapter) {
  const cases = [];
  const check = (name, passed, detail = "") => cases.push({ name, passed: Boolean(passed), ...(detail ? { detail } : {}) });
  if (!adapter || typeof adapter.receive !== "function" || typeof adapter.publishObservation !== "function" || typeof adapter.settleLease !== "function" || typeof adapter.snapshot !== "function") {
    return { report_type: "EmbodimentAdapterConformance", schema_version: 1, ok: false, cases: [{ name: "adapter_interface", passed: false, detail: "required methods are missing" }], non_claims: ["does not actuate or certify hardware"] };
  }
  const initial = adapter.snapshot();
  const adapterRef = adapter.adapter_ref;
  const make = (message_id, message_type, sequence, payload, lease = null) => ({
    protocol: "EmbodimentProtocol", schema_version: 1, message_id, direction: "coda_to_adapter", message_type,
    adapter_ref: adapterRef, epoch: 1, sequence,
    clock: { domain: adapter.clock_domain ?? "mock.clock", tick: 10 + sequence, quality: "synchronized" },
    validity: { valid_from_tick: 10, valid_until_tick: 30 }, payload,
    ...(lease ? { lease_ref: lease.lease_ref, generation: lease.generation } : {}),
  });
  const accepted = (name, result, expectedResponseType) => {
    const valid = result?.accepted === true && result.response?.message_type === expectedResponseType && validateEmbodimentProtocolMessage(result.response).ok;
    check(name, valid, valid ? "" : "expected an accepted, schema-valid response");
    return result;
  };
  const rejectedWithoutWrite = (name, before, result) => {
    const valid = result?.accepted === false && result.response?.message_type === "reject"
      && validateEmbodimentProtocolMessage(result.response).ok
      && result.response.payload.partial_write === false
      && stableStringify(result.ledger) === stableStringify(before);
    check(name, valid, valid ? "" : "reject must be schema-valid with partial_write=false and unchanged ledger");
  };

  const query = make("conformance.query", "capability_query", 0, { profile_ref: "conformance.profile@1", minimum_protocol_version: 1 });
  accepted("capability_query", adapter.receive(query), "capability_report");
  const afterQuery = adapter.snapshot();
  const lease = { lease_ref: "conformance.lease@1", generation: 1 };
  const unavailable = make("conformance.lease.unsupported", "authority_lease", 1, { lease_id: "conformance.unsupported", owner: "coda", resources: ["unavailable@1"], valid_until_tick: 25 }, lease);
  rejectedWithoutWrite("unsupported_resource", afterQuery, adapter.receive(unavailable));
  const admission = make("conformance.lease", "authority_lease", 1, { lease_id: "conformance.lease", owner: "coda", resources: [adapter.capabilities?.[0] ?? "arm@1"], valid_until_tick: 25 }, lease);
  const leaseResult = adapter.receive(admission);
  accepted("lease_admission", leaseResult, "barrier_receipt");
  const reference = make("conformance.reference", "reference", 2, { representation: "segment", reference_ref: "conformance.segment@1", constraints_ref: "conformance.constraints@1" }, lease);
  accepted("reference_admission", adapter.receive(reference), "barrier_receipt");
  const mode = make("conformance.mode", "mode_request", 3, { controller_ref: "conformance.controller@1", mode_ref: "conformance.mode@1", handoff_contract_ref: "conformance.handoff@1" }, lease);
  accepted("mode_admission", adapter.receive(mode), "transition_receipt");
  const beforeBadHandoff = adapter.snapshot();
  const badHandoff = make("conformance.handoff.bad", "handoff", 4, { handoff_contract_ref: "other.handoff@1", incoming_controller_ref: "conformance.next@1", barrier_id: "conformance.bad" }, lease);
  rejectedWithoutWrite("handoff_contract_mismatch", beforeBadHandoff, adapter.receive(badHandoff));
  const handoff = make("conformance.handoff", "handoff", 4, { handoff_contract_ref: "conformance.handoff@1", incoming_controller_ref: "conformance.next@1", barrier_id: "conformance.barrier" }, lease);
  accepted("handoff_admission", adapter.receive(handoff), "barrier_receipt");
  const beforeExpired = adapter.snapshot();
  const expired = make("conformance.reference.expired", "reference", 5, { representation: "segment", reference_ref: "conformance.expired@1", constraints_ref: "conformance.constraints@1" }, lease);
  rejectedWithoutWrite("expired_lease", beforeExpired, adapter.receive(expired, { now_tick: 26 }));
  const terminal = adapter.settleLease({ ...lease, status: "completed", now_tick: 15 });
  accepted("single_terminal_receipt", terminal, "terminal_receipt");
  const afterTerminal = adapter.snapshot();
  const duplicate = adapter.settleLease({ ...lease, status: "failed", now_tick: 16 });
  rejectedWithoutWrite("duplicate_terminal", afterTerminal, duplicate);
  const late = make("conformance.reference.late", "reference", 5, { representation: "segment", reference_ref: "conformance.late@1", constraints_ref: "conformance.constraints@1" }, lease);
  rejectedWithoutWrite("late_command_after_terminal", afterTerminal, adapter.receive(late, { now_tick: 16 }));
  const observation = adapter.publishObservation({ snapshot_ref: "conformance.snapshot@1", tick: 16 });
  check("observation_emission", observation?.accepted === true && validateEmbodimentProtocolMessage(observation.response).ok, "observation must be schema-valid");
  check("initial_snapshot_serializable", JSON.stringify(initial) !== undefined, "snapshot must be JSON serializable");
  const failures = cases.filter((item) => !item.passed);
  return {
    report_type: "EmbodimentAdapterConformance",
    schema_version: 1,
    ok: failures.length === 0,
    cases,
    case_count: cases.length,
    failure_count: failures.length,
    non_claims: ["hardware-free protocol behavior only", "does not validate physical accuracy, calibration, real-time guarantees, or hardware safety"],
  };
}
