import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const fixture = "gseos/events/ui.reward.apply.gse.json";

function run(command, args) {
  try {
    execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim().split("\n").slice(-12).join("\n");
    failures.push(`${command} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
    return false;
  }
}

function output(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

try {
  output("git", ["rev-parse", "--verify", "HEAD"]);
} catch {
  failures.push("clean-clone verification requires an initial commit");
}

if (!failures.length && output("git", ["status", "--porcelain"])) {
  failures.push("clone is not clean before verification");
}

if (!failures.length) {
  const commands = [
    ["npm", ["ci", "--ignore-scripts"]],
    ["npm", ["test"]],
    ["npm", ["run", "check"]],
    ["npm", ["run", "check:public"]],
    ["npm", ["run", "coda", "--", "manifest"]],
    ["npm", ["run", "coda", "--", "validate", fixture]],
    ["npm", ["run", "coda", "--", "generate", fixture]],
    ["godot", ["--headless", "--path", ".", "--editor", "--quit"]],
  ];
  for (const [command, args] of commands) {
    if (!run(command, args)) break;
  }
}

if (!failures.length && output("git", ["status", "--porcelain"])) {
  failures.push("verification created tracked or unignored changes");
}

const result = {
  ok: failures.length === 0,
  repository: output("git", ["remote", "get-url", "origin"]),
  branch: output("git", ["branch", "--show-current"]),
  fixture,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
