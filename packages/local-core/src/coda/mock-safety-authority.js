import { validateSafetyAuthorityReceipt } from "./embodied-contract-validation.js";

/** Independent safety-port conformance model; it revokes mock write admission and never actuates hardware. */
export class MockSafetyAuthorityPort {
  #writers = new Map();
  #seenEvents = new Set();

  constructor({ authority_ref = "mock.safety.authority@1" } = {}) {
    this.authority_ref = authority_ref;
  }

  snapshot() {
    return structuredClone(Object.fromEntries([...this.#writers.entries()].sort(([left], [right]) => left.localeCompare(right))));
  }

  registerWriter({ instance_id, generation, lease_ref } = {}) {
    const reject = (code) => ({ accepted: false, code, ledger: this.snapshot() });
    if (typeof instance_id !== "string" || !instance_id || typeof lease_ref !== "string" || !/^[-\w.]+@\d+$/u.test(lease_ref) || !Number.isInteger(generation) || generation < 0) return reject("MOCK_SAFETY_WRITER_BINDING_INVALID");
    const current = this.#writers.get(instance_id);
    if (current?.latched) return reject("MOCK_SAFETY_LATCH_ACTIVE");
    if (current && generation <= current.generation) return reject("MOCK_SAFETY_GENERATION_NOT_ADVANCED");
    this.#writers.set(instance_id, { generation, lease_ref, writer_enabled: true, latched: false, last_event_id: null, last_action: null });
    return { accepted: true, ledger: this.snapshot() };
  }

  apply(receipt) {
    const reject = (code, diagnostics = []) => ({ accepted: false, code, diagnostics, ledger: this.snapshot() });
    const validation = validateSafetyAuthorityReceipt(receipt);
    if (!validation.ok) return reject(validation.diagnostics[0]?.code ?? "INVALID_SAFETY_AUTHORITY_RECEIPT", validation.diagnostics);
    if (receipt.authority_ref !== this.authority_ref) return reject("MOCK_SAFETY_AUTHORITY_MISMATCH");
    if (this.#seenEvents.has(receipt.event_id)) return reject("MOCK_SAFETY_EVENT_REPLAY");
    const writer = this.#writers.get(receipt.target_instance);
    if (!writer || writer.generation !== receipt.target_generation) return reject("MOCK_SAFETY_TARGET_OR_GENERATION_MISMATCH");
    if (receipt.action === "report_safety_clear") {
      if (!writer.latched) return reject("MOCK_SAFETY_CLEAR_WITHOUT_LATCH");
      writer.latched = false;
      writer.writer_enabled = false;
    } else {
      writer.latched = true;
      writer.writer_enabled = false;
    }
    writer.last_event_id = receipt.event_id;
    writer.last_action = receipt.action;
    this.#seenEvents.add(receipt.event_id);
    return { accepted: true, ledger: this.snapshot() };
  }

  canWrite(instance_id, generation) {
    const writer = this.#writers.get(instance_id);
    return Boolean(writer && writer.generation === generation && writer.writer_enabled && !writer.latched);
  }
}
