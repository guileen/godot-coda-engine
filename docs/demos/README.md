# CODA Demo Suite

这是 CODA 阶段性能力验收的入口。Demo 必须可运行、可暂停、可回放，并同时展示视觉结果与决策/运行证据。

## 当前状态

`OFFLINE_REPORTS_IMPLEMENTED / REPORT_BOUND_LAUNCHER_IMPLEMENTED / D3_RUNTIME_SMOKE_AND_FACE_ADAPTER_PASS / THREE_VIEWPORT_DIAGNOSTICS_CAPTURED / VISUAL_REFERENCE_REGRESSION_PENDING`

本目录目前冻结 Demo 规格和素材边界；它不宣称 C1-T/C1-P 运行时已经实现。实现必须先满足 `tasks.md` 中的 `G-DEMO-A`，并继续服从 `G-C1-T-*`、`G-C1-P-*` 和 P3 现有门禁。

## Demo 入口

| ID | 名称 | 当前证据来源 | 实现状态 |
| --- | --- | --- | --- |
| D1 | 语义编排与来源定位 | [d1 report](../../tests/reports/demos/d1-semantic-authoring.json) | 离线报告、source map 与 replay 绑定；Launcher 显示报告数据图示，无 demo 场景截图 |
| D2 | 可中断行为运行时 | [d2 report](../../tests/reports/demos/d2-interruptible-behavior.json) | 离线报告、不同状态截图与 Launcher 展示绑定；Godot smoke 状态见报告 |
| D3 | Skeleton3D 身体技能与意图过渡 | [d3 smoke report](../../tests/reports/demos/d3-skeleton-transition-smoke.json) | 真实 GDBot/Skeleton3D 与 FaceScreen Adapter smoke 已通过；semantic phase、model-valid viability、task activation、commit re-anchor、typed claim、horizon underrun、物理连续 handoff 与平滑 re-entry 尚未实现/验收 |
| D4 | 物理知情多保真级联 | [d4 report](../../tests/reports/demos/d4-multifidelity-planning.json) | Launcher 从离线报告绘制 candidate、硬门与 work units 数据图示；不是运行时场景或目标设备 benchmark |
| D5 | Anytime 与安全边界 | [d5 report](../../tests/reports/demos/d5-anytime-safety-boundary.json) | Launcher 从报告绘制 budget sweep 与 certified/fallback 数据图示；不是运行时场景，目标设备校准待完成 |
| D6 | 失败与边界画廊 | [d6 report](../../tests/reports/demos/d6-failure-boundary-gallery.json) | Launcher 从报告绘制 reject/fallback case 与诊断；不是运行时场景 |

## 运行和查看约定

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
