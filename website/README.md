# Godot CODA Engine public site / Godot CODA Engine 公开网站

This is a dependency-free static GitHub Pages source. The language gateway is `website/index.html`; localized pages are kept in `website/en/` and `website/zh-CN/`. Shared CSS and interaction code live in `website/assets/`, while reusable interface strings and attribution assets live in [`i18n/`](../i18n/README.md) and [`brand/`](../brand/README.md). The Pages workflow combines `website/`, `i18n/`, and `brand/` into a clean `.pages/` artifact.

这是一个无依赖的静态 GitHub Pages 源码。语言入口是 `website/index.html`；各语言页面分别位于 `website/en/` 和 `website/zh-CN/`。共享 CSS 与交互代码位于 `website/assets/`，可复用界面文案和署名资源位于 [`i18n/`](../i18n/README.md) 和 [`brand/`](../brand/README.md)。Pages 工作流会把 `website/`、`i18n/` 和 `brand/` 合并成干净的 `.pages/` 部署产物。

## Local preview / 本地预览

Serve the repository root with any static file server and open `/website/` (then choose `/website/en/` or `/website/zh-CN/`). For example:

使用任意静态文件服务器提供仓库根目录，然后打开 `/website/`（再选择 `/website/en/` 或 `/website/zh-CN/`）。例如：

```sh
npx --yes serve .
```

The site does not send analytics or load third-party scripts. Theme preference and language preference are stored locally in `localStorage`.

网站不发送分析数据，也不加载第三方脚本。主题偏好和语言偏好保存在本地 `localStorage` 中。
