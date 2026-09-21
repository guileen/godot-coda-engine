# CODA language system / CODA 语言系统

The repository keeps language-specific documents and pages in locale directories, while this directory stores shared interface strings and the rules for adding another locale.

本仓库将语言专属文档和网页放在各自的语言目录中；本目录只保存共享界面文案和新增语言时需要遵循的约定。

## Layout / 目录

```text
i18n/
├── manifest.json       # supported locales and fallback order / 支持的语言与回退顺序
├── en/site.json        # English interface strings / 英文界面文案
└── zh-CN/site.json     # Simplified Chinese interface strings / 简体中文界面文案
```

Long-form documentation lives in `docs/en/` and `docs/zh-CN/`. The website pages live in `website/en/` and `website/zh-CN/`. This split keeps prose reviewable by language and keeps reusable UI strings in one place.

长文档位于 `docs/en/` 和 `docs/zh-CN/`；官网页面位于 `website/en/` 和 `website/zh-CN/`。这样的拆分让各语言正文可以独立审阅，同时让可复用的界面文案集中管理。

## Adding a locale / 新增语言

1. Add the locale to `manifest.json` with an explicit fallback.
2. Add its interface dictionary under `i18n/<locale>/`.
3. Add matching documentation under `docs/<locale>/`.
4. Add matching website pages under `website/<locale>/` and a language link from the existing pages.
5. Extend `scripts/check-public-surface.mjs` and run the full public-surface check.

1. 在 `manifest.json` 中增加语言，并明确回退语言。
2. 在 `i18n/<locale>/` 下增加界面文案字典。
3. 在 `docs/<locale>/` 下增加对应的技术文档。
4. 在 `website/<locale>/` 下增加对应网页，并从现有页面提供语言切换入口。
5. 扩展 `scripts/check-public-surface.mjs`，然后运行完整公开发布检查。
