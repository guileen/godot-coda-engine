#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TransitionLeaseArbiter,
  buildTransitionPlan,
  createSchemaRegistry,
  lowerMotionIntentForProfile,
  lowerToExecutionPlan,
} from "../packages/local-core/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const manifest = await readJson("contracts/coda/capabilities.json");
const profile = await readJson("demos/d3-skeleton-transition/fixtures/d3-motion-profile.json");
const snapshotTemplate = await readJson("coda/fixtures/c1t/valid-snapshot.json");
const registry = createSchemaRegistry(manifest);
const outDir = resolve(root, "demos/d3-skeleton-transition/fixtures/generated");
await mkdir(outDir, { recursive: true });

const eventFiles = ["robot.attack.recover.gse.json", "robot.high.guard.gse.json"];
for (const filename of eventFiles) {
  const assetPath = `coda/events/${filename}`;
  const asset = await readJson(assetPath);
  const lowered = lowerToExecutionPlan(asset, registry);
  if (!lowered.receipt.ok || lowered.plan.instructions.length !== 1 || lowered.plan.instructions[0].opcode !== "MotionIntent") {
    throw new Error(`${asset.event_id}: EventAsset did not lower to one valid MotionIntent: ${JSON.stringify(lowered.receipt.diagnostics)}`);
  }
  const instruction = lowered.plan.instructions[0];
  const envelope = lowerMotionIntentForProfile(instruction, profile.backend);
  if (!envelope.receipt.ok) throw new Error(`${asset.event_id}: backend admission failed: ${JSON.stringify(envelope.receipt.diagnostics)}`);
  const args = Object.fromEntries(Object.entries(instruction.args).map(([key, value]) => [key, value?.value ?? value]));
  const target = profile.targets[args.target];
  if (!target) throw new Error(`${asset.event_id}: target is not registered in the D3 motion profile: ${args.target}`);
  const resources = String(args.resources).split("+");
  const leaseId = `${asset.event_id}.lease`;
  const arbiter = new TransitionLeaseArbiter(profile.resource_registry);
  const leaseResult = arbiter.request({
    lease_id: leaseId,
    owner_id: asset.event_id,
    resources,
    priority: args.priority,
    sequence: 0,
  });
  if (!leaseResult.ok) throw new Error(`${asset.event_id}: resource admission failed: ${JSON.stringify(leaseResult.diagnostics)}`);

  const snapshot = structuredClone(snapshotTemplate);
  snapshot.revision = `${asset.event_id}.neutral-start`;
  snapshot.state = structuredClone(profile.initial_state);
  const segments = [
    {
      segment_id: `${asset.event_id}.approach`,
      start_tick: 0,
      duration_ticks: profile.segment_duration_ticks,
      start: structuredClone(profile.initial_state),
      end: structuredClone(target),
    },
    {
      segment_id: `${asset.event_id}.return`,
      start_tick: profile.segment_duration_ticks,
      duration_ticks: profile.segment_duration_ticks,
      start: structuredClone(target),
      end: structuredClone(profile.initial_state),
    },
  ];
  const admitted = buildTransitionPlan({
    plan_id: `${asset.event_id}.transition-plan@1`,
    intent: instruction.target,
    lease: leaseResult.value.lease,
    snapshot,
    snapshot_binding: profile.snapshot_binding,
    resources: leaseResult.value.lease.resources,
    segments,
    completion: profile.completion,
    plan_constraints: profile.plan_constraints,
  });
  if (!admitted.ok) throw new Error(`${asset.event_id}: TransitionPlan admission failed: ${JSON.stringify(admitted.diagnostics)}`);

  const generated = {
    artifact_type: "CODAD3GeneratedMotion",
    schema_version: 1,
    source_asset: asset.event_id,
    source_fingerprint: lowered.plan.asset_fingerprint,
    source_ref: instruction.source_ref,
    motion_envelope: envelope.envelope,
    transition_plan: admitted.value,
  };
  const output = resolve(outDir, `${asset.event_id.replaceAll(".", "-")}.json`);
  await writeFile(output, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
}
console.log(`Generated ${eventFiles.length} admitted D3 TransitionPlans from CODA event assets.`);
