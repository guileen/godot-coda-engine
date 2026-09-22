# C1-M.2 电机/执行器仿真评估

日期：2026-09-23  
裁决：**暂不增加专用动力学仿真依赖；Godot 保留为视觉/游戏后端。若未来需要离线电机与接触动力学实验，MuJoCo 是首个待评估候选；若目标是 ROS/Gazebo 联调，则优先评估 Gazebo Sim。**

## 范围与证据等级

本评估只决定采购/集成前的仿真策略，不选具体机器人、不安装新引擎，也不授予运行时写权。下表是基于一手官方文档的能力映射（E1：文档可证明功能存在）；没有在本仓库运行 MuJoCo/Gazebo，也没有比较数值误差、吞吐、p95/p99 或硬件相关性。因此不把能力列表写成仿真效果或设备安全证据。

| 用例 | Godot Physics | MuJoCo | Gazebo Sim |
| --- | --- | --- | --- |
| 视觉、Skeleton、游戏交互 | 现有场景和 D3 路径直接支持，继续作为主后端 | 可视化不是本项目替换 Godot 的收益点 | 可通过 GUI/渲染查看模型，但会增加模型与启动链路 |
| 位置/速度/受限力命令 | 关节约束、6-DOF 线/角 motor 的目标速度和 force limit 可表达；执行器电流、齿槽、热/电机状态需自建模型 | actuator 分离 transmission、activation dynamics、force generation；可建位置/速度/力输入与限幅 | joint controller/system 提供关节控制路径，joint force command 有明确 N/Nm 语义；所选 physics engine 与插件能力仍须核验 |
| 惯性、关节限位、接触/摩擦、饱和 | RigidBody/关节/PhysicalBone 可用于视觉级响应；Godot 官方明确物理不保证确定性。限位和 motor force limit 不等于校准过的电机模型 | 面向多体动力学与接触约束；支持 actuator control/force range、关节 limits、friction/contact 参数 | 多 physics engine 插件、SDF 模型、joint/sensor systems；不同后端与插件需要固定版本和功能集 |
| 扰动反馈/传感器 | 可在场景脚本中注入扰动；传感器噪声、时间行为需自建 | 可定义 sensor 数据并通过模型/控制回路构造扰动实验 | 官方传感器集合包含 contact、IMU、force-torque 等，适合 ROS/Gazebo 联调 |
| 命令延迟/丢包、状态过期 | 用 CODA mock/fault harness 做协议与时序故障；物理场景可单独承载扰动 | 通常需外围 harness/bridge 注入，不把引擎本身视为网络模拟器 | 可用 transport/plugin/ROS bridge 组合，但具体队列、延迟和时钟语义仍应由测试 harness 定义 |
| lease、generation、handoff、迟到 receipt | 属于 CODA Adapter/协议测试，不由 Physics backend 提供；现有 mock/replay 可覆盖 | 同左 | 同左 |

## 代表性验收切片

若启动专用仿真，首批只需比较下列可复现切片；每个后端使用同一模型假设、固定 physics step、命令序列和观测口径：

1. 单关节 position/velocity step 与负载变化：扫惯量、阻尼、限位、命令饱和，比较 overshoot、settling、limit violation 和控制输入。
2. 力/力矩命令与扰动：对支持的后端施加限幅输入和外部脉冲，比较状态/力传感反馈、饱和恢复和接触残差；不支持的能力标为 `unsupported`，不以控制器脚本模拟结果冒充执行器模型。
3. 延迟、丢包、过期 observation、handoff：由统一协议 harness 注入，验证无续租、无旧 generation 写入、无第二终态；物理姿态只作为状态载体，语义结论由 CODA conformance/replay 产生。
4. 报告仿真步长、solver/contact 配置、模型版本、种子/平台、wall-time 分布、状态误差与失败率。仿真参数未经目标设备校准时，证据只支持 model-admissible 的离线研究，不支持 calibrated envelope 或 hardware safety。

## 暂缓理由与触发条件

当前实际缺口集中在 mock-driver 协议、lease/generation、receipt/replay 和视觉 Adapter；这些可以在不安装动力学引擎的前提下验证。新增 MuJoCo 或 Gazebo 不会替代独立 SafetyAuthority，也不会验证设备方 timing、传感器校准或真实力/限位。现在引入新依赖会增加模型维护、构建/CI、版本固定和重复表示成本，但尚无已选硬件 Profile 或对照 benchmark 证明收益。

因此，暂缓专用 backend，不阻断 C1-M.0 与无硬件 C1-M.1。触发重评的条件是：选定一个具体 actuator-centric 用例，现有 Godot/mock 无法表达该用例需要的激励或反馈，并且已取得对应模型/参数来源。首个候选默认为 MuJoCo；若必须复用 ROS 2/Gazebo 传感器、SDF 和现有集成栈，则改评 Gazebo Sim。两者均须先通过同一代表用例和 CODA Adapter conformance，才可进入项目依赖。

## 一手资料

- [Godot Physics introduction](https://docs.godotengine.org/en/stable/tutorials/physics/physics_introduction.html)：固定 physics callback；官方指出 Godot physics 不保证确定性。
- [Godot Generic6DOFJoint3D](https://docs.godotengine.org/en/stable/classes/class_generic6dofjoint3d.html) 与 [PhysicalBone3D](https://docs.godotengine.org/en/stable/classes/class_physicalbone3d.html)：关节限位、motor 参数与骨骼物理节点。
- [MuJoCo overview](https://mujoco.readthedocs.io/en/stable/)、[actuator model](https://mujoco.readthedocs.io/en/stable/XMLreference.html#actuator) 与 [computation/contact](https://mujoco.readthedocs.io/en/latest/computation/)：actuator 组成、control/force range、约束与接触模型。
- [Gazebo Sim Harmonic joint controllers](https://gazebosim.org/api/sim/9/jointcontrollers.html)、[sensors](https://gazebosim.org/docs/harmonic/sensors/)、[feature comparison](https://gazebosim.org/docs/harmonic/comparison/)：关节控制插件、IMU/contact/force-torque 传感器和迁移/功能边界。
