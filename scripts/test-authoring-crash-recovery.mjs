import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const godot = process.env.GODOT_BIN ?? "godot";
const childScript = "res://tests/integration/authoring_crash_child.gd";
const tempRoot = mkdtempSync(join(tmpdir(), "coda-authoring-crash-"));

function runGodot(mode, caseName, extra = [], env = process.env) {
  const result = spawnSync(godot, ["--headless", "--path", root, "--script", childScript, "--", mode, caseName, ...extra], {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 30000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${mode} ${caseName} failed:\n${result.stdout}\n${result.stderr}`);
  return `${result.stdout}\n${result.stderr}`;
}

async function waitForMarker(child, markerPath, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const marker = readFileSync(markerPath, "utf8");
      if (marker) return marker;
    } catch {}
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`writer exited before crash marker (code=${child.exitCode}, signal=${child.signalCode})`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error(`timed out waiting for ${markerPath}`);
}

try {
  const cases = [
    { point: "journal_installed", expected: "old" },
    { point: "first_target_installed", expected: "old" },
    { point: "commit_marker_installed", expected: "new" },
  ];
  for (const { point, expected } of cases) {
    const caseName = `authoring-crash-${point}`;
    const markerPath = join(tempRoot, `${point}.ready`);
    runGodot("seed", caseName);
    const child = spawn(godot, ["--headless", "--path", root, "--script", childScript, "--", "update", caseName, "--enable-authoring-crash-injection"], {
      cwd: root,
      env: { ...process.env, GSEOS_TEST_CRASH_AT: point, GSEOS_TEST_CRASH_MARKER: markerPath },
      stdio: "ignore",
    });
    try {
      assert.equal(await waitForMarker(child, markerPath), point);
      child.kill("SIGKILL");
      const exit = await new Promise((resolvePromise, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolvePromise({ code, signal }));
      });
      assert.equal(exit.signal, "SIGKILL", `writer did not receive SIGKILL at ${point}`);
    } catch (error) {
      child.kill("SIGKILL");
      throw error;
    }
    const recoveryOutput = runGodot("recover", caseName, [expected]);
    assert.match(recoveryOutput, new RegExp(`authoring crash recovery passed: ${caseName}`));
  }
  console.log("authoring file-set subprocess kill-point recovery passed (prepared rollback, partial replacement rollback, committed forward recovery)");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
