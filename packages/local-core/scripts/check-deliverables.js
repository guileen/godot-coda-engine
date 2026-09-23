import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const failures = [];

async function filesUnder(directory) {
  const results = [];
  for (const name of await readdir(directory)) {
    const path = resolve(directory, name);
    if ((await stat(path)).isDirectory()) results.push(...await filesUnder(path));
    else results.push(path);
  }
  return results;
}

for (const path of await filesUnder(resolve(root, "contracts"))) {
  if (extname(path) !== ".json") continue;
  try { JSON.parse(await readFile(path, "utf8")); } catch (error) { failures.push(`${path}: JSON 无法解析：${error.message}`); }
}

const manifest = JSON.parse(await readFile(resolve(root, "contracts/coda/capabilities.json"), "utf8"));
if (manifest.manifest_type !== "CODA_CapabilityManifest" || manifest.schema_version !== 1) failures.push("CODA capability manifest 必须是 @1。");
const asset = JSON.parse(await readFile(resolve(root, "coda/events/ui.reward.apply.coda.json"), "utf8"));
if (asset.asset_type !== "EventAsset" || asset.schema_version !== 1) failures.push("奖励演示必须是 EventAsset@1。");
if (!asset.root?.length) failures.push("奖励演示必须包含结构化节点树。");
const { assetFingerprint, buildSemanticProjectionMap, createSchemaRegistry, generateGdscript, lowerToExecutionPlan, validateAliasRegistry, validateSemanticProjectionMap } = await import("../src/coda/index.js");
const aliasRegistry = JSON.parse(await readFile(resolve(root, "coda/fixtures/ui.reward.apply.alias-registry.json"), "utf8"));
const semanticMap = JSON.parse(await readFile(resolve(root, "coda/fixtures/ui.reward.apply.semantic-map.json"), "utf8"));
const p3Report = JSON.parse(await readFile(resolve(root, "tests/reports/p3-technical-baseline.json"), "utf8"));
if (!validateAliasRegistry(aliasRegistry).ok) failures.push("奖励演示 AliasRegistry fixture 未通过确定性校验。");
if (!validateSemanticProjectionMap(semanticMap).ok) failures.push("奖励演示 SemanticProjectionMap fixture 未通过确定性校验。");
const regeneratedMap = buildSemanticProjectionMap(asset, manifest, aliasRegistry).map;
if (!regeneratedMap || JSON.stringify(regeneratedMap) !== JSON.stringify(semanticMap)) failures.push("奖励演示 SemanticProjectionMap fixture 与输入不可再生地漂移。");
if (!createSchemaRegistry(manifest).manifest) failures.push("CODA schema registry 未能加载 manifest。");
const generatedBaseline = generateGdscript(lowerToExecutionPlan(asset, createSchemaRegistry(manifest)).plan);
if (p3Report.fixtures?.event_asset?.asset_fingerprint !== assetFingerprint(asset)) failures.push("P3 技术验收报告中的 EventAsset 指纹已过期。");
if (p3Report.fixtures?.semantic_projection?.contract_fingerprint !== semanticMap.contract_fingerprint || p3Report.fixtures?.semantic_projection?.node_count !== semanticMap.nodes.length) failures.push("P3 技术验收报告中的 SPM 指纹或节点数已过期。");
if (p3Report.fixtures?.generated_runner?.plan_fingerprint !== generatedBaseline.source_map.plan_fingerprint) failures.push("P3 技术验收报告中的 ExecutionPlan 指纹已过期。");
for (const [name, status] of Object.entries(p3Report.acceptance ?? {})) if (name !== "external_gate" && status !== "passed") failures.push(`P3 技术验收报告存在未通过项：${name}`);

const markdownFiles = (await filesUnder(root)).filter((path) => extname(path) === ".md");
for (const path of markdownFiles) {
  const markdown = await readFile(path, "utf8");
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
    const target = match[1].replace(/^<(.*)>$/u, "$1");
    if (/^(https?:|mailto:)/.test(target)) continue;
    const resolved = resolve(dirname(path), target);
    try { await stat(resolved); } catch { failures.push(`${path}: 失效本地链接 ${target}`); }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("离线交付物检查通过。");
}
