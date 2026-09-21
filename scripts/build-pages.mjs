import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, ".pages");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "website"), output, { recursive: true });
await cp(resolve(root, "i18n"), resolve(output, "i18n"), { recursive: true });
await cp(resolve(root, "brand"), resolve(output, "brand"), { recursive: true });
await cp(resolve(root, "examples"), resolve(output, "examples"), { recursive: true });
await cp(resolve(root, "LICENSE"), resolve(output, "LICENSE"));
await cp(resolve(root, "LICENSE-DOCS.md"), resolve(output, "LICENSE-DOCS.md"));
await cp(resolve(root, "TRADEMARKS.md"), resolve(output, "TRADEMARKS.md"));

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function href(value) {
  if (/^(?:https?:|mailto:|#)/.test(value)) return value;
  if (value.startsWith("../../examples/")) return value;
  if (value.startsWith("../../")) return `https://github.com/guileen/godot-coda-engine/blob/main/${value.slice(6)}`;
  return value.replace(/\.md(?=$|#)/, ".html");
}

function inline(value) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // `value` is escaped before link parsing, so escaping the captured URL a
    // second time would turn `&amp;` into `&amp;amp;` and break query strings.
    .replace(/\[([^\]]+)\]\(([^ )]+)\)/g, (_, label, url) => `<a href="${href(url)}">${label}</a>`);
}

function cells(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((item) => item.trim());
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim(); const code = []; index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
      index += 1; output.push(`<pre><code class="language-${escapeHtml(language)}">${escapeHtml(code.join("\n"))}</code></pre>`); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { const level = heading[1].length; const id = heading[2].toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""); output.push(`<h${level} id="${escapeHtml(id)}">${inline(heading[2])}</h${level}>`); index += 1; continue; }
    if (line.startsWith("> ")) { output.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); index += 1; continue; }
    if (line.includes("|") && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] ?? "")) {
      const header = cells(line); index += 2; const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) rows.push(cells(lines[index++]));
      output.push(`<div class="doc-table"><table><thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`); continue;
    }
    const list = line.match(/^[-*]\s+(.+)$/); const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (list || ordered) {
      const matcher = ordered ? /^\d+\.\s+(.+)$/ : /^[-*]\s+(.+)$/; const tag = ordered ? "ol" : "ul"; const items = [];
      while (index < lines.length) { const item = lines[index].match(matcher); if (!item) break; items.push(`<li>${inline(item[1])}</li>`); index += 1; }
      output.push(`<${tag}>${items.join("")}</${tag}>`); continue;
    }
    const paragraph = [line.trim()]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s|^```|^> |^[-*]\s+|^\d+\.\s+/.test(lines[index]) && !lines[index].includes("|")) paragraph.push(lines[index++].trim());
    output.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  return output.join("\n");
}

async function buildDocs(locale) {
  const sourceDirectory = resolve(root, "docs", locale);
  const destination = resolve(output, "docs", locale);
  await mkdir(destination, { recursive: true });
  for (const name of await readdir(sourceDirectory)) {
    if (!name.endsWith(".md")) continue;
    const markdown = await readFile(resolve(sourceDirectory, name), "utf8");
    const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? "CODA documentation";
    const otherLocale = locale === "en" ? "zh-CN" : "en";
    const otherLabel = locale === "en" ? "中文" : "English";
    const feedbackLabel = locale === "en" ? "Feedback" : "反馈体验";
    const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${escapeHtml(title)} — Godot CODA Engine"><title>${escapeHtml(title)} — CODA</title><link rel="icon" href="data:,"><link rel="stylesheet" href="../../assets/styles.css"></head><body class="grain"><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="page header-inner"><a class="wordmark" href="../../" aria-label="CODA home"><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span><span>CODA</span></a><nav class="main-nav" aria-label="Documentation"><a href="index.html">Docs</a><a href="../../examples/reward-claim.coda">Example</a><a href="feedback.html">${feedbackLabel}</a></nav><div class="header-actions"><a class="button button--small button--outline" href="../${otherLocale}/${name.replace(/\.md$/, ".html")}">${otherLabel}</a><a class="button button--small button--outline" href="https://github.com/guileen/godot-coda-engine">GitHub</a></div></div></header><main class="page docs-page" id="main"><article>${renderMarkdown(markdown)}</article></main></body></html>`;
    await writeFile(resolve(destination, name.replace(/\.md$/, ".html")), html, "utf8");
    if (name === "README.md") await writeFile(resolve(destination, "index.html"), html, "utf8");
  }
}

await Promise.all([buildDocs("en"), buildDocs("zh-CN")]);

console.log(`Pages artifact prepared at ${output}`);
