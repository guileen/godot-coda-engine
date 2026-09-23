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

const launcherDataPath = "demos/launcher/demo-data.js";
const launcherDataCheck = { file: launcherDataPath, exists: false, parses: false, matches_reports: false, mismatches: [] };
try {
  const source = await readFile(resolve(root, launcherDataPath), "utf8");
  launcherDataCheck.exists = true;
  const prefix = "window.CODA_DEMO_REPORTS = ";
  if (!source.startsWith(prefix)) throw new Error("unexpected launcher data format");
  const actual = JSON.parse(source.slice(prefix.length).trim().replace(/;$/, ""));
  launcherDataCheck.parses = true;
  for (const [demo_id, report_id] of Object.entries(demoReports)) {
    const expected = JSON.parse(await readFile(resolve(root, `tests/reports/demos/${report_id}.json`), "utf8"));
    if (JSON.stringify(actual[demo_id]) !== JSON.stringify(expected)) launcherDataCheck.mismatches.push(demo_id);
  }
  launcherDataCheck.matches_reports = launcherDataCheck.mismatches.length === 0 && Object.keys(actual).length === Object.keys(demoReports).length;
} catch (error) {
  launcherDataCheck.error = error.message;
}

const launcherVisualCheck = { directory: "tests/reports/demos/launcher-visual", passes: false, cases: [], errors: [] };
try {
  const base = launcherVisualCheck.directory;
  const report = JSON.parse(await readFile(resolve(root, `${base}/capture-report.json`), "utf8"));
  const pageModel = JSON.parse(await readFile(resolve(root, `${base}/page_model.json`), "utf8"));
  launcherVisualCheck.report_type = report.report_type;
  launcherVisualCheck.verdict = report.verdict;
  launcherVisualCheck.source_fingerprints = report.source_fingerprints ?? [];
  launcherVisualCheck.single_sided_diagnostic = report.evidence_role === "diagnostic"
    && report.verdict === "PARTIAL"
    && pageModel.comparison_contract?.type === "single-sided diagnostic; no approved reference";
  if (!launcherVisualCheck.single_sided_diagnostic) launcherVisualCheck.errors.push("visual evidence must remain explicitly diagnostic without an approved reference");
  for (const source of report.source_fingerprints ?? []) {
    if (await sha256(source.file) !== source.sha256) launcherVisualCheck.errors.push(`${source.file} changed after visual capture`);
  }
  if (!report.source_fingerprints?.some((source) => source.file === "demos/launcher/index.html")
    || !report.source_fingerprints?.some((source) => source.file === "demos/launcher/demo-data.js")) {
    launcherVisualCheck.errors.push("capture is not bound to the current launcher and report manifest");
  }
  if (report.environment?.errors?.length) launcherVisualCheck.errors.push("browser errors are recorded");
  const expectedCases = [
    { name: "mobile-390", width: 390, height: 844, columns: 1 },
    { name: "tablet-768", width: 768, height: 1024, columns: 2 },
    { name: "desktop-1440", width: 1440, height: 1000, columns: 3 },
  ];
  const reportedCases = new Map((report.captures ?? []).map((item) => [item.case_id, item]));
  if (reportedCases.size !== expectedCases.length) launcherVisualCheck.errors.push("expected exactly three viewport cases");
  for (const expected of expectedCases) {
    const id = `launcher-${expected.name}`;
    const item = reportedCases.get(id);
    const check = { case_id: id, viewport_css: { width: expected.width, height: expected.height }, screenshot_valid: false, state_valid: false, computed_style_valid: false };
    if (!item) {
      launcherVisualCheck.cases.push(check);
      launcherVisualCheck.errors.push(`${id} is missing`);
      continue;
    }
    const screenshotPath = `${base}/${expected.name}.png`;
    const statePath = `${base}/${expected.name}.state.json`;
    const stylePath = `${base}/${expected.name}.computed-style.json`;
    const png = await readFile(resolve(root, screenshotPath)).catch(() => null);
    const state = JSON.parse(await readFile(resolve(root, statePath), "utf8").catch(() => "{}"));
    const computed = JSON.parse(await readFile(resolve(root, stylePath), "utf8").catch(() => "{}"));
    const pngWidth = png?.readUInt32BE(16);
    const pngHeight = png?.readUInt32BE(20);
    check.screenshot_valid = Boolean(png && png.toString("hex", 0, 8) === "89504e470d0a1a0a"
      && pngWidth === expected.width
      && pngHeight === item.screenshot_pixels?.height
      && createHash("sha256").update(png).digest("hex") === item.sha256);
    check.state_valid = state.evidence_role === "diagnostic"
      && state.viewport_css?.width === expected.width
      && state.viewport_css?.height === expected.height
      && state.grid_columns === expected.columns
      && state.horizontal_overflow === false
      && state.interaction_checks?.length === 6
      && item.interaction_check_count === 6;
    check.computed_style_valid = computed.viewport_observed?.innerWidth === expected.width
      && computed.viewport_observed?.innerHeight === expected.height
      && Array.isArray(computed.elements)
      && ["main", ".grid", ".zones", ".zone.scene", ".card", "#scene-copy", "#decision", "#evidence"].every((selector) => computed.elements.some((element) => element.selector === selector));
    launcherVisualCheck.cases.push(check);
    if (!check.screenshot_valid) launcherVisualCheck.errors.push(`${id} screenshot dimensions or digest mismatch`);
    if (!check.state_valid) launcherVisualCheck.errors.push(`${id} state/interaction evidence is incomplete`);
    if (!check.computed_style_valid) launcherVisualCheck.errors.push(`${id} computed-style evidence is incomplete`);
  }
  launcherVisualCheck.passes = launcherVisualCheck.errors.length === 0
    && launcherVisualCheck.cases.length === expectedCases.length
    && report.status === "PASS_DOM_INTERACTION_AND_THREE_VIEWPORT_CAPTURE; VISUAL_REFERENCE_COMPARISON_PENDING";
} catch (error) {
  launcherVisualCheck.errors.push(error.message);
}

// Only D2/D3 contain actual demo captures. The other legacy PNGs are launcher previews.
const visualFiles = {
  D2: ["d2-idle.png", "d2-interrupted.png"],
  D3: ["d3-idle.png", "d3-interrupted.png", "d3-defense.png"],
};
const visualChecks = Object.entries(visualFiles).flatMap(([id, files]) => files.map((file) => ({ id, file, exists: false })));
for (const check of visualChecks) {
  check.path = `tests/reports/demos/visual/${check.file}`;
  check.exists = await exists(check.path);
  check.sha256 = await sha256(check.path);
}
const distinctVisualHashes = new Set(visualChecks.map((item) => item.sha256).filter(Boolean));
const d3StateHashes = await Promise.all(["d3-idle.png", "d3-interrupted.png", "d3-defense.png"].map(async (file) => ({ file, sha256: await sha256(`tests/reports/demos/visual/${file}`) })));
const visualDistinction = {
  captured_demo_states_have_unique_hashes: distinctVisualHashes.size === visualChecks.length,
  legacy_launcher_previews_excluded: ["d1.png", "d4.png", "d5.png", "d6.png"].every((file) => !visualChecks.some((item) => item.file === file)),
  d3_state_hashes: d3StateHashes,
  d3_states_distinct: new Set(d3StateHashes.map((item) => item.sha256).filter(Boolean)).size === d3StateHashes.filter((item) => item.sha256).length,
};

const requiredFiles = [
  "docs/demos/README.md",
  "docs/demos/demo-acceptance-spec.md",
  "docs/demos/asset-register.md",
  "docs/c1-owner-input-packet.md",
  "docs/coda-embodied-language-runtime-boundary.md",
  "coda/fixtures/c1t/continuation-viability.json",
  "coda/fixtures/c1t/resource-registry.json",
  "coda/fixtures/c1t/shared-contract-pack.json",
  "contracts/c1t/snapshot-bundle.schema.json",
  "contracts/c1t/transition-plan.schema.json",
  "contracts/c1t/hook-manifest.schema.json",
  "packages/local-core/src/coda/replay-reference.js",
  "tests/reports/c1p-reference-benchmark.json",
  "packages/local-core/src/coda/continuation-viability.js",
  "packages/local-core/src/coda/temporal-admission.js",
  "packages/local-core/src/coda/embodiment-conformance.js",
  "demos/launcher/index.html",
  "demos/launcher/demo-data.js",
  "demos/launcher/README.md",
  "tests/reports/demos/launcher-visual/capture-report.json",
  "tests/reports/demos/launcher-visual/page_model.json",
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
  && launcherDataCheck.exists && launcherDataCheck.parses && launcherDataCheck.matches_reports
  && launcherVisualCheck.passes
  && requiredFileChecks.every((item) => item.exists)
  && visualChecks.every((item) => item.exists)
  && visualDistinction.captured_demo_states_have_unique_hashes
  && visualDistinction.legacy_launcher_previews_excluded
  && visualDistinction.d3_states_distinct
  && linkChecks.every((item) => item.exists);
const pendingTaskLines = (tasks.match(/^\| \[ \].*$/gm) ?? []).length;
const report = {
  report_type: "CODA_TasksMdAudit",
  schema_version: 1,
  source: "tasks.md",
  status: localEvidencePass ? "LOCAL_INDEX_AND_EVIDENCE_PASS_EXTERNAL_GATES_PENDING" : "LOCAL_INDEX_INCOMPLETE",
  local_evidence: { demo_reports_and_replays: reportChecks, launcher_data: launcherDataCheck, launcher_visual_evidence: launcherVisualCheck, visual_files: visualChecks, visual_distinction: visualDistinction, required_files: requiredFileChecks, tasks_md_links: linkChecks },
  pending_unchecked_task_rows: pendingTaskLines,
  external_gates: externalGates,
  interpretation: "This audit verifies the index and locally available evidence only. It never upgrades an external, perception, calibration, hardware, or owner-decision gate.",
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
