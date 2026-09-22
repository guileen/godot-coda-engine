# 提案：CODA 机器人运动意图 Adapter（C1-M）

> 状态：`PROPOSED / LANGUAGE_RUNTIME_BOUNDARY_CORRECTED`（2026-09-22）。本提案是 [CODA 意图式过渡运行时（C1-T）](intentful-transition-runtime-proposal.md) 的机器人 Adapter 验证面，尚未实现、尚未授权为 CODA 默认能力或真实电机能力。上位职责边界见 [CODA 具身语言层与运行时边界](coda-embodied-language-runtime-boundary.md)。

> **定位已更新：** C1-M 不再定义 CODA 的产品方向。CODA 的通用能力是受约束的、可插入高级规划 hook 的微观过渡规划；本文件只讨论它在关节、轨迹、抢占与独立电机安全边界上的后续适配。C1-T 的契约与离线语义门必须先通过。

## 要解决的问题

固定动画把“动作”当作必须完整播放的文件：一旦用户触摸、出现安全事件或新的行为意图到达，中途切换会瞬移、硬停或继续执行过期动作。机器人仿真和真实机器人需要的不是“播放 `attack`”，而是一个有生命周期、可抢占、可安全收敛的运动意图。

AIBI 的验证场景是：头部从当前姿态向左转、停留、回中；执行中收到打断时，从实际当前姿态生成短的收敛轨迹，而不是回放旧动画剩余部分。

## 机器人侧裁决请求

为 CODA 增加受约束的 `motion` capability/效果族，但不把 CODA 变成电机驱动器，也不建立第二个可写行为真相。当前 fixture 仍由 `graph_owned` EventAsset 声明；新的 C1-L 资产以 `text_owned` `.coda` 为目标，每个资产只能有一个 authoring owner。`TransitionPlan`、`ReactiveExecutionGraph`、`DecisionRecord`、`RuntimeObservation` 和 Adapter receipt 都是派生物；Robot Adapter 是独立执行边界。

目标链路：

```text
.coda(text_owned) / EventAsset(graph_owned) → motion intent
           → C1-T arbitration / snapshot / planning/admission
           → validated TransitionPlan + resource lease
           → Robot Adapter → simulation / future motor controller
```

## 最小语义

### 运动意图

建议以 `motion.request@1` 表达一个结构化意图，而不是自由文本或任意 GDScript：

```json
{
  "intent_id": "aibi.attention.look_left",
  "target_pose": "aibi.head.attend_left",
  "resources": ["body.head.yaw"],
  "priority": "user_input",
  "constraints": {
    "max_transition_ms": 500,
    "hold_ms": 500,
    "return_to": "aibi.head.neutral"
  },
  "safety_profile": "head_only@1"
}
```

作者源只保存语义目标、资源和约束，不保存关节目标角或时间采样轨迹。语义资源到设备关节、`target_pose` 到受限关节目标、限位与速度/加速度边界，都由版本固定的 Robot Adapter profile 解析；生成出的采样轨迹只存在于派生 `TransitionPlan`。第一版只允许已注册的语义资源、姿态 ID、有限优先级和有限 safety profile。笛卡尔目标、逆运动学、全身重心约束及任意轨迹上传作为后续版本，不在 C1-M 中隐式猜测。

Robot Adapter 不假定固定 1kHz，也不把 C1-T 监督周期当作控制周期。Controller 负责 envelope 内的连续反馈；响应监督器只评估 typed guard、TrackingEnvelope、lease 和 receipt；设备/独立安全机制在其权威位置处理硬限位、watchdog、碰撞保护和急停。`e_stop` 不是 CODA 可编排 action。

若后续以“在物理约束下最小 effort/action”选择轨迹，或以反应式场策略持续控制，必须经过 [C1-P 物理知情策略编译](physics-informed-intent-planning-proposal.md) 的独立目标函数、稳定证书、硬安全、模型误差、预算/近似和 shadow prediction 门。机器人侧允许使用经校准的低/多保真模型，但必须声明省略现象、误差 envelope、decision-flip 测试、目标设备尾延迟和 fidelity 升级/拒绝条件；这不是 C1-M 基础抢占语义的默认依赖，也不能替代硬件安全控制器。

### 生命周期和抢占

运动效果必须有稳定 `effect_id` 和 owner，并完全复用 C1-T 的生命周期、耦合闭包、严格高优先级抢占、write barrier、单级 fallback 和唯一终态，不定义第二套机器人仲裁协议。新的高优先级意图或 `interrupt` 到达时：

1. 独立安全层可以先行中止，且其权威高于 CODA；
2. Robot Adapter 在控制 tick 上撤销冲突资源的旧 generation，确认停止写入，并返回带质量、revision 和时效的实测快照；
3. 新租约在 Adapter 保持当前状态时生成并校验新计划，收敛段是新计划的前缀，不是旧轨迹的宽限期；
4. 只有 start receipt 返回后，新计划才取得写权；
5. 旧轨迹的迟到帧、完成或 receipt 必须无操作并进入 `RuntimeObservation`。

`blend_to_safe@1` 只能是经 profile 注册并通过硬件边界检查的 fallback recipe，不能被称为默认安全保证。急停、碰撞、硬限位、watchdog 或硬件故障的立即停止必须由独立安全层决定，不能由 LLM、展示层或 CODA fallback 选择。

### 来源与回放

每条运动仲裁、轨迹采样、抢占、收敛和拒绝都必须定位到：`asset_id → rule_id → effect_id → intent_id → semantic_resource_id → adapter_joint_id`，但设备关节映射只能存在于 Adapter profile/receipt，不能回写为 CODA 核心语义。同一个 EventAsset、规范输入快照和版本摘要应产生字节一致的 `TransitionPlan/DecisionRecord`；wall time、传感器质量和执行反馈进入相关联的 `RuntimeObservation`，不要求字节一致。有限计划使用的传感器读数必须先进入固定 `SnapshotBundle`，不能一边规划一边读取未记录的实时状态；若后续启用 `ReactiveFieldPolicy`，其逐 tick 状态、外力/接触和目标切换必须进入可关联的观测流，回放固定该流而不是假定初始快照足够。

## LLM 边界

LLM 日后可以提出“关注用户”“轻轻摇头”这类候选**语义意图**，但不能提出或上传可直接执行的候选轨迹。候选必须带来源和置信状态，并在进入运行时前成为可审查的结构化输入；C1-M 首版不接云端 LLM。编译器、契约、独立安全层和 Adapter profile 必须在执行前完成 schema、权限、限位、速度/加速度、碰撞、重心/支撑面、快照质量和断连检查。LLM 不能直接发关节角度、PWM、力矩或 `raw_servo`。

## C1-M 验收门

- 合法语义意图能从固定 SnapshotBundle 编译为可回放 plan；未知姿态/资源、无映射关节、越界/非有限计划、过期或低质量遥测、未知 safety profile 均 fail-closed；
- 新意图只在严格更高优先级时按 C1-T 规则抢占；旧 generation 只撤销一次，且抢占的资源/耦合闭包原子交接；
- 抢占从同一控制 tick 的实测姿态开始，不瞬移，并在指定时间内进入 Adapter profile 定义的目标容差；这不自动等于物理安全；
- 迟到完成/帧回调不会重新激活旧意图；
- Node、仿真 Adapter 和至少一个 Skeleton3D fixture 产生等价的决策结论；运行观察只要求因果顺序和终态等价；
- trace 可从资产、规则、效果、意图定位到具体关节，且不把 Adapter 的模型骨骼名提升为 CODA 语义 ID；
- 不接真实电机、不接云端 LLM、不宣称动力学或重心安全已经解决。

## 明确非目标

- 不把 `AnimationPlayer`/`AnimationTree` 的模型原生片段当作 CODA 运动语义；
- 不把采样轨迹、关节目标角或设备 safety profile 写回 EventAsset；
- 不实现任意模型自动 retarget、完整 IK、MPC、动力学仿真或全身平衡；
- 不允许自然语言在运行时直接解释为电机命令；
- 不改变现有 C0/P3 `graph_owned` EventAsset 发布基线；C1-L 的 Text-Owned 迁移必须经过独立 authoring ownership 门。
