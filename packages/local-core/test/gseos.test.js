import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BehaviorRuntime, EventRegistry, ExpressionAdapterReference, RunContext, RunStatus, TransitionLeaseArbiter, TransitionRun, TrustedHookPipeline, WaitRegistration, admitFiniteFieldSwitch, applySemanticPatch, applyTaggedExternalJump, assetFingerprint, bindEventAsset, buildModelErrorReport, buildSafeParetoFrontier, buildSemanticProjectionMap, buildTransitionPlan, certifyReferenceCandidate, compareTransitionDecisionObservation, compileBehaviorRuntime, createSchemaRegistry, createSemanticPatch, decodeLinearPrior, detectFieldStagnation, enforceOneSidedJointLimit, evaluateLatentCandidate, evaluateTransitionCase, formatGse, generateGdscript, lexGse, lowerMotionIntentForProfile, lowerMotionIntentToBackend, lowerToExecutionPlan, lowerToTaskGraph, migrateEventAsset, parseCst, parseExpressionText, parseGse, replayTransitionCase, resolveAlias, resolveSourceRef, roundTripEventAsset, runAnytimeReference, runFieldWithFiniteFallback, runHybridReference, runReferenceCascade, runWithSingleFallback, selectFiniteEscapeWaypoint, selectStableParetoCandidate, stableStringify, summarizeUserObservationReport, transitionDecisionFingerprint, validateAliasRegistry, validateBehaviorRuntime, validateBehaviorRuntimeTrace, validateCapabilityManifest, validateEventAsset, validateExpressionAdapterProfile, validateRuntimeTrace, validateSemanticCandidate, validateSemanticProjectionMap, validateTransitionSnapshot, validateUserObservationReport, verifyManagedArtifact } from "../src/index.js";

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
  assert.equal(left.asset.root[0].command_id, right.asset.root[0].command_id);
  assert.equal(left.asset.root[0].params.condition.op, right.asset.root[0].params.condition.op);
  assert.equal(parseGse("event bad:\n\tawait x()").receipt.ok, false);
  assert.equal(parseExpressionText("a + b * c").expression.op, "+");
  assert.equal(parseExpressionText("a + b * c").expression.right.op, "*");
  assert.equal(parseCst("# comment\n\nif (a):\n  let b = 1").children[0].kind, "comment");
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
  assert.ok(schema("embodiment-protocol").allOf.length >= 8);
  assert.deepEqual(schema("safety-authority-port").properties.action.enum, ["revoke_writer", "request_protective_action", "enter_device_failsafe", "report_safety_clear"]);
  assert.deepEqual(schema("embodiment-dynamics-profile").properties.guarantee_level.enum, ["visual_plausibility", "model_admissible", "calibrated_envelope", "hardware_safety_reviewed"]);

  assert.equal(c1lContractPack.embodied_skill.authoring_owner, "text_owned");
  assert.equal(c1lContractPack.intent_request.operation, "invoke");
  assert.equal(c1lContractPack.intent_receipt.terminal, false);
  assert.equal(c1lContractPack.embodiment_observation.direction, "adapter_to_coda");
  assert.equal(c1lContractPack.embodiment_observation.validity.valid_until_tick, 122);
  assert.equal(c1lContractPack.safety_revocation.action, "revoke_writer");
  assert.equal(c1lContractPack.safety_revocation.latched, true);
  assert.equal(c1lContractPack.dynamics_profile.target_class, "game_visual");
  assert.equal(c1lContractPack.dynamics_profile.guarantee_level, "visual_plausibility");
  assert.equal(c1lContractPack.dynamics_profile.status, "draft");
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

  assert.equal(authoringOwnershipPack.text_owned.authoring_mode, "text_owned");
  assert.equal(authoringOwnershipPack.text_owned.source.source_type, "coda_source");
  assert.equal(authoringOwnershipPack.graph_owned.authoring_mode, "graph_owned");
  assert.equal(authoringOwnershipPack.graph_owned.source.source_type, "event_asset");
  assert.equal(authoringOwnershipPack.migration_transaction.expected_mode, "graph_owned");
  assert.equal(authoringOwnershipPack.migration_transaction.target_mode, "text_owned");
  assert.equal(authoringOwnershipPack.stale_owner_receipt.status, "conflict");
  assert.deepEqual(authoringOwnershipPack.stale_owner_receipt.changed_node_ids, []);
});

test("C1-L.1 TaskGraph 与 source reference 固定类型和作者源定位", () => {
  const graphSchema = c1lSchemas.find((item) => item.$id.endsWith("/task-graph@1"));
  const sourceSchema = c1lSchemas.find((item) => item.$id.endsWith("/source-ref@1"));
  assert.deepEqual(graphSchema.properties.nodes.items.properties.kind.enum, ["task", "observation", "mode_transition", "tracking", "control", "intent", "reactive"]);
  assert.equal(graphSchema.properties.nodes.items.properties.contract_ref.pattern, "^[a-z][a-z0-9_.-]*@\\d+$");
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
    resources: [
      { id: "body", version: 1, kind: "group", leaves: ["head@1", "arm@1"] },
      { id: "head", version: 1, kind: "leaf", leaves: [] },
      { id: "arm", version: 1, kind: "leaf", leaves: [] }
    ]
  };
  const arbiter = new TransitionLeaseArbiter(registryFixture);
  const first = arbiter.request({ lease_id: "lease.a", owner_id: "run.a", resources: ["body"], priority: 40, sequence: 1 });
  assert.equal(first.ok, true);
  const rejected = arbiter.request({ lease_id: "lease.b", owner_id: "run.b", resources: ["head"], priority: 40, sequence: 2 });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.diagnostics[0].code, "LEASE_REJECTED");
  const preempted = arbiter.request({ lease_id: "lease.b", owner_id: "run.b", resources: ["head"], priority: 80, sequence: 3 });
  assert.equal(preempted.ok, true);
  assert.deepEqual(preempted.value.preempted, ["lease.a"]);
  assert.equal(arbiter.checkWrite({ lease_id: "lease.a", generation: first.value.lease.generation, resources: ["head@1"] }).ok, false);
  assert.equal(arbiter.checkWrite({ lease_id: "lease.b", generation: preempted.value.lease.generation, resources: ["head@1"] }).ok, true);
});

test("C1-T.1.1 参考 planner 拒绝坏快照和未租资源且计划指纹可重复", () => {
  const lease = { lease_id: "lease.wave", generation: 1, resources: ["head@1"], mode: "all_or_reject" };
  const base = { plan_id: "plan.wave.1", intent: "social.wave@1", lease, snapshot: validSnapshot, resources: ["head@1"], segments: [{ segment_id: "s1", duration_ticks: 4, start_tick: 0, start: { yaw: 0 }, end: { yaw: 0.5 } }], completion: { terminal_states: ["completed"], dwell_ticks: 2 } };
  const built = buildTransitionPlan(base);
  assert.equal(built.ok, true);
  assert.equal(built.value.execution_authority, "adapter_only");
  assert.equal(transitionDecisionFingerprint(built.value), transitionDecisionFingerprint(buildTransitionPlan(structuredClone(base)).value));
  const badSnapshot = structuredClone(validSnapshot);
  badSnapshot.quality.finite = false;
  assert.equal(buildTransitionPlan({ ...base, snapshot: badSnapshot }).ok, false);
  assert.equal(buildTransitionPlan({ ...base, resources: ["arm@1"] }).ok, false);
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
  const failing = new TrustedHookPipeline(hookManifestFixture, {
    intent_resolver: () => { throw Object.assign(new Error("bad output"), { code: "HOOK_INVALID_OUTPUT" }); },
    validator: () => ({ valid: true })
  });
  const fallback = await runWithSingleFallback({
    pipeline: failing,
    input: { resources: ["head@1"] },
    fallback: (input) => ({ ...input, fallback: true }),
    safetySignature: { envelope: "strict" },
    resources: ["head@1"],
    fallbackResources: ["head@1"]
  });
  assert.equal(fallback.ok, true);
  assert.equal(fallback.path, "fallback");
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
  const run = new TransitionRun();
  assert.equal(run.start(), true);
  assert.equal(run.ownerLost(), true);
  assert.equal(run.cancel(), false);
  assert.deepEqual(run.terminal, { status: "owner_lost" });
});

test("C1-T.1.3 离线语义 harness 对执行、快照、外部 writer 和坏 plan 给出确定终态", () => {
  const registryFixture = { resources: [{ id: "head", version: 1, kind: "leaf", leaves: [] }] };
  const base = {
    registry: registryFixture,
    request: { lease_id: "lease.case", owner_id: "run.case", resources: ["head"], priority: 60, sequence: 1 },
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
