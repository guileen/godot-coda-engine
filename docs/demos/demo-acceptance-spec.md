# CODA Demo 阶段性验收规格

## 验收目标

用户应能看到 CODA 如何声明意图、生成/切换受约束计划、使用有限算力、记录决策，并在不满足硬门时安全拒绝。Demo 不是只展示成功动作的宣传片。

## 六个 Demo

1. **D1 语义编排与来源定位**：展示 EventAsset、双语投影、结构化 patch、三层差异和真实运行定位。
2. **D2 可中断行为运行时**：展示状态、优先级、取消、迟到回调和唯一终态。
3. **D3 Skeleton3D 身体技能与意图过渡**：使用 AIBI/GDBot 真实网格和骨骼，展示持续技能的 semantic phase/progress、typed claim、hard-atomic/soft-ramp/guarded-handoff、避障中断、viability/model-validity gate、direct/recovery/reject、buffer horizon、commit-time re-anchor 和物理连续 handoff；同时注入 stale epoch、状态漂移、任务变构、DoF conflict 与 kickback 反例。现有攻击→防御 smoke 只是前置切片，不能证明中断后自然恢复、动力学可达、passivity 或硬件安全。
4. **D4 物理知情多保真级联**：展示低成本筛选、局部/降阶候选、高保真验证、误差 envelope 和 decision flip。
5. **D5 Anytime 与安全边界**：展示预算变化、已认证候选、Pareto 选择和 fallback/reject。
6. **D6 失败与边界画廊**：展示过期快照、数值无效、资源冲突、外部 writer、局部极小、窄通道和超时。

## 统一画面

- 场景区：角色、姿态、目标管、安全域和资源占用；
- 时间线区：意图、快照、规划、抢占、barrier、执行、fallback/reject、终态；
- 决策区：fidelity、硬门、work units、首响应、p95/p99、内存、误差和 deadline reserve；
- 证据区：DecisionRecord、PredictionReceipt、RuntimeObservation、版本、摘要和失败码。

绿色表示可执行，黄色表示升级/验证/fallback，红色表示拒绝或域外，蓝色表示来源/版本/模型，虚线表示安全域、目标管或误差 envelope。

## 视觉可辨识性与素材边界

中间控制、碰撞、预算和数值边界测试允许使用方块、平面、胶囊或其他几何 fixture；它们用于让硬门和误差 envelope 清楚可见，不代表最终角色质量。凡是要评价姿态、惯性、关节限制、表情或“自然度”的画面，必须使用具有关节/组件的角色资产，例如 AIBI/GDQuest GDBot。

每个运行时视觉 Demo 至少要有可区分的画面状态：基线/待机、意图执行（例如挥手和微笑）、打断或 fallback、迟到回调被拒绝。验收不接受“同一张截图只换标题”；截图或录屏必须同时有语义状态差异和证据面板差异。截图本身不能证明“更自然”，自然性主张仍需独立的盲测或感知比较门。

## 必须证明的实践

- 每个资产只有一个 authoring owner：现有 Demo 可保持 `graph_owned` EventAsset，新 C1-L 具身 Demo 以 `text_owned` `.coda` 为目标；
- 抢占全取或全拒，旧 generation 永不复活；
- 低保真只能筛选，边界不确定时升级或拒绝；
- anytime 只能返回已通过硬门的候选；
- 安全、权限、数值有效性和 deadline 先过滤，再做 Pareto 比较。

## 通过条件

每个 Demo 都必须有正常、边界和失败路径，能保存/回放输入，并让屏幕数字与证据报告一致。任何 Demo 不得把技术代理指标称作“更自然”，不得把 Godot/仿真证据称作真实机器人安全证据。
