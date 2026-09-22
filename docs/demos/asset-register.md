# Demo 素材登记

## 已确认素材

| 素材 | 路径 | 用途 | 许可/边界 |
| --- | --- | --- | --- |
| GDBot 模型 | `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/godot/addons/gdquest_gdbot/model/gdbot.glb` | D2/D3/D6 视觉主角、Skeleton3D 骨骼和部件 | 美术/3D 模型 `CC BY-NC-SA 4.0`；非商业原型 |
| GDBot 场景 | `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/godot/addons/gdquest_gdbot/gdbot_skin.tscn` | Godot 可实例化角色场景 | 随上游资产许可 |
| GDBot 动画 | `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/godot/addons/gdquest_gdbot/custom_animations/` | 原生动作和状态投影对照 | 不等同于 CODA 行为语义 |
| GDBot Adapter | `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/godot/scripts/gdbot_robot_adapter.gd` | Skeleton3D 关节投影 | 当前为仿真 Adapter，不是硬件安全控制器 |
| 通用关节 Adapter | `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/godot/scripts/robot_joint_adapter.gd` | 限位、插值、中断过渡 | 当前不包含完整动力学、IK、重心或碰撞求解 |
| FaceScreen | `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/godot/assets/faces/` | 状态、情绪和表情投影 | 原创资源；240×240 共享规格 |

## 设计输入

- `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/prototype.md`
- `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/research/m1-design-read.md`
- `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/research/m1-asset-license-2026-09-21.md`
- `/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/research/robot-adapter-design-2026-09-22.md`

## 尚未纳入首阶段的素材

布料、头发、复杂软体和真实接触摩擦模型暂不作为 D1–D6 的前置。它们只能在 C1-P.5 中作为单独研究切片加入，并需要独立的模型、预算、误差 envelope、接触残差和 fallback 证据。

最终 Demo 不得用方块、胶囊或球体替代角色视觉。简单几何体仅可作为隐藏物理 fixture、边界 overlay 或数值测试输入。

