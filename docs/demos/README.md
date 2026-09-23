# CODA Demo Suite

这是 CODA 阶段性能力验收的入口。Demo 必须可运行、可暂停、可回放，并同时展示视觉结果与决策/运行证据。

## 当前状态

`OFFLINE_REPORTS_IMPLEMENTED / REPORT_BOUND_LAUNCHER_IMPLEMENTED / D3_RUNTIME_SMOKE_FACE_ADAPTER_AND_PLAN_PHASE_PROGRESS_PASS / THREE_VIEWPORT_DIAGNOSTICS_CAPTURED / VISUAL_REFERENCE_REGRESSION_PENDING`

本目录包含 Demo 规格、素材登记及阶段性实现；D2/D3 已有 Godot runtime smoke，但不宣称 C1-T/C1-P 的完整运行时已经实现。实现必须满足 `tasks.md` 中的 `G-DEMO-A`，并继续服从 `G-C1-T-*`、`G-C1-P-*` 和 P3 现有门禁。

## Demo 入口

给试玩者的简明说明见[体验说明](体验说明.md)。macOS 上可在仓库文件夹中双击“体验 CODA 事件编辑器.command”“体验奖励流程.command”或“体验具身演示.command”直接进入对应界面；试玩者不需要查找代码或打开终端。

| ID | 名称 | 当前证据来源 | 实现状态 |
| --- | --- | --- | --- |
| D1 | 语义编排与来源定位 | [d1 report](../../tests/reports/demos/d1-semantic-authoring.json) | 离线报告、source map 与 replay 绑定；Launcher 显示报告数据图示，无 demo 场景截图 |
| D2 | 可中断行为运行时 | [d2 report](../../tests/reports/demos/d2-interruptible-behavior.json) | 离线报告、不同状态截图与 Launcher 展示绑定；Godot smoke 状态见报告 |
| D3 | Skeleton3D 身体技能与意图过渡 | [d3 smoke report](../../tests/reports/demos/d3-skeleton-transition-smoke.json) | 内置与本机 AIBI Adapter 的 smoke 均覆盖真实 GDBot/Skeleton3D、生成计划阶段/进度、安全中断、姿态摘要 token、回中后新 generation 剩余计划续接和外部占用拒绝。续接只按固定头部姿态 profile 做 heuristic 门控，不代表动力学可恢复性；task activation、commit re-anchor、typed claim、horizon underrun、物理连续 handoff 与设备级连续控制仍未实现/验收 |
| D4 | 物理知情多保真级联 | [d4 report](../../tests/reports/demos/d4-multifidelity-planning.json) | Launcher 从离线报告绘制 candidate、硬门与 work units 数据图示；不是运行时场景或目标设备 benchmark |
| D5 | Anytime 与安全边界 | [d5 report](../../tests/reports/demos/d5-anytime-safety-boundary.json) | Launcher 从报告绘制 budget sweep 与 certified/fallback 数据图示；不是运行时场景，目标设备校准待完成 |
| D6 | 失败与边界画廊 | [d6 report](../../tests/reports/demos/d6-failure-boundary-gallery.json) | Launcher 从报告绘制 reject/fallback case 与诊断；不是运行时场景 |

## 运行和查看约定

### 奖励流程体验

在 Godot Project Manager 中导入仓库根目录的 `project.godot`，打开后点右上角“运行项目”。主场景会直接打开“领取关卡奖励”样例。点击“领取奖励 +25”，观察积分从 100 到 125、旧条目被替换以及结算通知；点击“验证条件：奖励为 0”，确认条件不成立时积分和奖励条目都保持不变。界面下方按“触发—判断—算分并等待—更新—反馈”列出本次流程。

若要检查编辑体验，在同一工程的右侧“CODA 事件”面板选择“应用奖励”。选择步骤可查看它在流程中的位置；添加计算步骤后，右侧会提示结果名称和算式，例如“新积分 = 当前积分 + 奖励”。确认前会显示预览；取消或预览都不会修改原流程。

### D3 交互体验

从 Godot 项目管理器导入 [`demos/d3-skeleton-transition/project.godot`](../../demos/d3-skeleton-transition/project.godot)，打开后按“运行项目”。画面左侧提供“攻击后收势”“高位防御”“中断并安全回中”按钮；可在动作执行时切换高位防御观察优先级抢占，也可点击表情按钮观察 GDBot 面部变化。若在动作第一阶段中断，安全回中完成后会启用“续接剩余动作（仿真）”；按下后可观察它从新 generation 和 lease 启动一份剩余动作计划。启用“模拟外部占用”时续接会被拒绝。进度条下方会标出当前生成计划阶段和阶段进度，例如“转入目标姿态→回到中立姿态”。下方的“模拟对象失效”用于查看失效拒绝行为，动作停止后可点“重置演示”恢复初始状态。底部记录区展示计划来源、generation、Adapter barrier、续接候选证据等级和终态回执。

该演示当前驱动 GDBot 头部骨骼姿态及面部表情。续接只证明受限仿真 profile 的 fail-closed 门控和新 generation 剩余计划，不是全身运动控制器、动力学可恢复性证明或真实机器人/硬件安全验证。

每个 Demo 必须提供：

- 正常路径、边界路径和失败路径；
- 固定输入或可保存的 replay；
- 场景、时间线、决策、证据四个区域；
- 对应的 fixture 指纹、运行命令和报告索引；
- 明确的“证明什么 / 不证明什么”。

当前首选的视觉素材是 AIBI 项目中的 GDBot。其模型和美术为 `CC BY-NC-SA 4.0`，只能用于非商业原型和技术验证；商业交付必须替换资产或取得书面授权。素材登记见 [asset-register.md](asset-register.md)。

离线报告和 `demos/launcher/demo-data.js` 可统一重建：`npm run demo:smoke`；D3 Godot smoke 与它串联为 `npm run demo:acceptance`。Launcher 中每个证据项取自对应报告，不再把硬编码演示文案标为 `observed`。报告缺失时显示缺失状态；选择证据项只展开报告记录，不触发或伪装运行时。三视口页面截图与卡片/证据切换检查记录在 [`tests/reports/demos/launcher-visual/`](../../tests/reports/demos/launcher-visual/)；截图为单侧诊断证据，不是与设计基线对比后的视觉通过结论。

## 权威来源

- [阶段性任务与门禁](../../tasks.md)
- [CODA 具身语言层与运行时边界](../coda-embodied-language-runtime-boundary.md)
- [C1-T 意图式过渡运行时](../intentful-transition-runtime-proposal.md)
- [C1-P 物理知情策略编译](../physics-informed-intent-planning-proposal.md)
- [C1-M 机器人 Adapter 边界](../robot-motion-intent-proposal.md)
- [C0 AIBI 行为运行时](../aibi-behavior-runtime-proposal.md)
- [P3 技术基线](../../tests/reports/p3-technical-baseline.json)
