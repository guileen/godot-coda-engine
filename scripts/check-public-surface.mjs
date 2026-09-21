import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const warnings = [];

async function exists(relativePath) {
  try {
    await access(resolve(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

const required = [
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "LICENSE-DOCS.md",
  "TRADEMARKS.md",
  "brand/README.md",
  "brand/coda-mark.svg",
  "brand/made-with-coda.svg",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  "website/index.html",
  "website/assets/styles.css",
  "website/assets/app.js",
  "website/404.html",
  "website/en/index.html",
  "website/en/404.html",
  "website/zh-CN/index.html",
  "website/zh-CN/404.html",
  "website/robots.txt",
  "website/og-card.svg",
  "docs/README.md",
  "docs/en/README.md",
  "docs/en/5-minutes-coda.md",
  "docs/en/first-game-flow.md",
  "docs/en/language.md",
  "docs/en/feedback.md",
  "docs/en/public-facts.md",
  "docs/zh-CN/README.md",
  "docs/zh-CN/5-minutes-coda.md",
  "docs/zh-CN/first-game-flow.md",
  "docs/zh-CN/language.md",
  "docs/zh-CN/feedback.md",
  "examples/reward-claim.coda",
  ".github/ISSUE_TEMPLATE/feedback.md",
  "skills/coda-gameplay-flow/SKILL.md",
  "docs/zh-CN/public-facts.md",
  "i18n/README.md",
  "i18n/manifest.json",
  "i18n/en/site.json",
  "i18n/zh-CN/site.json",
  "scripts/build-pages.mjs",
  "scripts/audit-publication.mjs",
  "scripts/verify-clean-clone.mjs",
  "package.json",
];

for (const relativePath of required) {
  if (!(await exists(relativePath))) failures.push(`missing public file: ${relativePath}`);
}

const localizedDocs = [
  "quick-start.md",
  "concepts.md",
  "scope-and-troubleshooting.md",
  "public-facts.md",
  "compatibility.md",
  "release-policy.md",
  "contributing.md",
  "security.md",
  "code-of-conduct.md",
  "changelog.md",
];
const publicFiles = [
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "LICENSE-DOCS.md",
  "TRADEMARKS.md",
  "brand/README.md",
  "brand/coda-mark.svg",
  "brand/made-with-coda.svg",
  "package.json",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "docs/README.md",
  "docs/en/README.md",
  "docs/zh-CN/README.md",
  "docs/en/5-minutes-coda.md",
  "docs/en/first-game-flow.md",
  "docs/en/language.md",
  "docs/en/feedback.md",
  "docs/zh-CN/5-minutes-coda.md",
  "docs/zh-CN/first-game-flow.md",
  "docs/zh-CN/language.md",
  "docs/zh-CN/feedback.md",
  "examples/reward-claim.coda",
  ".github/ISSUE_TEMPLATE/feedback.md",
  "skills/coda-gameplay-flow/SKILL.md",
  "website/index.html",
  "website/assets/styles.css",
  "website/assets/app.js",
  "website/404.html",
  "website/en/index.html",
  "website/en/404.html",
  "website/zh-CN/index.html",
  "website/zh-CN/404.html",
  "i18n/README.md",
  "i18n/manifest.json",
  "i18n/en/site.json",
  "i18n/zh-CN/site.json",
  ...localizedDocs.flatMap((name) => [`docs/en/${name}`, `docs/zh-CN/${name}`]),
];
const combined = (await Promise.all(publicFiles.map(read))).join("\n");
for (const banned of ["Godot Chinese Coding", "godot-chinese-coding.dev", "@godot-chinese-coding", "100% coverage", "zero performance overhead", "complete runtime topology visualization"]) {
  if (combined.toLowerCase().includes(banned.toLowerCase())) failures.push(`unsupported or stale public claim/identifier: ${banned}`);
}

for (const marker of ["MIT License", "CC BY 4.0", "Made with CODA", "not a condition of the software license"]) {
  if (!combined.toLowerCase().includes(marker.toLowerCase())) failures.push(`missing public licensing or brand marker: ${marker}`);
}

const landing = await read("website/index.html");
const website = await Promise.all(["website/en/index.html", "website/zh-CN/index.html", "website/assets/styles.css", "website/assets/app.js"].map(read));
const websiteCombined = website.join("\n");
for (const marker of ["og:image", "twitter:card", "meta name=\"description\"", "data-theme-toggle", "data-copy", "prefers-reduced-motion", "../../i18n/"]) {
  if (!(landing + websiteCombined).includes(marker)) warnings.push(`public surface marker not found: ${marker}`);
}
for (const marker of ["feedback.html", "issues/new?template=feedback.md", "Product feedback"]) {
  if (!(landing + websiteCombined + combined).includes(marker)) failures.push(`feedback channel marker not found: ${marker}`);
}

for (const name of localizedDocs) {
  const english = await read(`docs/en/${name}`);
  const chinese = await read(`docs/zh-CN/${name}`);
  if (!/[A-Za-z]/.test(english)) failures.push(`English document has no English text: docs/en/${name}`);
  if (!/[\u3400-\u9fff]/.test(chinese)) failures.push(`Chinese document has no Chinese text: docs/zh-CN/${name}`);
}

try {
  const manifest = JSON.parse(await read("i18n/manifest.json"));
  for (const locale of manifest.locales || []) {
    for (const path of [locale.docsPath, locale.websitePath, `i18n/${locale.id}/site.json`]) {
      if (!(await exists(path))) failures.push(`locale manifest points to missing path: ${path}`);
    }
  }
} catch {
  failures.push("i18n/manifest.json is not valid JSON");
}

if (!(await exists("LICENSE")) && !(await exists("LICENSE.md"))) {
  failures.push("missing LICENSE: choose and add the project owner's approved license before public release");
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, warnings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, warnings }, null, 2));
}
