# 研究提案：CODA 物理知情策略编译（C1-P）

> 状态：`RESEARCH_PROPOSAL / STATE_A_REVIEWED / HYBRID_CERTIFICATE_REFINED / BUDGETED_FIDELITY_REFINED`（2026-09-22）。本文评估“在物理约束下以最小作用量/能耗达成意图”以及 Manifold-Constrained Field（MCF）能否扩展 CODA。它不授权实现、不把 C1-T 自动改写为物理引擎，也不宣称势场、耗散、最高保真或低维先验天然等于安全、全局收敛或感知自然。

## 评审结论

该方向**可行且与 CODA 当前设计相容**。State A 提出的势场化方案比“每次抢占都重做有限时域 TrajOpt”更贴近 CODA 的声明式哲学，但它不是传统优化器的无条件替代。正确的产品边界调整为：

> CODA 把语义意图、硬约束、数据先验和证据义务编译为一种受限 `PhysicsPolicy`：它可以是有限 `TransitionPlan`，也可以是逐状态求值的 `ReactiveFieldPolicy`。Dynamics Backend 提供状态演化与接触事实；C1-T runtime 仍负责租约、提交、抢占、监测和唯一终态。

这让 CODA 从“受约束的过渡 runtime”扩展为“受约束的策略编译器与证据运行时”。物理引擎负责给定状态和控制下**会发生什么**；有限规划器或反应式场策略负责**下一段或下一步应该怎样演化**；CODA 负责**目标从何而来、哪些约束不可交易、允许哪类策略、结果是否获权执行、证据如何回放**。

这三个角色可以紧密协作，但不能混成一个没有边界的“高维决策整体”。角色混淆会使物理误差、策略权重、执行权限和产品承诺无法分别审计。

## State A 的批判性裁决

### 应当吸收的部分

1. **从开环轨迹转向闭环策略是正确扩展。** 对局部姿态调整、弹簧感、镜头、软约束和频繁抢占，编译一个状态反馈场比反复生成完整 `u(t)` 更自然，也更符合“从当前状态继续”的 C1-T 原则。
2. **任务空间/流形分解是正确方向。** 不应把“手避障、脚保持接触、躯干朝向、风格先验”先压成一个 60 DOF 总成本；应在各自语义空间定义局部策略，再通过有几何意义的 pullback/组合规则回到配置空间。
3. **数据先验适合承担风格与可行动作域。** motion manifold 可以把“像人/像角色”的分布知识从手调 cost 中分离出来，让物理场只负责目标、扰动和环境适配。
4. **势场适合作为可版本化派生策略。** 目标、势能/度量、阻尼、有效域、稳定证书和 fallback 都可以成为只读 artifact，与 EventAsset 单一事实源并不冲突。

### 必须反驳或收缩的部分

| State A 主张 | 裁决 | 原因 |
| --- | --- | --- |
| 势场天然全局无条件稳定 | **拒绝。** | 能量下降至多给出局部/条件稳定；普通人工势场会有局部极小、鞍点和不可达域。全局或 almost-global 收敛需要 navigation-function 拓扑条件、唯一目标极小值、正定阻尼、模型匹配等额外证明。 |
| 高势垒等同硬约束 | **拒绝。** | 有限势垒可被足够动能/离散步长穿透；无限势垒会造成刚性和数值问题。硬安全需要可行域不变性证明、contact/constraint solver 或独立 safety projection，不是“惩罚足够大”。 |
| 抢占零延迟且不注入能量 | **收缩。** | 更新目标参数很便宜，但切换 `U(q,t)` 会瞬间改变储能函数，相当于控制器注入/抽取能量；仍需 C1-T write barrier、能量跳变量测与受限切换。 |
| 局部梯度计算为 `O(d)` 且与时间步无关 | **拒绝。** | 仍需每 tick 积分；碰撞查询、decoder/Jacobian、质量矩阵求解和接触可能高于线性。只有利用稀疏树结构且策略局部时才可能接近 `O(d)`。 |
| 势场可完全替代规划 | **拒绝。** | 绕障拓扑、窄通道、接触模式切换和离散技能选择往往需要全局/混合规划。势场擅长局部反应，规划擅长选 basin、homotopy class 和 mode。 |
| VAE/PCA 低维空间天然保证自然 | **拒绝。** | 它只保证接近训练分布；latent 距离未必对应物理能量或骨骼距离，decoder 可产生足滑/碰撞，OOD、拓扑折叠与 Jacobian 奇异都可能破坏物理含义。 |
| 拉普拉斯场是当前公式的准确名称 | **暂不采用。** | 当前仅定义一般 `U` 与梯度流，并未要求 `∇²U=0` 或解 harmonic PDE。若未来使用 harmonic/navigation function，再以具体数学条件命名。 |

因此 State A 的 settlement 是：**采用 `ReactiveFieldPolicy` 作为 C1-P 的一等策略族；不采用“MCF 独占 C1-P”或“无需规划/物理后端”的表述。** `MCF` 目前仅是本项目对“流形约束反应式场”方向的工作标签，不应在 field、metric、组合规则、证书条件和失败语义冻结前当成一个已经成立的标准算法名。

## 因果补充评审：风险成立，“必然结论”不成立

后续评审提出了脉冲求解、pullback 退化和高阶安全约束三个重要缺口。它们应进入 C1-P.0，但不能以“定理已证明”的形式原样冻结：

| 补充主张 | 裁决 | 修正后的契约含义 |
| --- | --- | --- |
| 任何无源系统当且仅当可写成 `J=-Jᵀ, R≥0` 的 port-Hamiltonian 形式 | **拒绝该充要表述。** | port-Hamiltonian 结构在适当储能与端口定义下可推出无源性，但一般无源非线性系统不必存在光滑的该形式。C1-P 只要求可审计的供给率/储能不等式，不把一种表示法当成全部无源系统的定义。 |
| 任意外部激励下无源就等于稳定 | **拒绝。** | 无源只限制“储能增加不超过外部供给”；外界可以持续注入任意能量。稳定性还需要零输入、被动互连、储能正定/径向条件或输入有界等额外条件。 |
| 离散碰撞脉冲必然破坏证书并造成能量泄漏 | **收缩。** | 纯连续证书确实不足，但脉冲可以作为 hybrid jump 与外部功单独记账。真正的失败是 jump 不可观测、来源不可归属或离散残差超限，不是“出现脉冲”本身。 |
| `dim(Z)<dim(Q)` 必然使 `M_z` 有零本征值 | **拒绝。** | 当 `M_q` 正定且 `J_g` 满列秩时，`M_z=J_gᵀM_qJ_g` 仍正定；只有秩丢失或最小奇异值趋近零时才退化。高条件数会放大误差，但不等于已经奇异。 |
| 零空间阻尼可普遍消除 decoder 奇异 | **收缩。** | 满列秩 decoder 在 latent 域未必存在非平凡 latent 零空间；应使用奇异值/广义本征值守卫、正则化求解、输出限幅与全空间阻尼 fallback，而不是承诺一个总存在的零空间。 |
| finite→field 切换必然使 HO-CBF QP 无解 | **拒绝“必然”。** | 可行性取决于当前状态、输入边界、相对阶、采样模型和多个约束是否相容。切换阶跃可能暴露不可行，但不是唯一成因；正确边界是切换前做兼容域准入并准备独立 backup policy。 |
| Energy Tank 可以替代 CBF/硬安全 | **拒绝。** | tank 可限制策略主动注入的能量并保持某种无源性，但低能量运动仍可越界或碰撞。passivity budget 与 state safety 必须是正交门，不能互相替代。 |
| Razumikhin 延迟证书可直接解决离散碰撞 | **暂不采用。** | 该类结果针对带通信/状态延迟的离散互联系统；除非 C1-P 先建立对应延迟模型与可验证域，否则不能把它当作通用 physics tick 或碰撞证书。 |

因此补充评审不要求拓扑重构，而是把原 `PolicyCertificate` 从单一连续能量陈述升级为三组彼此独立的证据：**hybrid 能量归因、度量数值可接受性、硬安全递归可行性**。

## 有限算力下的目标：决策充分，而非物理完美

游戏动画、游戏物理、机器人仿真和真实硬件不需要同一等级的模型保真度。C1-P 的目标不是把所有场景都提升到“最真实模拟”，而是在声明的环境、误差和算力预算内，使用**足以保持决策结论的最低保真模型**。需要区分：

| 证据层 | 要回答的问题 | 可以近似什么 | 不能被近似掉什么 |
| --- | --- | --- | --- |
| simulation fidelity | 预测状态与参考/实测有多接近？ | 次要自由度、远场接触、材料细节、长 horizon。 | 必须声明省略现象、有效域和误差口径。 |
| decision fidelity | 近似模型是否仍选择相同的可接受策略、fallback 或拒绝？ | 精确轨迹、最优成本和最终小数值。 | 意图是否达成、候选是否可执行、终态类别不能静默翻转。 |
| safety fidelity | 近似后硬安全结论是否仍成立？ | 可通过保守约束收紧、鲁棒余量和 backup 域降低性能。 | 资源权限、有限数、输入/扰动 envelope、viability 与硬件安全层不能作为 Pareto 代价交易。 |

因此“近似正确”不是状态误差最小，而是：在预注册场景分布内，近似模型相对高保真 reference/实测不会把 `execute / fallback / reject` 决策翻转到危险一侧；若无法证明，就提高 fidelity、收紧约束或拒绝。

### Pareto 前沿只存在于安全可行域内

C1-P 先按词典序建立候选集合：

```text
A_safe = candidates satisfying
  schema/resource/numerical validity
  ∩ hard-safety and viability requirements
  ∩ intent acceptance floor
  ∩ deadline reserve for commit/fallback
```

只有 `A_safe` 内的候选才进入 Pareto 比较。可比较维度包括目标误差、模型/执行偏差、effort、smoothness、感知损失、首响应、p95/p99 tick 时间、确定 work units、峰值内存与能耗。安全违规、租约违规或 deadline miss 不是“较差分数”，而是候选无效。

Pareto set 默认在离线或 shadow 阶段生成和校准；runtime 只能在 EventAsset/Profile 已允许、版本固定的 frontier/profile 中按确定规则选取，不能现场悄悄改权重或放宽安全边界。若两个候选在声明容差内等价，使用规范编码的稳定 tie-break，保留回放性。

### 三种“收敛”必须分开

- **数值收敛：** solver residual、KKT/固定点误差或相邻迭代改善达到阈值；只说明算法停止，不说明动作正确；
- **控制收敛：** 状态在截止时间内进入目标管 `Ω_ε` 并保持 `dwell_ticks`；允许 practical/ultimate bounded convergence，不强求数学上的精确平衡点；
- **模型收敛：** PredictionReceipt 与 RuntimeObservation 的误差分布保持在 profile envelope 内；超限时必须提高 fidelity、收紧域或停止使用该模型。

游戏姿态可以使用较宽的 `Ω_ε` 和感知阈值；机器人仿真需要校准的状态/接触误差；真实硬件还必须服从独立安全控制器。三者可以共享策略契约，不能共享未经重标定的误差阈值。

### 预算必须是契约，不是实现备注

`PolicyProfile@1` 必须内嵌 `ComputationBudget` 与 `ApproximationPolicy`：

- 确定 work budget：最大 dynamics steps、policy evaluations、collision queries、linear solves/factorizations、iterations、候选数和内存；
- 目标设备预算：physics tick、首响应、p95/p99 wall time 与为 commit/fallback 预留的 deadline reserve；
- fidelity/降级阶梯：允许的模型层级、升级触发器、约束收紧、warm start、缓存/预计算和 timeout fallback；
- anytime 规则：预算耗尽只能返回“已通过全部硬门的当前最好候选”，否则 fallback/reject，不能返回未校验的最后一次迭代。

回放以确定 work budget 为主；wall watchdog 只作目标设备上的运行保护，因为相同 wall time 在不同负载下不代表相同计算。`PredictionReceipt` 必须同时记录两类预算的上限、实际消耗、停止原因、近似等级与剩余安全裕量。

### 多保真级联，而不是每 tick 使用最高保真

建议的默认路径是：

```text
cheap admissibility / kinematic screen
  → reduced or local dynamics generate candidates
  → higher-fidelity model validates top-k or uncertain cases
  → runtime feedback + independent safety mechanism executes
```

只有接近约束边界、模型不确定性超限、候选排序不稳或低/高保真决策不一致时才升级 fidelity。低保真结果可以用于筛选和排序，但若它没有经保守误差界保护，不得单独批准 hard-safe 执行。

fidelity tier 还必须绑定在线 `ModelValidityEnvelope`，覆盖参数/set-membership bounds、接触假设、校准 residual、OOD、状态 belief 和 disturbance envelope。摩擦、地面顺应性、载荷或模型 residual 超出包络时，runtime 只能收紧 margin、升级模型、进入 backup 或拒绝，不能用在线点估计静默扩大 viability set。Covariance 不能替代偏差、多峰和 epistemic/model error；DeepReach、Neural CBF 或 learned viability model 在没有经当前模型域验证的误差界与保守 set correction 时，只能生成候选或 shadow evidence。

动态 task/contact/controller 变构与策略 handoff 也不是普通目标更新：硬约束必须原子生效，软 cost 才可按获批 activation profile 连续变化，复杂 mode 先预求解并验证 conditioning/feasibility 后再提交。可选 passivity/energy ledger 约束策略注能，但不能延迟安全撤权，也不能替代接触、支撑和状态安全。

复杂度不能只写成一个抽象的 `O(N³)`。稠密矩阵分解可能是三次复杂度，但树形刚体动力学、稀疏 KKT、局部 field 和增量更新可以利用结构显著降低成本；相反，碰撞对数、接触数、horizon、候选数和 decoder/Jacobian 可能成为实际瓶颈。每个 SolverManifest 因此必须同时给出渐近变量、结构假设和目标设备 benchmark，不能用大 O 替代测量。

## 产品边界契约

### 主体与情境

- 主要用户：需要表达角色、镜头、软体或机关意图，但不想手写每帧控制的游戏/技术动画作者；
- 次要用户：定义 dynamics model、objective profile、solver manifest 和 Adapter 的高级开发者；
- 外部系统：Godot Physics/Jolt、后续研究用物理后端、Animation/Skeleton Adapter；
- 触发：C1-T 的 kinematic recipe 无法表达惯性、接触、能耗或动力学可行性，且项目能提供受版本约束的物理模型。

### 输入与输出

输入是 EventAsset 中的语义意图、资源、硬约束、允许的 `ObjectiveProfile@1`、`PolicyProfile@1` 与 `SafetyMechanismProfile@1`。质量、惯量、碰撞几何、关节/执行器映射、积分器、接触参数、fidelity tier、省略现象与误差 envelope 属于版本化 Dynamics Adapter profile；field、metric、decoder、数据集摘要、计算预算和近似/降级规则属于版本化策略 profile，均不写入每次意图。

输出不是“物理真相”，而是：

- 一个有限 `TransitionPlan`，或一个状态反馈 `ReactiveFieldPolicy`；
- 按项展开的目标函数值和约束余量；
- `PolicyCertificate`：策略有效域、平衡点/吸引域主张、flow/jump 储能不等式、阻尼/度量条件、切换兼容域和不适用条件；
- `PredictionReceipt`：模型、后端、策略/求解器、平台、fidelity/approximation tier、步长、hybrid energy ledger、passivity/safety 双准入、work/wall budget、终止原因与可行性结论；
- 与真实执行关联的 `RuntimeObservation`，用于判断模型预测误差。

### 状态、控制权与失败

- planner、field compiler 和数据模型只产生候选，没有资源租约或 Adapter 句柄；
- C1-T runtime 仍是唯一的准入、租约、提交、抢占和终态仲裁者；
- 无可行策略、预算耗尽且没有已通过全部硬门的 anytime 候选、证书条件不满足、数值不稳定、模型/decoder 摘要不匹配、状态离开 field/latent 有效域、接触模式不可信或预测误差超限时，候选不得继续执行；
- 首版只允许离线或 shadow prediction；在预测误差门通过前，物理候选不进入实时写路径。

### 明确非目标

- 不在 C1-P 首版重写碰撞检测、刚体积分、约束求解或 Godot 物理后端；
- 不把 safety、关节限位、碰撞、接触保持或资源权限变成可用低能耗交换的软惩罚；
- 不把高势垒、数据集内重建或连续时间 Lyapunov 证明直接称为离散执行的硬安全保证；
- 不承诺一个目标函数跨角色、动物、机器人、镜头和 UI 都代表“自然”；
- 不以仿真最优替代真实执行可行、玩家感知自然或硬件安全；
- 不把求解器返回的局部最优、可行点或预算内最好结果表述为全局最优。
- 不要求所有游戏/动画场景使用最高保真模型，也不把低状态误差自动称为决策充分；
- 不以单个渐近复杂度或开发机平均耗时替代目标设备的结构化 workload、p95/p99、内存和 deadline 证据。

## “最小作用量、最少能量”的必要修正

### 最小作用量不是通用的自然性目标

经典作用量通常写为 `S = ∫ L(q, q̇, t) dt`，其中 `L = T - V`。真实无控系统满足的是作用量的**驻值条件**，不保证它在所有候选中取最小，也不等于执行器能量消耗最少。它适合作为 dynamics formulation 的理论来源之一，不适合作为 CODA 对所有意图统一承诺的单一评分。

有意图的角色运动更接近有限时域最优控制：

```text
minimize over x(t), u(t), T
    J = Φ_goal(x(T), intent)
      + ∫ [w_effort·C_effort(x,u)
           + w_smooth·C_smooth(x,u)
           + w_time·C_time
           + w_style·C_style(x,u)] dt

subject to
    ẋ = f_model(x,u)
    x(0) = SnapshotBundle
    hard physical / contact / collision / joint / lease constraints
    terminal intent acceptance constraints
```

`C_effort` 必须明确到底指控制平方 `uᵀRu`、正机械功、总机械功、峰值力矩还是其他代理；它们不是同一指标。只最小化能量会出现退化解：不动、无限慢、借重力跌落或牺牲到达时间都可能更“省能”，却不满足用户意图或感知自然。

### 目标必须分层，而不是全部加权交易

C1-P 使用词典序目标：

1. **硬约束层：** 资源所有权、碰撞/穿透、接触、关节/速度/力、有限数、Adapter 能力；任何权重都不能交换；
2. **意图层：** 在时间窗口内达到目标集合并满足稳定窗口；不满足即 infeasible；
3. **优化层：** 在可行解中比较 effort、smoothness、duration、style deviation；
4. **确定 tie-break：** 在声明成本等价容差内，以规范 plan 编码/solver rule 选出唯一候选。

每个 ObjectiveProfile 必须声明单位、规范化、权重、时间尺度、终端成本、硬/软分类和允许放宽项。成本总分之外必须保留逐项分解，避免一个数字掩盖“更省能但更抖”或“更平滑但更慢”。

## 弹簧系统是好起点，但不是最终抽象

一维阻尼弹簧：

```text
m·ẍ + c·ẋ + k·(x - x_goal) = 0
```

可以提供一个非常好的 C1-P 首个 reference fixture：状态少、参数可审计、解析/数值结果可比较、能量变化可计算、抢占时可从当前 `x, ẋ` 重设目标。临界阻尼附近还能形成“不振荡、较快收敛”的明确基线。

但弹簧只证明局部反馈和能量整形。高维骨骼、非完整约束、主动肌肉/执行器、摩擦、碰撞和接触切换会引入非凸、非光滑和多解问题；把每个骨骼都挂弹簧并不能自动得到全身自然动作。首个 fixture 应把弹簧当作**可解释基线 solver**，而不是把“弹簧感”写成 CODA 的产品语义。

## ReactiveFieldPolicy 的严格语义

State A 的二阶系统应改写为带配置相关质量、偏置项、外力端口和安全机制的目标闭环，而不是把所有速度项塞入“势能”：

```text
M(q)·q̈ + h(q,q̇) + D(q,q̇)·q̇ + ∇U(q; intent) = τ_external + τ_safety
```

其中 `U(q)` 只表示配置势能；动能属于储能函数 `K = 1/2·q̇ᵀM(q)q̇`，速度相关耗散属于 `Dq̇`。对每个 field artifact，`PolicyCertificate` 至少声明：

- 状态域和参数域；`M` 的正定/条件数边界，`D` 的半正定或更强条件；
- 目标平衡点、已知其他临界点，以及主张的是 local、regional、almost-global 还是未证明收敛；
- 储能函数 `H = K + U` 及连续时间下的能量导数/供给率条件；
- 离散积分器、步长域和离散能量残差；超域不得继续沿用连续时间证明；
- 外力、接触、目标切换和抢占作为 energy port 的计量方法；
- 硬约束究竟由 contact solver、projection、control barrier/safety filter 还是拒绝执行保证。

当 intent 或 field profile 切换时，必须记录同一状态下的能量跳变：

```text
ΔH_switch = H_new(q,q̇) - H_old(q,q̇)
```

若跳变超过 profile 的 switching envelope，新策略不能“零延迟”直接取得写权，只能限幅、交叉切换、进入显式收敛策略或拒绝。这样 C1-T 的 write barrier 仍然成立，势场只减少重新规划，不取消控制权交接。

### 连续流与离散跳变必须分账

碰撞、限位修正、solver warm start、策略切换和瞬时外力不能继续被混入一个“`H` 是否单调下降”的布尔量。每个 physics tick 应形成可审计的 hybrid energy ledger：

```text
ΔH_observed
  = W_policy
  + W_external
  + W_contact_or_constraint
  + W_switch
  - W_dissipation
  + ε_numeric
```

- `W_policy` 是 CODA 策略命令可归属的功；`W_external` 是声明的外部激励；
- `W_contact_or_constraint` 是 backend 的碰撞/约束 jump work；`W_switch` 是同一状态下换场或换 metric 产生的储能差；
- `ε_numeric` 只能处于按 backend、步长、solver iteration 和量化规则声明的残差 envelope 内；不能把无法解释的正能量统一记为“碰撞”；
- backend 若不能提供足够的 impulse/constraint receipt，只能形成 tolerance/shadow 证据，不能形成逐端口精确证书。

这意味着 `ΔH_switch` 仍然有效，但只衡量**策略定义切换**，不能承担碰撞脉冲、外力和数值误差的总锅。`PolicyCertificate` 必须分别给出 flow inequality、jump inequality、可观测端口、不可观测残差和适用 backend。

可选的 energy tank 只管理 `W_policy + W_switch` 中由策略主动支配的正注能，并声明初始预算、保留量、充值来源、单 tick 功率上限和耗尽动作。tank 耗尽时允许缩放 nominal policy、切到阻尼/保持或拒绝新策略，但不得吞掉外部碰撞功，也不得宣称由此保持关节/碰撞安全。

### 势垒与硬安全分离

`U_barrier` 可以用于提前排斥、改善距离余量和塑造路径，但它默认只是 performance policy。要把集合 `S = {x | h(x) ≥ 0}` 称为硬安全域，必须另有 forward-invariance 证据或每 tick safety filter；若需要在线投影/QP，这并不构成设计失败，而是把低成本 nominal field 与最小必要安全修正分层。

普通人工势场出现非目标局部极小或拓扑死区时，Runtime 必须检测 `||q̇||`、目标进展、梯度和约束余量组成的 stagnation condition，并触发确定 fallback：切换经证明的 navigation field、请求有限规划器选择新 basin/mode，或失败。不得通过继续增大排斥权重假装问题消失。

安全过滤也不能只写成“每 tick 解一个 QP”。`SafetyMechanismProfile` 必须声明连续、sampled-data、离散或 hybrid 模型，约束相对阶、输入/速度/冲量边界、允许的 disturbance envelope、鲁棒余量、采样周期、已验证 viability/backup 域和无解后的权威动作。finite/field 切换只有在当前状态同时属于新策略有效域、hard-safe viability/backup 域且存在允许输入时才可提交；否则 Adapter 保持旧安全控制、进入已验证 backup controller 或产生 `SAFETY_ADMISSION_REJECTED`，不得先切换再期待 QP 补救。

任何有限执行器都不可能对任意大外部冲量保证集合不变性。超过 disturbance envelope、初态已经在 viability kernel 外或 backend 太晚才报告接触时，契约只能保证及时检测、撤销 nominal 写权、触发 Adapter/硬件安全层并记录 `SAFETY_DOMAIN_EXITED`；不能继续声称“硬安全已保持”。

Energy tank 与 safety filter 可以组合，但前者证明的是受控能量预算，后者证明的是安全集合不变性；即使某个统一求解器同时计算二者，receipt 也必须分别报告 `passivity_admissible` 与 `state_safe_admissible`。

### 数据流形不是欧氏捷径

若策略在潜变量 `z` 上运行、decoder 为 `q = g(z)`，至少需要 decoder Jacobian `J_g` 和物理量的 pullback：

```text
M_z(z) = J_g(z)ᵀ · M_q(g(z)) · J_g(z)
```

潜空间中的距离、梯度和阻尼只有在声明 metric 下才有物理意义。`LatentPriorProfile` 因此必须固定模型/训练数据摘要、坐标规范、decoder、metric、支持域/OOD 分数、Jacobian 条件数上限和 decoded constraint checker。状态离开支持域、decoder 奇异、接触要求离开流形或重建误差超限时，必须回到全空间安全策略或失败。

数值守卫不能只检查 `det(M_z)` 或一个条件数。`MetricConditionGuard` 至少记录 `σ_min(J_g)`、`λ_min(M_z)`、条件数、求解残差、输出加速度/力矩上限以及阈值迟滞；不同量纲下的阈值必须来自 profile 标定，而不是写死一个通用 `κ_max=1000`。接近退化域时的确定顺序是：

1. 使用声明阻尼的伪逆/Tikhonov 或截断 SVD，并报告因此产生的任务误差；
2. 若输出、残差或 decoded constraint 仍超限，撤销 latent nominal policy，切到配置空间阻尼/保持或已验证 backup；
3. 若 backup 也不在有效域，fail-closed 并交还 Adapter 安全层。

“零空间阻尼”只能作为已证明投影存在时的一种实现候选，不是 schema 语义，也不是通用 fallback 名称。

PCA/VAE 只证明压缩或重建特性，不证明动力学闭包：真实外力作用后的下一状态未必仍在 decoder manifold 上。若要让 latent field 驱动物理角色，还需要一个经验证的低层跟踪/物理控制器；它的稳定性和能耗不能由 VAE 重建损失继承。

## 混合架构：场负责局部，规划负责拓扑与模式

建议把 C1-P 定义为两个一等策略族，而不是二选一：

| 策略族 | 最适合 | 不擅长 |
| --- | --- | --- |
| `ReactiveFieldPolicy` | 高频扰动、局部目标跟随、连续抢占、避限位余量、风格流形内修正。 | 全局绕障拓扑、窄通道、接触序列、离散技能选择。 |
| `FiniteHorizonPolicy` | 选择 basin/homotopy class、接触/技能 mode、预见性动作、越过局部极小。 | 高频重规划成本高，对模型和初值敏感。 |

Runtime 可以执行一个有界 hybrid policy：有限 planner 选择 mode/局部 chart/field profile；`ReactiveFieldPolicy` 由其 manifest 指定的原生 controller/policy executor 闭环执行；C1-T 响应监督器只监控 typed guard、TrackingEnvelope、租约和终态，不与底层 Controller 形成第二个反馈环；独立 safety mechanism 在设备架构规定的位置和周期保持其声明的硬约束。stagnation/OOD/证书失效时退出当前 field。所有切换继续服从 C1-T 租约、generation、能量 envelope 和唯一终态。

这里的“低频/高频”只是相对职责，不是 CODA 核心频率。`ReferenceFrame`、`PlanningHorizon`、`SupervisoryCycle` 与 `ControlCycle` 的定义和边界以 [`coda-embodied-language-runtime-boundary.md`](coda-embodied-language-runtime-boundary.md) 为准。任何周期都必须由目标设备 profile、端到端 deadline、WCET、数据新鲜度和 p95/p99 测量确定，不能由单一 Nyquist 公式或游戏 physics tick 外推。

这比“TrajOpt 或 MCF”更贴近 CODA：EventAsset 仍只声明意图，编译器选择被允许且有证据的策略组合；具体轨迹、field、latent chart 和安全修正仍是派生物。

## 建议架构

```text
.coda(text_owned) / EventAsset(graph_owned) intent
  ↓
CODA PhysicsPolicy Compiler
  hard constraints + terminal set + ordered costs + allowed strategy families
  ↓
┌──────────────────────────┬─────────────────────────────┐
│ FiniteHorizonPolicy      │ ReactiveFieldPolicy         │
│ plan/mode/contact choice │ field/metric/damping/domain │
└─────────────┬────────────┴──────────────┬──────────────┘
              ↓                           ↓
       ReactiveExecutionGraph Supervisor
              ↕ Dynamics Backend / Snapshot stream
       Native Policy/Controller + independent Safety Plane
  ↓
Core Policy Validator → C1-T lease/commit → Execution Adapter
  ↓                                      ↓
DecisionRecord                       RuntimeObservation
             └──── prediction-error comparison ────┘
```

### 新契约

| 契约 | 责任 | 不承担什么 |
| --- | --- | --- |
| `DynamicsModelRef@1` | 固定状态/控制变量、单位、模型/几何/参数摘要、backend ABI、fidelity tier、省略现象、有效域和 reference/实测误差口径。 | 不定义用户意图或资源权限；低保真不自动获得执行权。 |
| `ObjectiveProfile@1` | 固定硬约束、目标管 `Ω_ε`/稳定窗口、分层成本、单位/权重、容差和允许放宽项。 | 不包含模型路径、任意代码或执行句柄。 |
| `PolicyProfile@1` | 声明允许的 finite/field/hybrid 策略族、`ComputationBudget`、`ApproximationPolicy`、fidelity 升降级、切换/stagnation/OOD 和 fallback。 | 不取得租约或执行权，也不能在 runtime 静默放宽边界。 |
| `SolverManifest@1` | 对 finite planner 固定算法、版本/摘要、horizon、步长、结构假设、复杂度变量、确定 work units、anytime 语义和终止码。 | 不宣称超出证据的全局最优，也不以大 O 替代目标设备测量。 |
| `ReactiveFieldPolicy@1` | 固定 field/metric/damping、状态/参数域、目标绑定、每 tick 输出 schema 和切换 envelope。 | 不把连续时间稳定性自动外推至离散执行。 |
| `SafetyMechanismProfile@1` | 固定安全模型类别、相对阶/采样周期、输入与 disturbance envelope、鲁棒余量、viability/backup 域、无解/域外动作和 Adapter 权威边界。 | 不把 passivity、低功率或 QP 成功自动称为状态安全，也不承诺抵御任意大外力。 |
| `PolicyCertificate@1` | 记录数值/控制收敛主张范围、flow/jump inequality、端口可观测性、离散步长、切换兼容域、已知临界点和反例。 | 不把 solver 停止、普通势场、energy tank 或连续证明称为全局安全。 |
| `LatentPriorProfile@1` | 固定模型/数据摘要、decoder、pullback metric、支持域/OOD、`MetricConditionGuard` 与 decoded constraint checker。 | 不把训练分布当作物理可行域，也不保证零空间存在。 |
| `PredictionReceipt@1` | 记录模型/策略环境、fidelity/approximation tier、可行性、分项成本、约束余量、hybrid energy ledger、work/wall 消耗、anytime quality 与终止原因。 | 不证明真实执行相同或感知自然。 |
| `ModelErrorReport@1` | 对齐预测与 reference/执行状态，报告位置/速度/接触/能耗代理误差、decision flip、漂移窗口和 frontier 变化。 | 不自动更新权威模型或静默调参。 |

PhysicsPolicy Compiler、Dynamics/Solver Adapter 与 C1-T Hook 不同：它们有明确状态空间、每 tick 数据依赖、数值语义和证据义务。它们仍无独立执行权，但不能被塞进一个泛化 `plan_modifier` 来绕过模型、预算、有效域和误差审计。`ReactiveFieldPolicy` 是派生的闭环策略，不是 EventAsset 的第二逻辑源。

当前 C1-P.0 的可审查落档入口是 [`contracts/c1p/contract-index.json`](../contracts/c1p/contract-index.json)，其中索引十个顶层 schema；最小设计 fixture 位于 [`gseos/fixtures/c1p/contract-pack.json`](../gseos/fixtures/c1p/contract-pack.json)。这组文件只冻结字段、责任边界、候选权、硬安全优先、anytime 终止语义和三类收敛的记录口径，不授权 field/solver/physics backend 实现，也不替代目标设备校准。

## 何时才叫“更好的物理引擎”

目前最多可以提出三种逐级主张：

| 主张级别 | 可证明的内容 | 所需证据 |
| --- | --- | --- |
| `P1` 物理知情策略 | finite 或 field 候选在声明模型/有效域/预算下满足硬约束，并位于相对固定 blend/弹簧基线的非支配 frontier。 | 同状态流、同目标、同硬门下的 fidelity、误差、work/wall、可行性、能量残差和分项指标比较。 |
| `P2` 更好的物理创作/控制层 | 作者更容易表达目标；预测与执行误差在容差内；执行结果优于基线。 | 作者任务证据、ModelErrorReport、运行指标与失败恢复。 |
| `P3` 更好的物理后端 | 新 backend 在相同场景和误差口径下，比 Godot Physics/Jolt 等基线有更好的准确性、稳定性、吞吐或可微性，并说明代价。 | 独立 benchmark、参考解/实测、跨步长/平台稳定性和性能数据。 |

`P1/P2` 成立不会自动推出 `P3`。反过来，一个更准确的积分器也不会自动得到更自然的意图轨迹。只有在 P1/P2 的失败被证据定位为 Dynamics Backend 的能力缺口，而不是目标函数、模型参数、优化器、Adapter 或感知标准的问题时，才允许立项 CODA 自研 physics backend。

## 证据门与研究切片

| 阶段 | 研究问题 | 通过证据 | 失败结论 |
| --- | --- | --- | --- |
| `C1-P.0` | 能否把意图、硬约束和分层目标编译为无执行权、预算有界的 finite/field/hybrid PhysicsPolicy？ | 十个契约草案；策略生命周期；硬/软边界；flow/jump、passivity/safety、fidelity/approximation、work/wall budget 与三种收敛责任无歧义。 | 若必须把 field/solver/模型写回 EventAsset，或近似只能靠静默放宽硬门成立，则 `REFRAME`。 |
| `C1-P.1` | 一维/二维阻尼场能否在离散流、外力/碰撞 jump、目标抢占、安全准入与有限预算下满足声明证书？ | 解析 reference；hybrid energy ledger、`ΔH_switch`、tank/无 tank、multi-fidelity、anytime/timeout 对照、离散残差、步长域、backup 与预算—质量曲线；不声称全局。 | 无法归属 jump、passivity 与 hard safety 混写、预算耗尽返回未校验候选或低保真翻转危险决策则停止扩维。 |
| `C1-P.2` | 普通势场在障碍/窄通道的局部极小能否被检测并由 hybrid fallback 闭合？ | 构造陷阱 fixture；stagnation 确定触发；navigation field 或 finite planner 选择新 basin。 | 无法检测/退出就不得用于有障碍执行。 |
| `C1-P.3` | 低维 motion prior 能否保持几何、物理约束和支持域可判定？ | decoder/pullback metric、重建误差、`σ_min/λ_min/cond`、求解残差、输出限幅、OOD、decoded collision/contact 与 fallback 反例；只做 shadow。 | latent 距离无物理意义、退化不可检测或正则化后仍越界则停止 latent field。 |
| `C1-P.4` | hybrid policy 是否在 Skeleton fixture 上形成优于 kinematic、spring 和单纯 finite planner 的预算—效果 frontier？ | 同硬门下报告 fidelity、技术成本、work/wall/内存、能量/安全残差、预测误差、抢占响应、运行稳定和感知证据；标出 dominated candidates。 | 只改善内部指标、依赖超预算或始终被简单基线支配时，停止产品扩张。 |
| `C1-P.5` | 接触/摩擦和多 mode 的高维策略是否值得进入产品范围？ | 接触残差、mode 可靠性、预算、失败率和 fallback 达标。 | 非光滑/局部极小/模式爆炸不可控则保持研究工具。 |
| `C1-PHYS.0` | 是否有必要自研 physics backend？ | P1–P5 证据排除 policy/objective/model/solver/Adapter 问题，并给出现有 backend 无法满足的最小反例。 | 没有最小反例则停止该立项，继续使用外部 backend。 |

关键路径是：`C1-T 设计冻结 → C1-P.0 → C1-P.1a–1e → C1-P.2 → C1-P.3 → C1-P.4`。C1-P.5 和 C1-PHYS 都是后续条件研究，不进入 C1-T 首版关键路径。

### C1-P.1 最小 fixture 必须拆成五个可归因切片

附件建议的“一维双积分器 + 关节限位 + 外部脉冲 + energy tank”方向可采用，但不能一次混测，否则无法知道失败来自积分、jump 归因、passivity budget、hard safety，还是 fidelity/预算选择：

| 切片 | 只引入什么 | 必须记录 | 通过/失败判据 |
| --- | --- | --- | --- |
| `C1-P.1a` discrete flow | 一维双积分器、阻尼 field、固定步长与目标切换，无接触。 | 解析/高精度 reference、`W_policy/W_switch/W_dissipation/ε_numeric`。 | 在声明步长域内残差有界；超域确定拒绝，不借 tank 掩盖积分误差。 |
| `C1-P.1b` tagged impulse | 已知时刻和冲量的外部速度 jump，不加限位；覆盖 envelope 内外两组。 | jump 前后状态、外部 impulse/work、ledger residual、domain verdict。 | 外部注能被正确归属；相同输入流产生容差内相同 receipt；域外不伪称稳定/安全。 |
| `C1-P.1c` constraint jump | 单侧关节限位、声明 restitution/contact model。 | backend impulse/constraint receipt、穿透/位置余量、jump residual。 | 后端可观测时闭合 jump 账；不可观测时明确降级为 tolerance/shadow，不伪造精确端口功。 |
| `C1-P.1d` switch admission | finite↔field 抢占、输入饱和、可选 tank、独立 safety/backup。 | `passivity_admissible`、`state_safe_admissible`、tank 余额、backup/start/terminal receipt。 | 任一门失败时不授予新写权；tank 不为负，安全域不靠 tank 证明，无解进入唯一 backup/拒绝终态。 |
| `C1-P.1e` budget/fidelity sweep | 对 1a–1d 使用不同步长、horizon、iteration/work limit、reduced/reference model 与 anytime cutoff。 | 确定 work、p95/p99 wall、内存、误差、decision flip、目标管和安全裕量的完整曲线。 | 形成非支配 frontier 与确定选型；超预算时只返回已认证候选，否则 fallback/reject。 |

energy tank 是 `1d` 的对照变量，不是 fixture 的预设赢家。至少比较无 tank 的幅值/斜率限制、tank budget 和直接拒绝三种策略；若 tank 只减少 nominal 性能而未扩大已证明的安全可接受域，则不进入产品契约。`1e` 同样不寻找单一“最高精度赢家”，而是删除被支配方案，冻结不同设备/场景可选择的 profile 与升级触发条件。

## 关键挑战

| 挑战 | 为什么比原 C1-T 更难 | 进入条件或止损线 |
| --- | --- | --- |
| 目标错设 | 求解器会忠实放大错误权重；低能耗可通过慢、不动或跌落取得。 | 硬约束/意图/优化分层，逐项成本和基线反例先通过。 |
| 模型不真实 | 质量、惯量、摩擦、阻尼或执行器模型错误时，“最优”只对错误世界成立。 | PredictionReceipt 与 ModelErrorReport 必须闭环；误差超限不执行。 |
| 保真度选择错误 | 最高保真可能错过实时 deadline；过低保真可能改变 execute/fallback/reject 决策。 | 固定省略现象、有效域、decision-flip 测试和 fidelity 升级触发器；选择最低决策充分层级。 |
| 近似误差侵蚀安全裕量 | 平均状态误差很小仍可能在约束边界产生危险结论。 | 低保真只作筛选，或以可验证误差界收紧约束；安全 margin 小于误差 envelope 时升级/拒绝。 |
| 势场局部极小与拓扑 | 梯度流只能看到局部信息；复杂自由空间通常不能靠任意势函数保证目标唯一吸引。 | 构造陷阱/窄通道 fixture；需要 navigation-function 证明或 hybrid planner fallback。 |
| 切换能量注入 | 抢占改变势能/metric，旧状态在新场中可能瞬间获得巨大储能。 | 记录 `ΔH_switch`，限制切换 envelope；超限进入收敛/拒绝。 |
| jump 能量不可归属 | 碰撞、约束修正和 warm start 可改变速度；若 backend 不提供可信 impulse/constraint receipt，残差无法区分物理输入与数值伪影。 | flow/jump 分账；固定 backend/settings；不可观测时只允许 tolerance/shadow 证书，不声称逐端口无源。 |
| 连续证明、离散失败 | 显式积分、步长、碰撞和延迟可能向系统注入数值能量。 | PolicyCertificate 必须含积分器/步长域和离散能量残差；超域 fail-closed。 |
| 势垒不是硬安全 | 高斥力仍可能被高速状态穿透，并造成刚性。 | hard constraint 使用 invariance/safety filter/contact solver；field 只作 nominal policy。 |
| 安全过滤不可行 | 多个 hard constraint、输入饱和、相对阶和采样误差可能使允许输入集合为空。 | 冻结切换兼容域、backup invariant set/policy 和无解终态；不把 energy tank 当作安全替代。 |
| 接触非光滑 | 碰撞、摩擦和接触切换导致离散模式、局部最优和不可靠梯度。 | C1-P.1a/1b 无接触先过，1c 只加单侧限位；一般接触仍作为 C1-P.5 独立门。 |
| 数据流形失真 | latent metric、decoder 和物理状态空间不等距，且数据覆盖限制可行动作。 | 固定 pullback metric、support/OOD、奇异值/本征值/残差守卫和 decoded constraint checker；正则化仍超限则退出 latent policy。 |
| 数值可回放 | Godot 官方不保证物理仿真确定；backend、平台、步长和迭代会改变结果。闭环策略还依赖执行期间的观测与扰动流，初始快照不足以重建其决策序列。 | 记录完整环境和逐 tick 状态/外力/接触/切换流；区分 exact/quantized/tolerance replay；候选计划再规范量化。 |
| 实时预算与尾延迟 | 高维规划、碰撞、contact、decoder/Jacobian 或稠密分解可能超过 tick；平均值会隐藏 p99 deadline miss。 | shadow/offline 先行；确定 work budget + 目标设备 p95/p99/内存；预留 commit/fallback 时间；超时只交付已认证 anytime 候选。 |
| 复杂度标签误导 | `O(N³)` 只描述特定稠密操作；结构、horizon、接触数和内存访问常决定实际成本。 | SolverManifest 同时声明渐近变量、稀疏/树形假设、操作计数和目标设备 benchmark；不凭单一大 O 立项。 |
| Pareto 漂移 | 在线静默改权重会让同一意图在不同负载下选择不同风险偏好。 | frontier/profile 离线版本化；runtime 只按确定规则选已授权点，任何 profile/fidelity 切换进入 receipt。 |
| 开环脆弱 | 优化轨迹即使可行，也可能因模型误差和扰动偏离。 | 先证明 feedback/replanning 边界；没有稳定策略不进入硬件。 |
| “高维一炉”不可审计 | 把安全、目标、风格、能耗全部压成单一分数会隐藏价值选择和失败原因。 | 保留分层约束、分项成本、solver receipt 和独立执行权限。 |
| 产品范围失控 | 物理引擎涉及碰撞、刚/软体、流体、布料、数值分析和平台优化。 | 没有 `C1-PHYS.0` 最小反例和 benchmark，不建立通用 physics roadmap。 |

## 研究依据与现实约束

- [MIT Underactuated Robotics：Trajectory Optimization](https://underactuated.csail.mit.edu/trajopt.html)把问题写为带 dynamics、终端成本和额外约束的有限时域最优控制，并明确高维、非线性和局部稳定性的限制。
- [Diehl 等人的 real-time iteration](https://cdn.syscop.de/publications/Diehl2005c.pdf)展示了“有限在线迭代、逐步逼近最优反馈并给出近似误差界”的路线，同时明确其有效性依赖系统保持在名义轨迹附近；这支持 budgeted/anytime 策略，但不支持无域限制的近似。
- [Anytime RRT*](https://people.csail.mit.edu/aperez/www/karaman_icra11.pdf)展示了先取得可行解、再随可用计算时间改善质量的规划模式；C1-P 进一步要求首个解已经通过全部硬门。
- [多保真方法综述](https://arxiv.org/abs/1806.10761)总结了以低保真模型加速、同时保留高保真模型用于准确度/收敛校准的共同结构，支持 C1-P 的筛选—升级—验证级联。
- [Pinocchio 官方文档](https://gepetto.github.io/doc/pinocchio/doxygen-html/)说明 articulated rigid-body dynamics 可使用递归与低复杂度结构化算法；因此“高维物理必然是稠密 `O(N³)`”不是可靠的架构前提。
- [Flash 与 Hogan 的 minimum-jerk 模型](https://pubmed.ncbi.nlm.nih.gov/4020415/)说明人类运动的可观察平滑性可以由特定成本函数解释，但并不支持“只要最低能耗就等于自然”。
- [MuJoCo 官方说明](https://mujoco.org/)展示了“面向模型优化设计的物理引擎”确实可行，也同时保留 simulator、optimization 和 control 的角色区别。
- [Godot Physics 官方文档](https://docs.godotengine.org/en/stable/tutorials/physics/physics_introduction.html)明确说明 Godot 物理不保证确定性，因此它不能直接继承 C1-T 的跨机器字节一致回放承诺。
- [可微接触仿真梯度研究](https://arxiv.org/abs/2207.05060)显示不同接触模型的梯度可能不一致或不正确；“可微”本身不是优化可靠性的充分证据。
- [Khatib 的人工势场方法](https://cs.stanford.edu/groups/manips/publications/pdfs/Khatib_1986_IJRR.pdf)证明势场适合实时局部反应；[Rimon–Koditschek navigation functions](https://www.cs.cmu.edu/~motionplanning/papers/sbp_papers/r/rimon_koditschek_potential.pdf)也说明无碰撞和 almost-global 收敛需要比“吸引势 + 排斥势”更强、且与环境拓扑相关的条件。
- [RMPflow](https://arxiv.org/abs/1811.07049)与 [Geometric Fabrics](https://arxiv.org/abs/2010.14750)直接支持“在任务流形中定义局部二阶策略并几何一致地组合”的方向，但论文给出的是充分条件下的稳定性，不是任意场的无条件保证。
- [Control Barrier Functions](https://coogan.ece.gatech.edu/papers/pdf/amesecc19.pdf)把安全定义为安全集合的 forward invariance，说明“高势垒”与可验证硬安全不是同一契约。
- [Character Controllers Using Motion VAEs](https://arxiv.org/abs/2103.14274)证明 latent action space 可支持目标导向控制，同时仍需要 planning/control algorithm；低维表示不会自动承担物理控制和安全。
- [van der Schaft 的 port-Hamiltonian/passivity 专著章节](https://people.math.ethz.ch/~hiptmair/Seminars/PHS_24/VSJ14.pdf)把无源性定义为储能与端口供给率的不等式，并明确一般无源系统不一定存在所假设的光滑 port-Hamiltonian 表示；因此 C1-P 不采用附件中的“当且仅当”定理。
- [Jolt 官方 simulation-step 文档](https://jrouwe.github.io/JoltPhysicsDocs/5.0.0/index.html)说明其使用带 warm start 的 sequential impulse solver；[Godot 的 Jolt 文档](https://docs.godotengine.org/en/4.6/tutorials/physics/using_jolt_physics.html)又说明部分 contact impulse 是预估值。这支持 flow/jump 分账，也限制逐端口精确证书能声称的范围。
- [Hybrid inclusions 的 barrier 条件](https://doi.org/10.1016/j.automatica.2020.109328)分别约束 flow 与 jump；[sampled-data CBF](https://arxiv.org/abs/2103.03677)和 [backup CBF](https://arxiv.org/abs/2104.11332)说明采样周期、可行域与 backup policy 应进入 SafetyMechanismProfile，而不是把切换 Tick 的无解归因于单一 jerk 阶跃。
- [Energy-tank 层级阻抗控制](https://ris.utwente.nl/ws/files/105394997/passive.pdf)证明 tank 可恢复特定互连下的无源性，但性能会在 tank 耗尽时受限；[CBF-tank 工作](https://iris.unitn.it/retrieve/handle/11572/422472/811324/A_Novel_Safety-Aware_Energy_Tank_Formulation_Based_on_Control_Barrier_Functions.pdf)进一步指出只保证 passivity 仍可能出现危险的瞬时高功率行为，因此 tank 不能替代状态安全证书。
- [Neural Vector Lyapunov–Razumikhin 工作](https://arxiv.org/abs/2604.00774)针对的是带延迟的离散互联系统。它可作为未来 delay profile 的候选依据，但不能直接证明一般碰撞/冲量执行的稳定性。

## 当前 settlement

**接受 State A 的核心转向，并吸收脉冲归因、度量退化、安全可行性以及有限算力/近似保真风险；CODA 追求的是安全可行域内的“最低决策充分 fidelity”，不是统一最高保真或单一加权最优。** 最近的可执行设计工作仍只有 C1-P.0：冻结十个顶层策略契约，并在其中冻结 flow/jump ledger、`MetricConditionGuard`、`SafetyMechanismProfile`、`ComputationBudget`、`ApproximationPolicy`、三种收敛、切换兼容域和 backup 终态。C1-P.1 已被定义成 `1a–1e` 五个可归因 fixture，其中 `1e` 专门形成预算—误差—效果 frontier；它们仍需 `G-C1-T-B + G-C1-P-A + 另行授权` 才能实现。它不改 C1-T 执行权，也不改变 P3 用户证据门。只有 C1-P.1–P.4 证明 hybrid policy 在同硬门下形成不被简单基线支配的 frontier，才讨论接触/高维策略；只有 `C1-PHYS.0` 找到并复现外部后端的最小能力缺口，才讨论自研物理内核。
