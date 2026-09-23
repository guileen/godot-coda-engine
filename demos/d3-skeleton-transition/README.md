# D3 Skeleton3D 意图过渡

状态：`CODA_TRANSITION_PLANS_GENERATED / AIBI_STYLE_ROBOT_ADAPTER_LINKED / SKELETON3D_EXECUTION_PENDING_VERIFICATION`

素材：AIBI/GDBot 真实网格和 Skeleton3D。当前素材登记见 [Demo asset register](../../docs/demos/asset-register.md)。

目标：展示 `EventAsset → ExecutionPlan → IntentBackendProfile → TransitionPlan → RobotJointAdapter → Skeleton3D`。CODA 生成的计划提供所有姿态目标和分段时长；GDScript 负责触发输入、Adapter 生命周期和安全收敛，不再手写攻击/防御目标。

运行：

```sh
npm run demo:d3:plans
godot --path demos/d3-skeleton-transition
```

默认使用 CODA 自带的 GDBot 参考 Adapter。若本机已有 AIBI 源码，可在同一场景中直接加载 AIBI 的 `RobotJointAdapter`，验证 CODA 生成计划到 AIBI 轨迹接口的桥接：

```sh
CODA_AIBI_ROBOT_JOINT_ADAPTER="/本机/aibi/godot/scripts/robot_joint_adapter.gd" \
  godot --headless --path demos/d3-skeleton-transition \
  --script res://tests/d3_skeleton_transition_smoke.gd
```

桥接层先检查计划、起始姿态、关节限位、速度与 generation，再调用 AIBI 的 `submit_trajectory` / `interrupt_to`；它补上 CODA 的 generation/回执边界，并把 AIBI 适配器当前关节值投影到 GDBot Skeleton3D。没有设置该路径时，仍运行内置参考 Adapter。此接线只验证本机 AIBI Godot Adapter API 与 GDBot 仿真，不触发真实执行器。

`A` 播放 CODA 的攻击收势计划，`D` 播放高位防御计划；更高优先级请求会先撤销旧 generation 并从当前关节状态回到安全中立位，再提交新计划。`I` 只做安全收敛，`R` 重置仿真。左侧面板显示来源 EventAsset、计划 ID、Adapter 回执和 generation。

无窗口 smoke test：

```sh
godot --headless --path demos/d3-skeleton-transition --script res://tests/d3_skeleton_transition_smoke.gd
```

`scripts/coda_aibi_robot_adapter_bridge.gd` 可包裹本机 AIBI `RobotJointAdapter` 源码；它保留 CODA 的计划/租约检查，并把生成轨迹和中断交给 AIBI API。未指定本机源码路径时，`scripts/robot_joint_adapter.gd` 与 `gdbot_robot_adapter.gd` 提供独立参考 Adapter。两种模式都只驱动 GDBot 仿真，不接电机。这里的关节上限与分段计划只证明该 Godot Profile 的约束链，不代表真实动力学、IK、平衡或硬件安全。

这是非商业原型视觉 Demo，使用 GDQuest GDBot；许可见 `assets/GDQUEST_LICENSE` 和仓库内 `docs/demos/asset-register.md`。

视觉证据：[D3 idle 截图](../../tests/reports/demos/visual/d3-idle.png)。

完成入口：`DEMO.3`。
