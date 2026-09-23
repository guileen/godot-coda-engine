import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const codaApi = await import("../src/coda/index.js");
const legacyApi = await import("../src/gseos/index.js");

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

test("CODA core module path and retired GSEOS module path expose the same API", () => {
  assert.deepEqual(Object.keys(legacyApi).sort(), Object.keys(codaApi).sort());
});

test("every retired GSEOS module path forwards to its CODA counterpart", async () => {
  const [codaFiles, legacyFiles] = await Promise.all([
    readdir(resolve(root, "packages/local-core/src/coda")),
    readdir(resolve(root, "packages/local-core/src/gseos")),
  ]);
  assert.deepEqual(legacyFiles.sort(), codaFiles.sort());
  for (const name of codaFiles) {
    const shim = await readFile(resolve(root, "packages/local-core/src/gseos", name), "utf8");
    assert.equal(shim, `export * from "../coda/${name}";\n`, name);
  }
});
