#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { summarizeUserObservationReport, validateUserObservationReport } from "../packages/local-core/src/gseos/index.js";

const target = process.argv[2];
if (!target) {
  console.error(JSON.stringify({ ok: false, diagnostics: [{ code: "OBSERVATION_REPORT_REQUIRED", message: "用法：node scripts/validate-p3-user-observation.mjs <report.json>" }] }, null, 2));
  process.exitCode = 64;
} else {
  const report = JSON.parse(await readFile(resolve(target), "utf8"));
  const receipt = validateUserObservationReport(report);
  console.log(JSON.stringify({ ...receipt, summary: summarizeUserObservationReport(report) }, null, 2));
  if (!receipt.ok) process.exitCode = 1;
}
