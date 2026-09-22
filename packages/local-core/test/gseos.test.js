import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateContinuationViability, evaluateTemporalCommandAdmission, validateAuthorityClaimMatrix, validateContinuationContract, validateEmbodimentProtocolMessage, validateEmbodimentUnitRegistry, validateReferenceFrameRegistry, validateSafetyAuthorityReceipt, validateTemporalCommandContract } from "../src/index.js";
import { applyAuthoringTransaction, applyTextAuthoringTransaction, authoringNodeIdentityDigest, authoringSourceNodeFingerprint } from "../src/index.js";
import { applyIntentProtocolRequest, createIntentProtocolState, MockEmbodimentAdapter, MockSafetyAuthorityPort, recordMockEmbodimentSession, replayMockEmbodimentSession, runEmbodimentAdapterConformance, settleIntentProtocolInstance, validateIntentProtocolReceipt, validateIntentProtocolRequest, verifyHookReplay } from "../src/index.js";
import { BehaviorRuntime, EventRegistry, ExpressionAdapterReference, RunContext, RunStatus, TransitionLeaseArbiter, TransitionRun, TrustedHookPipeline, WaitRegistration, admitFiniteFieldSwitch, applySemanticPatch, applyTaggedExternalJump, assetFingerprint, bindEventAsset, buildModelErrorReport, buildSafeParetoFrontier, buildSemanticProjectionMap, buildTransitionPlan, certifyReferenceCandidate, compareTransitionDecisionObservation, compileBehaviorRuntime, createReplayEnvelope, createSchemaRegistry, createSemanticPatch, decodeLinearPrior, detectFieldStagnation, enforceOneSidedJointLimit, evaluateLatentCandidate, evaluateTransitionCase, expandResourceLeaves, formatGse, generateGdscript, lexGse, lowerMotionIntentForProfile, lowerMotionIntentToBackend, lowerToExecutionPlan, lowerToTaskGraph, migrateEventAsset, parseCst, parseExpressionText, parseGse, replayEnvelopeFingerprint, replayTransitionCase, resolveAlias, resolveSourceRef, roundTripEventAsset, runAnytimeReference, runFieldWithFiniteFallback, runHybridReference, runReferenceCascade, runWithSingleFallback, selectFiniteEscapeWaypoint, selectStableParetoCandidate, stableStringify, summarizeUserObservationReport, transitionDecisionFingerprint, validateAliasRegistry, validateBehaviorRuntime, validateBehaviorRuntimeTrace, validateCapabilityManifest, validateControlContract, validateEventAsset, validateExpressionAdapterProfile, validateGuardExpression, validateHybridModeGraph, validateObservationContract, validateReactiveExecutionGraph, validateResourceRegistry, validateRuntimeObservation, validateReplayEnvelope, validateRuntimeTrace, validateSemanticCandidate, validateSemanticProjectionMap, validateTrackingEnvelope, validateTransitionSnapshot, validateUserObservationReport, validateTaskGraph, verifyManagedArtifact } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const asset = JSON.parse(await readFile(resolve(root, "gseos/events/ui.reward.apply.gse.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "contracts/gseos/capabilities.json"), "utf8"));
const aliasRegistry = JSON.parse(await readFile(resolve(root, "gseos/fixtures/ui.reward.apply.alias-registry.json"), "utf8"));
const semanticMapFixture = JSON.parse(await readFile(resolve(root, "gseos/fixtures/ui.reward.apply.semantic-map.json"), "utf8"));
const goldenSourceMap = JSON.parse(await readFile(resolve(root, "tests/golden/ui.reward.apply.source-map.json"), "utf8"));
const behaviorAsset = JSON.parse(await readFile(resolve(root, "gseos/events/aibi.behavior.runtime.gse.json"), "utf8"));
const behaviorManifest = JSON.parse(await readFile(resolve(root, "contracts/gseos/aibi-behavior-capabilities.json"), "utf8"));
const registry = createSchemaRegistry(manifest);
const behaviorRegistry = createSchemaRegistry(behaviorManifest);
const motionIntentSource = await readFile(resolve(root, "examples/robot-acknowledge.coda"), "utf8");
const motionIntentAsset = JSON.parse(await readFile(resolve(root, "gseos/events/robot.acknowledge_user.gse.json"), "utf8"));
const waveSource = await readFile(resolve(root, "examples/social-wave.coda"), "utf8");
const motionIntentSchema = JSON.parse(await readFile(resolve(root, "contracts/gseos/motion-intent.schema.json"), "utf8"));
const transitionPlanFixture = JSON.parse(await readFile(resolve(root, "gseos/fixtures/social.wave.transition-plan.json"), "utf8"));
const resourceRegistrySchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/resource-registry.schema.json"), "utf8"));
const snapshotBundleSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/snapshot-bundle.schema.json"), "utf8"));
const transitionPlanSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/transition-plan.schema.json"), "utf8"));
const adapterReceiptSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/adapter-receipt.schema.json"), "utf8"));
const validSnapshot = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/valid-snapshot.json"), "utf8"));
const externalWriterReject = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/external-writer-reject.json"), "utf8"));
const hookManifestSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/hook-manifest.schema.json"), "utf8"));
const replayEnvelopeSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/replay-envelope.schema.json"), "utf8"));
const runtimeObservationSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/runtime-observation.schema.json"), "utf8"));
const hookManifestFixture = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/trusted-hook-manifest.json"), "utf8"));
const replayEnvelopeFixture = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/replay-envelope.json"), "utf8"));
const runtimeObservationFixture = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/runtime-observation.json"), "utf8"));
const skeletonFixtureSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/skeleton-fixture.schema.json"), "utf8"));
const skeletonFixtureDraft = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/skeleton-gdbot-draft.json"), "utf8"));
const c1tDesignReview = JSON.parse(await readFile(resolve(root, "tests/reports/c1t-design-review.json"), "utf8"));
const c1tContractIndex = JSON.parse(await readFile(resolve(root, "contracts/c1t/contract-index.json"), "utf8"));
const c1tIndexedSchemas = await Promise.all(c1tContractIndex.schemas.map(async (name) => JSON.parse(await readFile(resolve(root, `contracts/c1t/${name.replace(/@\d+$/, "")}.schema.json`), "utf8"))));
const c1tSharedContractPack = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/shared-contract-pack.json"), "utf8"));
const taskActivationContractSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/task-activation-contract.schema.json"), "utf8"));
const modelValidityEnvelopeSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/model-validity-envelope.schema.json"), "utf8"));
const stateAlignmentContractSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/state-alignment-contract.schema.json"), "utf8"));
const handoffContractSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/handoff-contract.schema.json"), "utf8"));
const deviceCapabilityProfileSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/device-capability-profile.schema.json"), "utf8"));
const safetyProfileSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/safety-profile.schema.json"), "utf8"));
const falsificationBenchmarkSpecSchema = JSON.parse(await readFile(resolve(root, "contracts/c1t/falsification-benchmark-spec.schema.json"), "utf8"));
const c1tContractHardeningPack = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/contract-hardening-pack.json"), "utf8"));
const contactHandoffBenchmark = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/benchmarks/contact-handoff.spec.json"), "utf8"));
const modelValidityBenchmark = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/benchmarks/model-validity-detection.spec.json"), "utf8"));
const jointCompositionBenchmark = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/benchmarks/joint-dynamics-composition.spec.json"), "utf8"));
const resourceRegistryFixture = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/resource-registry.json"), "utf8"));
const c1pReferenceBenchmark = JSON.parse(await readFile(resolve(root, "tests/reports/c1p-reference-benchmark.json"), "utf8"));
const continuationViabilityFixture = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1t/continuation-viability.json"), "utf8"));
const c1pContractIndex = JSON.parse(await readFile(resolve(root, "contracts/c1p/contract-index.json"), "utf8"));
const c1pContractPack = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1p/contract-pack.json"), "utf8"));
const intentBackendProfileSchema = JSON.parse(await readFile(resolve(root, "contracts/gseos/intent-backend-profile.schema.json"), "utf8"));
const intentBackendProfiles = JSON.parse(await readFile(resolve(root, "gseos/fixtures/intent-backend-profiles.json"), "utf8"));
const c1lContractIndex = JSON.parse(await readFile(resolve(root, "contracts/c1l/contract-index.json"), "utf8"));
const c1lContractPack = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1l/contract-pack.json"), "utf8"));
const c1lSchemas = await Promise.all(c1lContractIndex.schemas.map(async (name) => JSON.parse(await readFile(resolve(root, `contracts/c1l/${name.replace(/@\d+$/, "")}.schema.json`), "utf8"))));
const authoringOwnershipPack = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1l/authoring-ownership-pack.json"), "utf8"));
const taskGraphFixture = JSON.parse(await readFile(resolve(root, "gseos/fixtures/c1l/task-graph.json"), "utf8"));

test("EventAsset 保留未知字段并稳定排序", () => {
  const extended = { ...asset, z_unknown: { b: 2, a: 1 }, a_unknown: true };
  assert.equal(validateEventAsset(extended, { capabilities: manifest.capabilities }).ok, true);
  assert.equal(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(assetFingerprint(extended), assetFingerprint({ a_unknown: true, ...asset, z_unknown: { a: 1, b: 2 } }));
});

test("能力清单、引用、能力版本和首发范围有统一诊断", () => {
  assert.equal(validateCapabilityManifest(manifest).ok, true);
  assert.equal(bindEventAsset(asset, registry).receipt.ok, true);
  const invalid = { ...asset, root: [{ ...asset.root[0], children: { then: [{ node_id: "bad", command_id: "await", params: { capability: "ui.unknown@9" } }] } }] };
  const plan = lowerToExecutionPlan(invalid, registry);
  assert.equal(plan.plan, null);
  assert.ok(plan.receipt.diagnostics.some((item) => item.code === "CAPABILITY_VERSION_MISMATCH"));
  const unsupported = { ...asset, root: [{ node_id: "spawned", command_id: "spawn", params: {} }] };
  assert.equal(lowerToExecutionPlan(unsupported, registry).plan, null);
  const badReference = { ...asset, root: [{ node_id: "bad-ref", command_id: "let", params: { name: "x", value: { ref: "missing" } } }] };
  assert.ok(lowerToExecutionPlan(badReference, registry).receipt.diagnostics.some((item) => item.code === "UNRESOLVED_REFERENCE"));
  const wrongLifecycle = { ...asset, root: [{ node_id: "bad-await", command_id: "await", params: { capability: "ui.remove_node@1", args: {} } }] };
  assert.ok(lowerToExecutionPlan(wrongLifecycle, registry).receipt.diagnostics.some((item) => item.code === "INVALID_LIFECYCLE"));
  const unsafeRegistry = createSchemaRegistry({ manifest_type: "GSEOSCapabilityManifest", schema_version: 1, capabilities: [{ id: "unsafe", version: 1, awaitable: true, cancellation: "none", result: "Void" }] });
  assert.equal(unsafeRegistry.checkCapability("unsafe@1", { awaitable: true }).ok, false);
});

test("双语 lexer/parser 归一为同一结构并保留可诊断 source span", () => {
  const english = `module ui.reward\nevent ui.reward.apply:\n  if (reward > 0):\n    let new_score = old_score + reward\n`;
  const chinese = `模块 ui.reward\n事件 ui.reward.apply：\n  若（奖励 大于 0）：\n    令 新分数 为 旧分数 加 奖励\n`;
  const namedChinese = `模块 ui.reward\n事件 领取奖励（积分，奖励） [标识：ui.reward.claim]：\n  等待 ui.animate_number@1(from: 积分, to: 奖励)\n`;
  assert.equal(lexGse("\uFEFF" + chinese).receipt.ok, true);
  const left = parseGse(english);
  const right = parseGse(chinese);
  assert.equal(left.receipt.ok, true);
  assert.equal(right.receipt.ok, true);
  assert.equal(parseGse(namedChinese).receipt.ok, true);
  assert.equal(parseGse(namedChinese).asset.event_id, "ui.reward.claim");
  assert.deepEqual(parseGse(namedChinese).asset.args.map((item) => item.id), ["积分", "奖励"]);
  assert.equal(parseGse(namedChinese).asset.root[0].params.capability, "ui.animate_number@1");
  const eventPolicy = parseGse("event body.wave [id: embodied.wave, reentry: reject, recovery: checkpoint]:\n");
  assert.equal(eventPolicy.asset.event_id, "embodied.wave");
  assert.equal(eventPolicy.asset.reentry, "reject");
  assert.equal(eventPolicy.asset.recovery, "checkpoint");
  assert.equal(left.asset.root[0].command_id, right.asset.root[0].command_id);
  assert.equal(left.asset.root[0].params.condition.op, right.asset.root[0].params.condition.op);
  assert.equal(parseGse("event bad:\n\tawait x()").receipt.ok, false);
  assert.equal(parseExpressionText("a + b * c").expression.op, "+");
  assert.equal(parseExpressionText("a + b * c").expression.right.op, "*");
  assert.equal(parseCst("# comment\n\nif (a):\n  let b = 1").children[0].kind, "comment");
  const anchored = parseGse("event demo:\n  let first = 1 # @node_id=stable.first\n  let second = 2 # @node_id=stable.second");
  const anchoredAfterInsert = parseGse("event demo:\n  let inserted = 0\n  let first = 1 # @node_id=stable.first\n  let second = 2 # @node_id=stable.second");
  assert.deepEqual(anchored.asset.root.map((node) => node.node_id), ["stable.first", "stable.second"]);
  assert.equal(anchoredAfterInsert.asset.root[1].node_id, "stable.first");
  assert.equal(anchoredAfterInsert.asset.root[2].node_id, "stable.second");
  const anchoredFormatted = formatGse(anchoredAfterInsert.asset, "en");
  const anchoredRoundTrip = parseGse(anchoredFormatted);
  assert.deepEqual(anchoredRoundTrip.asset.root.map((node) => node.node_id), anchoredAfterInsert.asset.root.map((node) => node.node_id));
  const branching = parseGse("event demo:\n  if (ready):\n    let result = 1\n  else:\n    let result = 0");
  assert.equal(branching.receipt.ok, true);
  assert.equal(branching.asset.root[0].children.then[0].params.value, 1);
  assert.equal(branching.asset.root[0].children.else[0].params.value, 0);
  const branchFormatted = formatGse(branching.asset, "zh");
  assert.match(branchFormatted, /# @node_id=imported-2/u);
  assert.match(branchFormatted, /否则：/u);
  const branchRoundTrip = parseGse(branchFormatted);
  assert.deepEqual(branchRoundTrip.asset.root[0].children.else[0].params, branching.asset.root[0].children.else[0].params);
  assert.deepEqual(branchRoundTrip.asset.root[0].children.then.map((node) => node.node_id), branching.asset.root[0].children.then.map((node) => node.node_id));
  assert.ok(parseGse("event demo:\n  if (ready):\n    let result = 1\n  else:\n  else:").receipt.diagnostics.some((item) => item.code === "DUPLICATE_ELSE"));
  assert.equal(formatGse(right.asset, "zh").startsWith("事件"), true);
  const englishFormatted = formatGse(left.asset, "en");
  assert.equal(formatGse(englishFormatted, "en"), englishFormatted);
});

test("迁移失败保留原始数据，往返和来源 span 不丢失", () => {
  const unsupported = JSON.stringify({ schema_version: 99, event_id: "bad", raw: { keep: true } });
  const migrated = roundTripEventAsset(unsupported);
  assert.equal(migrated.asset, null);
  assert.equal(migrated.json, unsupported);
  assert.equal(migrateEventAsset({ schema_version: 0, event_id: "demo", root: [] }).receipt.ok, true);
  assert.ok(parseGse("event demo:\n  let value = 1").asset.root[0].source_span.start.line === 2);
});

test("C1-L 机器人运动意图从源码进入计划并保留安全契约", () => {
  const parsed = parseGse(motionIntentSource);
  assert.equal(parsed.receipt.ok, true);
  assert.equal(parsed.asset.root[0].command_id, "motion_intent");
  assert.equal(parsed.asset.root[0].params.intent, "robot.acknowledge_user@1");
  const lowered = lowerToExecutionPlan(parsed.asset, registry);
  assert.equal(lowered.receipt.ok, true);
  assert.equal(lowered.plan.instructions[0].opcode, "MotionIntent");
  assert.equal(lowered.plan.instructions[0].args.priority.value, 80);
  const formatted = formatGse(parsed.asset, "en");
  assert.match(formatted, /intent robot\.acknowledge_user@1\(target:/);
  assert.equal(lowerToExecutionPlan(motionIntentAsset, registry).receipt.ok, true);
  const missingSafety = structuredClone(parsed.asset);
  delete missingSafety.root[0].params.args.safety_profile;
  assert.ok(lowerToExecutionPlan(missingSafety, registry).receipt.diagnostics.some((item) => item.code === "MISSING_MOTION_INTENT_CONTRACT"));
});

test("同一个高层挥手意图分流到 Godot 与机器人适配器", () => {
  const parsed = parseGse(waveSource);
  assert.equal(parsed.receipt.ok, true);
  const lowered = lowerToExecutionPlan(parsed.asset, registry);
  assert.equal(lowered.receipt.ok, true);
  const instruction = lowered.plan.instructions[0];
  const game = lowerMotionIntentToBackend(instruction, "game");
  const robot = lowerMotionIntentToBackend(instruction, "robot");
  assert.equal(game.receipt.ok, true);
  assert.equal(robot.receipt.ok, true);
  assert.equal(game.envelope.envelope_type, "GameIntentPlan");
  assert.equal(robot.envelope.envelope_type, "RobotMotionEnvelope");
  assert.equal(game.envelope.backend, "godot.motion@1");
  assert.equal(robot.envelope.adapter_command, "robot.motion.request@1");
  assert.equal(game.envelope.godot_actions[1].capability, "godot.expression.apply_profile@1");
  assert.equal(game.envelope.godot_actions[1].profile, "friendly_smile");
  assert.equal(game.envelope.llm_direct_write, false);
  assert.equal(robot.envelope.motor_write, "adapter_owned_only");
  assert.equal(JSON.stringify(game.envelope).includes("PWM"), false);
});

test("C1-L.3 按目标 Profile 能力条件 lowering，缺失能力只接受显式 fallback", () => {
  assert.equal(intentBackendProfileSchema.$id, "coda://contracts/gseos/intent-backend-profile@1");
  const instruction = lowerToExecutionPlan(parseGse(waveSource).asset, registry).plan.instructions[0];
  const [gameProfile, robotProfile] = intentBackendProfiles.profiles;
  const game = lowerMotionIntentForProfile(instruction, gameProfile);
  const robot = lowerMotionIntentForProfile(instruction, robotProfile);
  assert.equal(game.receipt.ok, true);
  assert.equal(robot.receipt.ok, true);
  assert.equal(game.envelope.target_profile, gameProfile.profile_id);
  assert.equal(robot.envelope.target_profile, robotProfile.profile_id);

  const unsupportedProfile = { ...gameProfile, capabilities: ["godot.animation.play_profile@1"] };
  const unsupported = lowerMotionIntentForProfile(instruction, unsupportedProfile);
  assert.equal(unsupported.envelope, null);
  assert.equal(unsupported.receipt.diagnostics[0].code, "INTENT_BACKEND_CAPABILITY_UNSUPPORTED");
  assert.deepEqual(unsupported.receipt.diagnostics[0].missing_capabilities, ["godot.expression.apply_profile@1"]);

  const fallback = lowerMotionIntentForProfile(instruction, {
    ...unsupportedProfile,
    capability_fallbacks: { "godot.expression.apply_profile@1": "godot.expression.neutral_profile@1" },
    capabilities: ["godot.animation.play_profile@1", "godot.expression.neutral_profile@1"],
  });
  assert.equal(fallback.receipt.ok, true);
  assert.equal(fallback.envelope.godot_actions[1].capability, "godot.expression.neutral_profile@1");
  assert.deepEqual(fallback.envelope.capability_resolution[1], { requested: "godot.expression.apply_profile@1", resolved: "godot.expression.neutral_profile@1", fallback_used: true });
  assert.equal(lowerMotionIntentForProfile(instruction, { ...gameProfile, capabilities: ["godot.animation.play_profile@1", "godot.animation.play_profile@1"] }).receipt.diagnostics[0].code, "INVALID_INTENT_BACKEND_PROFILE");
});

test("C1-L.0.3 协议合同冻结 authoring、控制权、时效与安全权威边界", () => {
  assert.equal(c1lContractIndex.contract_family, "C1-L");
  assert.deepEqual(c1lSchemas.map((item) => item.$id), c1lContractIndex.schemas.map((item) => `coda://contracts/c1l/${item}`));
  const schema = (name) => c1lSchemas.find((item) => item.$id.endsWith(`/${name}@1`));
  assert.equal(schema("embodied-skill").properties.authoring_owner.const, "text_owned");
  assert.deepEqual(schema("intent-protocol").properties.operation.enum, ["invoke", "amend", "interrupt", "pause", "resume", "cancel"]);
  assert.equal(schema("intent-protocol").properties.generation.minimum, 0);
  assert.equal(schema("intent-receipt").properties.terminal.type, "boolean");
  assert.deepEqual(schema("authoring-file-set-recovery").properties.state.enum, ["prepared", "committed"]);
  assert.equal(schema("authoring-file-set-recovery").properties.files.maxItems, 3);
  assert.ok(schema("embodiment-protocol").allOf.length >= 8);
  assert.ok(schema("embodiment-dynamics-profile").required.includes("unit_registry_ref"));
  assert.ok(schema("embodiment-dynamics-profile").required.includes("reference_frame_registry_ref"));
  assert.ok(schema("unit-registry").$defs.dimension.required.includes("angle"));
  assert.ok(schema("reference-frame-registry").properties.frames.minItems >= 1);
  assert.deepEqual(schema("safety-authority-port").properties.action.enum, ["revoke_writer", "request_protective_action", "enter_device_failsafe", "report_safety_clear"]);
  const safetyLatchRules = schema("safety-authority-port").allOf;
  assert.ok(safetyLatchRules.some((rule) => rule.if?.properties?.action?.enum?.includes("revoke_writer") && rule.then?.properties?.latched?.const === true));
  assert.ok(safetyLatchRules.some((rule) => rule.if?.properties?.action?.const === "report_safety_clear" && rule.then?.properties?.latched?.const === false));
  const observationBlock = schema("embodiment-protocol").allOf.find((item) => item.if.properties.message_type.const === "observation");
  assert.ok(observationBlock.then.properties.payload.required.includes("field_unit_map"));
  assert.equal(observationBlock.then.properties.payload.properties.field_unit_map.minItems, 1);
  assert.deepEqual(schema("embodiment-dynamics-profile").properties.guarantee_level.enum, ["visual_plausibility", "model_admissible", "calibrated_envelope", "hardware_safety_reviewed"]);

  assert.equal(c1lContractPack.embodied_skill.authoring_owner, "text_owned");
  assert.equal(c1lContractPack.intent_request.operation, "invoke");
  assert.equal(c1lContractPack.intent_receipt.terminal, false);
  assert.equal(validateIntentProtocolReceipt(c1lContractPack.intent_receipt).ok, true);
  const terminalMismatch = validateIntentProtocolReceipt({ ...c1lContractPack.intent_receipt, status: "completed" });
  assert.ok(terminalMismatch.diagnostics.some((item) => item.code === "INTENT_RECEIPT_TERMINAL_MISMATCH"));
  assert.equal(c1lContractPack.embodiment_observation.direction, "adapter_to_coda");
  assert.equal(c1lContractPack.embodiment_observation.validity.valid_until_tick, 122);
  assert.deepEqual(c1lContractPack.embodiment_observation.payload.field_unit_map.map(({ field_ref, unit_ref, reference_frame_ref }) => ({ field_ref, unit_ref, reference_frame_ref })), [
    { field_ref: "arm.position@1", unit_ref: "si.meter@1", reference_frame_ref: "world@1" },
    { field_ref: "arm.orientation@1", unit_ref: "si.radian@1", reference_frame_ref: "world@1" },
  ]);
  assert.equal(validateEmbodimentProtocolMessage(c1lContractPack.embodiment_observation, { now_tick: 121, clock_domain: "godot.physics", minimum_epoch: 1, minimum_sequence: 11 }).ok, true);
  const noUnitMap = structuredClone(c1lContractPack.embodiment_observation);
  delete noUnitMap.payload.field_unit_map;
  assert.ok(validateEmbodimentProtocolMessage(noUnitMap).diagnostics.some((item) => item.code === "EMBODIMENT_FIELD_UNIT_MAP_REQUIRED"));
  const duplicateUnitMap = structuredClone(c1lContractPack.embodiment_observation);
  duplicateUnitMap.payload.field_unit_map.push(duplicateUnitMap.payload.field_unit_map[0]);
  assert.ok(validateEmbodimentProtocolMessage(duplicateUnitMap).diagnostics.some((item) => item.code === "DUPLICATE_EMBODIMENT_FIELD_REF"));
  const unversionedUnitMap = structuredClone(c1lContractPack.embodiment_observation);
  unversionedUnitMap.payload.field_unit_map[0].unit_ref = "meters";
  assert.ok(validateEmbodimentProtocolMessage(unversionedUnitMap).diagnostics.some((item) => item.code === "INVALID_EMBODIMENT_FIELD_BINDING"));
  const partialReceipt = { ...c1lContractPack.embodiment_observation, message_type: "terminal_receipt", direction: "adapter_to_coda", lease_ref: "lease.wave@1", generation: 1, payload: { receipt_id: "receipt.1", status: "completed", partial_write: true } };
  assert.ok(validateEmbodimentProtocolMessage(partialReceipt).diagnostics.some((item) => item.code === "EMBODIMENT_PARTIAL_WRITE_FORBIDDEN"));
  assert.ok(validateEmbodimentProtocolMessage({ ...c1lContractPack.embodiment_observation, epoch: 0 }, { minimum_epoch: 1 }).diagnostics.some((item) => item.code === "EMBODIMENT_EPOCH_STALE"));
  assert.equal(c1lContractPack.safety_revocation.action, "revoke_writer");
  assert.equal(c1lContractPack.safety_revocation.latched, true);
  assert.equal(validateSafetyAuthorityReceipt(c1lContractPack.safety_revocation).ok, true);
  const invalidSafetyClear = { ...c1lContractPack.safety_revocation, action: "report_safety_clear", latched: true };
  assert.ok(validateSafetyAuthorityReceipt(invalidSafetyClear).diagnostics.some((item) => item.code === "SAFETY_CLEAR_MUST_UNLATCH"));
  const unboundFailsafe = { ...c1lContractPack.safety_revocation, action: "enter_device_failsafe", device_action_ref: undefined };
  assert.ok(validateSafetyAuthorityReceipt(unboundFailsafe).diagnostics.some((item) => item.code === "SAFETY_AUTHORITY_DEVICE_ACTION_REQUIRED"));
  assert.ok(validateSafetyAuthorityReceipt({ ...c1lContractPack.safety_revocation, unexpected_writer: "coda" }).diagnostics.some((item) => item.code === "UNKNOWN_SAFETY_AUTHORITY_FIELD"));
  assert.equal(c1lContractPack.dynamics_profile.target_class, "game_visual");
  assert.equal(c1lContractPack.dynamics_profile.guarantee_level, "visual_plausibility");
  assert.equal(c1lContractPack.dynamics_profile.status, "draft");
  assert.equal(c1lContractPack.dynamics_profile.unit_registry_ref, c1lContractPack.unit_registry.registry_ref);
  assert.equal(c1lContractPack.dynamics_profile.reference_frame_registry_ref, c1lContractPack.reference_frame_registry.registry_ref);
  assert.equal(validateEmbodimentUnitRegistry(c1lContractPack.unit_registry).ok, true);
  assert.equal(validateReferenceFrameRegistry(c1lContractPack.reference_frame_registry).ok, true);
  assert.equal(validateEmbodimentProtocolMessage(c1lContractPack.embodiment_observation, {
    unit_registry: c1lContractPack.unit_registry,
    frame_registry: c1lContractPack.reference_frame_registry,
  }).ok, true);
  const wrongRotationUnit = structuredClone(c1lContractPack.embodiment_observation);
  wrongRotationUnit.payload.field_unit_map[1].unit_ref = "si.meter@1";
  assert.ok(validateEmbodimentProtocolMessage(wrongRotationUnit, {
    unit_registry: c1lContractPack.unit_registry,
    frame_registry: c1lContractPack.reference_frame_registry,
  }).diagnostics.some((item) => item.code === "EMBODIMENT_ROTATION_UNIT_DIMENSION_MISMATCH"));
  const unknownObservationFrame = structuredClone(c1lContractPack.embodiment_observation);
  unknownObservationFrame.payload.field_unit_map[0].reference_frame_ref = "missing.frame@1";
  assert.ok(validateEmbodimentProtocolMessage(unknownObservationFrame, {
    unit_registry: c1lContractPack.unit_registry,
    frame_registry: c1lContractPack.reference_frame_registry,
  }).diagnostics.some((item) => item.code === "EMBODIMENT_FRAME_UNRESOLVED"));
  const cyclicFrames = structuredClone(c1lContractPack.reference_frame_registry);
  cyclicFrames.frames.push({ frame_ref: "arm@1", parent_frame_ref: "tool@1", transform_model_ref: "tool.to.arm@1" }, { frame_ref: "tool@1", parent_frame_ref: "arm@1", transform_model_ref: "arm.to.tool@1" });
  assert.ok(validateReferenceFrameRegistry(cyclicFrames).diagnostics.some((item) => item.code === "REFERENCE_FRAME_CYCLE"));
});

test("C1-M.0 独立 SafetyAuthority mock 撤销旧 writer、拒绝重放且不恢复旧 generation", () => {
  const port = new MockSafetyAuthorityPort({ authority_ref: "safety.mock@1" });
  const binding = { instance_id: "actor.wave", generation: 4, lease_ref: "lease.actor@1" };
  assert.equal(port.registerWriter(binding).accepted, true);
  assert.equal(port.canWrite(binding.instance_id, binding.generation), true);
  const revoke = {
    receipt_type: "SafetyAuthorityReceipt", schema_version: 1, event_id: "event.revoke.1", authority_ref: "safety.mock@1",
    target_instance: binding.instance_id, target_generation: binding.generation, action: "revoke_writer", latched: true,
    issued_at: { clock_domain: "test.tick", tick: 20 }, source_ref: "safety.monitor@1",
  };
  assert.equal(port.apply(revoke).accepted, true);
  assert.equal(port.canWrite(binding.instance_id, binding.generation), false);
  const afterRevoke = port.snapshot();
  assert.equal(port.apply(revoke).code, "MOCK_SAFETY_EVENT_REPLAY");
  assert.deepEqual(port.snapshot(), afterRevoke);
  const wrongGeneration = { ...revoke, event_id: "event.revoke.stale", target_generation: 3 };
  assert.equal(port.apply(wrongGeneration).code, "MOCK_SAFETY_TARGET_OR_GENERATION_MISMATCH");
  assert.deepEqual(port.snapshot(), afterRevoke);
  const wrongAuthority = { ...revoke, event_id: "event.revoke.foreign", authority_ref: "other.safety@1" };
  assert.equal(port.apply(wrongAuthority).code, "MOCK_SAFETY_AUTHORITY_MISMATCH");
  assert.deepEqual(port.snapshot(), afterRevoke);
  const clear = { ...revoke, event_id: "event.clear.1", action: "report_safety_clear", latched: false };
  assert.equal(port.apply(clear).accepted, true);
  assert.equal(port.canWrite(binding.instance_id, binding.generation), false);
  assert.equal(port.registerWriter({ ...binding, generation: 5, lease_ref: "lease.actor.next@1" }).accepted, true);
  assert.equal(port.canWrite(binding.instance_id, 5), true);
  assert.equal(port.apply({ ...revoke, event_id: "event.revoke.late" }).code, "MOCK_SAFETY_TARGET_OR_GENERATION_MISMATCH");
  assert.equal(port.canWrite(binding.instance_id, 5), true);
  const protectiveActionWithoutLatch = { ...revoke, event_id: "event.protective.invalid", action: "request_protective_action", device_action_ref: "safe.stop@1", latched: false };
  assert.equal(port.apply(protectiveActionWithoutLatch).accepted, false);
});

test("C1-L.0.3 IntentProtocol reference isolates 100 instances and rejects stale generations", () => {
  const makeRequest = (request_id, instance_id, operation, generation = 0, extra = {}) => ({
    protocol: "IntentProtocol", schema_version: 1, request_id, operation, skill_ref: "social.wave@1", instance_id, generation,
    issued_at: { clock_domain: "test.tick", tick: 10 }, deadline: { clock_domain: "test.tick", not_after_tick: 20 },
    parameter_schema_ref: "social.wave.parameters@1", authority_ref: "test.authority@1", priority: 50, ...extra,
  });
  let state = createIntentProtocolState();
  const initialState = state;
  for (let index = 0; index < 100; index += 1) {
    const request = makeRequest(`invoke.${index}`, `actor.${index}.wave`, "invoke", 0, { parameters: { actor_index: index } });
    assert.equal(validateIntentProtocolRequest(request).ok, true);
    const applied = applyIntentProtocolRequest(state, request);
    assert.equal(applied.receipt.status, "admitted");
    assert.equal(validateIntentProtocolReceipt(applied.receipt).ok, true);
    state = applied.state;
  }
  assert.equal(Object.keys(state.instances).length, 100);
  assert.deepEqual(initialState.instances, {});

  state = applyIntentProtocolRequest(state, makeRequest("amend.17", "actor.17.wave", "amend", 0, { parameters: { target: "left" } })).state;
  assert.equal(state.instances["actor.17.wave"].parameters.target, "left");
  assert.equal(state.instances["actor.18.wave"].parameters.target, undefined);
  state = applyIntentProtocolRequest(state, makeRequest("pause.17", "actor.17.wave", "pause", 0)).state;
  const resumed = applyIntentProtocolRequest(state, makeRequest("resume.17", "actor.17.wave", "resume", 1, { continuation_ref: "continuation.17@1" }));
  assert.equal(resumed.receipt.status, "resumed");
  state = resumed.state;
  const stale = applyIntentProtocolRequest(state, makeRequest("late.cancel.17", "actor.17.wave", "cancel", 0));
  assert.equal(stale.receipt.status, "stale");
  assert.equal(stale.state.instances["actor.17.wave"].generation, 1);
  assert.equal(stale.state.instances["actor.17.wave"].status, "running");
  const cancelled = applyIntentProtocolRequest(stale.state, makeRequest("cancel.17", "actor.17.wave", "cancel", 1));
  assert.equal(cancelled.receipt.terminal, true);
  assert.equal(cancelled.state.instances["actor.17.wave"].terminal, true);
  assert.equal(applyIntentProtocolRequest(cancelled.state, makeRequest("cancel.17", "actor.17.wave", "cancel", 1)).receipt.status, "stale");
  assert.equal(cancelled.state.instances["actor.18.wave"].status, "running");
  const completed = settleIntentProtocolInstance(cancelled.state, { request_id: "complete.18", instance_id: "actor.18.wave", generation: 0, status: "completed" });
  assert.equal(completed.receipt.status, "completed");
  assert.equal(validateIntentProtocolReceipt(completed.receipt).ok, true);
  const duplicateTerminal = settleIntentProtocolInstance(completed.state, { request_id: "late.failure.18", instance_id: "actor.18.wave", generation: 0, status: "failed" });
  assert.equal(duplicateTerminal.receipt.status, "stale");
  assert.equal(validateIntentProtocolReceipt(duplicateTerminal.receipt).ok, true);
  assert.equal(duplicateTerminal.state.instances["actor.18.wave"].status, "completed");
});

test("C1-M.0 mock EmbodimentAdapter conforms to query, lease and reference admission without partial writes", () => {
  const adapter = new MockEmbodimentAdapter({ adapter_ref: "mock.embodiment.adapter@1", capabilities: ["arm@1"] });
  const message = (message_id, message_type, sequence, payload, extras = {}) => ({
    protocol: "EmbodimentProtocol", schema_version: 1, message_id, direction: "coda_to_adapter", message_type,
    adapter_ref: "mock.embodiment.adapter@1", epoch: 1, sequence,
    clock: { domain: "coda.clock", tick: 10 + sequence, quality: "synchronized" },
    validity: { valid_from_tick: 10, valid_until_tick: 30 }, payload, ...extras,
  });
  const queryMessage = message("query.1", "capability_query", 0, { profile_ref: "test.profile@1", minimum_protocol_version: 1 });
  const query = adapter.receive(queryMessage);
  assert.equal(query.accepted, true);
  assert.equal(query.response.message_type, "capability_report");
  assert.equal(validateEmbodimentProtocolMessage(query.response).ok, true);
  const afterQuery = adapter.snapshot();
  const observation = adapter.publishObservation({ snapshot_ref: "snapshot.mock.1", tick: 10 });
  assert.equal(observation.accepted, true);
  assert.equal(validateEmbodimentProtocolMessage(observation.response).ok, true);
  assert.equal(observation.response.payload.field_unit_map[0].unit_ref, "si.meter@1");
  const invalidObservation = adapter.publishObservation({ snapshot_ref: "snapshot.mock.bad", tick: 10, field_unit_map: [] });
  assert.equal(invalidObservation.accepted, false);
  assert.deepEqual(invalidObservation.ledger, afterQuery);
  const unsupported = adapter.receive(message("unsupported.query", "observation", 1, { snapshot_ref: "snapshot.incoming", quality: "valid", reference_frame: "world@1", unit_system: "si@1", field_unit_map: c1lContractPack.embodiment_observation.payload.field_unit_map }));
  assert.equal(unsupported.accepted, false);
  assert.equal(unsupported.response.message_type, "reject");
  assert.equal(validateEmbodimentProtocolMessage(unsupported.response).ok, true);
  assert.deepEqual(unsupported.ledger, afterQuery);
  const replay = adapter.receive(queryMessage);
  assert.equal(replay.accepted, false);
  assert.deepEqual(replay.ledger, afterQuery);
  const beforeUnavailableLease = adapter.snapshot();
  const unavailableLease = adapter.receive(message("lease.unavailable", "authority_lease", 1, { lease_id: "lease.unavailable", owner: "coda", resources: ["leg@1"], valid_until_tick: 25 }, { lease_ref: "lease.actor@1", generation: 4 }));
  assert.equal(unavailableLease.accepted, false);
  assert.equal(unavailableLease.response.payload.code, "MOCK_LEASE_CAPABILITY_UNAVAILABLE");
  assert.deepEqual(unavailableLease.ledger, beforeUnavailableLease);
  const lease = adapter.receive(message("lease.1", "authority_lease", 1, { lease_id: "lease.1", owner: "coda", resources: ["arm@1"], valid_until_tick: 25 }, { lease_ref: "lease.actor@1", generation: 4 }));
  assert.equal(lease.accepted, true);
  assert.equal(lease.response.payload.partial_write, false);
  assert.equal(validateEmbodimentProtocolMessage(lease.response).ok, true);
  const reference = adapter.receive(message("reference.1", "reference", 2, { representation: "segment", reference_ref: "ref.segment@1", constraints_ref: "constraints.arm@1" }, { lease_ref: "lease.actor@1", generation: 4 }));
  assert.equal(reference.accepted, true);
  assert.equal(validateEmbodimentProtocolMessage(reference.response).ok, true);
  const mode = adapter.receive(message("mode.1", "mode_request", 3, { controller_ref: "controller.position@1", mode_ref: "mode.contact@1", handoff_contract_ref: "handoff.contact@1" }, { lease_ref: "lease.actor@1", generation: 4 }));
  assert.equal(mode.accepted, true);
  assert.equal(mode.response.message_type, "transition_receipt");
  assert.equal(validateEmbodimentProtocolMessage(mode.response).ok, true);
  const beforeMismatchedHandoff = adapter.snapshot();
  const mismatchedHandoff = adapter.receive(message("handoff.mismatch", "handoff", 4, { handoff_contract_ref: "handoff.other@1", incoming_controller_ref: "controller.contact@1", barrier_id: "barrier.other.1" }, { lease_ref: "lease.actor@1", generation: 4 }));
  assert.equal(mismatchedHandoff.accepted, false);
  assert.equal(mismatchedHandoff.response.payload.code, "MOCK_HANDOFF_MODE_NOT_ADMITTED");
  assert.deepEqual(mismatchedHandoff.ledger, beforeMismatchedHandoff);
  const handoff = adapter.receive(message("handoff.1", "handoff", 4, { handoff_contract_ref: "handoff.contact@1", incoming_controller_ref: "controller.contact@1", barrier_id: "barrier.contact.1" }, { lease_ref: "lease.actor@1", generation: 4 }));
  assert.equal(handoff.accepted, true);
  assert.equal(handoff.ledger.handoff_barrier.barrier_id, "barrier.contact.1");
  const beforeStale = adapter.snapshot();
  const expired = adapter.receive(message("reference.expired", "reference", 5, { representation: "segment", reference_ref: "ref.expired@1", constraints_ref: "constraints.arm@1" }, { lease_ref: "lease.actor@1", generation: 4 }), { now_tick: 26 });
  assert.equal(expired.accepted, false);
  assert.equal(validateEmbodimentProtocolMessage(expired.response).ok, true);
  assert.deepEqual(expired.ledger, beforeStale);
  const stale = adapter.receive(message("reference.stale", "reference", 5, { representation: "segment", reference_ref: "ref.next@1", constraints_ref: "constraints.arm@1" }, { lease_ref: "lease.actor@1", generation: 5 }));
  assert.equal(stale.accepted, false);
  assert.equal(stale.response.message_type, "reject");
  assert.equal(stale.response.payload.partial_write, false);
  assert.deepEqual(stale.ledger, beforeStale);
  assert.equal(validateEmbodimentProtocolMessage(stale.response).ok, true);
  const terminal = adapter.settleLease({ lease_ref: "lease.actor@1", generation: 4, status: "completed", now_tick: 15 });
  assert.equal(terminal.accepted, true);
  assert.equal(validateEmbodimentProtocolMessage(terminal.response).ok, true);
  const afterTerminal = adapter.snapshot();
  const duplicateTerminal = adapter.settleLease({ lease_ref: "lease.actor@1", generation: 4, status: "failed", now_tick: 15 });
  assert.equal(duplicateTerminal.accepted, false);
  assert.deepEqual(duplicateTerminal.ledger, afterTerminal);
  const unsupportedAfterTerminal = adapter.receive(message("unsupported.1", "observation", 6, { snapshot_ref: "snapshot.incoming", quality: "valid", reference_frame: "world@1", unit_system: "si@1", field_unit_map: c1lContractPack.embodiment_observation.payload.field_unit_map }));
  assert.equal(unsupportedAfterTerminal.accepted, false);
  assert.equal(unsupportedAfterTerminal.response.message_type, "reject");
  assert.equal(validateEmbodimentProtocolMessage(unsupportedAfterTerminal.response).ok, true);
  assert.deepEqual(unsupportedAfterTerminal.ledger, afterTerminal);
  const postTerminalReference = adapter.receive(message("reference.late", "reference", 6, { representation: "segment", reference_ref: "ref.late@1", constraints_ref: "constraints.arm@1" }, { lease_ref: "lease.actor@1", generation: 4 }), { now_tick: 16 });
  assert.equal(postTerminalReference.accepted, false);
  assert.deepEqual(postTerminalReference.ledger, afterTerminal);
});

test("C1-M.0 mode changes and handoffs require an active lease binding at protocol admission", () => {
  const adapterRef = "mock.embodiment.adapter@1";
  const makeMessage = (message_type, payload) => ({
    protocol: "EmbodimentProtocol", schema_version: 1, message_id: `missing-lease.${message_type}`,
    direction: "coda_to_adapter", message_type, adapter_ref: adapterRef, epoch: 2, sequence: 0,
    clock: { domain: "coda.clock", tick: 5, quality: "synchronized" },
    validity: { valid_from_tick: 0, valid_until_tick: 10 }, payload,
  });
  const adapter = new MockEmbodimentAdapter({ adapter_ref: adapterRef });
  for (const [message_type, payload] of [
    ["mode_request", { controller_ref: "controller.position@1", mode_ref: "mode.contact@1", handoff_contract_ref: "handoff.contact@1" }],
    ["handoff", { handoff_contract_ref: "handoff.contact@1", incoming_controller_ref: "controller.contact@1", barrier_id: "barrier.1" }],
  ]) {
    const message = makeMessage(message_type, payload);
    const validation = validateEmbodimentProtocolMessage(message);
    assert.ok(validation.diagnostics.some((item) => item.code === "EMBODIMENT_LEASE_BINDING_REQUIRED"));
    const before = adapter.snapshot();
    const response = adapter.receive(message);
    assert.equal(response.accepted, false);
    assert.equal(response.response.message_type, "reject");
    assert.equal(response.response.payload.partial_write, false);
    assert.deepEqual(response.ledger, before);
  }

  const schema = c1lSchemas.find((item) => item.$id.endsWith("/embodiment-protocol@1"));
  for (const type of ["mode_request", "handoff"]) {
    const condition = schema.allOf.find((item) => item.if.properties.message_type.const === type);
    assert.deepEqual(condition.then.required, ["lease_ref", "generation"]);
  }
});

test("C1-M.1 mock driver session records and deterministically replays faults and command lifecycle", () => {
  const adapterRef = "mock.embodiment.adapter@1";
  const build = (message_id, message_type, sequence, payload, lease = null) => ({
    protocol: "EmbodimentProtocol", schema_version: 1, message_id, direction: "coda_to_adapter", message_type,
    adapter_ref: adapterRef, epoch: 1, sequence,
    clock: { domain: "coda.clock", tick: 10 + sequence, quality: "synchronized" },
    validity: { valid_from_tick: 10, valid_until_tick: 40 }, payload,
    ...(lease ? { lease_ref: lease.lease_ref, generation: lease.generation } : {}),
  });
  const lease = { lease_ref: "lease.wave@1", generation: 2 };
  const recording = recordMockEmbodimentSession({
    adapter_config: { adapter_ref: adapterRef, capabilities: ["arm@1"] },
    actions: [
      { action: "receive", message: build("query.1", "capability_query", 0, { profile_ref: "robot.profile@1", minimum_protocol_version: 1 }) },
      { action: "receive", message: build("lease.1", "authority_lease", 1, { lease_id: "lease.wave", owner: "coda", resources: ["arm@1"], valid_until_tick: 35 }, lease) },
      { action: "receive", message: build("mode.1", "mode_request", 2, { controller_ref: "controller.position@1", mode_ref: "mode.wave@1", handoff_contract_ref: "handoff.wave@1" }, lease) },
      { action: "receive", message: build("handoff.bad", "handoff", 3, { handoff_contract_ref: "handoff.other@1", incoming_controller_ref: "controller.next@1", barrier_id: "barrier.1" }, lease) },
      { action: "receive", message: build("reference.1", "reference", 3, { representation: "segment", reference_ref: "wave.segment@1", constraints_ref: "wave.constraints@1" }, lease) },
      { action: "settle_lease", request: { ...lease, status: "completed", now_tick: 15 } },
      { action: "receive", message: build("reference.late", "reference", 4, { representation: "segment", reference_ref: "late.segment@1", constraints_ref: "wave.constraints@1" }, lease) },
      { action: "publish_observation", request: { snapshot_ref: "snapshot.15@1", tick: 15 } },
    ],
  });
  assert.equal(recording.ok, true);
  assert.equal(recording.steps[3].output.response.payload.code, "MOCK_HANDOFF_MODE_NOT_ADMITTED");
  assert.equal(recording.steps[6].output.response.payload.code, "MOCK_LEASE_ALREADY_TERMINAL");
  const firstReplay = replayMockEmbodimentSession(recording);
  const secondReplay = replayMockEmbodimentSession(recording);
  assert.equal(firstReplay.ok, true);
  assert.deepEqual(firstReplay, secondReplay);
  const changedFaultInput = structuredClone(recording);
  changedFaultInput.steps[1].input.message.payload.resources = ["leg@1"];
  const divergent = replayMockEmbodimentSession(changedFaultInput);
  assert.equal(divergent.ok, false);
  assert.ok(divergent.mismatches.some((item) => item.index === 1));
  assert.equal(replayMockEmbodimentSession({ ...recording, schema_version: 99 }).code, "MOCK_REPLAY_ENVELOPE_INVALID");
});

test("C1-M.1 reusable no-hardware conformance suite rejects partial writes and terminal races", () => {
  const report = runEmbodimentAdapterConformance(new MockEmbodimentAdapter({ adapter_ref: "conformance.adapter@1", capabilities: ["arm@1"] }));
  assert.equal(report.ok, true, JSON.stringify(report.cases.filter((item) => !item.passed)));
  assert.equal(report.case_count, 13);
  assert.equal(report.failure_count, 0);
  assert.ok(report.non_claims.includes("does not validate physical accuracy, calibration, real-time guarantees, or hardware safety"));
  const missingMethods = runEmbodimentAdapterConformance({});
  assert.equal(missingMethods.ok, false);
  assert.equal(missingMethods.cases[0].name, "adapter_interface");
});

test("C1-M.0 lease generations cannot be reused after expiry and remain epoch-bound", () => {
  const adapterRef = "mock.embodiment.adapter@1";
  const adapter = new MockEmbodimentAdapter({ adapter_ref: adapterRef, capabilities: ["arm@1"] });
  const message = (message_id, message_type, epoch, sequence, tick, payload, lease_ref, generation) => ({
    protocol: "EmbodimentProtocol", schema_version: 1, message_id,
    direction: "coda_to_adapter", message_type, adapter_ref: adapterRef, epoch, sequence,
    clock: { domain: "coda.clock", tick, quality: "synchronized" },
    validity: { valid_from_tick: 0, valid_until_tick: 20 }, payload,
    ...(lease_ref ? { lease_ref, generation } : {}),
  });
  assert.equal(adapter.receive(message("query.epoch1", "capability_query", 1, 0, 0, { profile_ref: "profile.test@1", minimum_protocol_version: 1 })).accepted, true);
  const firstLease = (sequence, generation, valid_until_tick, epoch = 1, tick = 1) => message(
    `lease.${epoch}.${generation}.${sequence}`, "authority_lease", epoch, sequence, tick,
    { lease_id: `lease.${generation}`, owner: "coda", resources: ["arm@1"], valid_until_tick },
    `lease.actor.${generation}@1`, generation,
  );
  assert.equal(adapter.receive(firstLease(1, 4, 3)).accepted, true);

  const beforeReplayGeneration = adapter.snapshot();
  const replayGeneration = adapter.receive(firstLease(2, 4, 9, 1, 4));
  assert.equal(replayGeneration.accepted, false);
  assert.equal(replayGeneration.response.payload.code, "MOCK_GENERATION_NOT_ADVANCED");
  assert.deepEqual(replayGeneration.ledger, beforeReplayGeneration);

  const renewed = adapter.receive(firstLease(2, 5, 9, 1, 4));
  assert.equal(renewed.accepted, true);
  assert.equal(renewed.ledger.lease.generation, 5);
  const staleEpochCommand = message("reference.old-epoch", "reference", 2, 0, 5,
    { representation: "hold_reference", reference_ref: "reference.hold@1", constraints_ref: "constraints.arm@1" },
    "lease.actor.5@1", 5);
  const beforeStaleCommand = adapter.snapshot();
  const stale = adapter.receive(staleEpochCommand);
  assert.equal(stale.accepted, false);
  assert.deepEqual(stale.ledger, beforeStaleCommand);
});

test("C1-L.0.1 authoring ownership 单源、乐观锁与迁移冲突保持原子", () => {
  const ownershipSchema = c1lSchemas.find((item) => item.$id.endsWith("/authoring-ownership@1"));
  const transactionSchema = c1lSchemas.find((item) => item.$id.endsWith("/authoring-transaction@1"));
  const receiptSchema = c1lSchemas.find((item) => item.$id.endsWith("/authoring-transaction-receipt@1"));
  assert.equal(ownershipSchema.properties.authoring_mode.enum.length, 2);
  assert.equal(ownershipSchema.properties.node_identity.properties.policy.const, "stable_node_id@1");
  assert.equal(ownershipSchema.properties.derived_projections.items.properties.authority.const, "derived");
  assert.equal(ownershipSchema.properties.derived_projections.items.properties.writable.const, false);
  assert.ok(transactionSchema.required.includes("expected_owner_revision"));
  assert.ok(transactionSchema.required.includes("expected_source_fingerprint"));
  assert.equal(receiptSchema.allOf[1].then.properties.changed_node_ids.maxItems, 0);
  assert.deepEqual(receiptSchema.properties.invalidated_projection_fingerprints.items.pattern, "^sha256:[a-f0-9]{64}$");

  assert.equal(authoringOwnershipPack.text_owned.authoring_mode, "text_owned");
  assert.equal(authoringOwnershipPack.text_owned.source.source_type, "coda_source");
  assert.equal(authoringOwnershipPack.graph_owned.authoring_mode, "graph_owned");
  assert.equal(authoringOwnershipPack.graph_owned.source.source_type, "event_asset");
  assert.equal(authoringOwnershipPack.migration_transaction.expected_mode, "graph_owned");
  assert.equal(authoringOwnershipPack.migration_transaction.target_mode, "text_owned");
  assert.equal(authoringOwnershipPack.stale_owner_receipt.status, "conflict");
  assert.deepEqual(authoringOwnershipPack.stale_owner_receipt.changed_node_ids, []);
});

test("C1-L.0.1 reference authoring transaction applies atomically with owner revision and node fingerprints", () => {
  const source = { asset_type: "EventAsset", schema_version: 1, event_id: "test.authoring", root: [{ node_id: "stable.node", command_id: "let", params: { value: 1 } }] };
  const identityDigest = authoringNodeIdentityDigest(source);
  const ownership = {
    contract_type: "AuthoringOwnership",
    schema_version: 1,
    asset_id: "test.authoring@1",
    authoring_mode: "graph_owned",
    owner_revision: 4,
    source: { source_type: "event_asset", source_ref: "gseos/events/test.authoring.gse.json", fingerprint: assetFingerprint(source) },
    node_identity: { policy: "stable_node_id@1", mapping_digest: identityDigest },
    derived_projections: [{ artifact_type: "execution_plan", fingerprint: "sha256:" + "a".repeat(64), authority: "derived", writable: false }],
  };
  const candidate = structuredClone(source);
  candidate.root[0].params.value = 2;
  const transaction = {
    transaction_type: "AuthoringTransaction",
    schema_version: 1,
    transaction_id: "edit.test.authoring.005",
    asset_id: ownership.asset_id,
    expected_mode: "graph_owned",
    expected_owner_revision: ownership.owner_revision,
    expected_source_fingerprint: ownership.source.fingerprint,
    operation: "edit",
    target_mode: "graph_owned",
    target_source: { source_type: "event_asset", source_ref: ownership.source.source_ref, candidate_fingerprint: assetFingerprint(candidate), node_identity_digest: identityDigest },
    operations: [{ operation: "replace_field", node_id: "stable.node", field_path: "/params/value", expected_node_fingerprint: authoringSourceNodeFingerprint(source.root[0]), value: 2 }],
  };
  const committed = applyAuthoringTransaction(ownership, source, transaction);
  assert.equal(committed.receipt.status, "committed");
  assert.equal(committed.ownership.owner_revision, 5);
  assert.deepEqual(committed.ownership.derived_projections, []);
  assert.deepEqual(committed.receipt.invalidated_projection_fingerprints, ["sha256:" + "a".repeat(64)]);
  assert.equal(committed.source.root[0].params.value, 2);
  assert.equal(source.root[0].params.value, 1);
  assert.deepEqual(committed.receipt.changed_node_ids, ["stable.node"]);

  const stale = applyAuthoringTransaction(committed.ownership, committed.source, transaction);
  assert.equal(stale.receipt.status, "conflict");
  assert.deepEqual(stale.receipt.changed_node_ids, []);
  const staleIdentity = { ...ownership, node_identity: { ...ownership.node_identity, mapping_digest: "sha256:" + "0".repeat(64) } };
  assert.equal(applyAuthoringTransaction(staleIdentity, source, transaction).receipt.diagnostics[0].code, "AUTHORING_NODE_IDENTITY_MISMATCH");
  const changedNode = { ...transaction, operations: [{ ...transaction.operations[0], expected_node_fingerprint: "sha256:" + "0".repeat(64) }] };
  assert.equal(applyAuthoringTransaction(ownership, source, changedNode).receipt.status, "conflict");
  const duplicateSubtreeIds = {
    ...transaction,
    operations: [{ operation: "add_node", node_id: "new.parent", field_path: "/root", value: { node_id: "new.parent", children: { body: [{ node_id: "nested.same" }, { node_id: "nested.same" }] } } }],
  };
  assert.equal(applyAuthoringTransaction(ownership, source, duplicateSubtreeIds).receipt.diagnostics[0].code, "INVALID_AUTHORING_NODE_ADDITION");
});

test("C1-L.0.1 text-owned authoring edits canonical anchored GSE atomically", () => {
  const source = "event test.textowned:\n  let value = 1 # @node_id=stable.value\n";
  const parsed = parseGse(source);
  const identityDigest = authoringNodeIdentityDigest(parsed.asset);
  const ownership = {
    contract_type: "AuthoringOwnership", schema_version: 1, asset_id: "test.textowned@1", authoring_mode: "text_owned", owner_revision: 2,
    source: { source_type: "coda_source", source_ref: "gseos/events/test.textowned.coda", fingerprint: assetFingerprint(source) },
    node_identity: { policy: "stable_node_id@1", mapping_digest: identityDigest },
    derived_projections: [{ artifact_type: "execution_plan", fingerprint: "sha256:" + "b".repeat(64), authority: "derived", writable: false }],
  };
  const candidate = structuredClone(parsed.asset);
  candidate.root[0].params.value = 7;
  const candidateText = formatGse(candidate, "en");
  const transaction = {
    transaction_type: "AuthoringTransaction", schema_version: 1, transaction_id: "text.edit.001", asset_id: ownership.asset_id,
    expected_mode: "text_owned", expected_owner_revision: ownership.owner_revision, expected_source_fingerprint: ownership.source.fingerprint,
    operation: "edit", target_mode: "text_owned",
    target_source: { source_type: "coda_source", source_ref: ownership.source.source_ref, candidate_fingerprint: assetFingerprint(candidateText), node_identity_digest: identityDigest },
    operations: [{ operation: "replace_field", node_id: "stable.value", field_path: "/params/value", expected_node_fingerprint: authoringSourceNodeFingerprint(parsed.asset.root[0]), value: 7 }],
  };
  const committed = applyTextAuthoringTransaction(ownership, source, transaction);
  assert.equal(committed.receipt.status, "committed");
  assert.equal(committed.ownership.owner_revision, 3);
  assert.deepEqual(committed.ownership.derived_projections, []);
  assert.deepEqual(committed.receipt.invalidated_projection_fingerprints, ["sha256:" + "b".repeat(64)]);
  assert.match(committed.source, /value = 7 # @node_id=stable\.value/u);
  assert.equal(applyTextAuthoringTransaction(committed.ownership, source, transaction).receipt.status, "conflict");
  const unanchoredSource = "event test.textowned:\n  let value = 1\n";
  const unanchored = applyTextAuthoringTransaction(
    { ...ownership, source: { ...ownership.source, fingerprint: assetFingerprint(unanchoredSource) } },
    unanchoredSource,
    { ...transaction, expected_source_fingerprint: assetFingerprint(unanchoredSource) },
  );
  assert.equal(unanchored.receipt.diagnostics[0].code, "TEXT_AUTHORING_SOURCE_NOT_CANONICAL");
});

test("C1-L.1 TaskGraph 与 source reference 固定类型和作者源定位", () => {
  const graphSchema = c1lSchemas.find((item) => item.$id.endsWith("/task-graph@1"));
  const sourceSchema = c1lSchemas.find((item) => item.$id.endsWith("/source-ref@1"));
  assert.deepEqual(graphSchema.properties.nodes.items.properties.kind.enum, ["task", "guard", "observation", "mode_transition", "tracking", "control", "intent", "reactive"]);
  assert.equal(graphSchema.properties.nodes.items.properties.contract_ref.pattern, "^[a-z][a-z0-9_.-]*@\\d+$");
  assert.equal(graphSchema.properties.edges.items.properties.contract_ref.pattern, "^[a-z][a-z0-9_.-]*@\\d+$");
  assert.deepEqual(graphSchema.properties.edges.items.allOf[0].then.required, ["contract_ref"]);
  assert.deepEqual(graphSchema.properties.nodes.items.allOf[0].then.required, ["branch_entries"]);
  assert.equal(graphSchema.properties.nodes.items.allOf[0].else.properties.branch_entries, false);
  assert.deepEqual(graphSchema.properties.nodes.items.properties.branch_context.items.required, ["guard_node_id", "outcome"]);
  assert.deepEqual(sourceSchema.required, ["event_id", "node_id", "path"]);
  assert.equal(taskGraphFixture.graph_type, "TaskGraph");
  assert.equal(taskGraphFixture.nodes[1].depends_on[0], taskGraphFixture.nodes[0].node_id);
  assert.equal(taskGraphFixture.edges[0].relation, "requires");
});

test("C1-L 独立 contract schema 与 TransitionPlan fixture 保持后端中立", () => {
  assert.equal(motionIntentSchema.$id, "coda://contracts/gseos/motion-intent@1");
  assert.deepEqual(motionIntentSchema.properties.args.required, ["target", "resources", "priority", "safety_profile", "on_no_solution"]);
  assert.equal(transitionPlanFixture.plan_type, "TransitionPlan");
  assert.equal(transitionPlanFixture.resource_lease.mode, "all_or_reject");
  assert.deepEqual(transitionPlanFixture.backend_contracts, { game: "godot.motion@1", robot: "robot.motion@1" });
  assert.equal(transitionPlanFixture.execution_authority, "adapter_only");
});

test("C1-T.0 设计契约冻结资源、快照、计划和 Adapter receipt 的硬边界", () => {
  assert.equal(resourceRegistrySchema.$id, "coda://contracts/c1t/resource-registry@1");
  assert.equal(resourceRegistrySchema.properties.lease_policy.properties.shared_write.const, false);
  assert.equal(resourceRegistrySchema.properties.coupling_groups.items.properties.resource_refs.minItems, 2);
  assert.equal(snapshotBundleSchema.properties.quality.properties.same_tick.const, true);
  assert.deepEqual(transitionPlanSchema.properties.lease.properties.mode, { const: "all_or_reject" });
  assert.deepEqual(adapterReceiptSchema.properties.receipt_type.enum, ["barrier_receipt", "start_receipt", "terminal_receipt"]);
  assert.equal(validSnapshot.quality.finite, true);
  assert.equal(validSnapshot.quality.same_tick, true);
  assert.equal(externalWriterReject.ownership, "external_owned");
  assert.equal(externalWriterReject.status, "rejected");
  assert.equal(externalWriterReject.partial_write, false);
});

test("C1-T.0.3/.0.4 分离受信任 hook、确定回放与运行时观察", () => {
  assert.equal(hookManifestSchema.properties.fallback_policy.properties.max_depth.const, 1);
  assert.match(hookManifestSchema.properties.hooks.items.properties.artifact_sha256.pattern, /\{64\}/u);
  assert.equal(hookManifestSchema.properties.trust_boundary.properties.allow_third_party.const, false);
  assert.equal(replayEnvelopeSchema.properties.logical_tick.type, "integer");
  assert.equal(runtimeObservationSchema.properties.wall.type, "object");
  assert.equal(hookManifestFixture.fallback_policy.max_depth, 1);
  assert.equal(hookManifestFixture.trust_boundary.allow_learning_models, false);
  assert.deepEqual(hookManifestFixture.hooks.map((hook) => hook.order), [10, 40]);
  assert.equal(replayEnvelopeFixture.decision_record.decision_id, "decision.c1t.wave.1");
  assert.equal(runtimeObservationFixture.decision_id, replayEnvelopeFixture.decision_record.decision_id);
  assert.equal(runtimeObservationFixture.receipts.at(-1).status, "completed");
});

test("C1-T.0.5 Skeleton fixture draft 显式保留五项 owner decision", () => {
  assert.equal(skeletonFixtureSchema.$id, "coda://contracts/c1t/skeleton-fixture@1");
  assert.equal(skeletonFixtureDraft.fixture_type, "SkeletonTransitionFixture");
  assert.equal(skeletonFixtureDraft.mapping.controlled_channels[0].bone, "head");
  assert.equal(skeletonFixtureDraft.ownership_policy.external_writer, "reject");
  assert.equal(skeletonFixtureDraft.status, "DRAFT_NOT_AUTHORIZED_FOR_RUNTIME");
  assert.equal(skeletonFixtureDraft.owner_decision_required.length, 5);
  assert.equal(skeletonFixtureDraft.profile.first_response_ms, 120);
});

test("C1-T.0.6 设计审查将证据、未闭合项和 owner blockers 显式索引", () => {
  assert.equal(c1tDesignReview.status, "HOLD_G-C1-T-A_OWNER_DECISION");
  assert.equal(c1tDesignReview.requirement_review.length, 10);
  assert.equal(c1tDesignReview.blocking_decisions.length, 5);
  assert.equal(c1tDesignReview.non_claims.includes("does not authorize C1-T runtime"), true);
  assert.equal(c1tDesignReview.evidence_index.hook_manifest, "contracts/c1t/hook-manifest.schema.json");
});

test("C1-L.1 linear MotionIntent lowers to a source-preserving TaskGraph and rejects partial graphs", () => {
  const result = lowerToTaskGraph(motionIntentAsset, registry);
  assert.equal(result.receipt.ok, true);
  assert.equal(validateTaskGraph(result.task_graph).ok, true);
  assert.equal(result.task_graph.graph_type, "TaskGraph");
  assert.equal(result.task_graph.source_fingerprint, assetFingerprint(motionIntentAsset));
  assert.equal(result.task_graph.nodes.length, 1);
  assert.equal(result.task_graph.nodes[0].contract_ref, "robot.acknowledge_user@1");
  assert.equal(result.task_graph.nodes[0].source_ref.path, "/root/0");

  const mixedAsset = structuredClone(motionIntentAsset);
  mixedAsset.root.push({ node_id: "return-node", command_id: "return", params: { value: null } });
  const rejected = lowerToTaskGraph(mixedAsset, registry);
  assert.equal(rejected.task_graph, null);
  assert.equal(rejected.receipt.diagnostics[0].code, "TASK_GRAPH_UNSUPPORTED_INSTRUCTION");

  const duplicate = structuredClone(result.task_graph);
  duplicate.nodes.push(structuredClone(duplicate.nodes[0]));
  assert.ok(validateTaskGraph(duplicate).diagnostics.some((item) => item.code === "DUPLICATE_TASK_GRAPH_NODE"));
  const badSource = structuredClone(result.task_graph);
  badSource.nodes[0].source_ref.event_id = "other.event";
  assert.ok(validateTaskGraph(badSource).diagnostics.some((item) => item.code === "TASK_GRAPH_SOURCE_REF_MISMATCH"));
  const cycle = structuredClone(result.task_graph);
  cycle.nodes.push({ ...structuredClone(cycle.nodes[0]), node_id: "second-intent", source_ref: { ...cycle.nodes[0].source_ref, node_id: "second-intent" }, depends_on: [cycle.nodes[0].node_id] });
  cycle.nodes[0].depends_on = ["second-intent"];
  cycle.edges = [
    { from: cycle.nodes[0].node_id, to: "second-intent", relation: "requires" },
    { from: "second-intent", to: cycle.nodes[0].node_id, relation: "requires" },
  ];
  assert.ok(validateTaskGraph(cycle).diagnostics.some((item) => item.code === "TASK_GRAPH_CYCLE"));
});

test("C1-L.1 hands_off edge is limited to typed controller nodes and a versioned contract", () => {
  const graph = lowerToTaskGraph(motionIntentAsset, registry).task_graph;
  graph.nodes.push({
    ...structuredClone(graph.nodes[0]),
    node_id: "handoff-controller",
    source_ref: { ...graph.nodes[0].source_ref, node_id: "handoff-controller" },
    kind: "mode_transition",
  });
  graph.nodes[0].kind = "control";
  graph.edges.push({
    from: graph.nodes[0].node_id,
    to: "handoff-controller",
    relation: "hands_off",
    contract_ref: "controller.handoff@1",
  });
  assert.equal(validateTaskGraph(graph).ok, true);

  const missingContract = structuredClone(graph);
  delete missingContract.edges.at(-1).contract_ref;
  assert.ok(validateTaskGraph(missingContract).diagnostics.some((item) => item.code === "INVALID_TASK_GRAPH_HANDOFF_EDGE"));

  const untypedEndpoint = structuredClone(graph);
  untypedEndpoint.nodes[0].kind = "intent";
  assert.ok(validateTaskGraph(untypedEndpoint).diagnostics.some((item) => item.code === "INVALID_TASK_GRAPH_HANDOFF_EDGE"));

  const misplacedContract = structuredClone(graph);
  misplacedContract.edges.push({ from: graph.nodes[0].node_id, to: "handoff-controller", relation: "observes", contract_ref: "controller.handoff@1" });
  assert.ok(validateTaskGraph(misplacedContract).diagnostics.some((item) => item.code === "INVALID_TASK_GRAPH_EDGE_CONTRACT"));
});

test("C1-L.1 lowers a two-arm MotionIntent branch only through a source-bound observation Guard", () => {
  const asset = structuredClone(motionIntentAsset);
  const intent = asset.root[0].params;
  asset.args = [{ id: "contact_confirmed", type: "Boolean" }];
  asset.root = [{
    node_id: "contact-branch",
    command_id: "if",
    params: { condition: { ref: "contact_confirmed" } },
    children: {
      then: [{ node_id: "wave-on-contact", command_id: "motion_intent", params: structuredClone(intent) }],
      else: [{ node_id: "yield-without-contact", command_id: "motion_intent", params: structuredClone(intent) }],
    },
  }];
  const knownRef = "contact.state@1#/confirmed";
  const guard = {
    guard_type: "GuardExpression",
    guard_version: 1,
    guard_id: "contact.confirmed@1",
    condition_ref: "contact_confirmed",
    unknown_policy: "reject_or_yield_safety",
    source_ref: { event_id: asset.event_id, node_id: "contact-branch", path: "/root/0" },
    expression: { node_type: "observation_ref", contract_ref: "contact.state@1", path: "/confirmed" },
  };
  const lowered = lowerToTaskGraph(asset, registry, {
    guard_bindings: { "contact-branch": guard },
    known_observation_refs: [knownRef],
  });
  assert.equal(lowered.receipt.ok, true);
  assert.equal(validateTaskGraph(lowered.task_graph).ok, true);
  assert.equal(lowered.task_graph.nodes[0].kind, "guard");
  assert.deepEqual(lowered.task_graph.edges.filter((edge) => edge.relation === "guards").map((edge) => edge.outcome).sort(), ["false", "true"]);
  const swappedOutcomes = structuredClone(lowered.task_graph);
  for (const edge of swappedOutcomes.edges.filter((candidate) => candidate.relation === "guards")) {
    edge.to = swappedOutcomes.nodes[0].branch_entries[edge.outcome === "true" ? "false" : "true"];
  }
  assert.ok(validateTaskGraph(swappedOutcomes).diagnostics.some((item) => item.code === "TASK_GRAPH_GUARD_ENTRY_MISMATCH"));
  const unbound = lowerToTaskGraph(asset, registry, { guard_bindings: { "contact-branch": guard } });
  assert.equal(unbound.task_graph, null);
  assert.equal(unbound.receipt.diagnostics[0].code, "TASK_GRAPH_GUARD_UNBOUND");
});

test("C1-L.1 lowers nested Guard branches through an explicit any-predecessor join", () => {
  const asset = structuredClone(motionIntentAsset);
  const intent = structuredClone(asset.root[0].params);
  asset.args = [{ id: "contact_confirmed", type: "Boolean" }, { id: "hand_clear", type: "Boolean" }];
  asset.root = [{
    node_id: "outer-branch",
    command_id: "if",
    params: { condition: { ref: "contact_confirmed" } },
    children: {
      then: [
        { node_id: "approach", command_id: "motion_intent", params: structuredClone(intent) },
        {
          node_id: "inner-branch",
          command_id: "if",
          params: { condition: { ref: "hand_clear" } },
          children: {
            then: [{ node_id: "wave-clear", command_id: "motion_intent", params: structuredClone(intent) }],
            else: [{ node_id: "yield-blocked", command_id: "motion_intent", params: structuredClone(intent) }],
          },
        },
      ],
      else: [{ node_id: "yield-no-contact", command_id: "motion_intent", params: structuredClone(intent) }],
    },
  }];
  const planned = lowerToExecutionPlan(asset, registry);
  assert.equal(planned.receipt.ok, true);
  const [outer] = planned.plan.instructions;
  const inner = outer.then.at(-1);
  const knownObservation = "contact.state@1#/confirmed";
  const guardFor = (instruction, conditionRef) => ({
    guard_type: "GuardExpression", guard_version: 1, guard_id: `${conditionRef}.guard@1`, condition_ref: conditionRef,
    unknown_policy: "reject_or_yield_safety", source_ref: instruction.source_ref,
    expression: { node_type: "observation_ref", contract_ref: "contact.state@1", path: "/confirmed" },
  });
  const lowered = lowerToTaskGraph(asset, registry, {
    guard_bindings: { "outer-branch": guardFor(outer, "contact_confirmed"), "inner-branch": guardFor(inner, "hand_clear") },
    known_observation_refs: [knownObservation],
  });
  assert.equal(lowered.receipt.ok, true);
  assert.equal(validateTaskGraph(lowered.task_graph).ok, true);
  assert.deepEqual(lowered.task_graph.nodes.find((node) => node.node_id === "outer-branch").branch_entries, { true: "approach", false: "yield-no-contact" });
  assert.ok(lowered.task_graph.edges.some((edge) => edge.from === "approach" && edge.to === "inner-branch" && edge.relation === "requires"));

  asset.root.push({ node_id: "after-join", command_id: "motion_intent", params: structuredClone(intent) });
  const joined = lowerToTaskGraph(asset, registry, {
    guard_bindings: { "outer-branch": guardFor(outer, "contact_confirmed"), "inner-branch": guardFor(inner, "hand_clear") },
    known_observation_refs: [knownObservation],
  });
  assert.equal(joined.receipt.ok, true);
  const continuation = joined.task_graph.nodes.find((node) => node.node_id === "after-join");
  assert.equal(continuation.activation_policy, "any_predecessor");
  assert.deepEqual(joined.task_graph.edges.filter((edge) => edge.to === "after-join" && edge.relation === "completes").map((edge) => edge.from).sort(), ["wave-clear", "yield-blocked", "yield-no-contact"]);
  const missingJoinPolicy = structuredClone(joined.task_graph);
  delete missingJoinPolicy.nodes.find((node) => node.node_id === "after-join").activation_policy;
  assert.ok(validateTaskGraph(missingJoinPolicy).diagnostics.some((item) => item.code === "TASK_GRAPH_COMPLETION_POLICY_MISSING"));
  const unprovenJoin = structuredClone(joined.task_graph);
  delete unprovenJoin.nodes.find((node) => node.node_id === "yield-blocked").branch_context;
  assert.ok(validateTaskGraph(unprovenJoin).diagnostics.some((item) => item.code === "TASK_GRAPH_JOIN_PATHS_NOT_EXCLUSIVE"));
});

test("C1-L.1 typed GuardExpression binds observations and fails closed on unknown/free-form input", () => {
  const guard = c1tSharedContractPack.guard_expression;
  const schema = c1tIndexedSchemas.find((item) => item.$id.endsWith("/guard-expression@1"));
  assert.equal(schema.properties.unknown_policy.const, "reject_or_yield_safety");
  const known = ["hand.pose@1#/quality/calibrated"];
  assert.equal(validateGuardExpression(guard, { known_observation_refs: known }).ok, true);
  const unresolved = validateGuardExpression(guard, { known_observation_refs: [] });
  assert.ok(unresolved.diagnostics.some((item) => item.code === "GUARD_OBSERVATION_NOT_BOUND"));
  const freeform = validateGuardExpression({ ...guard, expression: "calibrated && safe" }, { known_observation_refs: known });
  assert.ok(freeform.diagnostics.some((item) => item.code === "INVALID_GUARD_NODE"));
  const deep = structuredClone(guard);
  deep.expression = { node_type: "operation", operator: "not", operands: Array.from({ length: 3 }, () => ({ node_type: "operation", operator: "not", operands: [{ node_type: "literal", value: true }] })) };
  assert.ok(validateGuardExpression(deep, { known_observation_refs: known, max_depth: 1 }).diagnostics.some((item) => item.code === "GUARD_DEPTH_EXCEEDED"));
});

test("C1-L.1 reactive graph requires a passing admission on every Adapter path", () => {
  const graph = c1tSharedContractPack.reactive_execution_graph;
  assert.equal(validateReactiveExecutionGraph(graph).ok, true);
  const bypass = structuredClone(graph);
  bypass.nodes.push({ node_id: "unsafe_adapter", kind: "adapter_command", contract_ref: "adapter.command@1", source_ref: "skill:taiji.cloud_hands@1" });
  bypass.edges.push({ from: "observe_current", to: "unsafe_adapter", outcome: "pass" });
  bypass.edges.push({ from: "unsafe_adapter", to: "adapter_terminal", outcome: "pass" });
  assert.ok(validateReactiveExecutionGraph(bypass).diagnostics.some((item) => item.code === "ADAPTER_COMMAND_BEFORE_ADMISSION"));
});

test("C1-L.1 shared observation, hybrid, tracking and control contracts fail closed", () => {
  const contracts = c1tSharedContractPack;
  assert.equal(validateObservationContract(contracts.observation_contract, { known_guard_refs: ["scan.safety_guard@1"] }).ok, true);
  assert.equal(validateHybridModeGraph(contracts.hybrid_mode_graph, { known_guard_refs: ["contact.confirmed@1"] }).ok, true);
  assert.equal(validateTrackingEnvelope(contracts.tracking_envelope).ok, true);
  assert.equal(validateControlContract(contracts.control_contract).ok, true);
  assert.equal(validateContinuationContract(contracts.continuation_contract).ok, true);
  assert.equal(validateTemporalCommandContract(contracts.temporal_command_contract).ok, true);
  assert.equal(validateAuthorityClaimMatrix(contracts.authority_claim_matrix).ok, true);

  const unsafeTracking = { ...contracts.tracking_envelope, supervisor_role: "may_close_controller_loop" };
  assert.ok(validateTrackingEnvelope(unsafeTracking).diagnostics.some((item) => item.code === "TRACKING_SUPERVISOR_AUTHORITY_ESCALATION"));
  const missingMode = { ...contracts.hybrid_mode_graph, initial_mode: "unbound" };
  assert.ok(validateHybridModeGraph(missingMode, { known_guard_refs: ["contact.confirmed@1"] }).diagnostics.some((item) => item.code === "HYBRID_INITIAL_MODE_MISSING"));
  const competingWriter = { ...contracts.control_contract, authority: "supervisor_direct_writer" };
  assert.ok(validateControlContract(competingWriter).diagnostics.some((item) => item.code === "CONTROL_AUTHORITY_NOT_SINGLE_WRITER"));
  const oldGeneration = { ...contracts.continuation_contract, restore_old_generation: true };
  assert.ok(validateContinuationContract(oldGeneration).diagnostics.some((item) => item.code === "CONTINUATION_REACTIVATES_OLD_GENERATION"));
  const implicitLease = { ...contracts.temporal_command_contract, lease_extension_policy: "extend_on_heartbeat" };
  assert.ok(validateTemporalCommandContract(implicitLease).diagnostics.some((item) => item.code === "TEMPORAL_IMPLICIT_LEASE_EXTENSION"));
  const overclaim = { ...contracts.authority_claim_matrix, local_acceptance_implies_joint_feasible: true };
  assert.ok(validateAuthorityClaimMatrix(overclaim).diagnostics.some((item) => item.code === "LOCAL_ACCEPTANCE_OVERCLAIMS_COMPOSITION"));
  const optimisticUnknown = { ...contracts.observation_contract, on_unresolved: "assume_safe" };
  assert.ok(validateObservationContract(optimisticUnknown).diagnostics.some((item) => item.code === "OBSERVATION_UNKNOWN_NOT_FAIL_CLOSED"));
});

test("R-C1T-14/15 continuation viability selects finite modes and rejects unsafe or stale re-entry", () => {
  const { contract, context } = continuationViabilityFixture;
  assert.equal(evaluateContinuationViability(contract, context).resume_mode, "exact_phase");
  assert.equal(evaluateContinuationViability({}, context).diagnostics[0].code, "INVALID_CONTINUATION_CONTRACT");
  const compatible = structuredClone(context);
  compatible.candidates[0].admitted = false;
  assert.equal(evaluateContinuationViability(contract, compatible).resume_mode, "compatible_phase");
  const checkpoint = structuredClone(context);
  checkpoint.candidates[0].admitted = false;
  checkpoint.candidates[1].admitted = false;
  assert.equal(evaluateContinuationViability(contract, checkpoint).resume_mode, "checkpoint");
  const replan = structuredClone(context);
  replan.candidates.slice(0, 3).forEach((candidate) => { candidate.admitted = false; });
  assert.equal(evaluateContinuationViability(contract, replan).resume_mode, "replan_remaining");

  const outsideCapture = structuredClone(context);
  outsideCapture.gates.capture_region = false;
  assert.equal(evaluateContinuationViability(contract, outsideCapture).diagnostics[0].code, "CONTINUATION_VIABILITY_GATE_FAILED");
  const oldWriter = structuredClone(context);
  oldWriter.current.lease_id = oldWriter.token.lease_id;
  assert.equal(evaluateContinuationViability(contract, oldWriter).diagnostics[0].code, "CONTINUATION_OLD_LEASE_REUSED");
  const staleController = structuredClone(context);
  staleController.current.controller_revision = "controller@3";
  assert.equal(evaluateContinuationViability(contract, staleController).diagnostics[0].code, "CONTINUATION_CONTROLLER_REVISION_CHANGED");
  const noneViable = structuredClone(context);
  noneViable.candidates.forEach((candidate) => { candidate.admitted = false; });
  assert.equal(evaluateContinuationViability(contract, noneViable).diagnostics[0].code, "CONTINUATION_NO_VIABLE_CANDIDATE");
  assert.equal(evaluateContinuationViability(contract, context).claims_dynamics_certificate, false);
});

test("R-C1T-16 temporal admission rejects stale authority and applies buffer hysteresis without renewing", () => {
  const contract = c1tSharedContractPack.temporal_command_contract;
  const context = {
    now: { clock_domain: "arm.controller.clock@1", tick: 100 },
    lease: { id: "lease.7", generation: 7, active: true, expires_at_tick: 120, clock_domain: "arm.controller.clock@1" },
    observation: { tick: 98, clock_domain: "arm.controller.clock@1" },
    command: { lease_id: "lease.7", generation: 7, valid_from_tick: 90, valid_until_tick: 110, clock_domain: "arm.controller.clock@1" },
    liveness: { last_heartbeat_tick: 99, clock_domain: "arm.controller.clock@1" },
    buffer: { remaining_ticks: 20 },
    profile: { max_observation_age_ticks: 4, heartbeat_timeout_ticks: 3, low_watermark_ticks: 5, recovery_watermark_ticks: 9 },
  };
  assert.equal(evaluateTemporalCommandAdmission(contract, context).decision, "active");
  const low = structuredClone(context);
  low.buffer.remaining_ticks = 5;
  assert.equal(evaluateTemporalCommandAdmission(contract, low).decision, "hold");
  const hysteresis = structuredClone(context);
  hysteresis.previous_state = "hold";
  hysteresis.buffer.remaining_ticks = 8;
  assert.equal(evaluateTemporalCommandAdmission(contract, hysteresis).diagnostics[0].code, "TEMPORAL_HYSTERESIS_HOLD");
  hysteresis.buffer.remaining_ticks = 9;
  assert.equal(evaluateTemporalCommandAdmission(contract, hysteresis).decision, "active");
  const skew = structuredClone(context);
  skew.observation.clock_domain = "arm.adapter.clock@1";
  assert.equal(evaluateTemporalCommandAdmission(contract, skew).diagnostics[0].code, "TEMPORAL_CLOCK_DOMAIN_MISMATCH");
  const stale = structuredClone(context);
  stale.observation.tick = 90;
  assert.equal(evaluateTemporalCommandAdmission(contract, stale).diagnostics[0].code, "TEMPORAL_OBSERVATION_STALE");
  const leaseExpired = structuredClone(context);
  leaseExpired.lease.expires_at_tick = 99;
  assert.equal(evaluateTemporalCommandAdmission(contract, leaseExpired).diagnostics[0].code, "TEMPORAL_AUTHORITY_LEASE_INVALID");
  const heartbeat = structuredClone(context);
  heartbeat.liveness.last_heartbeat_tick = 90;
  assert.equal(evaluateTemporalCommandAdmission(contract, heartbeat).diagnostics[0].code, "TEMPORAL_LIVENESS_EXPIRED");
  const staleCommand = structuredClone(context);
  staleCommand.command.valid_until_tick = 99;
  assert.equal(evaluateTemporalCommandAdmission(contract, staleCommand).diagnostics[0].code, "TEMPORAL_COMMAND_INVALID");
  const emptyBuffer = structuredClone(context);
  emptyBuffer.buffer.remaining_ticks = 0;
  assert.equal(evaluateTemporalCommandAdmission(contract, emptyBuffer).diagnostics[0].code, "TEMPORAL_BUFFER_EMPTY");
  const backupPolicy = { ...contract, on_invalid: "enter_admitted_backup" };
  assert.equal(evaluateTemporalCommandAdmission(backupPolicy, { ...staleCommand, backup_admitted: true }).decision, "backup_candidate");
  assert.equal(evaluateTemporalCommandAdmission(backupPolicy, staleCommand).decision, "reject");
  const yieldPolicy = { ...contract, on_invalid: "yield_safety_authority" };
  assert.equal(evaluateTemporalCommandAdmission(yieldPolicy, staleCommand).decision, "yield_safety_authority");
  const noImplicitExtension = evaluateTemporalCommandAdmission(contract, context);
  assert.equal(noImplicitExtension.renew_lease, false);
  assert.equal(noImplicitExtension.emit_command, false);
});

test("C1-T.0.7/.0.8 锁定四项边界合同、分离设备安全配置并冻结三组证伪规范", () => {
  assert.equal(c1tContractIndex.canonical_encoding, "json-schema-2020-12");
  assert.equal(c1tContractIndex.wire_bindings, "generated_only");
  assert.equal(c1tContractIndex.semantic_digest_source, "canonical_semantic_object");
  assert.equal(c1tContractIndex.stable_rejection_codes.includes("JOINT_TASK_SET_INFEASIBLE"), true);
  assert.equal(taskActivationContractSchema.properties.transition.properties.commit_barrier.const, "atomic");
  assert.equal(taskActivationContractSchema.properties.on_failure.enum.includes("reject_new_keep_current_if_still_valid"), true);
  assert.equal(modelValidityEnvelopeSchema.properties.update_policy.properties.single_sample_parameter_update.const, "forbidden");
  assert.equal(stateAlignmentContractSchema.properties.start_tube.properties.semantics.enum.includes("probabilistic_belief"), true);
  assert.equal(stateAlignmentContractSchema.properties.start_tube.properties.complexity_bound.enum.includes("O(N2)"), true);
  assert.equal(handoffContractSchema.properties.reconstruction.properties.method.enum.includes("versioned_translate"), true);
  assert.equal(handoffContractSchema.properties.authority_barrier.const, "atomic_single_writer");
  assert.equal(deviceCapabilityProfileSchema.properties.safety_profile_ref.pattern, "@1$");
  assert.equal(safetyProfileSchema.properties.standard_domains.items.enum.includes("PX4_DEVICE_SPECIFIC"), true);
  assert.equal(falsificationBenchmarkSpecSchema.properties.status.enum.includes("structure_frozen_thresholds_pending"), true);
  assert.equal(c1tContractHardeningPack.status, "STRUCTURE_FROZEN_DEVICE_VALUES_PENDING");
  assert.equal(c1tContractHardeningPack.positive.model_validity.update_policy.single_sample_parameter_update, "forbidden");
  assert.equal(c1tContractHardeningPack.negative.some((item) => item.expected_rejection_code === "INTERNAL_STATE_INCOMPATIBLE"), true);
  assert.deepEqual(
    [contactHandoffBenchmark.kind, modelValidityBenchmark.kind, jointCompositionBenchmark.kind],
    ["contact_handoff", "model_validity_detection", "joint_dynamics_composition"]
  );
  assert.equal(contactHandoffBenchmark.non_claims.includes("does not treat Godot physics as physical ground truth"), true);
  assert.equal(jointCompositionBenchmark.counterexamples.every((item) => item.expected_rejection_code === "JOINT_TASK_SET_INFEASIBLE"), true);
});

test("C1-T.0.7 shared contracts type observations, control, continuation, timing, claims and derived graph", () => {
  assert.deepEqual(c1tIndexedSchemas.map((item) => item.$id), c1tContractIndex.schemas.map((item) => `coda://contracts/c1t/${item}`));
  const schema = (name) => c1tIndexedSchemas.find((item) => item.$id.endsWith(`/${name}@1`));
  assert.equal(schema("observation-contract").properties.on_unresolved.enum.includes("reject"), true);
  assert.equal(schema("hybrid-mode-graph").properties.unknown_input_policy.const, "reject_or_yield_safety");
  assert.equal(schema("tracking-envelope").properties.supervisor_role.const, "monitor_and_pre_authorized_escalation_only");
  assert.equal(schema("control-contract").properties.authority.enum.includes("controller_single_writer"), true);
  assert.equal(schema("continuation-contract").properties.restore_old_generation.const, false);
  assert.equal(schema("temporal-command-contract").properties.lease_extension_policy.const, "no_implicit_extension");
  assert.equal(schema("authority-claim-matrix").properties.local_acceptance_implies_joint_feasible.const, false);
  assert.equal(schema("reactive-execution-graph").properties.generated_only.const, true);
  assert.equal(c1tSharedContractPack.observation_contract.on_unresolved, "reject");
  assert.equal(c1tSharedContractPack.hybrid_mode_graph.transitions[0].commit_policy, "presolve_then_barrier");
  assert.equal(c1tSharedContractPack.tracking_envelope.supervisor_role, "monitor_and_pre_authorized_escalation_only");
  assert.equal(c1tSharedContractPack.control_contract.authority, "controller_single_writer");
  assert.equal(c1tSharedContractPack.continuation_contract.restore_old_generation, false);
  assert.equal(c1tSharedContractPack.temporal_command_contract.lease_extension_policy, "no_implicit_extension");
  assert.equal(c1tSharedContractPack.authority_claim_matrix.local_acceptance_implies_joint_feasible, false);
  assert.equal(c1tSharedContractPack.reactive_execution_graph.generated_only, true);
});

test("C1-T.1.1 参考仲裁器全取或全拒并阻断旧 generation 写入", () => {
  const registryFixture = {
    registry_type: "ResourceRegistry",
    schema_version: 1,
    resources: [
      { id: "body", version: 1, kind: "group", leaves: ["head@1", "arm@1"] },
      { id: "head", version: 1, kind: "leaf", leaves: [] },
      { id: "arm", version: 1, kind: "leaf", leaves: [] }
    ],
    lease_policy: { mode: "exclusive", ordering: "lexicographic", shared_write: false, implicit_queue: false }
  };
  assert.equal(validateResourceRegistry(registryFixture).ok, true);
  const arbiter = new TransitionLeaseArbiter(registryFixture);
  const first = arbiter.request({ lease_id: "lease.a", owner_id: "run.a", resources: ["body@1"], priority: 40, sequence: 1 });
  assert.equal(first.ok, true);
  const rejected = arbiter.request({ lease_id: "lease.b", owner_id: "run.b", resources: ["head@1"], priority: 40, sequence: 2 });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.diagnostics[0].code, "LEASE_REJECTED");
  const preempted = arbiter.request({ lease_id: "lease.b", owner_id: "run.b", resources: ["head@1"], priority: 80, sequence: 3 });
  assert.equal(preempted.ok, true);
  assert.deepEqual(preempted.value.preempted, ["lease.a"]);
  assert.equal(arbiter.checkWrite({ lease_id: "lease.a", generation: first.value.lease.generation, resources: ["head@1"] }).ok, false);
  assert.equal(arbiter.checkWrite({ lease_id: "lease.b", generation: preempted.value.lease.generation, resources: ["head@1"] }).ok, true);
});

test("R-C1T-03 multi-resource lease commits atomically at a revalidated write barrier", () => {
  const registry = {
    registry_type: "ResourceRegistry", schema_version: 1,
    resources: ["head", "arm", "torso"].map((id) => ({ id, version: 1, kind: "leaf", leaves: [] })),
    lease_policy: { mode: "exclusive", ordering: "lexicographic", shared_write: false, implicit_queue: false }
  };
  const arbiter = new TransitionLeaseArbiter(registry);
  const head = arbiter.request({ lease_id: "lease.head", owner_id: "run.head", resources: ["head@1"], priority: 70 });
  const arm = arbiter.request({ lease_id: "lease.arm", owner_id: "run.arm", resources: ["arm@1"], priority: 20 });
  const before = arbiter.snapshot();
  const partial = arbiter.prepareRequest({ lease_id: "lease.partial", owner_id: "run.partial", resources: ["head@1", "arm@1"], priority: 50 });
  assert.equal(partial.value.ownership_changed, false);
  assert.deepEqual(arbiter.snapshot(), before);
  assert.equal(arbiter.commitBarrier("lease.partial").diagnostics[0].code, "LEASE_REJECTED");
  assert.deepEqual(arbiter.snapshot(), before);

  const prepared = arbiter.prepareRequest({ lease_id: "lease.atomic", owner_id: "run.atomic", resources: ["head@1", "arm@1"], priority: 80 });
  assert.equal(prepared.ok, true);
  assert.equal(arbiter.checkWrite({ lease_id: "lease.atomic", generation: 1, resources: ["head@1"] }).ok, false);
  const committed = arbiter.commitBarrier("lease.atomic");
  assert.equal(committed.ok, true);
  assert.deepEqual(committed.value.preempted, ["lease.arm", "lease.head"]);
  assert.equal(arbiter.checkWrite({ lease_id: "lease.head", generation: head.value.lease.generation, resources: ["head@1"] }).ok, false);
  assert.equal(arbiter.checkWrite({ lease_id: "lease.arm", generation: arm.value.lease.generation, resources: ["arm@1"] }).ok, false);
  assert.equal(arbiter.checkWrite({ lease_id: "lease.atomic", generation: committed.value.lease.generation, resources: ["head@1", "arm@1"] }).ok, true);

  const raced = arbiter.prepareRequest({ lease_id: "lease.raced", owner_id: "run.raced", resources: ["head@1"], priority: 85 });
  assert.equal(raced.ok, true);
  const newerOwner = arbiter.request({ lease_id: "lease.winner", owner_id: "run.winner", resources: ["head@1"], priority: 90 });
  assert.equal(newerOwner.ok, true);
  assert.equal(arbiter.commitBarrier("lease.raced").diagnostics[0].code, "LEASE_REJECTED");
  const abandoned = arbiter.prepareRequest({ lease_id: "lease.abandoned", owner_id: "run.abandoned", resources: ["torso@1"], priority: 1 });
  assert.equal(abandoned.ok, true);
  assert.equal(arbiter.abortBarrier("lease.abandoned").value.ownership_changed, false);
  assert.equal(arbiter.commitBarrier("lease.abandoned").diagnostics[0].code, "BARRIER_NOT_PENDING");
});

test("R-C1T-02 resource registry validates versioned trees and closes transitive coupling groups", () => {
  const registry = resourceRegistryFixture;
  assert.equal(validateResourceRegistry(registry).ok, true);
  assert.deepEqual(expandResourceLeaves(registry, ["head@1"]).value, ["arm@1", "head@1", "torso@1"]);
  assert.equal(expandResourceLeaves(registry, ["head@2"]).diagnostics[0].code, "RESOURCE_VERSION_MISMATCH");
  assert.equal(expandResourceLeaves(registry, ["head"]).diagnostics[0].code, "INVALID_RESOURCE_REF");
  const duplicate = structuredClone(registry);
  duplicate.resources.push({ id: "head", version: 1, kind: "leaf", leaves: [] });
  assert.equal(validateResourceRegistry(duplicate).diagnostics[0].code, "DUPLICATE_RESOURCE_ID");
  const cycle = structuredClone(registry);
  cycle.resources[0].leaves = ["head@1"];
  cycle.resources.find((item) => item.id === "head").kind = "group";
  cycle.resources.find((item) => item.id === "head").leaves = ["body@1"];
  assert.ok(validateResourceRegistry(cycle).diagnostics.some((item) => item.code === "RESOURCE_CYCLE"));
  const unknown = structuredClone(registry);
  unknown.resources[0].leaves.push("missing@1");
  assert.ok(validateResourceRegistry(unknown).diagnostics.some((item) => item.code === "UNKNOWN_RESOURCE"));
  const malformedGroups = { ...registry, coupling_groups: "not-an-array" };
  assert.equal(validateResourceRegistry(malformedGroups).diagnostics[0].code, "INVALID_RESOURCE_COUPLING_GROUPS");
});

test("C1-T.1.1 参考 planner 拒绝坏快照和未租资源且计划指纹可重复", () => {
  const lease = { lease_id: "lease.wave", generation: 1, resources: ["head@1"], mode: "all_or_reject" };
  const base = { plan_id: "plan.wave.1", intent: "social.wave@1", lease, snapshot: validSnapshot, resources: ["head@1"], segments: [{ segment_id: "s1", duration_ticks: 4, start_tick: 0, start: { yaw: 0 }, end: { yaw: 0.5 } }], completion: { terminal_states: ["completed"], dwell_ticks: 2 } };
  const built = buildTransitionPlan(base);
  assert.equal(built.ok, true);
  assert.equal(built.value.execution_authority, "adapter_only");
  assert.equal(typeof built.value.snapshot_ref.digest, "string");
  assert.equal(transitionDecisionFingerprint(built.value), transitionDecisionFingerprint(buildTransitionPlan(structuredClone(base)).value));
  assert.equal(buildTransitionPlan({ ...base, snapshot_binding: { now_tick: 50, max_age_ticks: 1 } }).diagnostics[0].code, "SNAPSHOT_STALE");
  const badSnapshot = structuredClone(validSnapshot);
  badSnapshot.quality.finite = false;
  assert.equal(buildTransitionPlan({ ...base, snapshot: badSnapshot }).ok, false);
  assert.equal(buildTransitionPlan({ ...base, resources: ["arm@1"] }).ok, false);
});

test("R-C1T-05 plans enforce finite continuous segments and explicit profile time/amplitude bounds", () => {
  const base = {
    plan_id: "plan.continuous@1",
    intent: "social.wave@1",
    lease: { lease_id: "lease.wave", generation: 3, resources: ["head@1"], mode: "all_or_reject", owner_id: "run.wave", status: "active" },
    snapshot: validSnapshot,
    resources: ["head@1"],
    segments: [
      { segment_id: "s1", start_tick: 0, duration_ticks: 2, start: { yaw: 0 }, end: { yaw: 0.4 } },
      { segment_id: "s2", start_tick: 2, duration_ticks: 2, start: { yaw: 0.4 }, end: { yaw: 0.6 } },
    ],
    completion: { terminal_states: ["completed"], dwell_ticks: 1 },
    plan_constraints: { max_horizon_ticks: 4, max_delta_by_field: { yaw: 0.5 } },
  };
  const admitted = buildTransitionPlan(base);
  assert.equal(admitted.ok, true);
  assert.deepEqual(admitted.value.segments.map((segment) => segment.end_tick), [2, 4]);
  const discontinuous = structuredClone(base);
  discontinuous.segments[1].start.yaw = 0.3;
  assert.equal(buildTransitionPlan(discontinuous).diagnostics[0].code, "SEGMENT_STATE_DISCONTINUITY");
  const timeGap = structuredClone(base);
  timeGap.segments[1].start_tick = 3;
  assert.equal(buildTransitionPlan(timeGap).diagnostics[0].code, "SEGMENT_TIME_DISCONTINUITY");
  const horizon = structuredClone(base);
  horizon.plan_constraints.max_horizon_ticks = 3;
  assert.ok(buildTransitionPlan(horizon).diagnostics.some((item) => item.code === "PLAN_HORIZON_EXCEEDED"));
  const delta = structuredClone(base);
  delta.plan_constraints.max_delta_by_field.yaw = 0.3;
  assert.ok(buildTransitionPlan(delta).diagnostics.some((item) => item.code === "SEGMENT_DELTA_EXCEEDED"));
  const missingBound = structuredClone(base);
  missingBound.plan_constraints.max_delta_by_field = {};
  assert.ok(buildTransitionPlan(missingBound).diagnostics.some((item) => item.code === "PLAN_DELTA_BOUND_MISSING"));
  const nonFinite = structuredClone(base);
  nonFinite.segments[0].end.yaw = Number.NaN;
  assert.equal(buildTransitionPlan(nonFinite).diagnostics[0].code, "INVALID_SEGMENT_STATE");
  const startMismatch = structuredClone(base);
  startMismatch.plan_constraints.state_channel_by_field = { yaw: "head.yaw_deg" };
  startMismatch.snapshot.state["head.yaw_deg"] = 0.1;
  assert.equal(buildTransitionPlan(startMismatch).diagnostics[0].code, "PLAN_START_STATE_MISMATCH");
});

test("R-C1T-04 SnapshotBundle 按 profile 绑定新鲜度、通道、采样 tick 与摘要", () => {
  const binding = {
    now_tick: 43,
    max_age_ticks: 1,
    known_channels: ["head.pitch_deg", "head.yaw_deg", "head.roll_deg"],
    required_channels: ["head.pitch_deg", "head.yaw_deg"],
    expected_digest: assetFingerprint(validSnapshot),
  };
  assert.equal(validateTransitionSnapshot(validSnapshot, binding).ok, true);
  assert.equal(validateTransitionSnapshot(validSnapshot, { ...binding, now_tick: 44 }).diagnostics[0].code, "SNAPSHOT_STALE");
  assert.equal(validateTransitionSnapshot(validSnapshot, { ...binding, known_channels: ["head.pitch_deg"] }).diagnostics[0].code, "UNKNOWN_SNAPSHOT_CHANNEL");
  assert.equal(validateTransitionSnapshot(validSnapshot, { ...binding, required_channels: ["head.position"] }).diagnostics[0].code, "SNAPSHOT_REQUIRED_CHANNEL_MISSING");
  assert.equal(validateTransitionSnapshot(validSnapshot, { ...binding, expected_digest: "sha256:" + "0".repeat(64) }).diagnostics[0].code, "SNAPSHOT_DIGEST_MISMATCH");
  const skewed = structuredClone(validSnapshot);
  skewed.channel_ticks = { "head.pitch_deg": 42, "head.yaw_deg": 41, "head.roll_deg": 42 };
  assert.equal(validateTransitionSnapshot(skewed, { ...binding, require_channel_ticks: true }).diagnostics[0].code, "SNAPSHOT_CHANNEL_TICK_MISMATCH");
  const missingTicks = structuredClone(validSnapshot);
  assert.equal(validateTransitionSnapshot(missingTicks, { ...binding, require_channel_ticks: true }).diagnostics[0].code, "SNAPSHOT_CHANNEL_TICKS_REQUIRED");
  const badSkew = structuredClone(validSnapshot);
  badSkew.quality.skew_ms = 0.1;
  assert.equal(validateTransitionSnapshot(badSkew).diagnostics[0].code, "INVALID_SNAPSHOT_SKEW");
  const badDigest = { ...validSnapshot, semantic_digest: "sha256:" + "0".repeat(64) };
  assert.equal(validateTransitionSnapshot(badDigest).diagnostics[0].code, "SNAPSHOT_DIGEST_MISMATCH");
});

test("C1-T.1.2 受信任 hook 按固定顺序执行并受 work budget/单级 fallback 约束", async () => {
  const pipeline = new TrustedHookPipeline(hookManifestFixture, {
    intent_resolver: (input, context) => { context.consume(2); return { ...input, resolved: true }; },
    validator: (input, context) => { context.consume(3); return { ...input, valid: true }; }
  });
  const primary = await pipeline.run({ intent: "social.wave@1" });
  assert.equal(primary.ok, true);
  assert.deepEqual(primary.value.trace.map((item) => item.hook_id), ["intent_resolver", "validator"]);
  assert.equal(primary.value.execution_authority, "candidate_only");
  assert.equal((await verifyHookReplay(pipeline, { intent: "social.wave@1" })).value.deterministic, true);
  const overBudget = new TrustedHookPipeline(hookManifestFixture, {
    intent_resolver: (_input, context) => { context.consume(33); return {}; }, validator: (input) => input,
  });
  assert.equal((await overBudget.run({ intent: "social.wave@1" })).diagnostics[0].code, "HOOK_WORK_BUDGET_EXCEEDED");
  const failing = new TrustedHookPipeline(hookManifestFixture, {
    intent_resolver: () => { throw Object.assign(new Error("bad output"), { code: "HOOK_INVALID_OUTPUT" }); },
    validator: () => ({ valid: true })
  });
  const fallback = await runWithSingleFallback({
    pipeline: failing,
    input: { intent: "social.wave@1", resources: ["head@1"] },
    fallback: (input) => ({ ...input, fallback: true }),
    validateFallback: (output, context) => ({ ok: output.fallback === true && context.resources[0] === "head@1" }),
    safetySignature: { envelope: "strict" },
    resources: ["head@1"],
    fallbackResources: ["head@1"]
  });
  assert.equal(fallback.ok, true);
  assert.equal(fallback.path, "fallback");
  const unvalidated = await runWithSingleFallback({
    pipeline: failing, input: { intent: "social.wave@1" }, fallback: (input) => input,
    safetySignature: { envelope: "strict" }, resources: ["head@1"],
  });
  assert.equal(unvalidated.diagnostics[0].code, "FALLBACK_VALIDATOR_REQUIRED");
  const coreRejected = await runWithSingleFallback({
    pipeline: failing, input: { intent: "social.wave@1" }, fallback: (input) => input,
    validateFallback: () => ({ ok: false, diagnostics: [{ code: "PLAN_CONTACT_REJECTED" }] }),
    safetySignature: { envelope: "strict" }, resources: ["head@1"],
  });
  assert.equal(coreRejected.diagnostics[0].code, "FALLBACK_CORE_VALIDATION_FAILED");
  const changedTarget = await runWithSingleFallback({
    pipeline: failing, input: { intent: "social.wave@1" }, fallback: () => ({ intent: "social.run@1" }),
    validateFallback: () => ({ ok: true }), safetySignature: { envelope: "strict" }, resources: ["head@1"],
  });
  assert.equal(changedTarget.diagnostics[0].code, "FALLBACK_SEMANTIC_TARGET_CHANGED");
  const widenedOutput = await runWithSingleFallback({
    pipeline: failing, input: { intent: "social.wave@1" }, fallback: () => ({ intent: "social.wave@1", resources: ["arm@1"] }),
    validateFallback: () => ({ ok: true }), safetySignature: { envelope: "strict" }, resources: ["head@1"],
  });
  assert.equal(widenedOutput.diagnostics[0].code, "FALLBACK_OUTPUT_RESOURCE_WIDENED");
  const widened = await runWithSingleFallback({
    pipeline: failing,
    input: {},
    fallback: () => ({ ok: true }),
    safetySignature: { envelope: "strict" },
    fallbackSafetySignature: { envelope: "relaxed" },
    resources: ["head@1"],
    fallbackResources: ["head@1", "arm@1"]
  });
  assert.equal(widened.ok, false);
  assert.equal(widened.diagnostics[0].code, "FALLBACK_POLICY_VIOLATION");
  let replayNondeterminism = 0;
  const stateful = new TrustedHookPipeline(hookManifestFixture, {
    intent_resolver: (input) => ({ ...input, sequence: ++replayNondeterminism }),
    validator: (input) => input,
  });
  const replayCheck = await verifyHookReplay(stateful, { intent: "social.wave@1" });
  assert.equal(replayCheck.ok, false);
  assert.equal(replayCheck.diagnostics[0].code, "HOOK_REPLAY_DIVERGED");
  const timedManifest = structuredClone(hookManifestFixture);
  timedManifest.hooks[0].wall_watchdog_ms = 5;
  let timeoutAborted = false;
  const hanging = new TrustedHookPipeline(timedManifest, { intent_resolver: (_input, context) => { context.signal.addEventListener("abort", () => { timeoutAborted = true; }); return new Promise(() => {}); }, validator: (input) => input });
  assert.equal((await hanging.run({ intent: "social.wave@1" })).diagnostics[0].code, "HOOK_TIMEOUT");
  assert.equal(timeoutAborted, true);
  const run = new TransitionRun();
  assert.equal(run.start(), true);
  assert.equal(run.ownerLost(), true);
  assert.equal(run.cancel(), false);
  assert.deepEqual(run.terminal, { status: "owner_lost" });
});

test("C1-T.1.3 离线语义 harness 对执行、快照、外部 writer 和坏 plan 给出确定终态", () => {
  const registryFixture = {
    registry_type: "ResourceRegistry", schema_version: 1,
    resources: [{ id: "head", version: 1, kind: "leaf", leaves: [] }],
    lease_policy: { mode: "exclusive", ordering: "lexicographic", shared_write: false, implicit_queue: false }
  };
  const base = {
    registry: registryFixture,
    request: { lease_id: "lease.case", owner_id: "run.case", resources: ["head@1"], priority: 60, sequence: 1 },
    snapshot: validSnapshot,
    plan: { plan_id: "transition.case.1", intent: "social.wave@1", segments: [{ segment_id: "s1", duration_ticks: 2, start_tick: 0, start: { yaw: 0 }, end: { yaw: 0.1 } }], completion: { terminal_states: ["completed"], dwell_ticks: 1 } }
  };
  const executed = evaluateTransitionCase({ ...base, case_id: "execute" });
  assert.equal(executed.outcome, "execute");
  assert.equal(executed.terminal.status, "completed");
  const external = evaluateTransitionCase({ ...base, case_id: "external-writer", adapter_ownership: "external_owned" });
  assert.equal(external.failure_code, "EXTERNAL_WRITER_ACTIVE");
  assert.equal(external.partial_write, false);
  const invalid = structuredClone(base);
  invalid.case_id = "invalid-snapshot";
  invalid.snapshot.quality.same_tick = false;
  assert.equal(evaluateTransitionCase(invalid).failure_code, "SNAPSHOT_NOT_SAME_TICK");
  const badPlan = structuredClone(base);
  badPlan.case_id = "empty-plan";
  badPlan.plan.segments = [];
  assert.equal(evaluateTransitionCase(badPlan).failure_code, "EMPTY_PLAN_SEGMENTS");
  const replay = replayTransitionCase({ ...base, case_id: "replay" });
  assert.equal(replay.deterministic, true);
  assert.equal(replay.records.length, 2);
});

test("C1-P.1 reference slice 只在硬门后选择 fidelity，并在 anytime 截断时 fallback", () => {
  const options = { initial: { position: 0, velocity: 0 }, target: 1, target_tolerance: 0.45, horizon_ticks: 60, limits: { position: [-2, 2], velocity: [-4, 4] }, deadline_reserve_ms: 2, required_reserve_ms: 1 };
  const cascade = runReferenceCascade(options);
  assert.equal(cascade.ok, true);
  assert.equal(cascade.value.execution_authority, "candidate_only");
  assert.equal(cascade.value.candidates.length, 3);
  assert.equal(cascade.value.candidates.every((candidate) => candidate.hard_safe), true);
  assert.equal(cascade.value.selected.certified, true);
  const lowBudget = runAnytimeReference({ ...options, budgets: [8, 200, 4000] });
  assert.equal(lowBudget[0].outcome, "fallback");
  assert.equal(lowBudget[0].certified, false);
  assert.equal(lowBudget[1].outcome, "execute");
  assert.equal(lowBudget[1].candidate.certified, true);
  const unsafe = runReferenceCascade({ ...options, target: 10, limits: { position: [-1, 1], velocity: [-1, 1] }, budget_units: 10000 });
  assert.equal(unsafe.value.candidates.every((candidate) => candidate.hard_safe === false), true);
  assert.equal(unsafe.value.selected, null);
  assert.equal(unsafe.value.decision, "fallback");
  const simulation = runReferenceCascade(options).value.candidates[0];
  const receipt = certifyReferenceCandidate({ simulation: { ok: true, value: { final: { position: 0.7, velocity: 0 }, tier: "kinematic", work_units: simulation.work_units, finite_state: true, in_domain: true } }, target: 1, target_tolerance: 0.45, budget_units: simulation.work_units });
  assert.equal(receipt.value.certified, true);
});

test("C1-P.1e reference report separates deterministic decisions from current-host measurements", () => {
  assert.equal(c1pReferenceBenchmark.status, "PASS_REFERENCE_HOST_PROFILE_MEASURED");
  assert.equal(c1pReferenceBenchmark.execution_profile.profile_id, "node-reference-current-host@1");
  assert.equal(c1pReferenceBenchmark.execution_profile.sample_iterations >= 100, true);
  assert.equal(c1pReferenceBenchmark.wall_memory_observations.length, 3);
  assert.equal(c1pReferenceBenchmark.wall_memory_observations.every((item) => Number.isFinite(item.wall_ms.p95) && Number.isFinite(item.wall_ms.p99) && item.memory_bytes.peak_heap_used_during_samples >= item.memory_bytes.heap_used_before_samples), true);
  assert.match(c1pReferenceBenchmark.decision_fingerprint, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(c1pReferenceBenchmark.observation_non_claims.some((item) => item.includes("target device")), true);
});

test("C1-P.1b–1d hybrid reference 记录 tagged jump、关节限位和 finite/field 准入", () => {
  const jump = applyTaggedExternalJump({ state: { position: 0, velocity: 1 }, impulse: 0.2, envelope: 0.5 });
  assert.equal(jump.ok, true);
  assert.equal(jump.value.ledger.admitted, true);
  assert.equal(applyTaggedExternalJump({ state: { position: 0, velocity: 1 }, impulse: 0.8, envelope: 0.5 }).ok, false);
  const contact = enforceOneSidedJointLimit({ state: { position: 1.2, velocity: 2 }, limits: [-1, 1], restitution: 0 });
  assert.equal(contact.ok, true);
  assert.equal(contact.value.state.position, 1);
  assert.equal(contact.value.contact_receipt.contact, "upper_limit");
  assert.equal(admitFiniteFieldSwitch({ source_in_domain: true, target_in_domain: true, state_safe_admissible: true, input_intersection: true }).value.switch_admissible, true);
  assert.equal(admitFiniteFieldSwitch({ source_in_domain: true, target_in_domain: false, state_safe_admissible: true, input_intersection: true }).ok, false);
  const hybrid = runHybridReference({ target: 1, horizon_ticks: 12, limits: [-0.2, 0.2], disturbance_envelope: 0.1, jumps: { 4: 0.05 }, switches: [6] });
  assert.equal(hybrid.ok, true);
  assert.equal(hybrid.value.jump_ledger.length, 1);
  assert.equal(hybrid.value.switch_receipts.length, 1);
  assert.equal(hybrid.value.execution_authority, "candidate_only");
});

test("C1-T.2.3 Node decision 与 Godot observation 只比较语义因果，不冒充 wall-time 确定性", () => {
  assert.equal(validateReplayEnvelope(replayEnvelopeFixture).ok, true);
  assert.equal(validateRuntimeObservation(runtimeObservationFixture).ok, true);
  const canonical = createReplayEnvelope(replayEnvelopeFixture);
  assert.equal(canonical.ok, true);
  assert.equal(replayEnvelopeFingerprint(canonical.value).value, replayEnvelopeFingerprint(replayEnvelopeFixture).value);
  assert.equal(validateRuntimeObservation({ ...runtimeObservationFixture, wall: { ...runtimeObservationFixture.wall, p95_ms: 10, p99_ms: 9 } }).diagnostics[0].code, "INVALID_RUNTIME_WALL_PROFILE");
  assert.equal(validateRuntimeObservation({ ...runtimeObservationFixture, receipts: [...runtimeObservationFixture.receipts].reverse() }).diagnostics.some((item) => item.code === "INVALID_RUNTIME_RECEIPT_ORDER"), true);
  const execute = compareTransitionDecisionObservation(
    { decision_id: "decision.c1t.wave.1", outcome: "execute" },
    runtimeObservationFixture
  );
  assert.equal(execute.equivalent, true);
  assert.equal(execute.wall_time_comparable, false);
  const rejected = compareTransitionDecisionObservation(
    { decision_id: "decision.reject.1", outcome: "reject" },
    { decision_id: "decision.reject.1", receipts: [{ receipt_type: "barrier_receipt", status: "rejected" }, { receipt_type: "terminal_receipt", status: "rejected" }] }
  );
  assert.equal(rejected.equivalent, true);
  const badOrder = compareTransitionDecisionObservation(
    { decision_id: "decision.bad.1", outcome: "execute" },
    { decision_id: "decision.bad.1", receipts: [{ receipt_type: "terminal_receipt", status: "completed" }, { receipt_type: "barrier_receipt", status: "accepted" }, { receipt_type: "start_receipt", status: "started" }] }
  );
  assert.equal(badOrder.equivalent, false);
  assert.ok(badOrder.issues.some((item) => item.code === "RECEIPT_CAUSAL_ORDER"));
});

test("C1-P.2 field 局部停滞可检测，并只能通过安全 finite escape 或 reject", () => {
  const trace = Array.from({ length: 10 }, (_, tick) => ({ x: 0.2 + tick * 0.0001, y: 0.2, vx: 0.0001, vy: 0 }));
  const stagnation = detectFieldStagnation(trace);
  assert.equal(stagnation.stagnant, true);
  const obstacle = { x: 0.5, y: 0.5, radius: 0.2 };
  const escaped = selectFiniteEscapeWaypoint({ start: { x: 0, y: 0.5 }, target: { x: 1, y: 0.5 }, obstacles: [obstacle], margin: 0.05 });
  assert.equal(escaped.ok, true);
  const fallback = runFieldWithFiniteFallback({ start: { x: 0, y: 0.5 }, target: { x: 1, y: 0.5 }, obstacles: [obstacle], trace });
  assert.equal(fallback.outcome, "fallback");
  assert.equal(fallback.mode, "finite");
  const narrowChannel = selectFiniteEscapeWaypoint({ start: { x: 0, y: 0 }, target: { x: 1, y: 0 }, obstacles: [{ x: 0.5, y: 0.27, radius: 0.2 }, { x: 0.5, y: -0.27, radius: 0.2 }], margin: 0.04 });
  assert.equal(narrowChannel.ok, true);
  assert.ok(narrowChannel.clearance > 0.04);
  const blocked = runFieldWithFiniteFallback({ start: { x: 0, y: 0 }, target: { x: 1, y: 1 }, obstacles: [{ x: 0.5, y: 0.5, radius: 10 }], trace });
  assert.equal(blocked.outcome, "reject");
  assert.equal(blocked.reason, "NO_SAFE_ESCAPE_WAYPOINT");
});

test("C1-P.3 latent shadow guard 拒绝 OOD、metric 退化和 decoded 越界", () => {
  const prior = { mean: [0, 0], basis: [[1, 0], [0, 1]] };
  const base = { latent: [0.2, -0.1], prior, reference_state: [0.2, -0.1], decoded_limits: [[-1, 1], [-1, 1]], support: { min: [-1, -1], max: [1, 1] }, metric: { sigma_min: 0.8, condition_number: 2 } };
  const accepted = evaluateLatentCandidate(base);
  assert.equal(accepted.value.accepted, true);
  assert.equal(accepted.value.candidate_only, true);
  const ood = evaluateLatentCandidate({ ...base, latent: [2, 0] });
  assert.equal(ood.value.accepted, false);
  assert.ok(ood.diagnostics.some((item) => item.code === "LATENT_OOD"));
  const singular = evaluateLatentCandidate({ ...base, metric: { sigma_min: 0.001, condition_number: 1000 } });
  assert.equal(singular.value.accepted, false);
  assert.ok(singular.diagnostics.some((item) => item.code === "METRIC_CONDITION_GUARD"));
  const decodedOut = evaluateLatentCandidate({ ...base, latent: [2, 0], support: { min: [-3, -3], max: [3, 3] }, decoded_limits: [[-1, 1], [-1, 1]] });
  assert.equal(decodedOut.value.accepted, false);
  assert.ok(decodedOut.diagnostics.some((item) => item.code === "DECODED_CONSTRAINT_VIOLATION"));
  assert.deepEqual(decodeLinearPrior({ latent: [0.2, -0.1], ...prior }).value, [0.2, -0.1]);
  const modelError = buildModelErrorReport({ prediction_receipt_id: "prediction.1", reference: "high.reference", errors: { position: 0.1, velocity: 0.2, contact: 0.0, effort: 0.3 }, decision_flip: { execute_to_fallback: false, fallback_to_reject: false, dangerous_flip: false } });
  assert.equal(modelError.value.recommendation, "retain_tier");
  const dangerousModelError = buildModelErrorReport({ prediction_receipt_id: "prediction.2", reference: "kinematic.reference", errors: { position: 0.1, velocity: 0.2, contact: 0.0, effort: 0.3 }, decision_flip: { execute_to_fallback: false, fallback_to_reject: false, dangerous_flip: true } });
  assert.equal(dangerousModelError.value.recommendation, "upgrade_or_reject");
});

test("C1-T.3.1 表情 Adapter reference 复用 ownership/generation/receipt 且不依赖 Skeleton 字段", () => {
  const profile = { profile_type: "ExpressionAdapterProfile", schema_version: 1, channels: { "face.smile": { min: 0, max: 1 }, "face.eye_open": { min: 0, max: 1 } } };
  assert.equal(validateExpressionAdapterProfile(profile).ok, true);
  const adapter = new ExpressionAdapterReference(profile);
  assert.equal(adapter.handoff("coda_owned").ok, true);
  const generation = adapter.startGeneration();
  assert.equal(generation.ok, true);
  const completed = adapter.apply({ generation: generation.value.generation, channels: { "face.smile": 0.7, "face.eye_open": 0.85 } });
  assert.equal(completed.ok, true);
  assert.equal(completed.receipt.status, "completed");
  const stale = adapter.apply({ generation: generation.value.generation - 1, channels: { "face.smile": 0.2 } });
  assert.equal(stale.ok, false);
  assert.equal(stale.receipt.status, "rejected");
  assert.equal(stale.diagnostics[0].code, "STALE_EXPRESSION_GENERATION");
  adapter.handoff("external_owned");
  const denied = adapter.startGeneration();
  assert.equal(denied.ok, false);
  assert.equal(denied.diagnostics[0].code, "EXPRESSION_WRITER_NOT_OWNED");
  assert.equal(Object.hasOwn(adapter.snapshot(), "skeleton"), false);
});

test("C1-P.4 Pareto 先过滤硬门，再标记 dominated 并稳定选择候选", () => {
  const candidates = [
    { id: "kinematic", tier: "kinematic", schema_valid: true, resource_valid: true, numerical_valid: true, hard_safe: true, deadline_ok: true, target_error: 0.4, state_error: 0.4, work_units: 10, energy_proxy: 2 },
    { id: "reduced", tier: "reduced", schema_valid: true, resource_valid: true, numerical_valid: true, hard_safe: true, deadline_ok: true, target_error: 0.2, state_error: 0.2, work_units: 40, energy_proxy: 3 },
    { id: "dominated", tier: "reduced", schema_valid: true, resource_valid: true, numerical_valid: true, hard_safe: true, deadline_ok: true, target_error: 0.5, state_error: 0.5, work_units: 50, energy_proxy: 4 },
    { id: "unsafe-accurate", tier: "high", schema_valid: true, resource_valid: true, numerical_valid: true, hard_safe: false, deadline_ok: true, target_error: 0.01, state_error: 0.01, work_units: 100, energy_proxy: 1 }
  ];
  const frontier = buildSafeParetoFrontier(candidates);
  assert.deepEqual(frontier.rejected.map((candidate) => candidate.id), ["unsafe-accurate"]);
  assert.deepEqual(frontier.dominated.map((candidate) => candidate.id), ["dominated"]);
  assert.deepEqual(frontier.frontier.map((candidate) => candidate.id), ["kinematic", "reduced"]);
  const selected = selectStableParetoCandidate(frontier.frontier, { preferred_tier_order: ["reduced", "kinematic"] });
  assert.equal(selected.outcome, "execute_candidate");
  assert.equal(selected.candidate.id, "reduced");
  assert.equal(selected.execution_authority, "candidate_only");
});

test("C1-P.0 契约包保持候选权、安全先行和三类收敛的责任分离", () => {
  assert.equal(c1pContractIndex.contract_family, "C1-P");
  assert.equal(c1pContractIndex.schemas.length, 10);
  assert.equal(c1pContractIndex.execution_authority, "candidate_only");
  assert.equal(c1pContractPack.status, "DESIGN_ONLY_NOT_RUNTIME");
  assert.equal(c1pContractPack.policy.execution_authority, "candidate_only");
  assert.equal(c1pContractPack.approximation.dangerous_decision_rule, "upgrade_or_reject");
  assert.equal(c1pContractPack.approximation.anytime_rule, "certified_candidate_or_fallback");
  assert.equal(c1pContractPack.safety.no_solution_action, "reject");
  assert.equal(c1pContractPack.prediction.candidate_only, true);
  assert.equal(c1pContractPack.error.decision_flip.dangerous_flip, false);
});

test("ExecutionPlan 与 GDScript 生成是确定的，并拒绝受管工件漂移", () => {
  const lowered = lowerToExecutionPlan(asset, registry);
  assert.equal(lowered.receipt.ok, true);
  const generated = generateGdscript(lowered.plan);
  assert.match(generated.source, /GENERATED BY GSEOS/);
  assert.ok(generated.source_map.mappings.length >= 6);
  assert.equal(lowered.plan.instructions[0].then[4].bind, "new_row");
  assert.equal(resolveSourceRef(generated.source_map, 7).event_id, "ui.reward.apply");
  assert.deepEqual(generated.source_map, goldenSourceMap);
  assert.equal(verifyManagedArtifact(generated.source, { event_id: lowered.plan.event_id, plan_fingerprint: generated.source_map.plan_fingerprint }).ok, true);
  assert.equal(verifyManagedArtifact(generated.source.replace("ui.reward.apply", "ui.changed"), { event_id: lowered.plan.event_id, plan_fingerprint: generated.source_map.plan_fingerprint }).ok, false);
});

test("WaitRegistration 竞争只产生一个终态，EventRegistry 同步返回 RunHandle", async () => {
  const wait = new WaitRegistration();
  assert.equal(wait.finish({ status: "completed" }), true);
  assert.equal(wait.cancel(), false);
  assert.deepEqual(await wait.wait(), { status: "completed" });
  const events = new EventRegistry();
  events.register("demo", async () => "ok");
  const handle = events.start("demo", {}, null);
  assert.ok(handle.run_id > 0);
  const result = await new Promise((resolve) => handle.onComplete(resolve));
  assert.equal(result.status, RunStatus.COMPLETED);
  assert.equal(handle.status, RunStatus.COMPLETED);
  const context = new RunContext({}, { valid: true });
  context.cancel("owner_destroyed");
  assert.equal(context.cancelled, true);
});

test("SPM 与 AliasRegistry 确定性生成逐槽位投影", () => {
  assert.equal(validateAliasRegistry(aliasRegistry).ok, true);
  const projection = buildSemanticProjectionMap(asset, manifest, aliasRegistry);
  assert.equal(projection.receipt.ok, true);
  assert.equal(projection.map.projection_type, "SemanticProjectionMap");
  assert.equal(validateSemanticProjectionMap(projection.map).ok, true);
  assert.deepEqual(projection.map, semanticMapFixture);
  const animate = projection.map.nodes.find((node) => node.node_id === "animate-score");
  assert.equal(animate.semantic_id, "capability:ui.animate_number@1");
  const duration = animate.slots.find((slot) => slot.field_id === "duration");
  assert.equal(duration.path, "/root/0/children/then/2/params/args/duration");
  assert.equal(duration.control, "duration");
  assert.equal(duration.label["zh-CN"], "时长");
  assert.deepEqual(animate.slots.find((slot) => slot.field_id === "target").allowed_refs, ["new_row", "old_row", "target_hud"]);
  assert.equal(resolveAlias(aliasRegistry, "播放数字动画").target_id, "capability:ui.animate_number@1");
  assert.equal(resolveAlias(aliasRegistry, "play number animation", { locale: "en" }).target_id, "capability:ui.animate_number@1");
  assert.equal(resolveAlias(aliasRegistry, "PLAY NUMBER ANIMATION", { locale: "fr" }).label.locale, "zh-CN");
  assert.equal(resolveAlias(aliasRegistry, "数值动画").target_id, "capability:ui.animate_number@1");
  assert.equal(resolveAlias(aliasRegistry, "ui.animate_number@1").receipt.ok, false);
  const incompatible = structuredClone(aliasRegistry);
  incompatible.layers.project.push({ ...structuredClone(aliasRegistry.layers.official[0]), target_id: "capability:ui.animate_number@9", aliases: { "zh-CN": ["不存在的版本"] } });
  assert.equal(buildSemanticProjectionMap({ ...asset, root: [{ node_id: "bad-version", command_id: "do", params: { capability: "ui.animate_number@9", args: {} } }] }, manifest, incompatible).receipt.ok, false);
});

test("结构化 patch 绑定指纹、路径与类型并阻断过期和越权写回", () => {
  const projection = buildSemanticProjectionMap(asset, manifest, aliasRegistry).map;
  const created = createSemanticPatch({ asset, manifest, registry: aliasRegistry, projection, operations: [{ slot_id: "animate-score.duration", value: 1.25 }] });
  assert.equal(created.receipt.ok, true);
  assert.equal(created.patch.base_asset_fingerprint, assetFingerprint(asset));
  assert.equal(created.patch.operations[0].path, "/root/0/children/then/2/params/args/duration");
  const applied = applySemanticPatch(asset, created.patch, { manifest, registry: aliasRegistry, projection });
  assert.equal(applied.ok, true);
  assert.equal(applied.asset.root[0].children.then[2].params.args.duration, 1.25);
  const stale = applySemanticPatch({ ...asset, display_name: "已被外部修改" }, created.patch, { manifest, registry: aliasRegistry, projection });
  assert.equal(stale.ok, false);
  assert.ok(stale.receipt.diagnostics.some((item) => item.code === "PATCH_STALE_ASSET"));
  assert.deepEqual(stale.asset, { ...asset, display_name: "已被外部修改" });
  const outOfRange = createSemanticPatch({ asset, manifest, registry: aliasRegistry, projection, operations: [{ slot_id: "animate-score.duration", value: 61 }] });
  assert.equal(applySemanticPatch(asset, outOfRange.patch, { manifest, registry: aliasRegistry, projection }).ok, false);
  const invalidTarget = createSemanticPatch({ asset, manifest, registry: aliasRegistry, projection, operations: [{ slot_id: "animate-score.target", value: { ref: "not_declared" } }] });
  const invalidTargetResult = applySemanticPatch(asset, invalidTarget.patch, { manifest, registry: aliasRegistry, projection });
  assert.equal(invalidTargetResult.ok, false);
  assert.ok(invalidTargetResult.receipt.diagnostics.some((item) => item.code === "PATCH_REFERENCE_NOT_ALLOWED"));
  const illegal = { ...created.patch, operations: [{ ...created.patch.operations[0], path: "/root/0/params/display_name" }] };
  assert.equal(applySemanticPatch(asset, illegal, { manifest, registry: aliasRegistry, projection }).ok, false);
  assert.ok(applySemanticPatch(asset, illegal, { manifest, registry: aliasRegistry, projection }).receipt.diagnostics.some((item) => item.code === "PATCH_PATH_NOT_ALLOWED"));
  const renamed = structuredClone(aliasRegistry);
  renamed.layers.official[0].labels["zh-CN"] = "项目自定义动画";
  const renamedProjection = buildSemanticProjectionMap(asset, manifest, renamed).map;
  assert.equal(renamedProjection.asset_fingerprint, projection.asset_fingerprint);
  assert.equal(renamedProjection.contract_fingerprint, projection.contract_fingerprint);
});

test("同一层别名歧义和项目覆盖都有确定诊断", () => {
  const ambiguous = structuredClone(aliasRegistry);
  ambiguous.layers.project.push({ ...structuredClone(aliasRegistry.layers.official[0]), target_id: "capability:ui.set_text@1", aliases: { "zh-CN": ["播放数字动画"] } });
  ambiguous.layers.project.push({ ...structuredClone(aliasRegistry.layers.official[0]), target_id: "capability:ui.remove_node@1", aliases: { "zh-CN": ["播放数字动画"] } });
  assert.equal(validateAliasRegistry(ambiguous).ok, false);
  assert.equal(resolveAlias(ambiguous, "播放数字动画").receipt.ok, false);
  const override = structuredClone(aliasRegistry);
  override.layers.project.push({ ...structuredClone(aliasRegistry.layers.official[0]), aliases: { "zh-CN": ["项目数值动画"] } });
  assert.equal(resolveAlias(override, "项目数值动画").target_id, "capability:ui.animate_number@1");
});

test("RuntimeTrace 保留事件、步骤与状态并拒绝不完整记录", () => {
  const context = new RunContext({}, null, { event_id: asset.event_id, plan_fingerprint: "sha256:plan", run_id: 7 });
  context.recordStep("animate-score", "duration", "started", "ui.animate_number@1");
  context.recordStep("animate-score", "duration", "completed", "ui.animate_number@1");
  const trace = context.runtimeTrace();
  assert.equal(validateRuntimeTrace(trace).ok, true);
  assert.deepEqual(trace.steps.map((step) => step.status), ["started", "completed"]);
  assert.equal(validateRuntimeTrace({ ...trace, steps: [{ step_id: 1, node_id: "", slot: "duration", status: "completed" }] }).ok, false);
});

test("AI 语义候选只作为待审提议，不能建立权威锚点", () => {
  const candidate = { candidate_type: "SemanticCandidate", schema_version: 1, candidate_id: "candidate-1", status: "needs_review", target_ref: "capability:ui.animate_number@1", source: { kind: "human-assisted" }, confidence: { state: "medium", score: 0.7 }, aliases: { "zh-CN": ["数字动效"] }, patches: [{ path: "/root/0/children/then/2/params/args/duration", value: 1 }] };
  assert.equal(validateSemanticCandidate(candidate).ok, true);
  assert.equal(validateSemanticCandidate({ ...candidate, authoritative_target_id: "capability:ui.animate_number@1" }).ok, false);
});

test("用户观察记录只接受脱敏结构，并保留 G-P3-U 通过门槛", () => {
  const report = { observation_type: "P3UserObservation", schema_version: 1, study_id: "p3-reward", observations: [] };
  const incomplete = validateUserObservationReport(report);
  assert.equal(incomplete.ok, false);
  assert.ok(incomplete.diagnostics.some((item) => item.code === "USER_OBSERVATION_COUNT"));
  assert.deepEqual(summarizeUserObservationReport(report).gate, "G-P3-U_PENDING");
  const withPii = { ...report, observations: [{ participant_id: "u-001", role_profile: "godot", consent: { recorded: true, recording_allowed: false }, tasks: {}, hint_count: 0, outcome: "blocked", name: "should-not-be-recorded" }] };
  assert.ok(validateUserObservationReport(withPii).diagnostics.some((item) => item.code === "USER_OBSERVATION_PII_FIELD"));
});

test("C0 行为定义嵌入 EventAsset，拒绝第二逻辑源、未声明能力与非法 Blackboard 写入", () => {
  assert.equal(validateBehaviorRuntime(behaviorAsset, behaviorRegistry).ok, true);
  const compiled = compileBehaviorRuntime(behaviorAsset, behaviorRegistry);
  assert.equal(compiled.receipt.ok, true);
  assert.equal(compiled.plan.event_asset_id, "aibi.behavior.runtime");
  assert.equal(compiled.plan.behavior.behavior_id, "aibi.companion");
  const noExtension = { ...behaviorAsset }; delete noExtension.behavior_runtime;
  assert.ok(validateBehaviorRuntime(noExtension, behaviorRegistry).diagnostics.some((item) => item.code === "BEHAVIOR_EXTENSION_REQUIRED"));
  const parallelAsset = { ...behaviorAsset, asset_type: "BehaviorAsset" };
  assert.ok(validateBehaviorRuntime(parallelAsset, behaviorRegistry).diagnostics.some((item) => item.code === "INVALID_ASSET_TYPE"));
  const unknownCapability = structuredClone(behaviorAsset); unknownCapability.behavior_runtime.effects[0].capability = "audio.raw_servo@1";
  assert.equal(compileBehaviorRuntime(unknownCapability, behaviorRegistry).plan, null);
  const illegalWrite = structuredClone(behaviorAsset); illegalWrite.behavior_runtime.rules.find((item) => item.rule_id === "speak_done").blackboard_writes = { energy: 101 };
  const invalid = compileBehaviorRuntime(illegalWrite, behaviorRegistry);
  assert.equal(invalid.plan, null);
  assert.ok(invalid.receipt.diagnostics.some((item) => item.code === "BLACKBOARD_WRITE_FORBIDDEN" || item.code === "BLACKBOARD_WRITE_OUT_OF_RANGE"));
});

test("G-C0：正常链路、说话打断、迟到 tts_done 与冲突事件均确定且可回放", () => {
  const plan = compileBehaviorRuntime(behaviorAsset, behaviorRegistry).plan;
  const normal = new BehaviorRuntime(plan);
  for (const event_id of ["wake_word", "speech_end", "llm_response", "tts_done"]) { normal.enqueue(event_id); normal.drain(); }
  const normalTrace = normal.trace();
  assert.equal(normalTrace.final_state, "idle");
  assert.ok(normalTrace.entries.some((entry) => entry.kind === "EffectCompleted" && entry.effect_id === "speech"));
  assert.equal(validateBehaviorRuntimeTrace(normalTrace).ok, true);

  const interrupted = new BehaviorRuntime(plan);
  for (const event_id of ["wake_word", "speech_end", "llm_response", "interrupt", "tts_done"]) { interrupted.enqueue(event_id); interrupted.drain(); }
  const interruptedTrace = interrupted.trace();
  assert.equal(interruptedTrace.final_state, "listening");
  assert.equal(interruptedTrace.entries.filter((entry) => entry.kind === "EffectCancelled" && entry.effect_id === "speech").length, 1);
  assert.equal(interruptedTrace.entries.filter((entry) => entry.kind === "EffectConverged" && entry.cancelled_effect_id === "speech").length, 1);
  assert.equal(interruptedTrace.entries.filter((entry) => entry.kind === "EventIgnored" && entry.reason === "STALE_COMPLETION").length, 1);
  assert.equal(interruptedTrace.entries.filter((entry) => entry.kind === "EffectStarted" && entry.effect_id === "speech").length, 1);

  const conflict = new BehaviorRuntime(plan);
  conflict.enqueue("boredom_high", { sequence: 2 }); conflict.enqueue("wake_word", { sequence: 1 }); conflict.drain();
  const arbitration = conflict.trace().entries.find((entry) => entry.kind === "EventArbitrated");
  assert.equal(arbitration.event_id, "wake_word");
  assert.equal(conflict.trace().final_state, "listening");

  const replayA = new BehaviorRuntime(plan); const replayB = new BehaviorRuntime(plan);
  for (const runtime of [replayA, replayB]) { runtime.enqueue("wake_word", { sequence: 1 }); runtime.enqueue("boredom_high", { sequence: 2 }); runtime.drain(); }
  assert.equal(stableStringify(replayA.trace()), stableStringify(replayB.trace()));
});
