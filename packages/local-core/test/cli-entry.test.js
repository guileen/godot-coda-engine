import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");

test("CODA CLI entry and retired GSEOS entry preserve the same manifest contract", () => {
  const run = (entry) => spawnSync(process.execPath, [resolve(root, entry), "manifest"], {
    cwd: root,
    encoding: "utf8",
  });
  const coda = run("packages/local-core/src/coda-cli.js");
  const legacy = run("packages/local-core/src/gseos-cli.js");

  assert.equal(coda.status, 0, coda.stderr);
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.deepEqual(JSON.parse(legacy.stdout), JSON.parse(coda.stdout));
});
