# Demo 视觉证据

状态：`LAUNCHER_CAPTURED / D1_D2_D3_D4_D5_D6_VISUAL_CAPTURED`

当前已保存一张真实运行窗口的固定视口截图：

- [D3 idle / source-plan loaded](d3-idle.png)
- [D3 interrupted / safe convergence](d3-interrupted.png)
- [D2 idle / listening baseline](d2-idle.png)
- [D2 interrupted / cancelled speech and unique terminal](d2-interrupted.png)
- [D1 source map](d1.png)
- [D4 fidelity cascade](d4.png)
- [D5 anytime frontier](d5.png)
- [D6 failure boundary gallery](d6.png)
- [Unified six-Demo launcher](launcher.png)

画面可见真实 GDBot 网格、Skeleton3D、硬门状态、generation/owner、DecisionRecord 与 RuntimeObservation；D2 两张画面显示不同 generation 和唯一终态。截图证明视觉窗口、真实角色资产和可辨识状态差异，不证明“更自然”、完整 C1-T 或真实硬件安全。

各 Demo 的独立入口和截图索引记录在对应 Demo README 与各自 report；D2/D3 为 Godot 运行时画面，D1/D4/D5/D6 为本地独立 Launcher 视觉画面。后四者仍不替代 D4/D5 的目标设备 benchmark。

离线回放入口已覆盖 D1/D2/D4/D5/D6，索引位于 [`../replays/`](../replays/)；D3 的运行观察仍单独记录在其 smoke report。

Launcher screenshot SHA-256: `1fca1e344827846033a7167391b64c6cb15cc1d59ab4941c60ed109fd03330c8`。

状态：`VISUAL_CAPTURE_INDEX_COMPLETE / REPLAY_AND_CALIBRATION_GATES_PENDING`

已保存固定视口和关键状态截图；录屏、完整 replay/observation 关联以及目标设备 calibration 仍是 `G-DEMO-B/C` 的后续门禁。
