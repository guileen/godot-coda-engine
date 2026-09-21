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

const manifest = JSON.parse(await readFile(resolve(root, "contracts/gseos/capabilities.json"), "utf8"));
if (manifest.manifest_type !== "GSEOSCapabilityManifest" || manifest.schema_version !== 1) failures.push("GSEOS capability manifest 必须是 @1。");
const asset = JSON.parse(await readFile(resolve(root, "gseos/events/ui.reward.apply.gse.json"), "utf8"));
if (asset.asset_type !== "EventAsset" || asset.schema_version !== 1) failures.push("奖励演示必须是 EventAsset@1。");
if (!asset.root?.length) failures.push("奖励演示必须包含结构化节点树。");

const markdownFiles = (await filesUnder(root)).filter((path) => extname(path) === ".md");
for (const path of markdownFiles) {
  const markdown = await readFile(path, "utf8");
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
    const target = match[1];
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
