# 提案：CODA 意图式过渡运行时（C1-T）

> 状态：`PROPOSED / LANGUAGE_RUNTIME_BOUNDARY_CORRECTED`（2026-09-22）。本文定义待批准的产品边界和证据门，**不授权实现**；只有 `G-C1-T-A` 通过后，相应契约才被冻结。首个验证面是游戏中的姿态过渡；[机器人运动意图 Adapter 提案](robot-motion-intent-proposal.md)是后续严格 fixture，不是 CODA 的产品定义。具身语言、响应监督、Controller 与安全权威的上位边界见 [CODA 具身语言层与运行时边界](coda-embodied-language-runtime-boundary.md)。

## 当前裁决与终态主张

CODA 拟从“把既有游戏流程写清楚”扩展为能够声明、选择、生成并审计**受约束的微观过渡计划**的运行时。作者表达高层意图、资源和体验约束；CODA 只在明确取得控制权的资源上产生有限计划；Godot 或设备 Adapter 只执行已获租约、已经校验且版本匹配的计划。

首个切片真正需要证明的是：

> 对一个版本固定的“攻击收势 → 高位防御”fixture，运行时能从 Adapter 同一控制边界上的实际姿态出发，在有界预算内产生满足机械代理指标的计划；更高优先级意图只抢占其耦合闭包内的资源；所有采用、拒绝、回退和完成结论都可重放或关联到不可重放的执行观察。

这项主张不等于“自动生成自然动画”。本文现在区分三层证据：**过渡有效性**证明连续、受限并到达目标；**声明目标下的最优性**证明候选在固定 dynamics model、约束和成本函数下优于基线；**感知自然性**证明目标用户确实觉得结果更自然。三者不能互相冒充。物理目标函数与反应式场策略的条件扩展见 [CODA 物理知情策略编译（C1-P）](physics-informed-intent-planning-proposal.md)。

## 用户可观察的边界

游戏作者最终可以声明“攻击收势转为高位防御”“惊讶缓和为安心”或“镜头从跟随切换为对焦”，而不手写每个骨骼、混合权重和帧间回调。一次被接受的执行应当：

- 在 profile 规定的首响应预算内开始呈现目标意图；
- 从同一控制边界采集的当前呈现状态起步，而不是从资产里的陈旧起点起步；
- 在高优先级意图到达时，只中止发生冲突或被声明为耦合的资源，其余独立资源继续；
- 能解释采用了哪个 profile、recipe、hook 版本和工件摘要，使用了哪份输入快照，发生了何种回退；
- 让项目算法参与规划，但不让其取得 Adapter 句柄、扩大资源、修改事实源或放宽核心约束。

首个实现范围只有一个 `Skeleton3D` fixture。表情是第二验证面；镜头、UI 和机器人只证明抽象的候选适用面，不自动进入 C1-T 首版。

## 架构、事实源与父生命周期

```text
.coda(text_owned) 或 EventAsset(graph_owned) → 统一语义模型
  → ExecutionPlan / BehaviorPlan 中的 transition effect
  意图、优先级、资源、体验约束、允许的 hook/profile
                              ↓
Intentful Transition Runtime
  静态准入 → 资源交接/快照 → 规划流水线 → 核心校验 → 租约提交 → 决策记录
                              ↓
Domain Adapter
  控制权声明、状态快照、计划执行、write barrier、receipt
                              ↓
AnimationTree / Skeleton3D / 后续严格 Adapter
```

| 层 | 可以做什么 | 不可以做什么 |
| --- | --- | --- |
| 作者源/统一语义模型 | 声明意图、资源、优先级、约束、允许的 profile/hook 与一个有界回退；每个资产只有一个 authoring owner。 | 让 `.coda` 与 EventAsset 双写，或保存隐式运行时姿态、生成后的轨迹和任意脚本。 |
| 父 `ExecutionPlan/BehaviorPlan` | 启动、等待或取消一个 transition effect，并接收唯一终态。 | 绕过 transition 仲裁器直接驱动同一资源。 |
| Transition Runtime | 准入、取得资源租约、采集快照、运行规划流水线、校验、提交和关联证据。 | 直接访问任意 Godot 对象、信任未校验输出，或越过独立安全层。 |
| 规划器与 Hook | 在固定输入、资源、work budget 和输出 schema 内生成候选或附加拒绝理由。 | 直接执行、发起 I/O、修改资产、仲裁资源或放宽核心/Adapter 限制。 |
| Adapter | 声明可控资源和外部 writer，执行已提交计划并报告 barrier/start/terminal receipt。 | 把骨骼路径或设备协议提升为 CODA 语义，或宣称未验证的安全保证。 |

每个资产必须只有一个可写作者事实源。现有 C1-T fixture 继承 P0/P1 的 `graph_owned` EventAsset 基线；新的 C1-L 具身资产以 `text_owned` `.coda` 为目标，EventAsset/AST/IR 是确定派生物。迁移前不得让 `.coda` 与 EventAsset 双写。无论哪种 authoring mode，`TransitionPlan`、`ReactiveExecutionGraph`、快照、租约、执行句柄、receipt 和 trace 都是派生物；profile、resource registry、hook manifest 与 Adapter profile 是版本化只读契约。`TransitionPlan` 是父 plan 中一个 effect 的派生子计划，不建立独立调度真相。父 run 被取消、owner 失效或终止时，必须经同一 write barrier 撤销其全部租约；transition 的迟到 receipt 不得重新完成父 run。

## 响应监督而非中频控制

C1-T runtime 只能成为一个预编译、有界工作的响应监督器，不成为第二个连续控制环：

- `ReferenceFrame` 表示空间坐标关系；`PlanningHorizon` 表示规划时域；`SupervisoryCycle` 表示设备相关的监督周期；`ControlCycle` 表示底层控制周期。四者不得再混称“帧”。
- CODA 源码、通用 AST 和 JSON 不在监督周期中解释；未来 `ReactiveExecutionGraph` 必须是派生的 typed IR，由原生 runtime 执行固定 monitor、guard、lease 和 receipt 操作。
- 状态位于 Controller 声明的有效域与 `TrackingEnvelope` 内时，连续误差由 Controller 闭环消化。监督器只可触发 profile 预授权的边界收缩、backup、异步重规划或拒绝，不能逐周期重写关节/骨骼控制量。
- `SupervisoryCycle` 没有跨设备固定频率，也不能由单一传感器采样公式自动推出；RuntimeProfile 必须结合端到端 deadline、WCET、数据新鲜度、通信延迟和目标设备 p95/p99 测量冻结。
- `TrackingEnvelope` 是多维 typed predicate 集合，不是通用标量误差或固定四区。`scale_feedrate`、旧 controller rollback 和曲线重生成都只在 profile 证明其适用且当前状态仍在有效域时允许。
- 安全是跨层权威平面。CODA 可以记录并服从安全中止，不能把 `e_stop` 当作普通可编排 action，也不能延迟、解除或覆盖独立安全机制。

因此 `within/max_transition_ms` 表示 deadline 或最大持续时间，不表示运行时等到超时才响应；更快的 guard、controller feedback 和安全动作分别按其部署层工作。

## 最小声明模型

以下只是 `C1-T.0` 要冻结的说明性形状，不是已批准 schema：

```json
{
  "effect_id": "combat.guard.enter",
  "capability": "transition.request@1",
  "intent": {
    "from_hint": "combat.attack.recovery",
    "to": "combat.defense.guard_high",
    "style_profile": "combat.grounded_responsive@1"
  },
  "resources": ["body.lower", "body.spine", "body.arms"],
  "priority": 70,
  "constraints": {
    "first_response_ms": 120,
    "preserve_contacts": ["feet"],
    "max_transition_ms": 450
  },
  "allowed_hooks": ["game.combat.guard_bias@1"],
  "fallback_profile": "combat.safe_guard@1"
}
```

`to` 是稳定的语义姿态/状态 ID。`from_hint` 只能用于诊断、recipe 选择或一致性检查，**不能覆盖 Adapter 快照**。模型 animation clip、骨骼路径、逐帧角度和生成后的轨迹都不进入 EventAsset。

## 资源、耦合与确定性仲裁

### 资源注册表

`ResourceRegistry@1` 必须把语义资源定义为有限的有序树；父资源在编译时展开为确定排序的叶资源，不允许运行时通配符。首版只有排他写租约，没有共享写或隐式读锁。两个请求在规范化叶集合相交时冲突。

“只抢占局部资源”只有在资源确实可独立执行时才成立。profile 因此必须声明 `coupling_groups`：请求、计划段或抢占触及组内任一资源时，租约集合扩展到整个耦合闭包。若一段全身动作不能在失去手臂后安全地继续驱动脊柱，就必须把它们声明为同一耦合组；不得靠运行时猜测依赖。这样会牺牲部分并行性，但避免把视觉上局部的抢占伪装成语义上安全的局部抢占。

所有资源一次性全取或全拒，按规范顺序提交，不允许部分持有后等待，因此首版不产生租约死锁。每个叶资源上的写入都必须携带 `lease_id + generation + plan_id`；不匹配的帧、回调和 receipt 只产生无副作用的诊断记录。

### 仲裁规则

- 数值越大的 `priority` 越高；同一批请求按 `sequence` 越小越先处理，二者构成唯一总序。
- 只有**严格更高优先级**请求可以抢占现有冲突租约；同优先级或更低优先级请求以 `RESOURCE_BUSY` 拒绝。
- C1-T 首版没有隐式等待队列，也不把陈旧意图稍后自动执行。调用方若仍需要该意图，必须以新的 sequence 明示重试。
- 一个请求的规范化资源及耦合闭包必须原子取得；无法全部取得时，不发生快照、hook、取消或部分写入。

### 抢占交接协议

抢占不是“先取消旧动画、以后再想办法”，而是一个 Adapter 控制边界上的有界事务：

1. **静态准入：** 在触碰运行资源前验证 intent、profile、resource registry、hook manifest、fallback 和 Adapter 能力版本；失败无副作用。
2. **write barrier：** 在一个 Adapter 控制 tick 上原子撤销冲突/耦合闭包的旧 generation；旧计划保留的独立资源不受影响。Adapter 返回 barrier receipt 和同一边界上的 `SnapshotBundle`。
3. **有界持有：** 被接管资源由 Adapter 保持在已报告状态，新租约处于 `planning`，尚无任意规划输出的写权。
4. **规划与提交：** 规划流水线在预算内产生并通过核心及 Adapter 校验后，运行时原子提交 plan，Adapter 返回 start receipt，新租约进入 `executing`。
5. **失败：** 超时、无效输出或 Adapter 拒绝时，旧 generation 永不自动复活；运行时只可采用预先声明且同样通过校验的单级 fallback，或命令 Adapter 保持并以 `failed` 结束。

“收敛段”是新计划从 barrier 快照开始的可验证前缀，不是旧计划继续写入的宽限期。急停、碰撞和设备故障始终可在更低层越过此协议，但必须留下独立安全层的 receipt。

计划生命周期为：`requested → admitted → planning → ready → executing → completed`。`rejected` 只发生在未取得资源前；取得资源后只能进入唯一的 `completed / cancelled / preempted / failed` 终态。`completed` 必须由 Adapter 按 profile 的完成条件确认，逻辑时钟到点不等于完成。

## 快照、计划与 receipt 契约

### `SnapshotBundle`

快照至少绑定：Adapter/profile 版本和摘要、规范资源及耦合闭包、坐标系与单位、同一控制 tick/revision、状态值、捕获来源、有效期和质量标志。浮点顺序、精度与量化规则必须由 profile 固定；`NaN/Infinity`、未知通道、过期 revision、跨资源超过允许 skew 或缺失必需值都 fail-closed。首个 Skeleton fixture 必须能在同一 physics tick 原子采集全部受控骨骼；不能做到时不得假称“从当前状态起步”。

### `TransitionPlan`

每个有限计划至少声明：计划/profile/快照摘要，所需 lease generation，有限段列表，段所写语义资源，时间边界，允许的插值/混合 recipe，位置/速度/加速度等 profile 边界，接触与耦合约束，首响应条件、完成条件和最大持续时间。核心校验器必须拒绝未租资源、非有限数、时间倒退、首样本不连续、越界值、未知 recipe、缺失完成条件以及 Adapter 不支持的通道。

首版只允许版本固定的确定性 recipe，例如姿态混合和有限曲线缓动。完整 IK、运行时搜索、物理平衡、MPC、学习模型和自由轨迹生成不是 C1-T.1 的隐式承诺。

### Adapter receipt

至少区分 `barrier_receipt`、`start_receipt` 和唯一 `terminal_receipt`。每份 receipt 绑定 Adapter revision、资源、lease/generation、plan 和实际状态；terminal receipt 还必须说明完成、取消、抢占、失败或更低层安全中止。receipt 可以证明 Adapter 接受或观察到了什么，不能单独证明物理世界安全或感知自然。

## Hook 流水线与信任边界

首版流水线顺序固定为：

```text
intent_resolver → plan_selector → built-in planner → plan_modifier
→ core validator → project validator(s) → Adapter validator → commit
```

同类型多个 hook 按 manifest 中固定的 `(order, hook_id, version)` 串行执行；每一步只接收固定快照和前一步的规范输出，并记录输入/输出摘要。`intent_resolver` 只能从 profile 预先列出的语义候选中解析；`plan_selector` 只能选择已注册 recipe；`plan_modifier` 只能修改 schema 标记为可调的字段；项目 `validator` 只能 `pass` 或附加拒绝，不能请求 runtime 采用某个 fallback，更不能覆盖核心或 Adapter 拒绝。fallback 由 runtime policy 决定，最多一层，不递归调用失败 hook，且资源只能相同或更少。

每个 hook manifest 必须固定 `hook_id@version`、可执行工件摘要、runtime ABI、输入/输出 schema、允许资源、确定性等级、work budget、wall watchdog、失败码和是否允许在 fallback 中出现。超预算、异常、摘要不匹配或无效输出只能拒绝/回退，不得留下部分执行。

**必须诚实说明的安全边界：** “纯函数、无 I/O”若只写在 manifest 中，是契约而不是安全沙箱。同进程 GDScript/JavaScript 模块仍可能读写全局状态或发起 I/O。C1-T.0/C1-T.1 因此只允许仓库内受信任、摘要固定、可在测试中重放的项目 hook；它可以证明输出受到 schema/租约约束，不能证明恶意代码没有副作用。接纳不受信任的第三方 hook 前，必须另行选择受限 DSL、WASM capability sandbox 或隔离进程，并建立逃逸测试。非确定性/学习模型 hook 同样不进入首版运行时；日后只能作为候选提供者，经单独门禁和确定性验证后使用。

## 回退与失败语义

fallback 是预注册、摘要固定的 built-in profile/recipe，不是异常回调。它必须保持同一语义目标，只能使用原资源集合的子集，不能放宽资源所有权、幅度、接触、Adapter 或安全约束；只能放宽 effect 中明确列出的体验偏好。每次请求最多尝试一次 fallback，失败后保持并终止，不形成 fallback 链。

首版至少冻结以下稳定拒绝族；具体码在 C1-T.0 定稿：

| 失败面 | 最低稳定拒绝族 | 是否可能已取得资源 |
| --- | --- | --- |
| 静态准入 | `UNKNOWN_PROFILE / RESOURCE_UNDECLARED / HOOK_NOT_ALLOWED / ADAPTER_INCOMPATIBLE` | 否 |
| 仲裁 | `RESOURCE_BUSY / PRIORITY_NOT_HIGHER` | 否 |
| 快照 | `SNAPSHOT_MISSING / STALE / INCOHERENT / INVALID_VALUE` | 是，仅在 barrier 后 |
| 规划/Hook | `BUDGET_EXCEEDED / HOOK_FAILED / INVALID_OUTPUT / NON_REPLAYABLE_INPUT` | 是 |
| 校验/提交 | `PLAN_OUT_OF_BOUNDS / CONTINUITY_VIOLATION / ADAPTER_REJECTED / START_NOT_CONFIRMED` | 是 |
| 执行 | `LEASE_LOST / OWNER_GONE / DEADLINE_EXCEEDED / ADAPTER_FAILED / SAFETY_ABORTED` | 是 |

任何已取得资源后的失败都必须产生 terminal receipt，明确资源处于“fallback 执行”还是“Adapter 保持”状态；不得只记录异常后把控制权悬空。

## 可追溯性与可回放性的精确定义

原方案把“字节一致 trace”和真实帧时序混在一起，无法同时成立。首版拆成两类工件：

- **`ReplayEnvelope` / `DecisionRecord`：** 固定 asset/rule/effect/intent、registry/profile/hook/Adapter contract 摘要、规范请求、逻辑 sequence、SnapshotBundle、fallback 决策和 TransitionPlan。使用规范编码和逻辑 tick；相同版本与输入必须字节一致。
- **`RuntimeObservation`：** 实际帧时间、wall duration、性能、Adapter barrier/start/terminal receipt 和外部遥测。它通过稳定 ID 与 DecisionRecord 关联，但只要求 schema 与因果顺序一致，不要求跨机器字节一致。

规划回放只证明“相同固定输入得到相同决策”，不证明真实执行轨迹或物理结果相同。每次决策至少可定位：`asset_id → rule_id → effect_id → intent_id → resource_id → profile/recipe/hook digest → snapshot_id → plan_id → receipt_id`。

## 首个 Skeleton fixture 的可判定证据

`C1-T.0` 必须把具体模型、骨骼映射、攻击中间姿态、防御目标姿态、physics tick、容差和 profile 数值固化为可提交 fixture。`C1-T.2` 的技术门只判断以下代理指标：

- **起点连续：** plan 首样本在每个受控通道上等于 barrier snapshot（在固定量化容差内），无姿态瞬移；
- **边界遵守：** 每 tick 位移、速度、加速度、接触漂移和总时长不超过 profile 上限；
- **可响应：** 从请求被接受到 start receipt/首次可测变化不超过 `first_response_ms`；已处于目标容差内可直接完成；
- **目标收敛：** 在 `max_transition_ms` 内进入并保持目标姿态容差所规定的稳定窗口；
- **局部抢占：** barrier 后冲突 generation 无任何写入；非冲突且不在耦合闭包内的对照通道保持运行；
- **完成可信：** 只有 Adapter 观察到稳定窗口后才发 completed receipt；逻辑超时只能失败或回退；
- **互操作排他：** Adapter 必须报告 `available / coda_owned / external_owned`。首版不与 AnimationTree、root motion 或外部脚本同时混写；发现外部 writer 就以 `EXTERNAL_WRITER_ACTIVE` 拒绝，除非 Adapter 能提供显式 handoff receipt。

这些指标只能证明“连续、受限、响应及时且到达目标”。即使后续候选在固定物理模型下具有更低的 effort/action/smoothness 组合成本，也只能证明**对已声明 ObjectiveProfile 的相对最优性**，不能直接证明感知自然。若要使用“更自然”这一产品表述，必须另设感知证据：在观察结果前冻结对照基线、场景、目标参与者、盲化/随机化方式、问题、样本和成功阈值；至少比较固定动画/朴素 blend、弹簧或物理知情候选，并保存负面反馈。该证据不阻塞 C1-T.1 的语义实验，但阻塞任何“自然性已验证”的公开结论。

## 物理知情扩展边界

“在物理约束下，以较低作用量/能耗达成意图”是 C1-T 的合理策略扩展，但不是把 CODA 核心直接改成碰撞/刚体引擎。正确分层是：Dynamics Backend 计算给定状态和控制会发生什么；PhysicsPolicy Compiler 可产生有限时域策略或受证书约束的反应式场策略；CODA 编译语义意图、硬约束和分层目标，管理预算/版本/租约并审计候选。

最小作用量不等同于执行器最小能耗，二者也都不自动等于自然。能耗目标若没有终端意图、时间和稳定性约束，会偏好不动、无限慢或借重力跌落等退化解。因此安全/碰撞/资源权限必须是不可交易的硬约束，目标到达必须先成为 feasibility 条件，effort、jerk、duration 和 style 只能在可行解中比较。

C1-T 首版继续使用有限确定性 kinematic recipe。C1-P 作为条件研究分支，同时保留有限规划与 `ReactiveFieldPolicy`：先验证一维/二维耗散场、目标切换能量和离散积分，再验证局部极小的 hybrid fallback，最后才进入 latent motion prior。只有证据证明瓶颈确实来自现有 Dynamics Backend，而不是策略、目标函数、模型参数、求解器或 Adapter，才允许讨论 CODA 自研 physics backend。具体门禁见 [C1-P 研究提案](physics-informed-intent-planning-proposal.md)。

C1-P 的 passivity 与 hard safety 是两项正交准入：碰撞/约束 impulse、外力、策略功、切换储能和数值残差必须按 flow/jump 分账；energy tank 只能限制策略可控注能，不能证明关节/碰撞安全。finite↔field 切换只有在新策略有效域、安全 viability/backup 域和允许输入交集内才可通过 C1-T write barrier，否则维持 Adapter hold/backup 或拒绝，不得先交权再等待在线安全求解器补救。安全保证只在声明的输入/扰动 envelope 和 viability 域内成立；任意大外力下只能承诺域外检测、撤权与 Adapter 安全处置，不能承诺集合不变。

C1-P 不要求统一最高保真。DynamicsModelRef 必须声明省略现象、有效域和误差 envelope；PolicyProfile 必须声明确定 work budget、目标设备 wall/p95/p99/内存、fidelity 升降级和 anytime fallback。安全/权限/数值有限性与 deadline reserve 先作为硬门，只有通过者才在目标误差、预测偏差、响应、work、内存、能耗和感知指标上形成 Pareto frontier。Runtime 只能选择版本固定的授权 profile，不得因机器负载静默改权重或放宽安全边界。

有限计划的决策回放仍以固定 `SnapshotBundle` 为输入；`ReactiveFieldPolicy` 的评估回放还必须固定逐 tick 的状态观测、外力/接触事件、目标切换以及 backend/积分器环境。初始快照相同但扰动流不同，不得宣称产生相同控制序列或物理轨迹。

## 阶段、门禁与停止条件

| 阶段 | 只做什么 | 通过证据 | 明确不做什么 |
| --- | --- | --- | --- |
| `C1-T.0` | 冻结 registry、耦合、仲裁/交接、快照、plan、hook、fallback、receipt、证据分层和 fixture 指标。 | 版本化 schema 草案、状态/时序图、正反 fixture、需求追踪表；不含悬空策略。 | 不写运行时实现。 |
| `C1-T.1` | 实现攻击→防御的离线确定性参考规划器、租约仲裁和受信任 hook harness。 | ReplayEnvelope/DecisionRecord 字节一致；每个非法 fixture 确定拒绝；旧 generation 永无副作用。 | 不接 AnimationTree、学习模型或硬件。 |
| `C1-T.2` | 接一个排他控制的 `Skeleton3D` Adapter，验证真实快照、barrier、局部抢占、fallback 和 receipt。 | Node 决策语义等价；所有技术代理指标与外部 writer 反例通过。 | 不把代理指标称为感知自然，也不支持 root motion 混写。 |
| `C1-T.2N` | 条件性收集感知自然性比较证据。 | 预注册协议下达到预设阈值，或诚实记录未胜过基线。 | 技术门通过不自动使本项通过。 |
| `C1-T.3` | 用第二种非骨骼通道（优先表情）检验抽象。 | 复用同一 lease/hook/fallback/证据模型；Adapter 特有字段不泄漏进核心。 | 不扩张为任意 Godot API。 |
| `C1-M` | 经另行批准后，把已验证模型用于机器人 Adapter 设计。 | 独立的遥测质量、安全控制和机构责任审查。 | 不以 Godot/仿真证据替代电机安全证明。 |

门禁是零时长裁决，不是阶段别名：

- `G-C1-T-A` 设计冻结：C1-T.0 的全部契约、fixture 与需求追踪通过；Hook 信任模型、外部 writer 和失败后资源状态没有歧义。
- `G-C1-T-B` 离线语义：每个合法/非法 fixture 都有确定 plan/DecisionRecord 或确定拒绝；租约、单级 fallback、唯一终态和迟到回调反例全过。
- `G-C1-T-C` Godot 适配：Adapter 只执行匹配 lease/generation 的计划，barrier/start/terminal receipt 闭合，技术代理指标通过。
- `G-C1-T-N` 感知主张：只有 C1-T.2N 的预注册比较证据达到阈值，才允许声称该 fixture “更自然”。失败不推翻技术运行时，但必须收缩产品表述或修改 profile 后重新观察。
- `G-C1-T-X` 跨域抽象：第二通道通过且没有把 Skeleton 字段提升为核心语义，才允许把 C1-T 描述为跨通道过渡抽象。

任一门出现以下情况必须 `HOLD` 或 `REFRAME`：需要第二可写事实源；必须让旧/new generation 同时写冲突资源；必须信任无法校验的规划输出；首个 fixture 只能靠模型特有字段表达；或技术代理指标与感知结果持续相反。

## 关键挑战与当前不可解决项

| 挑战 | 本次已经解决的边界 | 尚不能解决的核心问题 / 重开条件 |
| --- | --- | --- |
| “自然”的三层证据 | 已拆为过渡有效性、声明目标下的相对最优性和感知自然性；C1-P 定义物理目标研究边界，感知结论仍由 `G-C1-T-N` 控制。 | 最低 action/effort 依赖模型、成本定义和权重；没有预测误差与真实比较观察，不能知道它是否更真实或更自然。 |
| 动画系统互操作 | 首版采用排他 writer、显式 handoff 和 `EXTERNAL_WRITER_ACTIVE`，不做隐式混写。 | 与 AnimationTree/root motion 的双向权重、状态同步和恢复协议需要单独 Adapter 研究。 |
| 局部抢占的可组合性 | 引入资源叶、耦合闭包、原子全取与 write barrier。 | 如何自动发现跨骨骼动力学/美术耦合不可由核心推断；首版必须由 profile 作者声明并由 fixture 反例校验。 |
| Hook 表达力与安全 | 固定流水线、摘要、schema、预算、单级 fallback；首版只接受受信任 hook。 | 同进程代码的“无 I/O”无法靠 manifest 强制；第三方 hook 必须等待 sandbox/DSL/隔离进程的威胁模型与逃逸证据。 |
| 性能、近似与确定性 | 拆分确定 DecisionRecord 与非确定 RuntimeObservation；C1-P 使用 work budget + wall/p95/p99/内存、决策充分 fidelity、anytime 已认证候选和安全域内 Pareto。 | 各设备/profile 的误差 envelope、decision-flip 阈值和尾延迟仍需 benchmark；复杂/异步/学习规划器不能只凭平均耗时或单个大 O 获权。 |
| 物理预测与数值可回放 | C1-P 要求固定 model/backend/solver/settings，以 flow/jump energy ledger 与 PredictionReceipt 记录，并把 passivity、安全可行性分别裁决。 | Godot 物理不保证确定性，contact impulse 可能只能估计；需 tolerance replay、shadow prediction、backup 域和 ModelErrorReport，不能继承字节一致或逐端口精确证书。 |
| 快照真实性 | 固定 revision、单位、量化、skew、有效期与 Adapter receipt。 | 游戏呈现快照仍不等同于机器人实测状态；C1-M 必须独立处理校准、时延、断连、watchdog、硬限位和停止确认。 |
| 产品优先级 | C1-T 与 P3 门互不冒充证据，当前仍保持 proposal。 | C1-T 是否值得占用实现容量是项目所有者决策；技术可行并不自动证明它应早于 P3 用户证据。 |

## 明确非目标

- 不在运行时解释自由文本、任意 GDScript、未经登记的模型或不受信任 hook；
- 不承诺自动生成“最佳”动画、替代动画师/玩法工程师审美，或自动解决全身物理；
- 不把 AnimationTree 状态、骨骼路径、设备关节名或协议 ID 变为 CODA 核心语义；
- 不在 C1-T 接真实电机、云端 LLM、自由搜索规划器或具有人身风险的控制路径；
- 不改变 P3 的公开用户证据门，也不因文档完成而宣称 C1-T、完整游戏编辑器或机器人框架已经成立。

## 仍需项目所有者裁决

本文已把可由设计解决的歧义收敛为契约和任务，但以下选择会改变 fixture 或授权范围，不能替项目所有者决定：

1. 指定首个可提交 Skeleton 模型、攻击中间姿态、防御目标姿态及允许 CODA 排他控制的骨骼；
2. 确认首版接受“遇到 AnimationTree/root motion 外部 writer 即拒绝”，而不是立即做混合互操作；
3. 确认 C1-T.1 只允许受信任、确定性 hook；第三方和学习模型 hook 延后；
4. 在查看结果前批准 fixture 的具体 `first_response_ms`、总时长、接触漂移、速度/加速度和目标容差；
5. 决定 C1-T 作为与 P3.3.2 并行的低后悔实验，还是在 `G-P3-U` 前保持 `HOLD`。
6. 决定是否接受 C1-P 仅作为 C1-T 之后的条件研究分支；这不等于批准自研 physics backend。

在这些裁决与 `C1-T.0` 文档工件未完成前，当前 settlement 是 **`HOLD FOR IMPLEMENTATION`**：允许继续设计和准备 fixture，不允许写运行时实现。
