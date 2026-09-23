# 范围与排障

## 当前范围

E0 版本覆盖 sequence、`if`、局部绑定和明确输出、受约束的 `while/each`、同步 `do`、受管理 `await`、`call`、`publish` 以及受约束的 `escape`。奖励 UI 示例覆盖了主要端到端路径。

当前版本不覆盖 `spawn/join`、`try/catch/finally`、E1/E2、跨场景独立运行、后台 Godot 对象访问、热重载恢复、Godot 内长期使用的 CODA 文本编辑器、LSP 或任意 Godot 反射。

## 生成输出被拒绝

当受管理产物不再匹配源指纹时，生成器会停止。只删除工具拥有的生成目录内对应的生成产物，然后从 EventAsset 重新生成：

```sh
npm run coda -- generate coda/events/ui.reward.apply.coda.json
```

不要编辑生成的 GDScript 来修复源文件。如果行为无法由结构化后端表达，请使用声明过的 `escape` 节点，或在生成 runner 外使用普通 GDScript。

## 校验报告了源路径

把诊断路径视为契约的一部分。它应尽可能标识 `event_id → node_id → field → target/version → backend` 路径。修复 EventAsset 或契约，然后重新校验。

## 运行意外结算

检查能力契约和所有者生命周期。E0 等待可以因完成、失败、取消、超时或所有者失效而结算。结算后到达的回调会被有意忽略；这是安全属性，不是重试机制。

## 编辑器没有显示事件

确认文件是 `.coda.json` 后缀的资产，并位于 `coda/events/`；确认 EventAsset 校验通过且 `CODA Event Editor` 插件已启用。面板从资产重新构建，摘要文本不是可解析的源文件。

## 需要 E0 之外的行为

在加入当前运行时边界前，先准备版本化契约、最小反例、源映射，以及适用时的竞争/清理测试。另请参阅 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
