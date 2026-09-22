# Demo 证据报告

状态：`D1_D2_D4_D5_D6_OFFLINE_REPORTS_PASS; D3_RUNTIME_SMOKE_AND_FACE_ADAPTER_PASS; VISUAL_CAPTURE_PENDING`

本目录保存 Demo 版本、fixture 指纹、运行命令、截图/录屏索引、DecisionRecord、PredictionReceipt、RuntimeObservation 和门禁结论。

离线报告统一入口：`npm run demo:smoke`。当前已生成 D1、D2、D4、D5、D6 报告；D3 的 Godot smoke 报告另列。报告通过不等于视觉验收通过。

- [D1](d1-semantic-authoring.json)
- [D2](d2-interruptible-behavior.json)
- [D3](d3-skeleton-transition-smoke.json)
- [D4](d4-multifidelity-planning.json)
- [D5](d5-anytime-safety-boundary.json)
- [D6](d6-failure-boundary-gallery.json)

子目录：

- [visual](visual/README.md)
- [benchmarks](benchmarks/README.md)
- [replays](replays/README.md)
