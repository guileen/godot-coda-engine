import { access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const ownerGates = [];
const deferredOptionalGates = [
  "coda.ipub.io DNS/TLS/operations before using the optional IPUB entry",
];

function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function list(command, args) {
  const output = run(command, args);
  return output ? output.split("\n") : [];
}

async function exists(relativePath) {
  try {
    await access(resolve(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

const required = [
  "README.md",
  "LICENSE",
  "LICENSE-DOCS.md",
  "TRADEMARKS.md",
  "brand/coda-mark.svg",
  "brand/made-with-coda.svg",
  "docs/en/public-facts.md",
  "docs/zh-CN/public-facts.md",
  "website/en/index.html",
  "website/zh-CN/index.html",
  "i18n/manifest.json",
  "scripts/check-public-surface.mjs",
  "scripts/build-pages.mjs",
];
for (const file of required) {
  if (!(await exists(file))) failures.push(`missing required public file: ${file}`);
}

const tracked = list("git", ["ls-files"]);
const forbidden = /(^|\/)(goal\.md|tasks\.md|handoff\.md|requirements\.md)$|^workspace\/|^research\/|(^|\/)\.godot\/|(^|\/)\.pages\/|\.import$/;
for (const file of tracked) {
  if (forbidden.test(file)) failures.push(`forbidden tracked publication file: ${file}`);
}

try {
  run("git", ["diff", "--cached", "--check"]);
} catch (error) {
  failures.push(`staged diff check failed: ${error.stderr?.trim() || error.message}`);
}

const unstaged = list("git", ["diff", "--name-only"]);
const untracked = list("git", ["ls-files", "--others", "--exclude-standard"]);
if (unstaged.length) failures.push(`unstaged tracked files remain: ${unstaged.join(", ")}`);
if (untracked.length) failures.push(`untracked non-ignored files remain: ${untracked.join(", ")}`);

try {
  run(process.execPath, ["scripts/check-public-surface.mjs"]);
} catch (error) {
  failures.push(`public surface gate failed: ${error.stderr?.trim() || error.message}`);
}

try {
  run(process.execPath, ["scripts/build-pages.mjs"]);
  for (const file of ["brand/coda-mark.svg", "brand/made-with-coda.svg", "i18n/manifest.json", "LICENSE-DOCS.md", "TRADEMARKS.md"]) {
    if (!(await exists(`.pages/${file}`))) failures.push(`Pages artifact is missing: .pages/${file}`);
  }
} catch (error) {
  failures.push(`Pages artifact build failed: ${error.stderr?.trim() || error.message}`);
}

let hasCommit = true;
try {
  run("git", ["rev-parse", "--verify", "HEAD"]);
} catch {
  hasCommit = false;
}

const result = {
  local_ready: failures.length === 0,
  publication_ready: failures.length === 0 && hasCommit && ownerGates.length === 0,
  branch: run("git", ["branch", "--show-current"]),
  staged_file_count: tracked.length,
  has_initial_commit: hasCommit,
  failures,
  pending_owner_gates: ownerGates,
  deferred_optional_gates: deferredOptionalGates,
  pending_after_commit: hasCommit ? [] : ["run npm run verify:clean-clone after the first commit"],
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
