# 为 CODA 贡献代码

CODA 是面向 Godot 的结构化事件创作与生成层。贡献应维护结构化资产、生成 runner 和小型 E0 运行时之间的边界。

## 创建 Pull Request 前

根据变更范围运行对应检查：

```sh
npm test
npm run check
npm run coda -- validate gseos/events/ui.reward.apply.gse.json
npm run coda -- generate gseos/events/ui.reward.apply.gse.json
godot --headless --path . --editor --quit
```

如果改动涉及 Godot 集成、运行时行为、生成输出或导出边界，还要运行 `npm run test:godot` 和 `npm run export:pack`。

## 设计规则

- 新行为先定义版本化 schema、能力或主题契约，再接入资产、规划器、生成器和适配器。
- 跨边界使用稳定机器 ID；显示名称和别名不是 ABI 标识符。
- 保持 `EventAsset` 为语义事实来源。生成的 GDScript 是受管理产物，不是并行创作格式。
- 不要增加中文/英文文本或 EventAsset 的运行时解析。
- 不要增加任意 Godot 反射；不支持的逻辑应放在普通 GDScript 中，或放进声明明确输入输出的 `escape` 节点。
- 修改降级或代码生成时保留源映射和诊断信息。

`.gseos/generated/` 和 `gseos/generated/` 由工具管理，不要手动编辑或提交。保持 Pull Request 聚焦，并说明对 E0 边界、取消语义、所有权或生成产物格式的影响。

软件贡献采用 MIT；文档贡献采用 CC BY 4.0。推荐使用的 `Made with CODA` 徽章由 [`TRADEMARKS.md`](../../TRADEMARKS.md) 管理，不是软件使用条件。
