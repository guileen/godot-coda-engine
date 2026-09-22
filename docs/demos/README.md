# CODA Demo Suite

这是 CODA 阶段性能力验收的入口。Demo 必须可运行、可暂停、可回放，并同时展示视觉结果与决策/运行证据。

## 当前状态

`OFFLINE_REPORTS_IMPLEMENTED / D3_RUNTIME_SMOKE_AND_FACE_ADAPTER_PASS / VISUAL_CAPTURE_PENDING`

本目录目前冻结 Demo 规格和素材边界；它不宣称 C1-T/C1-P 运行时已经实现。实现必须先满足 `tasks.md` 中的 `G-DEMO-A`，并继续服从 `G-C1-T-*`、`G-C1-P-*` 和 P3 现有门禁。

## Demo 入口

| ID | 名称 | 当前证据来源 | 实现状态 |
| --- | --- | --- | --- |
| D1 | 语义编排与来源定位 | [d1 report](../../tests/reports/demos/d1-semantic-authoring.json) | 离线报告已通过；视觉展示待完成 |
| D2 | 可中断行为运行时 | [d2 report](../../tests/reports/demos/d2-interruptible-behavior.json) | 离线报告已通过；视觉展示待完成 |
| D3 | Skeleton3D 身体技能与意图过渡 | [d3 smoke report](../../tests/reports/demos/d3-skeleton-transition-smoke.json) | 真实 GDBot/Skeleton3D 与 FaceScreen Adapter smoke 已通过；semantic phase、model-valid viability、task activation、commit re-anchor、typed claim、horizon underrun、物理连续 handoff 与平滑 re-entry 尚未实现/验收 |
| D4 | 物理知情多保真级联 | [d4 report](../../tests/reports/demos/d4-multifidelity-planning.json) | 离线级联报告已通过；真实 benchmark/视觉展示待完成 |
| D5 | Anytime 与安全边界 | [d5 report](../../tests/reports/demos/d5-anytime-safety-boundary.json) | 离线预算报告已通过；真实 sweep/视觉展示待完成 |
| D6 | 失败与边界画廊 | [d6 report](../../tests/reports/demos/d6-failure-boundary-gallery.json) | 离线反例报告已通过；统一视觉画廊待完成 |

## 运行和查看约定

每个 Demo 必须提供：

- 正常路径、边界路径和失败路径；
- 固定输入或可保存的 replay；
- 场景、时间线、决策、证据四个区域；
- 对应的 fixture 指纹、运行命令和报告索引；
- 明确的“证明什么 / 不证明什么”。

当前首选的视觉素材是 AIBI 项目中的 GDBot。其模型和美术为 `CC BY-NC-SA 4.0`，只能用于非商业原型和技术验证；商业交付必须替换资产或取得书面授权。素材登记见 [asset-register.md](asset-register.md)。

离线报告可统一重跑：`npm run demo:smoke`；D3 Godot smoke 与它串联为 `npm run demo:acceptance`。这些命令不伪造视觉通过状态；视觉验收仍必须提供窗口截图/录屏和固定视口回归记录。

## 权威来源

- [阶段性任务与门禁](../../tasks.md)
- [CODA 具身语言层与运行时边界](../coda-embodied-language-runtime-boundary.md)
- [C1-T 意图式过渡运行时](../intentful-transition-runtime-proposal.md)
- [C1-P 物理知情策略编译](../physics-informed-intent-planning-proposal.md)
- [C1-M 机器人 Adapter 边界](../robot-motion-intent-proposal.md)
- [C0 AIBI 行为运行时](../aibi-behavior-runtime-proposal.md)
- [P3 技术基线](../../tests/reports/p3-technical-baseline.json)
