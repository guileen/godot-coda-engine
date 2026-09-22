import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { constants } from "node:fs";

const root = resolve(new URL("..", import.meta.url).pathname);
const tasksPath = resolve(root, "tasks.md");
const tasks = await readFile(tasksPath, "utf8");

async function exists(relative) {
  try {
    await access(resolve(root, relative), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256(relative) {
  try {
    return createHash("sha256").update(await readFile(resolve(root, relative))).digest("hex");
  } catch {
    return null;
  }
}

const demoReports = {
  D1: "d1-semantic-authoring",
  D2: "d2-interruptible-behavior",
  D3: "d3-skeleton-transition-smoke",
  D4: "d4-multifidelity-planning",
  D5: "d5-anytime-safety-boundary",
  D6: "d6-failure-boundary-gallery",
};
const demoReplays = {
  D1: "d1-semantic-authoring",
  D2: "d2-interruptible-behavior",
  D3: "d3-skeleton-transition",
  D4: "d4-multifidelity-planning",
  D5: "d5-anytime-safety-boundary",
  D6: "d6-failure-boundary-gallery",
};
const reportChecks = Object.entries(demoReports).map(([demo_id, id]) => ({
  demo_id,
  id,
  report: `tests/reports/demos/${id}.json`,
  replay: `tests/reports/demos/replays/${demoReplays[demo_id]}.replay.json`,
  report_exists: false,
  replay_exists: false,
}));
for (const check of reportChecks) {
  check.report_exists = await exists(check.report);
  check.replay_exists = await exists(check.replay);
}

// D1–D6 use deliberately different visual filenames; keep the explicit map in the audit.
const visualFiles = {
  D1: "d1.png", D2: "d2-interrupted.png", D3: "d3-interrupted.png",
  D4: "d4.png", D5: "d5.png", D6: "d6.png",
};
const visualChecks = Object.entries(visualFiles).map(([id, file]) => ({ id, file, exists: false }));
for (const check of visualChecks) {
  check.path = `tests/reports/demos/visual/${check.file}`;
  check.exists = await exists(check.path);
  check.sha256 = await sha256(check.path);
}
const distinctVisualHashes = new Set(visualChecks.map((item) => item.sha256).filter(Boolean));
const d3StateHashes = await Promise.all(["d3-idle.png", "d3-interrupted.png", "d3-defense.png"].map(async (file) => ({ file, sha256: await sha256(`tests/reports/demos/visual/${file}`) })));
const visualDistinction = {
  demo_visual_hashes_unique: distinctVisualHashes.size === visualChecks.length,
  d3_state_hashes: d3StateHashes,
  d3_states_distinct: new Set(d3StateHashes.map((item) => item.sha256).filter(Boolean)).size === d3StateHashes.filter((item) => item.sha256).length,
};

const requiredFiles = [
  "docs/demos/README.md",
  "docs/demos/demo-acceptance-spec.md",
  "docs/demos/asset-register.md",
  "docs/c1-owner-input-packet.md",
  "docs/coda-embodied-language-runtime-boundary.md",
  "gseos/fixtures/c1t/continuation-viability.json",
  "gseos/fixtures/c1t/resource-registry.json",
  "gseos/fixtures/c1t/shared-contract-pack.json",
  "contracts/c1t/snapshot-bundle.schema.json",
  "contracts/c1t/transition-plan.schema.json",
  "contracts/c1t/hook-manifest.schema.json",
  "packages/local-core/src/gseos/replay-reference.js",
  "tests/reports/c1p-reference-benchmark.json",
  "packages/local-core/src/gseos/continuation-viability.js",
  "packages/local-core/src/gseos/temporal-admission.js",
  "demos/launcher/index.html",
  "demos/d3-skeleton-transition/scripts/d3_skeleton_transition.gd",
  "demos/d3-skeleton-transition/scripts/d3_expression_adapter.gd",
  "tests/reports/demos/d3-skeleton-transition-smoke.json",
  "tests/reports/c1t-cross-domain-abstraction.json",
  "tests/reports/demos/replays/README.md",
];
const requiredFileChecks = await Promise.all(requiredFiles.map(async (file) => ({ file, exists: await exists(file) })));

const markdownLinks = [...tasks.matchAll(/\]\(([^)]+)\)/g)]
  .map((match) => match[1].trim())
  .filter((target) => !target.startsWith("http://") && !target.startsWith("https://") && !target.startsWith("#"))
  .map((target) => target.replace(/^<|>$/g, "").split("#", 1)[0])
  .filter(Boolean);
const uniqueLinks = [...new Set(markdownLinks)];
const linkChecks = await Promise.all(uniqueLinks.map(async (target) => ({ target, exists: await exists(target) })));

const externalGates = [
  { id: "G-C1-L", reason: "complete GUI AST transaction integration, typed embodied IR coverage, and cross-embodiment falsification evidence" },
  { id: "G-C1-T-A", reason: "owner-selected Skeleton fixture thresholds and runtime authorization" },
  { id: "G-C1-T-N", reason: "pre-registered human perception comparison" },
  { id: "G-C1-P-B", reason: "target-device wall/p95/p99 and contact-model calibration" },
  { id: "G-C1-P-D", reason: "real latent data/model and Skeleton contact error" },
  { id: "G-C1-P-E", reason: "observed value frontier on an authorized profile" },
  { id: "G-P3-U", reason: "three external users, two independently completing the task" },
];

const localEvidencePass = reportChecks.every((item) => item.report_exists && item.replay_exists)
  && requiredFileChecks.every((item) => item.exists)
  && visualChecks.every((item) => item.exists)
  && visualDistinction.demo_visual_hashes_unique
  && visualDistinction.d3_states_distinct
  && linkChecks.every((item) => item.exists);
const pendingTaskLines = (tasks.match(/^\| \[ \].*$/gm) ?? []).length;
const report = {
  report_type: "CODA_TasksMdAudit",
  schema_version: 1,
  source: "tasks.md",
  status: localEvidencePass ? "LOCAL_INDEX_AND_EVIDENCE_PASS_EXTERNAL_GATES_PENDING" : "LOCAL_INDEX_INCOMPLETE",
  local_evidence: { demo_reports_and_replays: reportChecks, visual_files: visualChecks, visual_distinction: visualDistinction, required_files: requiredFileChecks, tasks_md_links: linkChecks },
  pending_unchecked_task_rows: pendingTaskLines,
  external_gates: externalGates,
  interpretation: "This audit verifies the index and locally available evidence only. It never upgrades an external, perception, calibration, hardware, or owner-decision gate.",
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
