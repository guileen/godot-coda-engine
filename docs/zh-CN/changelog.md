# 更新日志

## 未发布

- GSEOS → CODA 改名已彻底完成。目录（`addons/coda/`、`contracts/coda/`、`coda/`）、schema 标识（`CODA_CapabilityManifest`、契约 `$id` 与标题）、环境变量、诊断码与生成标记现在只使用 CODA。
- 退役的兼容入口已删除，不再作为别名保留：`packages/local-core/src/gseos/`、`gseos-cli.js`、`npm run gseos`、`scripts/gseos-*` 启动脚本，以及旧 `GSEOS_*` 环境变量。
- 新生成的 GDScript 标记使用 CODA 名称；编辑器与校验器对既有生成物仍按只读识别旧 GSEOS 标记，不会批量改写，重新生成时才替换。
- 证据报告、文档、网站文案与素材登记已同步到 CODA 路径；历史发布记录保留当时使用的名称。
- 为 CODA 公开 GitHub 发布流程准备仓库。
- 增加按语言组织的公开文档和双语 GitHub Pages 网站。
- 增加贡献、安全、行为准则、issue 和 Pull Request 指南。

## 0.1.0 — 实现基线

- 交付首版 CODA E0 结构化事件流水线（当时使用 GSEOS 名称）、运行时边界、Godot 编辑器界面、奖励示例、确定性测试、无头集成和运行时导出审计。
- 本条目记录实现基线，不构成许可证授权或公开发布公告。
