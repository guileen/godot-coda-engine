# 快速开始

想先建立对 CODA 语法的直观印象，而不是立刻跑环境校验？请先阅读[5 分钟认识 CODA](5-minutes-coda.md)。本页面向准备打开当前仓库并运行 Godot 检查的开发者。

本指南会从干净检出运行仓库中提供的奖励事件示例。假设环境中已经安装 Node.js 20+ 和 Godot 4.7.2，并且它们位于 `PATH` 中。

## 1. 安装仓库

当前工作区不需要安装第三方运行时包。克隆仓库并进入目录：

```sh
git clone https://github.com/guileen/godot-coda-engine.git
cd godot-coda-engine
```

## 2. 校验事件资产

这个示例是结构化的 `EventAsset`，不是文本脚本：

```sh
npm test
npm run coda -- validate gseos/events/ui.reward.apply.gse.json
```

校验器应报告 `ok: true`，并且没有诊断信息。

## 3. 生成 runner

```sh
npm run coda -- generate gseos/events/ui.reward.apply.gse.json
```

命令会在 `.gseos/generated/` 下生成 GDScript runner 和 JSON 源映射。生成文件头部包含计划指纹；源映射把事件节点和字段对应到生成行。

## 4. 在 Godot 中打开项目

```sh
godot --editor --path .
```

如果尚未启用，请启用 `CODA Event Editor` 插件。事件面板从 `gseos/events/` 读取资产，并从结构化资产重新构建预览。

## 5. 运行校验

无头编辑器冒烟检查：

```sh
godot --headless --path . --editor --quit
```

完整本地套件：

```sh
npm run test:all
```

完整套件包括离线核心测试、Godot 无头集成、生成 runner 检查、取消/所有者竞争，以及运行时导出包审计。

## 校验失败时

保留原始诊断和源路径。不要手动修复生成文件；应从源资产重新生成，然后查看[范围与排障](scope-and-troubleshooting.md)了解对应边界。
