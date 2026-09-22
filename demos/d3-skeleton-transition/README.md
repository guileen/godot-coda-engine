# D3 Skeleton3D 意图过渡

状态：`IMPLEMENTED / D3_IDLE_CAPTURED / C1-L_SOURCE_PLAN_ADAPTER_LINKED / FULL_VISUAL_PENDING`

素材：AIBI/GDBot 真实网格和 Skeleton3D。当前素材登记见 [Demo asset register](../../docs/demos/asset-register.md)。

目标：展示连续姿态过渡、资源租约、局部抢占、Adapter barrier/start/terminal receipt 和外部 writer 拒绝。`fixtures/robot-acknowledge.plan.json` 同时记录 C1-L `MotionIntent` 计划及其源引用。

运行：

```sh
godot --path demos/d3-skeleton-transition --editor
```

在运行窗口中使用 `A` 触发攻击收势、`D` 触发高位防御、`I` 在过渡中抢占并安全收敛、`R` 重置。左侧面板同时显示硬门、generation、lease、DecisionRecord 和 RuntimeObservation。

无窗口 smoke test：

```sh
godot --headless --path demos/d3-skeleton-transition --script res://tests/d3_skeleton_transition_smoke.gd
```

这是非商业原型视觉 Demo，使用 GDQuest GDBot；许可见 `assets/GDQUEST_LICENSE` 和仓库内 `docs/demos/asset-register.md`。

视觉证据：[D3 idle 截图](../../tests/reports/demos/visual/d3-idle.png)。

完成入口：`DEMO.3`。
