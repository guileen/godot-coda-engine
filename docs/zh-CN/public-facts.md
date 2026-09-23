# 公开事实与证据

公开页面只描述能够追溯到已提交 fixture、源码位置或可重复命令的行为。本页是当前 E0 发布候选版本的精简证据映射。

## 宣称与证据映射

| 公开宣称 | 证据 | 复现方式 |
| --- | --- | --- |
| CODA 保存带稳定 ID 的版本化 `EventAsset@1`，并保留未知字段。 | `packages/local-core/src/gseos/asset.js`、`contracts/gseos/event-asset.schema.json` 和资产测试。 | `npm test` |
| 生成链路是 `EventAsset → ExecutionPlan → GDScript`，包含源映射和确定性输出。 | `packages/local-core/src/gseos/planner.js`、`packages/local-core/src/gseos/codegen.js`、`tests/golden/ui.reward.apply.source-map.json` 以及奖励 fixture。 | 先运行 `npm run coda -- validate gseos/events/ui.reward.apply.gse.json`，再运行 `npm run coda -- generate gseos/events/ui.reward.apply.gse.json` |
| E0 运行时明确处理等待、取消、超时、所有者失效和迟到回调。 | `addons/gseos/runtime/`，尤其是 `wait_registration.gd`、`run_handle.gd` 和 `event_registry.gd`；竞争集成测试覆盖终态规则。 | `npm run test:godot` |
| 英文、中文和混合语言导入面会归一到同一个结构化模型。 | `packages/local-core/src/gseos/frontend.js` 和双语前端测试。 | `npm test` |
| 编辑器界面支持资产事务和源映射定位。 | `addons/gseos/editor/event_dock.gd`、`tests/integration/event_dock_smoke.gd` 和 `tests/reports/t2-editor-smoke.json`。 | `npm run test:godot:gui` |
| 导出运行时不包含编辑器、前端、旧词典或 EventAsset 解释层。 | `export_presets.cfg`、`scripts/gseos-pack-audit.js` 和 `tests/reports/t2-export-audit.json`。 | `npm run export:pack` |
| 双语静态网站通过响应式、键盘、减少动态效果和无跟踪检查。 | `website/`、`i18n/` 和 `tests/reports/t2-pages-visual-qa.json`。 | 在本地 Pages 预览上运行报告中记录的视觉验收命令。 |

## 证据边界

记录的性能数值对应 [`tests/reports/t2-performance.json`](../../tests/reports/t2-performance.json) 中明确的 Godot 版本、平台、事件形状和测量方法，不是普遍性能保证。项目不宣称完整运行时覆盖率、零性能开销，也不宣称支持[范围页](scope-and-troubleshooting.md)列出的排除能力。

项目完整名称为 Godot CODA Engine，CODA 是简称。项目只把 Godot 作为宿主引擎引用，不声称获得 Godot Foundation 背书。独立品牌政策见 [`TRADEMARKS.md`](../../TRADEMARKS.md)。

首个 commit 创建后，可以在干净 checkout 中运行 [`npm run verify:clean-clone`](../../scripts/verify-clean-clone.mjs)，复跑发布清单要求的 README 命令、链接、公开面和 fixture 检查。
