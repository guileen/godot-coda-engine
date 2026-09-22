# CODA 机器人运动意图语言扩展（C1-L）

状态：`DESIGN_PROPOSAL / LANGUAGE_RUNTIME_BOUNDARY_CORRECTED / MOTION_INTENT_SCHEMA_AND_MINIMUM_IR_IMPLEMENTED / FULL_DECLARATIVE_SYNTAX_PENDING`

本文回答一个核心问题：CODA 如何从“编排游戏流程的语言”扩展为“编排受约束机器人运动意图的语言”。目标不是把 Godot API、关节角、PWM 或任意轨迹直接暴露给作者，而是让作者能够声明可理解、可抢占、可验证的高层运动意图。

本轮外部审查后的上位边界见 [`coda-embodied-language-runtime-boundary.md`](coda-embodied-language-runtime-boundary.md)。高置信度裁决是：`MotionIntent` 只是 TaskGraph 中一种 effect，不是 CODA 的最终中心抽象；完整语言还必须区分 `ObservationContract`、`HybridModeGraph`、`TrackingEnvelope`、`ControlContract` 和派生的 `ReactiveExecutionGraph`。CODA 编译这些契约，但不在监督周期中解释源码，也不与底层 Controller 竞争连续反馈控制。

### 作者事实源的迁移边界

新的 C1-L 具身语言资产以 `text_owned` 为目标：`.coda` 是唯一可编辑作者事实源，EventAsset/AST/IR/plan 都是确定派生物。现有 P0/P1/P3 的 `graph_owned` EventAsset 发布基线暂不重写；过渡期每个资产必须显式选择且只能选择一种 authoring ownership。稳定 node identity、lossless formatter、GUI AST transaction 和迁移恢复未通过前，不宣称旧资产已经 Text-Owned。

## 现有语言能做什么

当前 CODA 已有：

- `事件` / `event`：声明一个可触发流程；
- `令` / `let`：声明局部计算；
- `执行` / `do`：调用同步能力；
- `等待` / `await`：等待跨帧能力；
- `发出` / `publish`：发布版本化主题；
- capability manifest：声明参数类型、线程、等待、取消和 E0 失败语义。

因此可以先写出：

```coda
事件 回应用户（声源） [标识：robot.acknowledge_user]：
  等待 robot.request_motion_intent@1(
    intent: "acknowledge_user",
    target: "orient_to_source",
    source: 声源,
    duration: 1.2s
  )
```

但这还不够。它没有表达资源范围、优先级、抢占、快照质量、安全域、fallback 或“动作完成”的判据，不能作为 C1-T/D3 的最终语言层。

## 最终语言方向：身体技能，而不是动作播放

最终语言的一等对象是 `EmbodiedSkill`。下面语法只是待冻结的可读设计稿，不代表 parser 已经实现：

```coda
skill taiji.cloud_hands@1(actor: humanoid) {
  require capability body.whole_body_control@1
  require capability body.support_state@1

  observe actor.body_state {
    freshness <= 20ms
    estimator_status == healthy
  }

  maintain balance {
    com_projection inside support_region margin >= profile.balance_margin
    angular_momentum within profile.relaxed_momentum
  }

  phase shift_left progress s in 0..1 {
    task actor.pelvis follows profile.weight_shift_left(s)
    task actor.right_hand follows arc(profile.cloud_hand_arc, s)
    prefer tension == relaxed
    complete when s == 1 and balance settled profile.balance_dwell
  }

  checkpoint after_shift_left

  on interrupt obstacle.near priority 90 {
    enter skill locomotion.evade@1 preserving balance
    resume compatible_phase within 1200ms
    otherwise restart checkpoint after_shift_left
    on no_solution => reject cannot_resume_safely
  }
}
```

这里的 `balance`、`arc`、`relaxed` 都是语义合同：它们必须由目标 `EmbodimentProfile` 绑定到具体实现和可验证范围。游戏后端可以 lower 为 motion matching、IK、animation warp 与物理骨骼约束；双足机器人可以 lower 为状态估计、接触计划与 whole-body controller；无人机的 `hold_pose` 可以 lower 为位置—速度—姿态—角速度级联。没有对应 capability 或有效域证据时，结果是 `unsupported/reject`，不是自动生成一个未经验证的控制器。

同一个技能可由 100 个智能体共享源码，但每个实例必须有独立的 observation、phase/progress、lease/generation、ContinuationToken 和 receipt。共享程序不意味着共享运行状态。

### 中断与恢复语义

`pause/resume` 不是动画播放器的时间游标。语言至少要允许作者选择：

- `exact_phase`：仅在仍处于原 phase capture region 时恢复；
- `compatible_phase`：在允许的 phase/window 内寻找物理状态相容的重入点；
- `checkpoint`：回到最近的语义稳定点，并生成当前状态到该点的 bridge；
- `replan_remaining`：保持任务后置条件，重新规划余下部分；
- `reject`：没有安全、自然且按时的重入方案时终止。

无论哪一种，都必须从当前实测状态生成过渡 bridge，不能瞬移到旧骨骼 pose，也不能让旧 generation 恢复写入。

### 两套语言外协议

- `IntentProtocol@1` 服务 LLM、游戏逻辑和业务程序，提供 invoke/amend/interrupt/pause/resume/cancel 与状态/终态回执。
- `EmbodimentProtocol@1` 服务 Controller/Adapter，交换 task-space reference、constraint、mode、observation、authority lease、handoff 和执行回执。

独立的 `SafetyAuthorityPort@1` 可以越过普通流程撤销写权；它不是第三套供业务编排的动作 API。

这组结构合同位于 [`contracts/c1l/`](../contracts/c1l/)，索引为 [`contract-index.json`](../contracts/c1l/contract-index.json)，正例见 [`contract-pack.json`](../gseos/fixtures/c1l/contract-pack.json)。`EmbodiedSkill@1` 固定 `text_owned` 与 phase/progress/resume 语义；`IntentProtocol@1` 只接收版本化技能引用和语义参数；`EmbodimentProtocol@1` 对 capability、observation、reference、lease、handoff 和 receipt 使用有方向的消息类型；`SafetyAuthorityPort@1` 单向保留独立撤权/保护权；`EmbodimentDynamicsProfile@1` 声明目标拓扑、接触/耦合模型和保证等级。该合同包仍是结构设计和 Godot 视觉正例，不包含运行时实现、目标设备校准或授权。

每个资产的唯一作者源由 [`AuthoringOwnership@1`](../contracts/c1l/authoring-ownership.schema.json) 标记为 `text_owned` 或 `graph_owned`。GUI 修改必须携带期望 owner revision、source fingerprint、稳定 node ID 和字段路径，经 [`AuthoringTransaction@1`](../contracts/c1l/authoring-transaction.schema.json) 写入单一 target source；EventAsset、文本投影、ExecutionPlan 与生成代码都只能作为只读派生物。迁移改变 owner 时必须原子切换；revision/fingerprint 冲突返回无部分写入的 receipt。Godot EventAsset store 已为写入、Undo/Redo 与投影写回增加可选 compare-and-swap，发现磁盘资产在预览后变化会拒绝覆盖；该机制目前比较完整的 EventAsset snapshot，不等同于 owner revision/source fingerprint 协议。对应正反例见 [`authoring-ownership-pack.json`](../gseos/fixtures/c1l/authoring-ownership-pack.json)。text-owned AST transaction、稳定节点迁移和恢复仍未完成。

Node 参考核心另提供 `applyAuthoringTransaction`，对 graph-owned JSON 来源执行 owner revision/source fingerprint CAS、稳定 node ID 和 per-node fingerprint 校验；候选 source 与 node-identity digest 必须完全匹配后才产生递增 owner revision 的新状态。该纯函数不写磁盘，不支持 owner migration，也尚未接入 Godot GUI。

### 物理 refinement、时域与并行 claim

语言中的 `maintain balance`、`resume compatible_phase` 或并行 `walk + upper_body_skill` 只有在 `EmbodimentDynamicsProfile@1` 提供 actuation/contact/coupling refinement 后才可 lower。编译期最多证明合同存在且类型兼容；目标设备的动力学可达性仍须由声明证据等级的 `ViabilityGate` 和执行准入验证。

`EmbodimentProtocol@1` 必须把写权与数据时效拆开：`AuthorityLease` 决定 writer，`ObservationFreshness` 决定状态是否可用，`CommandValidity/BufferedHorizon` 决定 Controller 可继续消费多久，`Liveness` 只触发冻结的 hold/backup/failsafe。下行可以是 segment、spline、setpoint sequence、local policy 或 hold reference，不在核心语言中固定为多项式。

并行技能声明 `exclusive/composed/nullspace/observe_only` claim。`composed/nullspace` 不是两个技能直接写同一关节，而是把多个 task 提交给一个受信任的 composition controller，由它在硬约束、奇异性和当前 contact mode 下统一求解；无法组合时必须抢占或拒绝。

任务增删还必须选择获批的 activation class：安全/接触/撤权使用 `hard_atomic`，可交易偏好使用 `soft_ramp`，controller/contact mode 变化使用先预求解再提交的 `guarded_handoff`。语言作者不能用任意 `fade_ms` 让硬约束缓慢生效，也不能规定某个后端必须使用特定 S 曲线。

`ContinuationToken` 只携带 epoch、时间/clock quality、状态 belief/envelope 和版本化 predictor/profile 引用；在 write barrier，Adapter 必须用本地最新状态重新锚定 bridge 并验证 start tube。物理 handoff 则由 `HandoffContract` 保证旧 writer 原子失权、incoming/backup 同步接管以及设备相关的 command/contact/impedance 连续性；可选 passivity ledger 不能替代状态安全。

## 当前已实现的最小语法

当前编译器可将纯线性 `MotionIntent` ExecutionPlan lower 为版本化 `TaskGraph`：每个意图保留稳定 node ID、作者 source-ref 和资产指纹；校验器检查引用、依赖/边一致性、重复节点与 DAG；空计划、分支或混合普通指令均拒绝生成部分图。该切片不代表完整 Observation/Mode/Tracking/Control 图 lowering 或运行时准入。

C1-L 当前已经落地一条可解析、可校验、可 lower 的紧凑形式。它产生专用 `motion_intent` 节点和 `MotionIntent` 计划指令，并在编译期要求目标、资源、优先级、安全 profile 与无解策略。该形式只验证 source → IR → 双后端 envelope 的最小链路；扁平 `target/resources/expression` 字段不是最终任务、观测、模式或控制契约：

```coda
event robot.acknowledge.user:
  intent robot.acknowledge_user@1(target: "pose.orient_to_source", resources: "robot.head@1+robot.torso@1", priority: 80, safety_profile: "aibi.gdbot.safety@1", on_no_solution: "safe_stop")
```

对应的可复跑源码、EventAsset、计划 fixture 和测试分别位于 [`examples/robot-acknowledge.coda`](../examples/robot-acknowledge.coda)、[`gseos/events/robot.acknowledge_user.gse.json`](../gseos/events/robot.acknowledge_user.gse.json)、[`demos/d3-skeleton-transition/fixtures/robot-acknowledge.plan.json`](../demos/d3-skeleton-transition/fixtures/robot-acknowledge.plan.json) 与 `packages/local-core/test/gseos.test.js`。多行 `resources/constraints/preempt/receipt` 语法仍是后续 C1-L.1 的扩展，不应被误解为本轮已经全部实现。

## 从“挥挥手”到两条执行路径

CODA 的高层意图可以由大语言模型或人工作者提出，但模型只生成经过解析、校验和权限过滤的语义意图，不能直接生成 GDScript、关节角、PWM 或电机写入。相同意图先经过共享的语法、类型、单位、frame、capability 和权限检查，再分别进入后端特有的模型、Adapter 与安全准入；游戏与机器人不能互相继承安全证据：

```coda
module companion.greeting

event companion.greet:
  intent social.wave@1(target: "person.nearby", expression: "friendly_smile", resources: "character.right_arm@1+character.face@1", priority: 60, safety_profile: "game.character.safe@1", on_no_solution: "fallback")
```

这个示例的可复跑入口是 [`examples/social-wave.coda`](../examples/social-wave.coda)，对应 EventAsset 是 [`gseos/events/social.wave.gse.json`](../gseos/events/social.wave.gse.json)。它表达的是“对附近的人友好地挥右手并带微笑”，不是“把右臂关节写成某组角度”。

共享流水线固定为：

```text
LLM/作者高层意图 → CODA parse + static contract checks
  → TaskGraph / MotionIntent effect / Observation + Mode contracts
  → backend lowering + candidate generation
  → model / resource / numerical / deadline / Adapter / safety admission
  → ReactiveExecutionGraph → Controller/Adapter 执行与 receipts/observations
```

游戏路径使用 `GameIntentBackend@1`（当前标识 `godot.motion@1`），将意图落为 `GameIntentPlan`，再由 Godot Adapter 选择已登记的动画 profile、Skeleton3D/角色控制器和表情 profile。游戏可以用 practical perceptual fidelity，但仍必须显示来源、硬门和终态。

机器人路径使用 `RobotIntentBackend@1`（当前标识 `robot.motion@1`），将同一意图落为 `RobotMotionEnvelope`，交给受信任的 robot Adapter 和独立 Safety Mechanism，再由硬件侧产生适配器拥有的电机命令包。CODA/LLM 永远没有直接 PWM、力矩或 raw-servo 写权；机器人还必须使用实测校准的误差 envelope。

两条路径的差异不是换一套自然语言，而是换 backend contract、资源 registry、误差/安全包络和 receipt。`packages/local-core/src/gseos/intent-backend.js` 提供当前最小的契约级分流，测试验证同一 `social.wave@1` 同时得到两个不同 envelope，且不产生直接写硬件的指令。

## C1-L 新增的五个语言概念

### 1. 运动意图 `intent`

作者声明“想让机器人表现什么”，不声明如何驱动骨骼或电机：

```coda
意图 关注用户：
  目标 姿态.朝向（声源）
  体验 轻微点头
```

`意图` 生成的是候选 `TransitionPlan`，不是直接执行命令。目标可以是已注册的语义姿态、姿态关系或有限 profile，不允许任意未审查轨迹。

### 2. 资源租约 `resources`

意图必须声明要占用的资源和耦合闭包：

```coda
  资源 [机器人.头部, 机器人.躯干]
```

资源来自版本化 `ResourceRegistry@1`。CODA 只允许全取或全拒；作者不能在代码中直接改写 AnimationTree、Skeleton3D 或外部电机 writer。

### 3. 优先级和抢占 `priority / preempt`

```coda
  优先级 80
  可被更高优先级打断
  打断时 收敛到 姿态.安全中立
```

同优先级或更低优先级不能隐式插队。抢占经 write barrier 原子完成，旧 generation 迟到回调只能记录为无副作用拒绝。

### 4. 约束和安全 `within / safety`

约束表达可验证的边界，不把安全问题压成一个权重：

```coda
  约束：
    头部.pitch 在 -15deg..25deg
    头部.yaw 在 -60deg..60deg
    首响应 不超过 120ms
    完成 不超过 1200ms
  安全：
    快照 必须同一物理帧
    输入 仅允许声明的扰动包络
    无可行计划时 拒绝
```

`约束` 是可检查的候选准入条件；`安全` 绑定独立 `SafetyMechanismProfile`、backup 或拒绝终态。作者代码可以请求更严格约束或引用部署允许的 profile，但不能选择比设备/部署基线更宽松的安全机制；权威安全 profile 由 deployment/Adapter 绑定。代码不能通过放宽约束来保证“动作一定成功”。

### 5. receipt 和生命周期 `await receipt`

动作完成不是“调用返回”或“solver 停止”，而是有来源和终态的 receipt：

```coda
  等待 robot.motion_receipt@1
  若（结果.终态 为 "rejected"）：
    等待 robot.fallback_receipt@1
```

receipt 至少区分：`accepted`、`started`、`preempted`、`completed`、`fallback`、`rejected`、`owner_lost` 和 `stale`。决策记录可重放，实际 wall time 和执行观察单独记录。

## 推荐的完整写法

```coda
模块 companion.robot

资源 机器人.头部 [标识：robot.head@1]
资源 机器人.躯干 [标识：robot.torso@1]

事件 回应用户（声源） [标识：robot.acknowledge_user]：
  意图 关注用户：
    目标 姿态.朝向（声源）
    资源 [机器人.头部, 机器人.躯干]
    优先级 80
    可取消
    可被更高优先级打断
    打断时 收敛到 姿态.安全中立
    约束：
      头部.pitch 在 -15deg..25deg
      头部.yaw 在 -60deg..60deg
      首响应 不超过 120ms
      完成 不超过 1200ms
    安全：
      profile "aibi.gdbot.safety@1"
      快照 必须同一物理帧
      无可行计划时 拒绝
  等待 意图完成
  发出 robot.intent_completed@1（意图："acknowledge_user"）
```

等价的英文机器可审阅形式可以保留稳定 ID：

```coda
module companion.robot

event acknowledge_user(source) [id: robot.acknowledge_user]:
  intent acknowledge_user:
    target pose.orient_to_source(source)
    resources [robot.head@1, robot.torso@1]
    priority 80
    cancellable
    preempted_by higher_priority
    converge_to pose.safe_neutral
    constraints:
      head.pitch in -15deg..25deg
      head.yaw in -60deg..60deg
      first_response <= 120ms
      complete <= 1200ms
    safety profile "aibi.gdbot.safety@1"
  await intent.completed
```

## 生成后的中间表示

作者代码不直接生成关节写入，而生成带来源的父 effect 和受约束子计划：

```json
{
  "command_id": "motion_intent",
  "node_id": "acknowledge-user-motion",
  "params": {
    "intent": "acknowledge_user",
    "target": { "pose_id": "pose.orient_to_source@1", "source": { "ref": "声源" } },
    "resources": ["robot.head@1", "robot.torso@1"],
    "priority": 80,
    "constraints": { "profile": "aibi.gdbot.motion@1" },
    "safety": { "profile": "aibi.gdbot.safety@1", "on_no_solution": "reject" },
    "preemption": { "policy": "higher_priority_only", "converge_to": "pose.safe_neutral@1" }
  },
  "source_ref": { "event_id": "robot.acknowledge_user", "path": "/root/0" }
}
```

`MotionIntent` 是父 TaskGraph 中一种 effect；它可以派生 `TransitionPlan`，但不能替代完整的任务阶段、观测门、混合模式和闭环监督表示。`TransitionPlan`、`ReactiveExecutionGraph`、lease、generation、Adapter receipt 和 RuntimeObservation 都是派生物，不能回写成第二个可编辑事实源。

当前独立契约文件是 [`contracts/gseos/motion-intent.schema.json`](../contracts/gseos/motion-intent.schema.json)，目标能力配置由 [`contracts/gseos/intent-backend-profile.schema.json`](../contracts/gseos/intent-backend-profile.schema.json) 描述，示例见 [`gseos/fixtures/intent-backend-profiles.json`](../gseos/fixtures/intent-backend-profiles.json)。编译只在目标 Profile 满足后端所需能力时生成 envelope；缺失能力必须由 Profile 显式映射到已声明替代能力，否则返回 `INTENT_BACKEND_CAPABILITY_UNSUPPORTED`。替代映射会写入 `capability_resolution`，供审阅者看见。一个后端中立的最小子计划 fixture 是 [`gseos/fixtures/social.wave.transition-plan.json`](../gseos/fixtures/social.wave.transition-plan.json)。这些契约冻结字段责任和写权限边界，但不冒充已经完成 C1-T 的完整数值 validator 或真实机器人安全证明。

## 不能写进 CODA 的内容

以下内容必须留在 Adapter、Safety Mechanism 或受信任后端：

- 直接关节角序列、PWM、力矩、电流或 `raw_servo`；
- 任意 `AnimationTree`/`Skeleton3D` 写入；
- 未注册的骨骼、资源、碰撞体或 NodePath；
- 通过 `escape` 绕过租约、快照、硬限位或 fallback；
- LLM 直接生成可执行轨迹；
- 用单一 effort/smoothness 权重替代硬安全和 deadline。

## C1-L 验收边界

语言扩展至少需要验证：

1. 未声明资源、姿态、profile、约束和 safety 都在编译期拒绝；
2. 同一语义输入生成稳定的 EventAsset/plan/source map；
3. 旧 generation、迟到 receipt 和 owner 失效不能形成第二终态；
4. 约束只能收紧或拒绝，不能由 runtime 静默放宽；
5. D3 能从 CODA 代码追踪到 TransitionPlan、Skeleton3D Adapter 和最终 receipt；
6. C1-M 机器人 Adapter 不能让游戏/仿真语言代码直接获得电机执行权。
7. 同一高层意图可以稳定 lower 到 Godot 与机器人两个后端，但两个后端的执行 contract、误差包络和安全 receipt 必须明确分离。
8. `ReferenceFrame`、`PlanningHorizon`、`SupervisoryCycle`、`ControlCycle` 与 Godot `PhysicsTick` 语义分离；语言和核心 IR 不写死通用频率。
9. Guard 按信息来源、deadline、计算成本和权威部署；TrackingEnvelope 内的连续误差由 Controller 闭环处理，核心监督器只执行预授权升级策略。
10. 静态合法、候选可行、Adapter 可执行、安全准入和实际完成使用不同 receipt/状态，不能统称为“已证明”。
11. 跨 embodiment 只承诺保持声明的后置条件、安全/权限不变量和验收证据；不承诺轨迹、关节、控制器或动作外形相似。

这使 CODA 的定位清楚：它是“意图与生命周期的编排语言”，而不是关节控制器、物理引擎或硬件安全控制器。
