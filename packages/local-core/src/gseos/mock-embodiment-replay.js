import { createHash } from "node:crypto";
import { stableStringify } from "./asset.js";
import { MockEmbodimentAdapter } from "./mock-embodiment-adapter.js";

const digest = (value) => `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
const supportedActions = new Set(["receive", "settle_lease", "publish_observation"]);
const adapterConfigKeys = new Set(["adapter_ref", "capabilities", "adapter_revision", "profile_status", "clock_domain", "field_unit_map"]);
const maxActions = 4096;
const maxSerializedChars = 10_000_000;

function replayInputValid(adapterConfig, actions) {
  if (!adapterConfig || typeof adapterConfig !== "object" || Array.isArray(adapterConfig) || Object.keys(adapterConfig).some((key) => !adapterConfigKeys.has(key))) return false;
  if (adapterConfig.capabilities !== undefined && (!Array.isArray(adapterConfig.capabilities) || adapterConfig.capabilities.length > 256 || adapterConfig.capabilities.some((capability) => typeof capability !== "string"))) return false;
  if (adapterConfig.field_unit_map !== undefined && (!Array.isArray(adapterConfig.field_unit_map) || adapterConfig.field_unit_map.length > 256)) return false;
  if (!Array.isArray(actions) || actions.length > maxActions) return false;
  try {
    let total = JSON.stringify(adapterConfig).length;
    for (const action of actions) {
      if (!action || typeof action !== "object" || Array.isArray(action) || !supportedActions.has(action.action)) return false;
      total += JSON.stringify(action).length;
      if (total > maxSerializedChars) return false;
    }
    return total <= maxSerializedChars;
  } catch {
    return false;
  }
}

function execute(adapter, action) {
  if (!action || typeof action !== "object" || Array.isArray(action) || !supportedActions.has(action.action)) {
    return { accepted: false, code: "MOCK_REPLAY_ACTION_UNSUPPORTED", ledger: adapter.snapshot() };
  }
  if (action.action === "receive") return adapter.receive(action.message, action.options ?? {});
  if (action.action === "settle_lease") return adapter.settleLease(action.request ?? {});
  return adapter.publishObservation(action.request ?? {});
}

/** Captures deterministic mock I/O only; this is not a hardware recording format. */
export function recordMockEmbodimentSession({ adapter_config = {}, actions = [] } = {}) {
  if (!replayInputValid(adapter_config, actions)) {
    return { ok: false, code: "MOCK_REPLAY_INPUT_INVALID" };
  }
  const adapter = new MockEmbodimentAdapter(adapter_config);
  const steps = actions.map((input) => {
    const action = structuredClone(input);
    const output = execute(adapter, action);
    return { input: action, output, state_after: adapter.snapshot(), output_digest: digest(output), state_digest: digest(adapter.snapshot()) };
  });
  return {
    ok: true,
    replay_type: "EmbodimentProtocolMockReplay",
    schema_version: 1,
    adapter_config: structuredClone(adapter_config),
    steps,
  };
}

export function replayMockEmbodimentSession(recording) {
  if (!recording || typeof recording !== "object" || recording.replay_type !== "EmbodimentProtocolMockReplay" || recording.schema_version !== 1 || !Array.isArray(recording.steps) || !recording.adapter_config || typeof recording.adapter_config !== "object" || Array.isArray(recording.adapter_config)) {
    return { ok: false, code: "MOCK_REPLAY_ENVELOPE_INVALID", mismatches: [], results: [] };
  }
  if (!replayInputValid(recording.adapter_config, recording.steps.map((step) => step?.input))) return { ok: false, code: "MOCK_REPLAY_LIMIT_EXCEEDED_OR_INPUT_INVALID", mismatches: [], results: [] };
  const adapter = new MockEmbodimentAdapter(recording.adapter_config);
  const mismatches = [];
  const results = [];
  for (const [index, step] of recording.steps.entries()) {
    const output = execute(adapter, step?.input);
    const stateAfter = adapter.snapshot();
    const outputDigest = digest(output);
    const stateDigest = digest(stateAfter);
    results.push({ output, state_after: stateAfter, output_digest: outputDigest, state_digest: stateDigest });
    if (outputDigest !== step?.output_digest || stateDigest !== step?.state_digest || stableStringify(output) !== stableStringify(step?.output) || stableStringify(stateAfter) !== stableStringify(step?.state_after)) {
      mismatches.push({ index, expected_output_digest: step?.output_digest ?? null, actual_output_digest: outputDigest, expected_state_digest: step?.state_digest ?? null, actual_state_digest: stateDigest });
    }
  }
  return { ok: mismatches.length === 0, code: mismatches.length === 0 ? "MOCK_REPLAY_MATCH" : "MOCK_REPLAY_DIVERGED", mismatches, results };
}
