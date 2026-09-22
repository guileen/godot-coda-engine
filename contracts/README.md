# GSEOS contracts / GSEOS 共享契约

This directory is the versioned boundary consumed by the Node local core and the Godot plugin. `contracts/gseos/event-asset.schema.json` defines `EventAsset@1`; `contracts/gseos/capabilities.json` defines the initial capability/topic ABI. Incompatible changes must add an explicit version and migration function.

本目录是 Node 本地核心和 Godot 插件共同消费的版本化边界。`contracts/gseos/event-asset.schema.json` 定义 `EventAsset@1`；`contracts/gseos/capabilities.json` 定义首发 capability/topic ABI。不兼容变更必须新增显式版本和迁移函数。

P3 语义投影契约：`alias-registry.schema.json` 定义官方、项目和个人显示覆盖的 `AliasRegistry@1`；`semantic-projection.schema.json` 定义可再生的 `SemanticProjectionMap@1`；`semantic-patch.schema.json` 定义绑定资产/契约/词典版本的受控槽位 patch；`runtime-trace.schema.json` 定义回到 `run_id/node_id/slot` 的运行证据；`semantic-candidate.schema.json` 定义只能待审、不能建立权威锚点的 AI/人工候选；`user-observation.schema.json` 定义 `P3UserObservation@2` 脱敏观察报告，显式记录目标用户与项目关系自我声明、主持人资格确认，并限制可存入的自由文本。

Every failure is returned as a stable `Diagnostic` with at least `code`, `severity`, `message`, and a source path. When available, preserve event, node, field, target/version, and backend locations.

所有失败都以稳定 `Diagnostic` 回执表达，至少包含 `code`、`severity`、`message` 和来源路径；能定位到事件、节点、字段、target/version 或后端时必须保留这些字段。
