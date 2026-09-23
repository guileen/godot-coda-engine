import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BehaviorRuntime, compileBehaviorRuntime, createSchemaRegistry, stableStringify, validateBehaviorRuntime, validateBehaviorRuntimeTrace } from "../packages/local-core/src/coda/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asset = JSON.parse(await readFile(resolve(root, "coda/events/aibi.behavior.runtime.coda.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "contracts/coda/aibi-behavior-capabilities.json"), "utf8"));
const registry = createSchemaRegistry(manifest);

assert.equal(validateBehaviorRuntime(asset, registry).ok, true, "C0 fixture must validate");
const { plan, receipt } = compileBehaviorRuntime(asset, registry);
assert.equal(receipt.ok, true, "C0 fixture must compile");
assert.ok(plan, "C0 must not emit a partial plan");

const unknownCapability = structuredClone(asset);
unknownCapability.behavior_runtime.effects[0].capability = "raw_servo.move@1";
assert.equal(compileBehaviorRuntime(unknownCapability, registry).plan, null, "undeclared effect capabilities must reject before planning");
const illegalWrite = structuredClone(asset);
illegalWrite.behavior_runtime.rules.find((rule) => rule.rule_id === "speak_done").blackboard_writes = { energy: 101 };
assert.equal(compileBehaviorRuntime(illegalWrite, registry).plan, null, "out-of-range or unauthorized Blackboard writes must reject before planning");

const normal = new BehaviorRuntime(plan);
for (const event_id of ["wake_word", "speech_end", "llm_response", "tts_done"]) { normal.enqueue(event_id); normal.drain(); }
assert.equal(normal.trace().final_state, "idle", "normal AIBI flow must return to idle");

const fullBaseline = new BehaviorRuntime(plan);
for (const event_id of ["touch_head", "boredom_high", "settled", "poked_5x", "settled", "energy_low", "energy_empty", "wake_word", "wake_word"]) { fullBaseline.enqueue(event_id); fullBaseline.drain(); }
assert.equal(fullBaseline.trace().final_state, "listening", "the CODA fixture must cover the complete AIBI M0 state surface");
assert.deepEqual(Object.keys(fullBaseline.trace().blackboard).sort(), ["affection", "boredom", "energy", "happiness", "last_interaction_at"], "AIBI blackboard fields must remain explicit");
for (const key of ["affection", "boredom", "energy", "happiness"]) assert.ok(fullBaseline.trace().blackboard[key] >= 0 && fullBaseline.trace().blackboard[key] <= 1, "AIBI mood values must use the documented 0..1 scale");

const hierarchical = structuredClone(asset);
hierarchical.behavior_runtime.states.push({ state_id: "focused", parent_state_id: "idle" });
hierarchical.behavior_runtime.initial_state = "focused";
const hierarchicalPlan = compileBehaviorRuntime(hierarchical, registry).plan;
assert.ok(hierarchicalPlan, "a child state with a declared parent must compile");
const inherited = new BehaviorRuntime(hierarchicalPlan);
inherited.enqueue("wake_word"); inherited.drain();
assert.equal(inherited.trace().final_state, "listening", "an event may inherit the nearest parent-state rule deterministically");
const cyclic = structuredClone(hierarchical);
cyclic.behavior_runtime.states.find((state) => state.state_id === "idle").parent_state_id = "focused";
assert.equal(compileBehaviorRuntime(cyclic, registry).plan, null, "cyclic state parents must reject before planning");

const concurrent = structuredClone(asset);
concurrent.behavior_runtime.effects.push({ effect_id: "speech_gesture", capability: "body.plan_action@1", args: { action: "speak" }, cancellable: true, owner_state: "speaking", convergence_effect_id: "speech_safe_stop" });
concurrent.behavior_runtime.rules.find((rule) => rule.rule_id === "think_response").effects.push("speech_gesture");
const concurrentRuntime = new BehaviorRuntime(compileBehaviorRuntime(concurrent, registry).plan);
for (const event_id of ["wake_word", "speech_end", "llm_response", "interrupt"]) { concurrentRuntime.enqueue(event_id); concurrentRuntime.drain(); }
const concurrentTrace = concurrentRuntime.trace();
for (const effect_id of ["speech", "speech_gesture"]) assert.equal(concurrentTrace.entries.filter((entry) => entry.kind === "EffectCancelled" && entry.effect_id === effect_id).length, 1, "each concurrent cancellable effect must cancel once");
assert.equal(concurrentTrace.entries.filter((entry) => entry.kind === "EffectConverged" && entry.effect_id === "speech_safe_stop").length, 2, "each concurrent effect must execute exactly one convergence action");

const interrupted = new BehaviorRuntime(plan);
for (const event_id of ["wake_word", "speech_end", "llm_response", "interrupt", "tts_done"]) { interrupted.enqueue(event_id); interrupted.drain(); }
const trace = interrupted.trace();
assert.equal(trace.final_state, "listening", "interrupt must move speaking to listening");
assert.equal(trace.entries.filter((entry) => entry.kind === "EffectCancelled" && entry.effect_id === "speech").length, 1, "speech may cancel once");
assert.equal(trace.entries.filter((entry) => entry.kind === "EffectConverged" && entry.cancelled_effect_id === "speech").length, 1, "speech must converge once");
assert.equal(trace.entries.filter((entry) => entry.kind === "EventIgnored" && entry.reason === "STALE_COMPLETION").length, 1, "late tts_done must have no side effect");
assert.equal(validateBehaviorRuntimeTrace(trace).ok, true, "every trace entry must have an EventAsset source reference");

const first = new BehaviorRuntime(plan); const second = new BehaviorRuntime(plan);
for (const runtime of [first, second]) { runtime.enqueue("boredom_high", { sequence: 2 }); runtime.enqueue("wake_word", { sequence: 1 }); runtime.drain(); }
assert.equal(first.trace().entries.find((entry) => entry.kind === "EventArbitrated").event_id, "wake_word", "priority must win before sequence");
assert.equal(stableStringify(first.trace()), stableStringify(second.trace()), "same asset and inputs must replay byte-identically");

console.log("G-C0 Node offline counterexamples passed.");
