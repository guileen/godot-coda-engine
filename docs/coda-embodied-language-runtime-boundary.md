# CODA 具身语言层与运行时边界

> 状态：`RESPONSIBILITY_BOUNDARY_CONVERGED / CONTRACT_AND_BENCHMARK_STRUCTURES_FROZEN / DEVICE_VALUES_AND_RUNTIME_AUTHORIZATION_OPEN`（2026-09-23）  
> 本文冻结本轮外部审查后具有高置信度的架构边界。它修正 C1-L/C1-T/C1-P 的职责划分，但不宣称 `ReactiveExecutionGraph`、机器人控制器或真实硬件安全链已经实现。当前已实现的紧凑 `MotionIntent` 仍只是编译链验证切片。

## 1. 裁决

CODA 的目标不是成为中频控制器、求解器或硬件驱动，而是成为一个可编译的具身任务与执行契约语言：作者声明任务、模式、约束、观测要求、恢复和验收条件；编译器产生类型化任务/策略 IR；受预算约束的 planner 只生成候选；原生响应监督器管理模式、资源、包络和 receipt；底层控制器闭合连续反馈；独立安全机制保留最终干预权。

```text
.coda authoring source
  → parse / type / authority checks
  → TaskGraph + ObservationContract + HybridModeGraph
  → planner problem + ControlContract
  → candidate plan / policy
  → model / Adapter / safety admission
  → ReactiveExecutionGraph
  → native controller / Adapter / hardware

Safety & Authority Plane  ────────────────┐
Evidence & Receipt Plane  ────────────────┴─ cross-cutting
```

这条链只建立责任和证据边界，不保证任意任务可解，也不把某个局部可行解、仿真结果或 receipt 称为真实世界安全证明。

### 1.1 “意识—神经系统—肌肉”的工程映射

人的类比可以保留，但必须映射到明确责任：

| 类比 | CODA 系统角色 | 可以表达什么 | 不应表达什么 |
| --- | --- | --- | --- |
| 意识 | LLM、游戏逻辑、业务程序、人类作者 | “打太极”“避开障碍后继续”“保持放松但受控”及业务优先级 | 股四头肌、电机 PWM、逐关节闭环 |
| 神经协调 | CODA source/compiler/runtime + 已绑定的 controller graph | 身体技能、模式、相位、约束、观测、抢占、恢复、资源和回执 | 未经 profile 验证的任意控制律或安全保证 |
| 反射/小脑式连续调节 | whole-body/MPC/servo/animation controller | 平衡、跟踪、接触、姿态、插值和局部扰动抑制 | 改写高层任务后置条件 |
| 肌肉/骨骼 | Godot Skeleton/AnimationTree、机器人 controller/HAL、飞控和 actuator | 执行已取得写权的参考量并报告实际状态 | 解释业务语义或自行扩展权限 |

因此 CODA 的核心对象不应只是一个离散 `MotionIntent`，而应是可持续执行、可被观察和恢复的 `EmbodiedSkill`。`balance()`、`relaxed_tension()` 或 `hold_attitude()` 不是一句自动产生正确控制器的魔法函数，而是带 capability、适用域、输入观测、约束、实现绑定和证据等级的可复用身体契约。

### 1.2 两套公开协议族，而不是两套孤立消息

CODA 对外冻结两套双向协议族；独立安全权威另有不可被普通程序覆盖的通道：

1. **`IntentProtocol@1`（上层 ↔ CODA）**：提交/实例化 `EmbodiedSkill`，携带目标、参数、优先级、约束、deadline 和权限；支持 `amend/interrupt/pause/resume/cancel`；返回 admitted/rejected、当前语义 phase、降级原因和 terminal receipt。它不接收关节角、PWM 或任意控制器代码。
2. **`EmbodimentProtocol@1`（CODA ↔ 身体后端）**：向下交换 task-space reference、constraint set、controller/mode 请求、authority lease、generation、validity horizon 和 handoff；向上交换带时间戳/质量的 observation、contact/balance/tracking 状态、controller health、capability availability 和 barrier/start/transition/terminal receipt。它不是某一种 ROS/Godot 消息格式，而是由 Adapter 映射的语义接口。
3. **`SafetyAuthorityPort@1`（独立权威）**：可以撤销写权、进入受控停止或硬件保护，并向 CODA 发出不可覆盖的 safety receipt。CODA 可以服从和记录，不能把它当作普通 `interrupt` handler。

协议必须使用稳定类型、单位、reference frame、revision、timestamp、freshness、source identity、lease/generation 和确定失败码；不能用自由文本 condition 或“最新值”隐含时间一致性。

### 1.3 连续身体程序与自然中断/恢复

身体技能不能被表示成“从第 0 帧播放到第 N 帧”。它至少同时包含：

- **语义 phase**：例如起势、移重、推出、收回；
- **连续 progress coordinate** `s`：描述动作在当前 phase 的进展，不等同于 wall time 或动画帧；
- **task manifold/reference**：手的圆弧、重心迁移、朝向、接触和张力偏好；
- **invariants/envelopes**：平衡、关节舒适域、碰撞、观测质量和 controller validity；
- **checkpoint/capture region**：允许暂停、恢复或重新进入的状态集合；
- **resume policy**：精确相位恢复、兼容相位重入、最近 checkpoint 重启、重规划剩余部分或拒绝。

中断流程固定为：

```text
interrupt request
  → capture current physical state + semantic phase + progress + generation
  → bridge into interrupt skill while preserving hard invariants
  → execute interrupt skill and re-observe
  → find a compatible re-entry state on the original skill manifold
  → bridge and resume, or restart/replan/reject according to ResumeContract
```

运行时生成的 `ContinuationToken` 只记录恢复所需的来源引用、phase/progress、状态摘要、约束/controller revision、lease/generation 和可用 checkpoint；它是派生执行状态，不是新的作者事实源。

“回到刚才暂停的位置”不能被解释为无条件跳回旧时间戳。外力或避障已经改变身体状态时，精确回到旧 pose 可能造成跳变、失衡或碰撞。CODA 保证的是**语义连续和受约束重入**：如果当前状态仍处于该 phase 的 capture region，可以平滑接回；否则选择兼容 phase、checkpoint、重规划或明确拒绝。

### 1.4 重入必须经过动力学可恢复性门

几何上接近技能流形不等于动力学上可以重入。每个候选 `ReentryPoint` 必须同时通过：

- 当前状态、接触 mode、估计误差和 disturbance envelope；
- 输入/力矩/加速度/速度/功率与热限制；
- Controller validity domain 与声明的 capture/recoverable set；
- bridge 时域内的碰撞、稳定、资源、deadline 和 backup 可用性；
- 该结论的模型类别、保守程度和证据等级。

```text
x_actual + candidate re-entry
  → typed/model validity
  → recoverability/capture check
  → bridge candidate + residual/budget
  → execution admission
```

若直接重入失败，只有在当前状态仍位于某个已验证 `RecoverySkill` 的 recoverable/backup domain 内时，才可以先执行动量衰减、扩大支撑或姿态恢复。不能写成“状态在 viability kernel 外也能强行拉回”：一旦当前状态已离开所有可用安全/恢复域，CODA 必须拒绝恢复并让独立安全权威处置。

高维系统的完整 viability kernel 往往不可直接求得。因此 `ViabilityGate` 必须声明其证据为 `exact/conservative/reduced_model/sampled/heuristic` 之一，并记录假设、误差裕量和 false-positive/false-negative 责任；启发式结果不能升级为硬安全证明。

### 1.5 跨 embodiment 需要 refinement，而不是同名即等价

`maintain balance` 是上层 property，不是跨设备拥有相同数学含义的实现。每个 `EmbodimentProfile` 必须把它 refinement 为设备相关合同：

- actuation topology 与 underactuated DoF；
- contact/support model、base dynamics 与允许 mode；
- task coupling/Jacobian 或等价影响模型；
- input/saturation、带宽、时延和 disturbance bounds；
- guarantee level：`visual_plausibility/model_admissible/calibrated_envelope/hardware_safety_reviewed`；
- 不支持、只能降级或会改变后置条件的情况。

编译期可以检查 capability、单位、frame、拓扑和合同 refinement 是否存在，却不能仅靠类型系统证明非线性闭环稳定。候选仍须经过目标模型验证和运行时准入。Godot 的“视觉平衡”不得冒充双足机器人或飞行器的动力学安全证据。

### 1.6 Authority、freshness 与 horizon 必须分离

多时钟域下至少区分：

- `AuthorityLease`：谁有资格更新某个 reference/control port；由 generation 和显式 handoff/revoke 管理；
- `ObservationFreshness`：输入状态是否仍可用于当前决策；
- `CommandValidity`：某个 reference segment 在什么时域和状态域内有效；
- `BufferedHorizon`：Controller 在上游短暂迟到时可以继续消费的有界 reference/policy buffer；
- `Liveness/Heartbeat`：上游是否仍健康，只触发预先冻结的 hold/backup/failsafe，不自动恢复旧 writer。

因此 EmbodimentProtocol 不应只发送点目标，但也不强制所有后端使用多项式。它可以承载 trajectory segment、spline、setpoint horizon、local policy 或静态 hold reference；格式由 capability/profile 决定。buffer 低水位、过期、IPC jitter 和时钟偏差必须有 hysteresis、deadline reserve 和唯一降级动作，避免 active/hold 在边界抖动。

### 1.7 Typed Claim Matrix 的边界

技能先声明 task-space/resource authority，再由 `EmbodimentProfile` refinement 到 controller interface/DoF：

- `exclusive`：骨盆基座、支撑接触、同一 command interface 等只能有一个 writer；
- `composed`：多个 task 只能提交给同一个受信任 composition controller，由其按冻结的硬约束和优先关系统一求解；
- `nullspace`：只有 composition controller 证明主任务保持且当前 Jacobian/metric 条件合格时才允许；
- `observe_only`：可以共享读取，不获得 reference 写权。

不能让两个技能各自计算同一关节命令后再相加，也不能仅凭整数 priority 解决物理耦合。静态检查负责显式冲突；接触 mode、奇异性和动态耦合造成的冲突必须在运行准入时重新检查。

“每个局部 task 都通过”不推出组合可行。双臂挥动与下肢平衡、机械臂与浮动基座、多个接触之间都可能通过反作用力矩、质心/动量、共享饱和和接触锥耦合。Composition Controller 必须对**联合 task set**运行设备 profile 声明的 coupled-dynamics admission，并检查联合 solver residual、输入/接触/稳定裕量和 backup；不得只做 claim 标量交集。Minkowski sum 可能是某些集合传播实现的一部分，但不是所有耦合动力学问题的统一或充分判据，核心合同只引用获批的 joint-admissibility checker 及其证据等级。

### 1.8 动态任务集需要 activation/handoff contract

任务集合变化可能改变目标权重、约束集合、接触 mode、Jacobian 条件和可行域，但不能把所有变化都简化为 `fade_in_ms/fade_out_ms`：

- `hard_atomic`：安全、碰撞、接触有效性、权限撤销等硬约束必须在声明边界原子生效，禁止淡入；
- `soft_ramp`：风格、姿态偏好和可交易 task cost 可以使用受 rate/jerk/torque envelope 约束的连续 activation profile；
- `guarded_handoff`：controller/contact/mode 变更先捕获状态、预求解并验证兼容域，再在 write barrier 原子提交；失败不产生部分任务集。

`hard_atomic` 适用于已经成立且必须持续保持的安全不变量、有效刚性接触/闭环、物理限位和权限屏障；它不表示“尚未建立的接触从第一个采样起就已成立”。接触建立或释放必须是带 guard、冲击/相对速度条件和确认回执的 mode transition。若设备模型以顺应接触、稳定化或有界 slack 表示真实非刚性，允许的松弛必须由 profile 给出物理上界，且不得放宽上位安全包络。

`approach → impact/settling → established contact → unloading/detachment` 是首个接触 fixture 应覆盖的参考分解，但不是语言内置且恰好四态的通用物理本体。滚动、粘滑、多点接触、反复冲击和软体接触可能需要不同 mode graph。尤其不能宣称“进入 impact phase 后由软件力控吸收全部冲量”：碰撞瞬态可能快于反馈带宽，实际吸收依赖机械顺应性、驱动器保护、接触模型和已验证 controller。核心合同只要求 phase identity、进入/退出 guard、允许的控制模式、约束/slack 权限、最大冲击/能量/相对速度包络与确认 receipt 均由设备 profile 冻结。

`TaskActivationContract` 声明 activation class、profile/version、允许的过渡时域、输出连续性阶次、conditioning threshold、slack/relaxation 权限、预求解 deadline 和无解动作。具体 S 曲线、正则化、warm start 或 damped least squares 属于 Composition Controller profile，不由 CODA 作者填写任意毫秒值。

`guarded_handoff` 的预求解超时不产生默认“一 tick 续租”或“二 tick 后 hold”规则。只有旧 task set 的 `AuthorityLease`、`CommandValidity`、模型有效域和 backup domain 在当前时刻仍同时有效时，才可继续消费旧集合；这不是续租。否则必须原子拒绝新集合并进入已准入 backup/failsafe。允许的 tick 数、WCET 和降级 deadline 由目标设备 profile 冻结，昂贵或不可界定的预求解不得阻塞硬实时线程。

需要分别处理两类失败：软权重/目标阶跃可能使最优解和输出不连续；硬约束/接触阶跃可能让可行集突变或为空。`1/σ_min` 发散是未正则化伪逆类方法的典型风险，不是所有 QP/WBC 的统一公式；合同应直接门控 Jacobian/constraint rank、conditioning、solver residual、saturation 和输出跳变量。

### 1.9 Viability 依赖在线模型有效性包络

静态 `reduced_model` 标签不足以覆盖摩擦、地面顺应性、载荷、磨损和未建模接触。每次 viability/re-entry admission 必须绑定 `ModelValidityEnvelope`：

- 参数或 set-membership bounds，而不只是均值/协方差；
- contact/mode 假设与 association validity；
- calibrated residual/error bound、OOD 与 estimator health；
- 适用的 disturbance/input bounds 和最近校准 revision；
- envelope 扩大或模型失配时的 margin tightening、fidelity upgrade、backup/reject。

协方差只适合表达某些概率状态估计误差，不能代表系统性偏差、多峰、未知摩擦或神经模型近似误差。在线异常或单个高可信危险样本可以立即触发切换到**预先认证的更保守 envelope**；这是一种防御性收缩，不等于把单样本点估计宣称为新的真实参数。收缩路径可以快且不对称，扩张路径必须经过校准、持续证据与 hysteresis。所谓“立即”仍指满足已测得的 detection-to-commit deadline，不是物理上的零延迟。若 estimator 的误差界、可辨识条件和更新速率未进入证书，只能保持保守域、切换 backup 或拒绝，不能据此扩张安全域。

CUSUM、SPRT、EWMA 或残差窗口可以作为 `ModelValidityEnvelope` 的版本化 detector profile，但都不是核心语言的唯一算法。它们依赖残差模型、独立性/分布或经验校准，并必须冻结 false-alarm/missed-detection 指标、reset/hysteresis、传感器健康和最坏检测延迟。真正的硬过流、限位或碰撞保护仍由独立安全链处理；统计 detector 只能请求预认证收缩/升级/backup，不能凭一次统计判决重写硬件安全参数。

DeepReach、Neural CBF 或 learned viability model 只能先作为 candidate/accelerator。除非有与当前模型域匹配的验证残差和可用误差界，并据此保守修正 reachable set，否则不得获得 `exact/conservative` 安全等级。

### 1.10 ContinuationToken 必须按执行时刻重新锚定

`ContinuationToken` 不能把 `x(t0)` 当作未来执行初值，也不应嵌入可执行 predictor 代码。它至少引用：

- `epoch/generation`、snapshot time、clock domain 和时间同步质量；
- estimator/predictor profile 的不可变版本与模型 revision；
- state belief 或 set-valued envelope、预测 horizon 和最大 admission age；
- bridge 的允许 start set/tube、首段 validity 和重算 deadline。

Controller/Adapter 在 commit barrier 读取本地最新状态，将候选 bridge re-anchor/splice 到当前执行状态，并原子校验 epoch、start tube、model envelope、输入边界和 horizon。超出包络返回稳定的 `state_drift_exceeded/stale_epoch/model_invalid`，不得先启动再纠正。Covariance 是可选 belief 表示之一，不是所有 Token 的强制字段。

`start_tube` 的表示是 profile 选择，不是核心语言固定为 AABB 或对角椭球。AABB/对角椭球适合某些低耦合、严格 WCET 场景；当状态相关性决定安全性时，它们可能过松而不安全，或过紧而造成不必要拒绝。允许固定规模多面体、稠密椭球、zonotope 或设备专用 predicate，只要序列化边界、数值有限性、membership WCET 和保守性证据已冻结。高频路径宜让 Token 引用 Controller 本地已编译对象及其 digest/revision，而不是反复传输高维几何体；复杂度目标由 profile 和实测 deadline 决定，不宣称通用 `O(N)`。

“covariance ellipsoid” 只有在置信水平、分布/校准假设和 tail policy 明确时才是概率 belief region，不能自动当作硬安全集合。稠密二次型 membership 通常需要 `O(N²)` 运算，对角/固定带宽或稀疏结构才可能接近 `O(N)`/`O(nnz)`。Zonotope 的点/集合包含也不天然是线性时间；生成元数量、表示形式和采用的保守外逼近决定实际复杂度。因此 schema 应表达 `representation/profile_ref/dimension/complexity_bound/error_bound`，而不是承诺某个几何类型必然在微秒级完成。

### 1.11 Handoff 同时要求权威原子性与物理连续性

安全撤权必须立即生效，但“旧 skill 不再有写权”不等于“所有 actuator command 立刻归零”。合法 handoff 是：旧 writer 在 barrier 失权，同时预先准入的 incoming/backup controller 原子取得唯一写权，并从当前测得状态、命令和内部能量状态初始化。

`HandoffContract` 至少约束 position/velocity/effort reference 的连续性、允许的导数跳变、接触/重力支撑、执行器饱和、弹性元件/impedance rest state、controller internal state、energy/passivity ledger（若该 profile 支持）以及 takeover deadline。不能把残余能量仅写成 `½ qᵀKq + ½ q̇ᵀMq̇`：势能取决于参考误差、刚度、重力、接触和执行器结构。

位置控制切换到阻抗控制时，将 `q0` 初始化为 `q_measured(t_handoff)` 是消除弹簧位置误差项的一种 profile 策略，不是通用的无冲击证明。总输出还包含阻尼、重力/Coriolis、前馈、旧 controller 的末次 effort、执行器内部状态和饱和/限速。正确的准入条件是 incoming controller 从交接瞬间的实际 state、last commanded/desired state 和 outgoing command 初始化，并证明 `τ_in(t+)` 与 `τ_out(t-)` 及允许导数跳变满足合同；否则 `q0=q_measured` 仍可能造成总力矩骤降或骤升。

这里应使用版本化的 `StateCommandReconstruction`，而不是要求不同 controller 无条件“继承积分器/观测器状态”。只有语义、维度、坐标系和版本兼容且有已验证 state translator 时，内部状态才可迁移；否则 incoming controller 必须从可观测状态重建、受控 reset、先运行 shadow/warm-up，或拒绝直接 handoff。残差 effort offset/blend 也只能在 torque/rate/saturation、接触、passivity/energy 和闭环有效域全部允许时使用；它是 profile 算法，不是 CODA 保证稳定性的通用 S 曲线。

Passivity/energy tank 可以限制可控注能，却不自动证明碰撞、关节限位、支撑或状态安全；统一阻尼注入也可能让飞行器、承重机构或动态平衡机器人失去控制。因此只有设备 profile 已验证时才能采用 damping/energy threshold，紧急安全切换不得为了等待 `E_safe` 而延迟撤权。这里的原子动作是**撤销失效 writer 的软件写权并触发设备已认证的 takeover/stop action**，不等于对所有设备立即断电：机械臂可能受控停止或制动，飞行器可能降落/返航/终止，具体动作由独立安全架构裁决。

术语必须按标准分开：Stop Category 0/1/2 来自 IEC 60204-1；STO/SS1/SS2/SOS 属于 IEC 61800-5-2 的安全驱动功能；ISO 13849-1 处理安全相关控制系统的性能等级/架构类别，三者不能互作同义词。无人机 kill/disarm 也不应被宣称为已取得工业机械 Stop Category 0 认证。`SafetyProfile` 记录设备标准域、认证边界、触发条件、物理动作和 receipt 映射，CODA 只消费这个已批准映射。

## 2. 术语必须分开

`frame` 不能同时表示坐标系、执行周期和规划时域。核心契约使用以下稳定概念：

| 概念 | 含义 | 责任方 |
| --- | --- | --- |
| `ReferenceFrame` | 世界、物体、工具、基座等空间参考系及带时间戳的变换关系。 | 模型/Adapter 提供，编译器检查闭合与单位。 |
| `PlanningHorizon` | planner/MPC 面向未来优化或搜索的时间范围。 | SolverManifest/PolicyProfile。 |
| `SupervisoryCycle` | 响应监督器评估已编译 monitor/guard 的设备相关周期；也可以是事件触发。 | RuntimeProfile；不得在语言中写死通用频率。 |
| `ControlCycle` | 控制器读取状态并输出参考量/控制量的实时周期。 | 原生 controller/HAL。 |
| `PhysicsTick` / `AnimationTick` | 特定 Adapter 的仿真或呈现边界。 | Godot/仿真 Adapter；不是机器人通用语义。 |

不采用“Task Frame = 10–50ms 微步长”作为核心术语。空间任务帧与时间采样必须可区分。

## 3. 作者事实源与派生工件

高置信度目标是让新的具身语言资产采用 `text_owned`：`.coda` 是唯一可编辑作者事实源，AST、EventAsset、TaskGraph、计划、生成代码和 receipt 都是派生物。GUI 只能通过保留语义和稳定身份的语法树事务修改 `.coda`，不能形成第二个可写逻辑源。

现有 P0/P1/P3 的 `graph_owned` EventAsset 已经形成发布基线，不能靠文档宣告立即迁移。过渡期每个资产必须显式选择且只能选择一个 `authoring_mode`：

```text
text_owned   : .coda → semantic model / IR（派生，不反向独立编辑）
graph_owned  : EventAsset → text projection（投影，不反向独立编辑）
```

新 C1-L 具身资产默认目标是 `text_owned`；旧资产保持 `graph_owned`，直到稳定 node identity、lossless CST/formatter、schema migration、GUI AST transaction 和冲突恢复全部通过迁移门。不得在同一资产上双写。

合同编码也只能有一个规范语义源。当前设计阶段可延续仓库既有 JSON Schema + 正反 fixture 作为 canonical contract；若目标设备证明 JSON 解析/IPC 不满足预算，可由同一字段 registry 确定生成 Protobuf/FlatBuffers/本地 C struct binding，并冻结 field identity、单位、presence/default、unknown-field、版本迁移和 canonical digest。不得人工维护一份 JSON Schema 与一份语义可能漂移的 `.proto`，也不得因为采用二进制 wire format 就让运行时解释作者源码。

## 4. 语言层、监督层、控制层与安全层

### 4.1 CODA 语言与编译器

负责：

- 任务、阶段、并行/分支、mode、guard、恢复和终态；
- `ReferenceFrame`、单位、容差、观测质量和数据新鲜度；
- 硬约束、验收后置条件、可交易目标/偏好及其优先关系；
- 语义 capability、资源意图、权限和 fallback/reject；
- 确定 lowering、source map 和版本化契约绑定。

不负责：

- PID/PWM、电流、裸关节写入或设备协议；
- 在源码中实现 IK、Jacobian、MPC 数值迭代或碰撞循环；
- 在运行时解释自由文本、通用 AST 或 JSON；
- 选择或降低独立安全机制的保护阈值。

### 4.2 Planner Portfolio

planner 接收已类型化的问题，生成候选计划或策略。每个 `SolverManifest` 必须声明算法/版本、模型类别、适用域、预算、终止码和能够主张的保证，例如：

```text
feasibility     sound | conservative | sampled | heuristic
optimality      global | bounded_suboptimal | local | none
collision_check continuous | discrete_sampled | conservative_bound
dynamics        full | reduced | kinematic
contact         explicit | approximated | unsupported
```

Solver 返回成功不等于执行准入；未声明的性质不得由 CODA 代为推断。

### 4.3 原生响应监督器

`ReactiveExecutionGraph` 是编译产物，不是第二作者事实源。原生监督器只能执行预编译、有界工作量的职责：

- 消费带 revision、时间戳、单位和质量标志的观察；
- 评估已编译 guard 和 `TrackingEnvelope` monitor；
- 管理 mode、lease、generation、write barrier 和唯一终态；
- 请求已授权的速度收缩、局部恢复、backup、异步重规划或拒绝；
- 生成 barrier/start/transition/terminal receipt。

它不直接输出 PWM/力矩，不在每个周期运行任意用户代码，也不以“监督频率较高”为由冒充稳定控制器。

### 4.4 底层控制器与 Adapter

Controller/Adapter 负责轨迹跟踪、插值/平滑、局部扰动抑制、力/阻抗/姿态/全身反馈和实际设备命令。只要状态仍处于声明的闭环有效域和 tracking envelope 内，局部误差首先由 Controller 消化，CODA 监督器不得与其形成第二个竞争控制环。

模式切换可以发生在一个复合控制器内部，也可以通过 controller manager 交接；由 Adapter profile 决定，不能由核心语法假设。切换契约至少包含目标 controller/profile 版本、初态捕获、接口所有权、兼容域、hysteresis/dwell、deadline、start confirmation、失败后的已验证 backup 和最终 receipt。

### 4.5 Safety & Authority Plane

安全不是固定在“第六层 1kHz loop”的普通模块，而是一条跨层权威平面：高层处理授权、规范危险和任务禁区；规划/准入层处理模型内硬约束；控制/硬件层处理限位、watchdog、碰撞保护和急停。频率、部署位置和证据范围由设备安全架构决定。

CODA 可以声明 `yield_to_safety_authority` 并记录安全中止，不能把 `e_stop` 当作普通可编排 action，也不能覆盖、延迟或解除独立安全动作。

安全响应可以分级，但级别名称和动作必须由设备 `SafetyProfile` 冻结，不能把 `scale_down → safe_stance → power_off` 写成跨设备通用阶梯：

- envelope 内的限速、降张力和局部修正通常仍是 Controller/监督器的正常保护响应；
- 撤销 CODA 写权并切换到 hold、safe stance、return、land 或受控停止属于设备相关 protective/backup action；
- disarm、power cut、flight termination 或机械制动是最后手段，可能本身导致跌倒、坠落或失去可控性。

严重度只能单调升级，自动降级或恢复原任务必须重新执行 observation、authority、viability 和 execution admission；安全事件消失不意味着旧 skill 自动复活。

## 5. TrackingEnvelope 与升级规则

`TrackingEnvelope` 不是一个通用标量误差球，也不固定为四个同心区域。它是带适用域、单位、数据质量和响应权限的谓词集合，可同时包含：

- 位姿、速度、加速度、jerk、力/力矩和接触余量；
- 模型/观测 age、skew、estimator health、校准摘要和 OOD；
- controller validity region、输入饱和、碰撞距离和稳定余量；
- 每个 predicate 的观测来源、评估位置、持续时间/hysteresis 和未知值策略。

建议的责任升级语义是：

```text
inside controller validity/envelope
  → controller closes the loop; supervisor observes only

approaching a declared boundary
  → only a pre-authorized adjustment whose safety/effect is profile-specific

envelope breach but still inside verified backup domain
  → revoke/hold as contracted; enter backup or request replanning

outside safety/viability domain or hardware hazard
  → independent safety authority acts; CODA records and yields
```

`scale_feedrate`、局部曲线重生成或“保持旧控制器”都不是通用 fallback。它们只有在 profile 已证明适用且当前状态仍在其有效域内时才可使用。

## 6. Guard 与多速率数据

Guard 的部署由四项共同决定：所需信息来源、最坏响应 deadline、评估成本和执行权威。核心不冻结视觉 1–5Hz、监督 20–100Hz、控制 1kHz 等通用数字。

典型分层是：

| Guard | 典型评估位置 |
| --- | --- |
| 电流/力矩硬限位、硬件故障、急停 | 设备/独立安全机制 |
| 接触阈值、局部滑移、controller validity | 原生 controller 或近硬件 monitor |
| tracking envelope、模式完成、重规划候选准入 | 响应监督器 |
| 对象身份、任务授权、规范危险、用户确认 | 感知/任务层 |

同一决策使用的输入必须携带时间戳、revision 和 freshness。不同速率输入不能只因在同一监督周期被读取就假称同时。安全权威、资源撤权和唯一终态优先于普通 mode/goal；同级 guard 必须在编译后有确定仲裁规则，但未知/矛盾输入默认拒绝，不能靠任意数字 priority 掩盖冲突。

不采纳用单一 Nyquist 公式从传感器周期自动推出 `SupervisoryCycle`。采样定理需要信号带宽等前提；监督周期还受通信延迟、计算 WCET、执行器/控制器动态、数据新鲜度和端到端 deadline 约束。周期必须由 profile 声明并在目标设备上以 p95/p99/WCET 与 deadline reserve 验证。

## 7. 三阶段过滤与证据等级

```text
Static Check
  syntax / types / units / frame graph / capability / authority
    ↓
Candidate Generation and Verification
  planner candidate / model validity / residuals / collision / dynamics
    ↓
Execution Admission
  fresh state / lease / Adapter compatibility / backup domain / safety authority
    ↓
Commit and Closed-loop Observation
```

禁止把这些阶段都称为“形式化证明”。记录至少区分：

- `well_typed`：语法和静态契约通过；
- `candidate_generated`：某 solver 产生候选；
- `model_admissible`：在声明模型/有效域/容差内通过；
- `adapter_admissible`：目标 Adapter 能执行且资源/接口可取得；
- `safety_admitted`：声明的独立安全准入通过；
- `started/completed/failed`：实际执行观察终态。

静态合法 AST 可以进入 solver；物理可行性通常只能在候选产生后检查。未经执行准入的候选永远不能取得写权。

## 8. ObservationContract

`observe` 不能等同于 covariance threshold。语言应声明任务所需的信息质量，而把 Kalman/particle/factor graph 等估计器实现留在 profile：

```coda
observe hole.pose {
  require freshness <= 30ms
  require calibrated_error_bound <= 0.3mm
  require association_status == valid
  require estimator_status == healthy

  on insufficient_information =>
    attempt active_scan@2 within 500ms retries 2

  on unresolved => reject perceptual_blindness
}
```

低 covariance 可能仍有偏差、错误关联或多峰；高 uncertainty 也不必然使任务失败，只要鲁棒可行域覆盖它。主动感知不会被假定必然收敛，必须有预算、可观测性/安全准入、停止条件和最终 reject。

## 9. 跨 embodiment 语义

跨设备 lowering 保持的是：

- 任务后置条件；
- 不可交易的安全/权限不变量；
- 验收容差和完成证据语义；
- 明确允许的体验/形态差异。

它不保证轨迹、关节、控制器、能耗或外观相似。若目标设备缺少必要 capability，编译器必须选择已声明 specialization/fallback 或返回 unsupported/reject，不得静默修改后置条件。

跨 embodiment 证伪不能把任意硬件失败算作语言失败。只有在任务对各设备可行、Adapter/solver 能力声明真实且底层实现合格时，核心语言仍无法表达共同不变量、或必须修改任务语义才能通过，才构成语言抽象反例。

## 10. 仍未采纳的外部建议

以下内容作为待证假设或明确反驳保留，不进入冻结契约：

1. **固定 50–200Hz CODA Engine。** 不同设备和 guard 的 deadline 不同，必须由 profile 与目标设备测量决定。
2. **用单一误差范数和固定四区覆盖所有系统。** 接触、姿态、belief、稳定性和资源权限通常不能压成一个有序标量。
3. **Boundary Zone 一律降低 feedrate。** 降速可能改善、无效或恶化稳定/接触，必须是 profile-specific policy。
4. **切换失败一律回滚旧 controller。** 旧接口可能已撤权或已离开有效域；只能进入仍被证明有效的旧域或 backup。
5. **所有复杂规划必须异步。** 昂贵/不可界定 solver 必须隔离，但有严格 WCET 的局部策略可以按 profile 同步运行。
6. **运行时不得动态分配内存是语言公理。** 这是安全关键 RuntimeProfile 的实现约束，不应强加给所有游戏/仿真后端。
7. **CODA 是第一个或不可替代体系。** 在完成与 Stateflow、BehaviorTree.CPP、MTC、Drake、ROS 2 control 等能力矩阵和最小反例前，不作此公开主张。
8. **CNC 类比等同证明。** 前瞻、跟随误差和分层执行是有价值的工程类比，但不能直接证明通用机器人接触/不确定性语义正确。
9. **状态离开 viability kernel 后仍可由恢复技能“强行拉回”。** 只有位于该恢复策略的 backward-reachable/recoverable set 内才成立；域外必须进入设备安全处置。
10. **固定 `scale_down → safe_stance → power_off` 三层安全阶梯。** 响应顺序依赖设备和故障；断电对飞行器、动态平衡机器人或承重机构可能更危险。
11. **所有下行命令必须是 polynomial horizon。** 需要有界 buffer 和有效期，但 segment、spline、policy、setpoint sequence 或 hold reference 应由后端 capability 决定。
12. **DoF 冲突可由整数 priority 或运行时向量叠加解决。** 共享任务必须由单一 composition controller 在硬约束下统一求解；否则只能排他、抢占或拒绝。
13. **每个 claim 都必须携带作者指定的 `fade_in_ms/fade_out_ms`。** 硬安全/接触/撤权不能淡入，具体曲线和可行过渡时域属于 controller profile；作者只能选择获批 activation policy。
14. **`ContinuationToken` 必须统一携带 covariance 和推演模型。** belief 可能是 bounded set、particles 或其他表示；Token 应引用版本化 predictor/profile，不能携带任意可执行模型。
15. **所有 handoff 都先阻尼到统一 `E_safe` 再释放。** 撤权必须原子及时，阻尼和能量阈值依设备成立；passivity 也不能替代状态安全与接触/支撑保证。
16. **DeepReach/Neural CBF 输出天然具有硬安全保证。** 学习近似必须有适用域、误差验证和保守 reachable-set correction；否则只能作候选或 shadow evidence。
17. **所有接触约束在接触建立前后都以零 slack 原子生效。** 已确认的刚性闭环可要求 hard-atomic，但建立/释放本身是混合 mode transition；顺应接触或数值稳定化只能使用 profile 限定的有界松弛，不能用无限权重代替物理模型。
18. **一次摩擦异常样本可直接成为新的精确 `mu`。** 单样本可以触发预认证保守域的快速收缩，却不足以证明参数真值；扩张必须使用更强证据与滞回。
19. **预求解超时自动续租一 tick，并在固定二 tick 后进入 hold。** 旧集合能否继续取决于现有 lease/validity/domain，而非隐式续租；tick 数与 fallback deadline 必须由设备 profile 和 WCET 证据决定。
20. **`start_tube` 统一限制为 AABB/对角椭球即可获得通用 `O(N)` 安全判定。** 这可能丢失关键相关性；表示、复杂度和保守性必须按设备 profile 冻结，高频消息可引用本地预编译对象。
21. **`q0=q_measured` 足以证明位置→阻抗切换零冲击。** 它只消除一个弹簧误差项；还必须匹配总 command、速度/阻尼、补偿项和 controller internal state。
22. **原子撤权等于所有设备立即断电。** 必须立即失去软件写权，但物理停止/接管动作是设备安全架构的职责，通用硬断电可能扩大危险。
23. **四个新增合同即完整运行时架构，部署后自动获得 WCET、passivity 与安全保证。** 它们只补齐四个边界，不能替代其余语言/观察/模式/控制/时间/安全合同；schema 部署也不是实现或设备验证证据。
24. **所有接触都固定为恰好四阶段，impact phase 的软件力控可吸收全部冲量。** 四阶段是首个 benchmark 的有用模板，不覆盖滚动/粘滑/多点/软体/反复冲击；高频冲量还受机械顺应性与驱动器保护支配。
25. **新 controller 必须直接继承旧 controller 的积分器和观测器内部状态。** 不同 controller 的状态语义可能不兼容；只有存在版本化 translator 和验证证据时才迁移，否则重建、reset、shadow warm-up 或拒绝。
26. **CUSUM/SPRT 是安全域收缩的唯一门，或危险样本能物理零延迟完成收缩。** 统计检测依赖模型与阈值且有检测延迟；独立硬保护不经过它，CODA 只在有界 deadline 内切换预认证 envelope。
27. **Stop Category 0 等于 STO、Category 2 等于 SOS，且可直接用于无人机 kill/disarm。** IEC 60204-1、IEC 61800-5-2 与 ISO 13849-1 的术语和认证范围不同；飞行器必须使用自身安全 profile，不继承工业机械认证结论。
28. **CODA 50Hz、presolve 10ms、Controller 1kHz、commit 100μs 是通用预算。** 它们只能是某个设备 benchmark 的待测参数；语言核心不冻结频率和 deadline。
29. **稠密 covariance ellipsoid 或 sparse zonotope 都天然支持微秒级 `O(N)` membership。** 稠密二次型通常为 `O(N²)`，zonotope 判定依表示/生成元和所求性质；必须由 profile 给出结构、近似误差与实测 WCET。
30. **联合任务可行性必须统一用 coupled admissible set 的 Minkowski sum 判定。** 需要联合动力学准入是正确的，但具体集合运算取决于模型、约束表示和保守近似，Minkowski sum 不是通用充分条件。

## 11. 下一步合同与门禁

共享合同结构已由 `contracts/c1t/contract-index.json` 索引，覆盖 Observation、HybridMode、Tracking、Control、Continuation、TemporalCommand、AuthorityClaim 与 ReactiveExecutionGraph，并由 `gseos/fixtures/c1t/shared-contract-pack.json` 提供结构 fixture。该结构包不包含已测的 Godot deadline/WCET/p95/p99、设备安全 Profile 或运行时准入证据；这些仍是逐 Profile 的开放门禁。

在实现新的监督运行时前，至少需要：

1. `AuthoringOwnership@1`：`text_owned/graph_owned` 互斥、稳定 node identity、迁移与冲突恢复；
2. `ObservationContract@1`：质量、新鲜度、校准、多假设/OOD、主动观测预算；
3. `HybridModeGraph@1`：mode、typed guard、hysteresis/dwell、确定仲裁和唯一终态；
4. `TrackingEnvelope@1`：多维 predicate、来源、有效域、unknown policy 和升级权限；
5. `ControlContract@1`：controller capability、切换兼容域、handoff、backup 和 receipt；
6. `ReactiveExecutionGraph@1`：无自由字符串条件、无任意 action、预算有界且不取得未声明硬件权；
7. `IntentProtocol@1`：上层调用、修改、中断、暂停、恢复、取消和完整 receipt；
8. `EmbodimentProtocol@1`：reference/observation/handoff/authority/receipt 的双向 typed port；
9. `ContinuationContract@1`：phase/progress、capture region、checkpoint、re-entry bridge 和无法恢复时的确定动作；
10. `EmbodimentDynamicsProfile@1`：actuation/contact/coupling、输入边界、refinement 和 guarantee level；
11. `TemporalCommandContract@1`：authority、freshness、validity、buffered horizon、heartbeat 和时钟域；
12. `AuthorityClaimMatrix@1`：exclusive/composed/nullspace/observe-only 及其静态与运行时冲突门；
13. `TaskActivationContract@1`：hard-atomic/soft-ramp/guarded-handoff、profile-specific contact mode、conditioning、presolve deadline、输出连续性和无解动作；
14. `ModelValidityEnvelope@1`：参数/接触/残差/OOD/校准边界、detector profile、非对称 shrink/expand、upgrade/reject；
15. `StateAlignmentContract@1`：epoch、clock、predictor ref、start-tube representation/complexity/error、commit re-anchor 和 drift reject；
16. `HandoffContract@1`：原子 writer 交接、StateCommandReconstruction、internal-state translator/reset、总 command/接触连续性、SafetyProfile 映射及可选 passivity ledger；
17. 一个跨 embodiment 证伪 benchmark，能区分语言、planner、controller、Adapter 和硬件失败。

这些合同只冻结表达和责任。没有目标设备 profile、测量和真机安全审查时，不能授权真实硬件执行。

### 11.1 收敛后仍需证伪的问题

以下问题尚未被文档推演关闭，必须转成 schema/fixture/目标设备测量，而不是继续用“已锁死”措辞覆盖：

1. 如何对 `approach → impact/settling → established contact → unloading/detachment` 建立首个 profile，同时允许其他 contact mode graph；怎样使 active rigid constraint 原子保持，又允许真实顺应性与有界数值稳定化，且不让 slack 穿透上位安全包络？
2. 哪类观测可触发保守 envelope 的单周期收缩；CUSUM/SPRT/其他 detector 的残差模型、误报/漏报、最坏检测延迟和 reset 如何校准；安全域重新扩张需要多少持续证据和 hysteresis？
3. 各目标设备的 `start_tube` 需要保留哪些状态相关性；AABB、对角/稠密椭球、多面体或 zonotope 在假接受、假拒绝、消息大小、近似误差和实测 WCET 上的 frontier 是什么？
4. 对每一对获批 controller mode，哪些 internal state 可经 translator 迁移，哪些必须重建/reset；如何从 outgoing command 与当前 state 构造 incoming 初始化，使总 effort 及其允许导数跳变有界；哪些组合不允许直接 handoff？
5. presolve、commit、takeover 与 fallback 的目标设备 WCET/p99/deadline reserve 分别是多少；超时后旧 task set 是否仍在其 lease、command validity 与 backup domain 内？
6. 每类设备的安全撤权映射是什么：controlled stop、brake、hold、land、return、disarm 或 terminate；谁拥有最终决策权，CODA 能观察哪些 receipt，但绝不能覆盖哪些动作？
7. 四个新增合同与既有 Observation/Mode/Control/Temporal/Authority 合同组合后，是否存在循环等待、双 writer、无 backup 或“每个局部合同都通过但联合动力学不可行”的最小反例；哪个 joint-admissibility checker 能在设备预算内保守识别它？

### 11.2 已冻结的结构与仍开放的值

本轮已经把不依赖目标设备实测的部分冻结为可机器读取工件：

- [`contract-index.json`](../contracts/c1t/contract-index.json)：唯一 canonical encoding、generated-only wire binding、语义 digest 来源、稳定拒绝码和硬边界；
- [`TaskActivationContract@1`](../contracts/c1t/task-activation-contract.schema.json)、[`ModelValidityEnvelope@1`](../contracts/c1t/model-validity-envelope.schema.json)、[`StateAlignmentContract@1`](../contracts/c1t/state-alignment-contract.schema.json)、[`HandoffContract@1`](../contracts/c1t/handoff-contract.schema.json)：四项边界合同的最小对象形状；
- [`DeviceCapabilityProfile@1`](../contracts/c1t/device-capability-profile.schema.json) 与 [`SafetyProfile@1`](../contracts/c1t/safety-profile.schema.json)：普通设备能力和不可由 CODA 自行扩张的安全映射分开；
- [`FalsificationBenchmarkSpec@1`](../contracts/c1t/falsification-benchmark-spec.schema.json) 与[三组 benchmark specification](../gseos/fixtures/c1t/benchmarks/)：接触/无扰交接、模型有效性检测、联合动力学组合；
- [`contract-hardening-pack.json`](../gseos/fixtures/c1t/contract-hardening-pack.json)：四项正例和稳定拒绝族反例；
- [`c1t-contract-hardening-review.json`](../tests/reports/c1t-contract-hardening-review.json)：本轮 settlement、证据索引、剩余挑战和重开条件。

冻结的是字段身份、枚举、引用方向、禁止行为、拒绝码、benchmark claim/non-claim 和 Oracle 接口；仍开放的是目标设备、控制器对、动力学后端、校准 corpus、全部 `threshold_ref/budget_ref/evidence_ref` 的实际值、WCET/p95/p99、deadline reserve、安全审批和 runtime authorization。任何 `pending` 引用都不得在运行时被解释成默认许可。

## 12. 外部依据与适用边界

- [MoveIt Task Constructor](https://moveit.picknik.ai/main/doc/concepts/moveit_task_constructor/moveit_task_constructor.html)证明复杂操作可分解为相互依赖的 generator/propagator/connector 及串并行容器；它不证明 CODA 的运行监督语义。
- [MoveIt Servo](https://moveit.picknik.ai/main/doc/examples/realtime_servo/realtime_servo_tutorial.html)提供流式 pose/twist/joint 命令、碰撞/奇异性检查与信号平滑；它说明连续 servo 应留在本地控制组件，不证明任意命令源安全。
- [ros2_control 异步控制器](https://control.ros.org/kilted/doc/ros2_control/controller_manager/doc/running_controllers_asynchronously.html)明确不同 update rate、异步执行和 missed update 风险；它反对冻结一个跨设备通用监督频率。
- [ros2_control Kilted release notes](https://control.ros.org/kilted/doc/ros2_control/doc/release_notes.html)说明 controller switching 可以走实时或非实时路径且可能影响实时循环；它不构成无扰切换或稳定性证明。
- [ros2_control Controller Manager](https://control.ros.org/jazzy/doc/ros2_control/controller_manager/doc/userdoc.html)把 controller switch timeout 暴露为部署配置，并区分 strict/best-effort 与实时/非实时切换；它支持 profile-specific timeout，却不支持在 CODA 核心中写死一或二个 tick。
- [Franka FCI](https://frankarobotics.github.io/docs/doc/libfranka/docs/overview.html)展示设备特定的 1kHz 回调、当前/上次命令状态、impedance mode、力矩率限制以及非平滑信号风险；它支持交接时匹配完整 command state，而不是只设置一个虚拟平衡点，该频率也不能外推为 CODA 核心频率。
- [DESPITE](https://despite-safety.github.io/)证明强规划能力不自动带来安全意识，支持把 LLM 候选与独立验证分开；其符号计划结果不能外推为连续控制安全证明。
- [PX4 Multicopter Control Architecture](https://docs.px4.io/v1.14/en/flight_stack/controller_diagrams)展示位置、速度、姿态、角速度和 control allocation 的级联，以及 mode-dependent outer-loop bypass；它支持用高层 reference 驱动本地闭环，而不是由任务语言直接计算各电机输出。
- [ros2_control Controller Chaining](https://control.ros.org/jazzy/doc/ros2_control/controller_manager/doc/controller_chaining.html)展示 controller 之间的 typed reference/state interface、资源 claim 和 chained mode 下禁用外部输入；它支持唯一 writer 与双向身体端口，但不自动提供 CODA 的恢复语义。
- [PX4 Safety/Failsafe Configuration](https://docs.px4.io/main/en/config/safety)展示 Warning、Hold、Return、Land、Disarm、Terminate 等设备/场景相关响应，并明确 kill 会使飞行器坠落；它支持分级保护，但反对把断电定义为通用最安全终点。
- [Universal Robots Stop Categories](https://www.universal-robots.com/manuals/EN/HTML/SW5_21/Content/prod-usr-man/complianceUR30/stop_categories_UR20_en.htm)按 IEC 60204-1 区分立即移除动力的 Category 0、受控停止后移除动力的 Category 1、保持驱动动力的 Category 2；其[安全功能表](https://www.universal-robots.com/manuals/EN/HTML/SW10_6/Content/prod-usr-man/hardware/arm_UR20/safetyFunctionsAndinterfaces/safety_functions_table1_UR20_en.htm)另行标注 ISO 13849-1 与 IEC 61800-5-2，说明这些术语不能合并，也不能把“撤销上层控制权”简化成唯一物理停止动作。
- [PX4 Offboard Mode](https://docs.px4.io/main/en/flight_modes/offboard)要求持续 proof-of-life，并在超时后退出外部控制进入配置的 failsafe；它支持 freshness、liveness 与本地 backup，但不意味着 authority lease 应随每个点目标抖动。
- [OCS2 Optimal Control Modules](https://leggedrobotics.github.io/ocs2/optimal_control_modules.html)区分 hard/soft constraints、要求部分约束 Jacobian 满秩，并将 switched-system mode schedule/target trajectory 通过 reference manager 更新；它支持显式 task/mode contract，但不证明任意动态任务集可行。
- [Changing-Contact Robot Manipulation](https://arxiv.org/abs/2106.10969)把接近速度、冲击力预测、变阻抗与连续接触控制组合起来，支持显式建模接触建立过程；它不证明所有接触都能被固定成同一个四态自动机，也不把机械冲击完全交给软件反馈吸收。
- [ROS 2 Joint Trajectory Controller trajectory replacement](https://control.ros.org/master/doc/ros2_controllers/joint_trajectory_controller/doc/trajectory.html)按时间戳把当前 hold/既有轨迹与新轨迹的有效部分拼接，支持 commit 时从当前执行状态连续替换，而不是盲用旧快照。
- [NIST CUSUM/残差检测说明](https://nvlpubs.nist.gov/nistpubs/gcr/2016/NIST.GCR.16-010.pdf)说明 CUSUM 等 stateful detector 依赖历史残差和阈值，可检测持续偏移；它同时意味着误报、漏报、模型与检测延迟必须被校准，不能替代独立硬保护。
- [Zonotope containment complexity](https://doi.org/10.1016/j.ejcon.2021.06.028)表明一般 zonotope 集合包含问题具有非平凡复杂度；即使 runtime 只做点 membership，也必须按表示、维度和生成元实测，而不能从“稀疏”直接推出通用 `O(N)` 或微秒级保证。
- [DeepReach](https://arxiv.org/abs/2011.02082)展示神经 HJ 高维可达性近似；[formal safety assurances](https://arxiv.org/abs/2209.12336)明确神经解可能出错并用误差界修正 reachable tube，因而学习结果不能默认获得硬安全等级。
- [Passive Hierarchical Impedance Control via Energy Tanks](https://ris.utwente.nl/ws/files/105394997/passive.pdf)说明 energy tank 可用于层级阻抗控制的 passivity；其保证范围仍不等于碰撞、关节、接触和支撑状态安全。

## Settlement

本轮 settlement 是 **`BOUNDARY CONVERGED / CONTRACT SCHEMAS, BENCHMARKS AND DEVICE PROFILES OPEN / HOLD RUNTIME IMPLEMENTATION`**：接受预编译响应监督、TrackingEnvelope、分层 guard、三阶段准入、Text-Owned 目标、四个新增边界合同、profile-specific contact graph、bumpless reconstruction、非对称模型有效域和联合动力学准入；拒绝固定接触四态、固定频率/预算/tick fallback、CUSUM/SPRT 冒充安全链、通用 `O(N)` start-tube 表示、无条件 controller state 继承、把单样本当参数真值、把 `q0=q_measured` 或通用 torque blend 当完整无冲击证明、混用 Stop Category/STO/SOS/ISO 13849、把撤权等同断电，以及“部署合同即获得控制保证”。这里的“收敛”只指职责和反例边界已稳定，不指 schema、benchmark oracle、profile 数值、WCET、闭环稳定性、passivity 或硬件安全证据已经完成。只有第 11 节合同、三组证伪 benchmark、目标设备证据与既有 C1 门禁闭合后，才重新讨论运行时实现授权。
