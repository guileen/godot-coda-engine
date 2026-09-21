import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EventRegistry, RunContext, RunStatus, WaitRegistration, applySemanticPatch, assetFingerprint, bindEventAsset, buildSemanticProjectionMap, createSchemaRegistry, createSemanticPatch, formatGse, generateGdscript, lexGse, lowerToExecutionPlan, migrateEventAsset, parseCst, parseExpressionText, parseGse, resolveAlias, resolveSourceRef, roundTripEventAsset, stableStringify, summarizeUserObservationReport, validateAliasRegistry, validateCapabilityManifest, validateEventAsset, validateRuntimeTrace, validateSemanticCandidate, validateSemanticProjectionMap, validateUserObservationReport, verifyManagedArtifact } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const asset = JSON.parse(await readFile(resolve(root, "gseos/events/ui.reward.apply.gse.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "contracts/gseos/capabilities.json"), "utf8"));
const aliasRegistry = JSON.parse(await readFile(resolve(root, "gseos/fixtures/ui.reward.apply.alias-registry.json"), "utf8"));
const semanticMapFixture = JSON.parse(await readFile(resolve(root, "gseos/fixtures/ui.reward.apply.semantic-map.json"), "utf8"));
const goldenSourceMap = JSON.parse(await readFile(resolve(root, "tests/golden/ui.reward.apply.source-map.json"), "utf8"));
const registry = createSchemaRegistry(manifest);

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
