import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, ".pages");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "website"), output, { recursive: true });
await cp(resolve(root, "i18n"), resolve(output, "i18n"), { recursive: true });
await cp(resolve(root, "brand"), resolve(output, "brand"), { recursive: true });
await cp(resolve(root, "LICENSE"), resolve(output, "LICENSE"));
await cp(resolve(root, "LICENSE-DOCS.md"), resolve(output, "LICENSE-DOCS.md"));
await cp(resolve(root, "TRADEMARKS.md"), resolve(output, "TRADEMARKS.md"));

console.log(`Pages artifact prepared at ${output}`);
