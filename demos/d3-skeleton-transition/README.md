# D3 Skeleton3D 意图过渡

状态：`CODA_TRANSITION_PLANS_GENERATED / AIBI_STYLE_ROBOT_ADAPTER_LINKED / SKELETON3D_EXECUTION_PENDING_VERIFICATION`

素材：AIBI/GDBot 真实网格和 Skeleton3D。当前素材登记见 [Demo asset register](../../docs/demos/asset-register.md)。

目标：展示 `EventAsset → ExecutionPlan → IntentBackendProfile → TransitionPlan → RobotJointAdapter → Skeleton3D`。CODA 生成的计划提供所有姿态目标和分段时长；GDScript 负责触发输入、Adapter 生命周期和安全收敛，不再手写攻击/防御目标。

运行：

```sh
npm run demo:d3:plans
godot --path demos/d3-skeleton-transition
```

`A` 播放 CODA 的攻击收势计划，`D` 播放高位防御计划；更高优先级请求会先撤销旧 generation 并从当前关节状态回到安全中立位，再提交新计划。`I` 只做安全收敛，`R` 重置仿真。左侧面板显示来源 EventAsset、计划 ID、Adapter 回执和 generation。

无窗口 smoke test：

```sh
godot --headless --path demos/d3-skeleton-transition --script res://tests/d3_skeleton_transition_smoke.gd
```

`scripts/robot_joint_adapter.gd` 和 `gdbot_robot_adapter.gd` 将 AIBI 本机参考 Adapter 的执行边界接入 D3；其写入只影响 GDBot 仿真，不接电机。这里的关节上限与分段计划只证明该 Godot Profile 的约束链，不代表真实动力学、IK、平衡或硬件安全。

这是非商业原型视觉 Demo，使用 GDQuest GDBot；许可见 `assets/GDQUEST_LICENSE` 和仓库内 `docs/demos/asset-register.md`。

视觉证据：[D3 idle 截图](../../tests/reports/demos/visual/d3-idle.png)。

完成入口：`DEMO.3`。
