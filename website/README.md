# Godot CODA Engine public site / Godot CODA Engine 公开网站

This is a dependency-free static GitHub Pages site. The root page picks the saved language or browser language automatically; the language switcher saves a later choice. Localized landing pages live in `website/en/` and `website/zh-CN/`, but the learn-and-use pages are generated from Markdown in [`docs/`](../docs/README.md). Shared CSS and interaction code live in `website/assets/`; reusable interface strings and attribution assets live in [`i18n/`](../i18n/README.md) and [`brand/`](../brand/README.md).

这是一个无依赖的静态 GitHub Pages 网站。根页面会自动选择已保存的语言或浏览器语言；语言切换器会保存之后的选择。各语言落地页位于 `website/en/` 和 `website/zh-CN/`，而学习与上手页面由 [`docs/`](../docs/README.md) 中的 Markdown 生成。共享 CSS 与交互代码位于 `website/assets/`；可复用界面文案和署名资源位于 [`i18n/`](../i18n/README.md) 和 [`brand/`](../brand/README.md)。

## Local preview / 本地预览

Build the Pages artifact, then serve `.pages/`. For example:

先构建 Pages 产物，再提供 `.pages/` 目录。例如：

```sh
node scripts/build-pages.mjs
python3 -m http.server --directory .pages
```

The build copies examples and renders localized Markdown documents into `.pages/docs/`. The site does not send analytics or load third-party scripts. Theme preference and language preference are stored locally in `localStorage`.

构建过程会复制示例，并把本地化 Markdown 文档渲染到 `.pages/docs/`。网站不发送分析数据，也不加载第三方脚本。主题偏好和语言偏好保存在本地 `localStorage` 中。
