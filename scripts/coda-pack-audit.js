#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const zipPath = resolve(process.argv[2] ?? "/tmp/coda-runtime.zip");

if (!existsSync(zipPath)) {
  console.log(JSON.stringify({ ok: false, code: "PACK_MISSING", zip: zipPath }, null, 2));
  process.exit(1);
}

const entries = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .sort();
const allowed = (entry) => entry === "project.godot"
  || entry === "project.binary"
  || entry.startsWith(".godot/")
  || entry.startsWith("coda/generated/")
  || entry.startsWith("addons/coda/runtime/");
const required = [
  "project.godot",
  "coda/generated/ui_reward_apply.gdc",
  "coda/generated/ui_reward_apply.gd.map.json",
  "addons/coda/runtime/event_registry.gdc",
  "addons/coda/runtime/generated_runtime_facade.gdc",
  "addons/coda/runtime/main.gdc",
  "addons/coda/runtime/main.tscn.remap",
  "addons/coda/runtime/reward_capabilities.gdc",
  "addons/coda/runtime/reward_event_runner.gdc",
];
const forbiddenEntries = entries.filter((entry) => !allowed(entry));
const missing = required.filter((entry) => !entries.includes(entry));
const forbiddenSymbols = ["EditorPlugin", "EventAsset", "lexGse", "parseGse", "chinese_dictionary", "dictionary_registry"];
const result = {
  ok: forbiddenEntries.length === 0 && missing.length === 0,
  zip: zipPath,
  project_root: root,
  entry_count: entries.length,
  required_missing: missing,
  forbidden_entries: forbiddenEntries,
  forbidden_runtime_symbols: forbiddenSymbols.filter((symbol) => entries.some((entry) => entry.includes(symbol))),
  included_prefixes: ["coda/generated/", "addons/coda/runtime/"],
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
