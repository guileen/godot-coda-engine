import { validateEmbodimentProtocolMessage } from "./embodied-contract-validation.js";

/** Protocol conformance mock only: it records references in memory and never actuates a device. */
export class MockEmbodimentAdapter {
  #epoch = null;
  #lastSequence = -1;
  #seenMessageIds = new Set();
  #lease = null;
  #lastGeneration = -1;
  #reference = null;
  #modeRef = null;
  #handoffBarrier = null;
  #terminal = false;
  #outSequence = 0;

  constructor({ adapter_ref = "mock.embodiment.adapter@1", capabilities = [], adapter_revision = "mock@1", profile_status = "available", clock_domain = "mock.clock" } = {}) {
    this.adapter_ref = adapter_ref;
    this.capabilities = [...new Set(capabilities)].sort();
    this.adapter_revision = adapter_revision;
    this.profile_status = profile_status;
    this.clock_domain = clock_domain;
  }

  snapshot() {
    return structuredClone({ epoch: this.#epoch, last_sequence: this.#lastSequence, lease: this.#lease, reference: this.#reference, mode_ref: this.#modeRef, handoff_barrier: this.#handoffBarrier, terminal: this.#terminal });
  }

  receive(message, { now_tick = message?.clock?.tick } = {}) {
    const reject = (code) => ({ accepted: false, response: this.#rejectMessage(message, now_tick, code), ledger: this.snapshot() });
    if (!["capability_query", "authority_lease", "reference", "mode_request", "handoff"].includes(message?.message_type)) return reject("MOCK_MESSAGE_TYPE_UNSUPPORTED");
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
      if (this.#lease?.epoch === message.epoch && this.#lease.valid_until_tick >= now_tick) return reject("MOCK_LEASE_ALREADY_ACTIVE");
      const previousGeneration = this.#epoch === message.epoch ? this.#lastGeneration : -1;
      if (message.generation <= previousGeneration) return reject("MOCK_GENERATION_NOT_ADVANCED");
      if (message.payload.valid_until_tick < now_tick) return reject("MOCK_LEASE_ALREADY_EXPIRED");
      if (message.payload.owner !== "coda" || message.payload.resources.some((resource) => !this.capabilities.includes(resource))) return reject("MOCK_LEASE_CAPABILITY_UNAVAILABLE");
      this.#record(message);
      this.#lastGeneration = message.generation;
      this.#lease = { lease_ref: leaseRef, generation: message.generation, epoch: message.epoch, valid_until_tick: message.payload.valid_until_tick, resources: [...message.payload.resources] };
      this.#reference = null;
      this.#modeRef = null;
      this.#handoffBarrier = null;
      this.#terminal = false;
      return { accepted: true, response: this.#barrierReceipt(message, now_tick, "accepted"), ledger: this.snapshot() };
    }
    if (!this.#lease || message.epoch !== this.#lease.epoch || message.lease_ref !== this.#lease.lease_ref || message.generation !== this.#lease.generation || now_tick > this.#lease.valid_until_tick) return reject("MOCK_LEASE_OR_GENERATION_MISMATCH");
    if (this.#terminal) return reject("MOCK_LEASE_ALREADY_TERMINAL");
    this.#record(message);
    if (message.message_type === "reference") {
      if (!this.#lease.resources.length) return reject("MOCK_REFERENCE_RESOURCES_MISSING");
      this.#reference = { representation: message.payload.representation, reference_ref: message.payload.reference_ref, constraints_ref: message.payload.constraints_ref, generation: message.generation };
      return { accepted: true, response: this.#barrierReceipt(message, now_tick, "accepted"), ledger: this.snapshot() };
    }
    if (message.message_type === "mode_request") {
      this.#modeRef = message.payload.mode_ref;
      return { accepted: true, response: this.#barrierReceipt(message, now_tick, "accepted", "transition_receipt"), ledger: this.snapshot() };
    }
    this.#handoffBarrier = { barrier_id: message.payload.barrier_id, incoming_controller_ref: message.payload.incoming_controller_ref, generation: message.generation };
    return { accepted: true, response: this.#barrierReceipt(message, now_tick, "accepted"), ledger: this.snapshot() };
  }

  settleLease({ lease_ref, generation, status, now_tick = 0 } = {}) {
    const source = { epoch: this.#epoch ?? 0, message_id: `mock.terminal.${this.#outSequence}`, lease_ref, generation };
    const reject = (code) => ({ accepted: false, response: this.#rejectMessage(source, now_tick, code), ledger: this.snapshot() });
    if (!this.#lease || lease_ref !== this.#lease.lease_ref || generation !== this.#lease.generation || now_tick > this.#lease.valid_until_tick) return reject("MOCK_TERMINAL_LEASE_OR_GENERATION_MISMATCH");
    if (this.#terminal) return reject("MOCK_DUPLICATE_TERMINAL_RECEIPT");
    if (!["completed", "failed", "owner_lost"].includes(status)) return reject("MOCK_TERMINAL_STATUS_UNSUPPORTED");
    this.#terminal = true;
    const response = this.#baseResponse(source, now_tick, "terminal_receipt", {
      receipt_id: `${source.message_id}.receipt`, status, partial_write: false,
    }, lease_ref, generation);
    return { accepted: true, response, ledger: this.snapshot() };
  }

  #record(message) {
    if (this.#epoch !== message.epoch) { this.#epoch = message.epoch; this.#lastSequence = -1; this.#lastGeneration = -1; }
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

  #barrierReceipt(message, nowTick, status, messageType = "barrier_receipt") {
    return this.#baseResponse(message, nowTick, messageType, {
      receipt_id: `${message.message_id}.receipt`, status, partial_write: false,
    }, message.lease_ref, message.generation);
  }

  #rejectMessage(message, nowTick, code) {
    return this.#baseResponse(message, nowTick, "reject", { code, partial_write: false });
  }
}
