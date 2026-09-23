# CODA contracts / CODA 共享契约

The `gseos/` path and `GSEOS*` schema identifiers are retained as compatibility names for existing projects. New product-facing material should use CODA.

`gseos/` 路径和 `GSEOS*` schema 标识暂时作为既有项目的兼容名称保留。新的产品文案统一使用 CODA。

This directory is the versioned boundary consumed by the Node local core and the Godot plugin. `contracts/gseos/event-asset.schema.json` defines `EventAsset@1`; `contracts/gseos/capabilities.json` defines the initial capability/topic ABI. Incompatible changes must add an explicit version and migration function.

本目录是 Node 本地核心和 Godot 插件共同消费的版本化边界。`contracts/gseos/event-asset.schema.json` 定义 `EventAsset@1`；`contracts/gseos/capabilities.json` 定义首发 capability/topic ABI。不兼容变更必须新增显式版本和迁移函数。

P3 语义投影契约：`alias-registry.schema.json` 定义官方、项目和个人显示覆盖的 `AliasRegistry@1`；`semantic-projection.schema.json` 定义可再生的 `SemanticProjectionMap@1`；`semantic-patch.schema.json` 定义绑定资产/契约/词典版本的受控槽位 patch；`runtime-trace.schema.json` 定义回到 `run_id/node_id/slot` 的运行证据；`semantic-candidate.schema.json` 定义只能待审、不能建立权威锚点的 AI/人工候选；`user-observation.schema.json` 定义 `P3UserObservation@3` 脱敏体验记录，评价流程理解、表达自然度、编辑/预览体验、运行正确性和操作信心；不要求参与者找代码或解释工程机制。

Every failure is returned as a stable `Diagnostic` with at least `code`, `severity`, `message`, and a source path. When available, preserve event, node, field, target/version, and backend locations.

所有失败都以稳定 `Diagnostic` 回执表达，至少包含 `code`、`severity`、`message` 和来源路径；能定位到事件、节点、字段、target/version 或后端时必须保留这些字段。
