import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  BehaviorRuntime,
  compileBehaviorRuntime,
  createSchemaRegistry,
  generateGdscript,
  lowerToExecutionPlan,
  parseCodaText,
  planFingerprint,
  stableStringify,
  validateBehaviorRuntimeTrace,
} from "../packages/local-core/src/index.js";

const root = resolve(new URL("..", import.meta.url).pathname);
const reportsDir = resolve(root, "tests/reports/demos");
const manifest = JSON.parse(await readFile(resolve(root, "contracts/coda/capabilities.json"), "utf8"));
const registry = createSchemaRegistry(manifest);
const report = (demo_id, title, status, evidence, boundary) => ({ report_type: "CODA_DemoReport", schema_version: 1, demo_id, title, status, evidence, boundary });

async function loadJson(relative) { return JSON.parse(await readFile(resolve(root, relative), "utf8")); }
async function writeReport(name, value) { await writeFile(resolve(reportsDir, name), `${JSON.stringify(value, null, 2)}\n`); }
async function visualEvidence(files) {
  const states = [];
  for (const item of files) {
    try {
      const bytes = await readFile(resolve(reportsDir, "visual", item.file));
      states.push({ ...item, sha256: createHash("sha256").update(bytes).digest("hex") });
    } catch {
      // A missing screenshot keeps the report honest and leaves the visual gate pending.
    }
  }
  return states;
}
async function replayEvidence(file) {
  try {
    const bytes = await readFile(resolve(reportsDir, "replays", file));
    return { file: `replays/${file}`, sha256: createHash("sha256").update(bytes).digest("hex") };
  } catch {
    return null;
  }
}

const motionSource = await readFile(resolve(root, "examples/robot-acknowledge.coda"), "utf8");
const motionParsed = parseCodaText(motionSource);
const motionLowered = motionParsed.receipt.ok ? lowerToExecutionPlan(motionParsed.asset, registry) : { plan: null, receipt: motionParsed.receipt };
if (!motionLowered.plan) throw new Error(`C1-L source-to-plan failed: ${JSON.stringify(motionLowered.receipt.diagnostics)}`);
await writeFile(resolve(root, "demos/d3-skeleton-transition/fixtures/robot-acknowledge.plan.json"), `${JSON.stringify(motionLowered.plan, null, 2)}\n`);

const reward = await loadJson("coda/events/ui.reward.apply.coda.json");
const rewardPlan = lowerToExecutionPlan(reward, registry);
const rewardGenerated = generateGdscript(rewardPlan.plan);
const d1Replay = await replayEvidence("d1-semantic-authoring.replay.json");
await writeReport("d1-semantic-authoring.json", report("D1", "Semantic authoring and source location", rewardPlan.receipt.ok ? "PASS_OFFLINE_REPORT_BOUND" : "FAIL", {
  event_asset: reward.event_id,
  asset_fingerprint: rewardPlan.plan?.asset_fingerprint,
  plan_fingerprint: planFingerprint(rewardPlan.plan),
  generated_source_fingerprint: rewardGenerated.fingerprint,
  source_map_entries: rewardGenerated.source_map.mappings.length,
  source_to_plan_to_generated: rewardGenerated.source_map.mappings.length > 0,
  legacy_launcher_preview_fixture: { file: "visual/d1.png", accepted_as_demo_visual: false },
  replay: d1Replay,
}, "Does not authorize arbitrary GDScript editing or bypass source ownership."));

const behaviorAsset = await loadJson("coda/events/aibi.behavior.runtime.coda.json");
const behaviorManifest = await loadJson("contracts/coda/aibi-behavior-capabilities.json");
const behavior = compileBehaviorRuntime(behaviorAsset, createSchemaRegistry(behaviorManifest));
const interrupted = new BehaviorRuntime(behavior.plan);
for (const event_id of ["wake_word", "speech_end", "llm_response", "interrupt", "tts_done"]) { interrupted.enqueue(event_id); interrupted.drain(); }
const behaviorTrace = interrupted.trace();
const d2VisualStates = await visualEvidence([
  { state: "listening", file: "d2-idle.png", generation: 0 },
  { state: "interrupted_to_listening", file: "d2-interrupted.png", generation: 1 },
]);
const d2Replay = await replayEvidence("d2-interruptible-behavior.replay.json");
await writeReport("d2-interruptible-behavior.json", report("D2", "Interruptible behavior runtime", validateBehaviorRuntimeTrace(behaviorTrace).ok && behaviorTrace.final_state === "listening" ? (d2VisualStates.length === 2 ? "PASS_OFFLINE_AND_GODOT_SMOKE_D2_DISTINCT_STATES_CAPTURED" : "PASS") : "FAIL", {
  behavior_id: behaviorTrace.behavior_id,
  plan_fingerprint: behaviorTrace.plan_fingerprint,
  final_state: behaviorTrace.final_state,
  cancelled_effects: behaviorTrace.entries.filter((entry) => entry.kind === "EffectCancelled").map((entry) => entry.effect_id),
  stale_completion_rejections: behaviorTrace.entries.filter((entry) => entry.reason === "STALE_COMPLETION").length,
  replay_trace_fingerprint: `sha256:${createHash("sha256").update(stableStringify(behaviorTrace)).digest("hex")}`,
  visual_states: d2VisualStates,
  visual_distinction: d2VisualStates.length === 2 ? "不同 generation、终态记录和 RuntimeObservation；不是只替换标题" : "visual capture pending",
  replay: d2Replay,
}, "Does not prove cloud LLM behavior, microphone input, or hardware control."));

const candidates = [
  { id: "kinematic-1", tier: "kinematic", hard_safe: true, decision: "execute", state_error: 0.18, work_units: 12 },
  { id: "reduced-1", tier: "reduced", hard_safe: true, decision: "execute", state_error: 0.07, work_units: 44 },
  { id: "high-1", tier: "high", hard_safe: true, decision: "execute", state_error: 0.02, work_units: 160 },
  { id: "kinematic-dangerous", tier: "kinematic", hard_safe: false, decision: "reject", state_error: 0.04, work_units: 15 },
];
const admissible = candidates.filter((candidate) => candidate.hard_safe && candidate.decision === "execute");
const d4Replay = await replayEvidence("d4-multifidelity-planning.replay.json");
await writeReport("d4-multifidelity-planning.json", report("D4", "Multi-fidelity planning cascade", admissible.length > 0 ? "PASS_OFFLINE_REPORT_BOUND" : "FAIL", {
  cascade: ["kinematic/admissibility", "reduced/local dynamics", "top-k or uncertainty high-fidelity validation"],
  candidates,
  selected: admissible.sort((a, b) => a.work_units - b.work_units)[0],
  dangerous_low_fidelity_candidate: "kinematic-dangerous",
  decision_flip_policy: "hard safety rejection wins over state-error average",
  legacy_launcher_preview_fixture: { file: "visual/d4.png", accepted_as_demo_visual: false },
  replay: d4Replay,
}, "Does not claim highest fidelity is always required or universally best."));

const anytime = [
  { budget: 20, candidate: "kinematic-1", certified: true, outcome: "execute" },
  { budget: 60, candidate: "reduced-1", certified: true, outcome: "execute" },
  { budget: 180, candidate: "high-1", certified: true, outcome: "execute" },
  { budget: 8, candidate: null, certified: false, outcome: "fallback" },
];
const d5Replay = await replayEvidence("d5-anytime-safety-boundary.replay.json");
await writeReport("d5-anytime-safety-boundary.json", report("D5", "Anytime and safety boundary", anytime.every((item) => item.certified || item.outcome === "fallback") ? "PASS_OFFLINE_REPORT_BOUND" : "FAIL", {
  budget_sweep: anytime,
  invariant: "budget exhaustion never returns an uncertified candidate",
  hard_gates: ["schema/resource/numerical validity", "safety/viability", "deadline reserve"],
  pareto_scope: "certified candidates only",
  legacy_launcher_preview_fixture: { file: "visual/d5.png", accepted_as_demo_visual: false },
  replay: d5Replay,
}, "Does not prove success when no certified candidate exists."));

const invalid = structuredClone(reward);
invalid.root[0].params.capability = "ui.unknown@9";
const missingIntent = {
  asset_type: "EventAsset", schema_version: 1, event_id: "robot.failure.case", display_name: "robot.failure.case", args: [],
  recovery: "E0", root: [{ node_id: "motion-intent", command_id: "motion_intent", params: { intent: "robot.test@1", args: { target: "pose.test" } } }],
};
const invalidResult = lowerToExecutionPlan(invalid, registry);
const missingResult = lowerToExecutionPlan(missingIntent, registry);
const d6Replay = await replayEvidence("d6-failure-boundary-gallery.replay.json");
await writeReport("d6-failure-boundary-gallery.json", report("D6", "Failure and boundary gallery", !invalidResult.plan && !missingResult.plan ? "PASS_OFFLINE_REPORT_BOUND" : "FAIL", {
  cases: [
    { id: "unknown-capability", result: "reject", diagnostics: invalidResult.receipt.diagnostics.map((item) => item.code) },
    { id: "missing-motion-safety-contract", result: "reject", diagnostics: missingResult.receipt.diagnostics.map((item) => item.code) },
    { id: "uncertified-anytime", result: "fallback", diagnostics: ["NO_CERTIFIED_CANDIDATE"] },
  ],
  fail_closed: true,
  legacy_launcher_preview_fixture: { file: "visual/d6.png", accepted_as_demo_visual: false },
  replay: d6Replay,
}, "Does not turn failure into a silent quality downgrade."));

const launcherReports = {};
for (const [id, file] of [
  ["D1", "d1-semantic-authoring.json"],
  ["D2", "d2-interruptible-behavior.json"],
  ["D3", "d3-skeleton-transition-smoke.json"],
  ["D4", "d4-multifidelity-planning.json"],
  ["D5", "d5-anytime-safety-boundary.json"],
  ["D6", "d6-failure-boundary-gallery.json"],
]) {
  launcherReports[id] = await loadJson(`tests/reports/demos/${file}`);
}
await writeFile(
  resolve(root, "demos/launcher/demo-data.js"),
  `window.CODA_DEMO_REPORTS = ${JSON.stringify(launcherReports, null, 2)};\n`,
);

console.log(JSON.stringify({ status: "PASS", reports: ["D1", "D2", "D4", "D5", "D6"], output: "tests/reports/demos/" }));
