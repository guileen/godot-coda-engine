#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSemanticProjectionMap, createSchemaRegistry, generateGdscript, lowerToExecutionPlan, parseGse, roundTripEventAsset, validateCapabilityManifest, validateEventAsset, verifyManagedArtifact } from "./gseos/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = resolve(root, "contracts/gseos/capabilities.json");
const output = (value) => console.log(JSON.stringify(value, null, 2));
const load = async (path) => JSON.parse(await readFile(resolve(path), "utf8"));
const manifest = await load(manifestPath);
const registry = createSchemaRegistry(manifest);
const [command, ...args] = process.argv.slice(2);

async function generateAsset(asset, targetArgument) {
  const checked = lowerToExecutionPlan(asset, registry);
  if (!checked.receipt.ok) {
    output(checked);
    process.exitCode = 1;
    return;
  }
  const generated = generateGdscript(checked.plan);
  const target = resolve(targetArgument ?? `.gseos/generated/${asset.event_id.replaceAll(".", "_")}.gd`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, generated.source, "utf8");
  await writeFile(`${target}.map.json`, `${JSON.stringify(generated.source_map, null, 2)}\n`, "utf8");
  const generatedRoot = resolve(root, ".gseos/generated");
  const relativeTarget = target.startsWith(`${generatedRoot}/`) ? target.slice(`${generatedRoot}/`.length) : null;
  if (relativeTarget) {
    const stagingTarget = resolve(root, "gseos/generated", relativeTarget);
    await mkdir(dirname(stagingTarget), { recursive: true });
    await writeFile(stagingTarget, generated.source, "utf8");
    await writeFile(`${stagingTarget}.map.json`, `${JSON.stringify(generated.source_map, null, 2)}\n`, "utf8");
  }
  output({ receipt: checked.receipt, plan: checked.plan, generated: { path: target, staging_path: relativeTarget ? `gseos/generated/${relativeTarget}` : null, fingerprint: generated.fingerprint } });
}

try {
  if (command === "validate") {
    const result = validateEventAsset(await load(args[0]), { capabilities: manifest.capabilities }); output(result); if (!result.ok) process.exitCode = 1;
  } else if (command === "parse") {
    const parsed = parseGse(await readFile(resolve(args[0]), "utf8")); output(parsed); if (!parsed.receipt.ok) process.exitCode = 1;
  } else if (command === "parse-check" || command === "text-check") {
    const parsed = parseGse(await readFile(resolve(args[0]), "utf8"));
    if (!parsed.asset || !parsed.receipt.ok) { output(parsed); process.exitCode = 1; }
    else {
      const checked = lowerToExecutionPlan(parsed.asset, registry);
      output({ ...parsed, receipt: { ok: parsed.receipt.ok && checked.receipt.ok, diagnostics: [...parsed.receipt.diagnostics, ...checked.receipt.diagnostics] }, plan: checked.plan });
      if (!checked.receipt.ok) process.exitCode = 1;
    }
  } else if (command === "format") {
    const source = await readFile(resolve(args[0]), "utf8"); const parsed = parseGse(source); if (!parsed.receipt.ok) { output(parsed); process.exitCode = 1; } else { const { formatGse } = await import("./gseos/index.js"); process.stdout.write(formatGse(parsed.asset, args[1] ?? "preserve")); }
  } else if (command === "generate") {
    await generateAsset(await load(args[0]), args[1]);
  } else if (command === "text-generate") {
    const parsed = parseGse(await readFile(resolve(args[0]), "utf8"));
    if (!parsed.asset || !parsed.receipt.ok) { output(parsed); process.exitCode = 1; }
    else await generateAsset(parsed.asset, args[1]);
  } else if (command === "manifest") { const result = validateCapabilityManifest(manifest); output(result); if (!result.ok) process.exitCode = 1; }
  else if (command === "project") {
    const asset = await load(args[0]);
    const aliasPath = args[1] ?? "gseos/fixtures/ui.reward.apply.alias-registry.json";
    const aliasRegistry = await load(aliasPath);
    let sourceMap = args[2] && args[2] !== "none" ? await load(args[2]) : null;
    if (!args[2] && !sourceMap) {
      try { sourceMap = await load(resolve(root, `.gseos/generated/${asset.event_id.replaceAll(".", "_")}.gd.map.json`)); } catch { sourceMap = null; }
    }
    const result = buildSemanticProjectionMap(asset, manifest, aliasRegistry, { sourceMap });
    output(result);
    if (!result.receipt.ok) process.exitCode = 1;
  }
  else throw new Error("用法：coda <validate|parse|parse-check|text-check|format|generate|text-generate|manifest|project> <path> [mode/output]");
} catch (error) { output({ ok: false, diagnostics: [{ code: "GSEOS_CLI_ERROR", message: error.message, path: "/" }] }); process.exitCode = 64; }
