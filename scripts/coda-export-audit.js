#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSchemaRegistry, generateGdscript, lowerToExecutionPlan } from "../packages/local-core/src/coda/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asset = JSON.parse(await readFile(resolve(root, "coda/events/ui.reward.apply.coda.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "contracts/coda/capabilities.json"), "utf8"));
const registry = createSchemaRegistry(manifest);
const lowered = lowerToExecutionPlan(asset, registry);
const generated = lowered.plan ? generateGdscript(lowered.plan).source : "";
const forbidden = ["EditorPlugin", "EventAsset", "lexCodaText", "parseCodaText", "chinese_dictionary", "dictionary_registry"];
const violations = forbidden.filter((item) => generated.includes(item));
const declared = manifest.capabilities.map((item) => `${item.id}@${item.version}`);
const result = { ok: lowered.receipt.ok && violations.length === 0, generated_runner: true, declared_capabilities: declared, forbidden_runtime_symbols: violations, runtime_boundary: ["generated runner", "E0 runtime", "declared capability adapters"] };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
