import { validateEmbodimentProtocolMessage } from "./embodied-contract-validation.js";

/** Protocol conformance mock only: it records references in memory and never actuates a device. */
export class MockEmbodimentAdapter {
  #epoch = null;
  #lastSequence = -1;
  #seenMessageIds = new Set();
  #lease = null;
  #reference = null;
  #outSequence = 0;

  constructor({ adapter_ref = "mock.embodiment.adapter@1", capabilities = [], adapter_revision = "mock@1", profile_status = "available", clock_domain = "mock.clock" } = {}) {
    this.adapter_ref = adapter_ref;
    this.capabilities = [...new Set(capabilities)].sort();
    this.adapter_revision = adapter_revision;
    this.profile_status = profile_status;
    this.clock_domain = clock_domain;
  }

  snapshot() {
    return structuredClone({ epoch: this.#epoch, last_sequence: this.#lastSequence, lease: this.#lease, reference: this.#reference });
  }

  receive(message, { now_tick = message?.clock?.tick } = {}) {
    const reject = (code) => ({ accepted: false, response: this.#rejectMessage(message, now_tick, code), ledger: this.snapshot() });
    if (message?.message_type !== "capability_query" && message?.message_type !== "authority_lease" && message?.message_type !== "reference") return reject("MOCK_MESSAGE_TYPE_UNSUPPORTED");
    const validation = validateEmbodimentProtocolMessage(message, {
      now_tick,
      clock_domain: message?.clock?.domain,
      minimum_epoch: this.#epoch,
      minimum_sequence: this.#lastSequence,
    });
    if (!validation.ok) return reject(validation.diagnostics[0]?.code ?? "INVALID_EMBODIMENT_MESSAGE");
    if (message.direction !== "coda_to_adapter" || message.adapter_ref !== this.adapter_ref) return reject("MOCK_ADAPTER_IDENTITY_MISMATCH");
    if (this.#seenMessageIds.has(message.message_id)) return reject("MOCK_MESSAGE_REPLAY");
    if (this.#epoch === message.epoch && message.sequence <= this.#lastSequence) return reject("MOCK_SEQUENCE_STALE");

    if (message.message_type === "capability_query") {
      this.#record(message);
      return { accepted: true, response: this.#capabilityReport(message, now_tick), ledger: this.snapshot() };
    }
    if (message.message_type === "authority_lease") {
      const leaseRef = message.lease_ref;
      if (this.#lease && this.#lease.valid_until_tick >= now_tick) return reject("MOCK_LEASE_ALREADY_ACTIVE");
      if (message.payload.owner !== "coda" || message.payload.resources.some((resource) => !this.capabilities.includes(resource))) return reject("MOCK_LEASE_CAPABILITY_UNAVAILABLE");
      this.#record(message);
      this.#lease = { lease_ref: leaseRef, generation: message.generation, valid_until_tick: message.payload.valid_until_tick, resources: [...message.payload.resources] };
      this.#reference = null;
      return { accepted: true, response: this.#barrierReceipt(message, now_tick, "accepted"), ledger: this.snapshot() };
    }
    if (!this.#lease || message.lease_ref !== this.#lease.lease_ref || message.generation !== this.#lease.generation || now_tick > this.#lease.valid_until_tick) return reject("MOCK_LEASE_OR_GENERATION_MISMATCH");
    if (message.payload.constraints_ref.length === 0 || !this.#lease.resources.length) return reject("MOCK_REFERENCE_CONSTRAINTS_MISSING");
    this.#record(message);
    this.#reference = { representation: message.payload.representation, reference_ref: message.payload.reference_ref, constraints_ref: message.payload.constraints_ref, generation: message.generation };
    return { accepted: true, response: this.#barrierReceipt(message, now_tick, "accepted"), ledger: this.snapshot() };
  }

  #record(message) {
    if (this.#epoch !== message.epoch) { this.#epoch = message.epoch; this.#lastSequence = -1; }
    this.#lastSequence = message.sequence;
    this.#seenMessageIds.add(message.message_id);
  }

  #baseResponse(message, nowTick, messageType, payload, leaseRef = undefined, generation = undefined) {
    return {
      protocol: "EmbodimentProtocol", schema_version: 1,
      message_id: `${this.adapter_ref}.out.${this.#outSequence++}`,
      direction: "adapter_to_coda", message_type: messageType, adapter_ref: this.adapter_ref,
      epoch: message?.epoch ?? this.#epoch ?? 0, sequence: this.#outSequence - 1,
      clock: { domain: this.clock_domain, tick: Number.isInteger(nowTick) ? nowTick : 0, quality: "synchronized" },
      validity: { valid_from_tick: Number.isInteger(nowTick) ? nowTick : 0, valid_until_tick: Number.isInteger(nowTick) ? nowTick : 0 },
      ...(leaseRef !== undefined ? { lease_ref: leaseRef, generation } : {}), payload,
    };
  }

  #capabilityReport(message, nowTick) {
    return this.#baseResponse(message, nowTick, "capability_report", {
      capabilities: this.capabilities,
      adapter_revision: this.adapter_revision,
      profile_status: this.profile_status,
    });
  }

  #barrierReceipt(message, nowTick, status) {
    return this.#baseResponse(message, nowTick, "barrier_receipt", {
      receipt_id: `${message.message_id}.receipt`, status, partial_write: false,
    }, message.lease_ref, message.generation);
  }

  #rejectMessage(message, nowTick, code) {
    return this.#baseResponse(message, nowTick, "reject", { code, partial_write: false });
  }
}
