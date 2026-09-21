# Godot CODA Engine

[![CI](https://github.com/guileen/godot-coda-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/guileen/godot-coda-engine/actions/workflows/ci.yml)

**Godot CODA Engine (CODA): a structured game-logic engine for Godot.**

[English documentation](docs/en/README.md) · [中文文档](docs/zh-CN/README.md) · [Language architecture / 语言架构](i18n/README.md) · [Brand assets / 品牌资源](brand/README.md)

Every game event deserves a clear ending.

Godot CODA Engine models gameplay flows as structured events, generates traceable GDScript, and keeps managed waits, cancellation, and ownership explicit. CODA is the short name. It is an authoring and generation layer for Godot—not a replacement for Godot or ordinary GDScript.

> Godot CODA Engine is the project name selected for this repository; CODA is its short name. The technical implementation is the GSEOS E0 toolchain.

## What is here

- A versioned `EventAsset@1` format with stable event and node IDs.
- An `EventAsset → ExecutionPlan → GDScript` generation pipeline with source maps and deterministic fingerprints.
- Versioned capability and topic contracts for the runtime boundary.
- An E0 runtime with `RunHandle`, `WaitRegistration`, cancellation, timeout, owner invalidation, and late-callback cleanup.
- English, Chinese, and mixed-language import surfaces for the same structured asset; public prose is organized by locale.
- A Godot EditorPlugin with an event tree preview and asset transactions.
- A real reward UI fixture covering read, calculate, await animation, remove/create UI, set text, and publish.

## Five-minute verification

Requirements:

- Node.js 20 or newer.
- Godot 4.7.2 for the integration and editor checks. Godot 4.7.2 is the version used for the checked-in evidence.

From the repository root:

```sh
npm test
npm run check
npm run gseos -- manifest
npm run gseos -- validate gseos/events/ui.reward.apply.gse.json
npm run gseos -- generate gseos/events/ui.reward.apply.gse.json
godot --headless --path . --editor --quit
```

The generated runner is written to `.gseos/generated/`. The directory is tool-owned and ignored by Git. A generated file that was edited by hand is rejected rather than silently overwritten.

For the full local suite, including Godot headless integration and the runtime export audit, run:

```sh
npm run test:all
```

After the first commit exists, a fresh checkout can run `npm run verify:clean-clone` to repeat the README command, link, public-surface, and fixture checks from a clean repository state.

## The example

The checked-in fixture is [`ui.reward.apply.gse.json`](gseos/events/ui.reward.apply.gse.json). Its generated runner contains the following real steps:

```gdscript
if (ctx.get_value("reward") > 0):
  ctx.set_value("old_score", await runtime.read("read@1", {"field":"score", "target":ctx.get_value("target_hud")}))
  ctx.set_value("new_score", (ctx.get_value("old_score") + ctx.get_value("reward")))
  await runtime.await_capability("ui.animate_number@1", {"from":ctx.get_value("old_score"), "to":ctx.get_value("new_score")})
  runtime.call_sync("ui.remove_node@1", {"target":ctx.get_value("old_row")})
  runtime.call_sync("ui.create_reward_row@1", {"owner":ctx.get_value("target_hud"), "value":ctx.get_value("new_score")})
  runtime.publish("combat.hit_resolved@1", {"damage":ctx.get_value("reward"), "score":ctx.get_value("new_score")})
```

The generated file is an output, not a second source of truth. The source map points each generated step back to its event node and field.

## Boundaries

The current release scope is E0. It does not include `spawn/join`, `try/catch/finally`, E1/E2, long-lived text source files, LSP, arbitrary Godot reflection, or a runtime interpreter for Chinese/English text or EventAssets. Complex or unsupported logic remains ordinary GDScript or a declared, bounded `escape` node.

See [the English quick start](docs/en/quick-start.md), [English core concepts](docs/en/concepts.md), [English public facts and evidence](docs/en/public-facts.md), and [English scope and troubleshooting](docs/en/scope-and-troubleshooting.md) for the intended workflow, evidence, and failure modes. Chinese readers can use the matching guides in [`docs/zh-CN/`](docs/zh-CN/README.md), including the [中文公开事实与证据](docs/zh-CN/public-facts.md) page.

## 中文入口

Godot CODA Engine（简称 CODA）是面向 Godot 的游戏逻辑引擎：将游戏流程建模为结构化事件，生成可追踪的 GDScript，并明确管理等待、取消和所有权。项目至少支持 English / 简体中文；长文档按语言分别维护在 `docs/en/` 和 `docs/zh-CN/`，官网页面分别位于 `website/en/` 和 `website/zh-CN/`，共享界面文案位于 `i18n/`。

中文用户可从[中文快速开始](docs/zh-CN/quick-start.md)、[中文核心概念](docs/zh-CN/concepts.md)和[中文范围与排障](docs/zh-CN/scope-and-troubleshooting.md)开始。

## Repository layout

- `addons/gseos/` — Godot EditorPlugin and E0 runtime ABI.
- `contracts/gseos/` — versioned EventAsset, capability, and topic contracts.
- `gseos/events/` — checked-in authoring assets.
- `packages/local-core/` — deterministic frontend, planner, code generator, and tests.
- `tests/` — golden files, integration scripts, and sanitized evidence reports.
- `docs/en/` and `docs/zh-CN/` — language-specific public technical documentation.
- `i18n/` — shared interface strings, locale manifest, and translation-extension rules.
- `brand/` — CODA mark and `Made with CODA` attribution assets.
- `website/en/` and `website/zh-CN/` — language-specific dependency-free GitHub Pages source.
- `research/` — design and architecture background.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). New capabilities must first become versioned contracts, and every cross-boundary value must use a stable machine ID. Please keep generated output, editor caches, internal task state, and temporary reports out of commits.

See [CHANGELOG.md](CHANGELOG.md) for the implementation baseline and [the English release policy](docs/en/release-policy.md) or [中文发布策略](docs/zh-CN/release-policy.md) for versioning and publication gates.

The Pages source can be previewed locally with `npx --yes serve .` and opening `/website/`. CODA code is MIT-licensed; documentation and website copy use CC BY 4.0. See [the brand policy](TRADEMARKS.md) for the recommended `Made with CODA` badge. GitHub Pages is the first public website; `coda.ipub.io` is a deferred optional entry.

## Project status

The E0 implementation and its recorded offline, headless, editor, and export checks are complete. The project owner has selected Godot CODA Engine (short name: CODA) for the first release; this repository does not claim trademark clearance or Godot Foundation endorsement.
