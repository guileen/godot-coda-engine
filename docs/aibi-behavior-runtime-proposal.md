# 提案：以 AIBI 验证 CODA Behavior Runtime（C0）

> 状态：`C0_IMPLEMENTED`（2026-09-21）。C0 已由 `tasks.md` 授权并实现；它不改变当前 P3 的用户反馈门。C1 的层级状态和更广泛并发反例仍未实现。

## 要解决的用户问题

CODA 已能把版本化 `EventAsset` 编译为可追溯的游戏流程，并以 `RunHandle`、`RunContext` 与 `WaitRegistration` 管理等待、取消、超时和迟到回调。AIBI 提出一个更严格但窄的验证场景：一个角色在“空闲、聆听、思考、说话、休眠”等状态间响应外部事件；说话被打断时，所有可取消效果必须安全收敛，旧响应不得重新激活说话。

该场景的目标不是复刻 LimboAI，而是验证 CODA 是否能把**版本化、可读、可修改的行为定义**可靠地编译并运行成可中断的 Godot 行为。

## 请求的产品裁决

在不影响 P3 公开体验回流的前提下，C0 已交付无硬件、无网络、无儿童数据的契约与离线验证切片。它只用 AIBI 的有限状态/事件反例来检验 CODA 运行时，不承诺发布为通用机器人框架，也不承诺立刻取代 LimboAI。

## 应复用的现有 CODA 边界

| 现有资产 | C0 的复用方式 |
| --- | --- |
| `EventAsset`、稳定 ID 与版本化 capability/topic 契约 | 行为、状态、事件、Blackboard 字段与效果都必须使用稳定机器 ID；展示名称不是执行依据。 |
| `ExecutionPlan`、checker 与 generator | 行为定义须在生成前经静态完整性、类型、优先级和能力检查；错误不生成部分运行物。 |
| `RunHandle`、`RunContext`、`WaitRegistration` | 每个行为实例只有一个终态；取消、超时、owner 失效和迟到回调均经同一终态仲裁门。 |
| source map 与 RuntimeTrace | 每次事件仲裁、状态切换、效果启动/取消/收敛均能定位到资产、规则、状态与效果 ID。 |

**C0 的关键设计约束：** 不建立与 `EventAsset` 平行、可独立写入的“行为真相”。C0 必须先在现有资产模型上提出最小扩展；若确实需要新 `BehaviorAsset`，必须同时定义它与 EventAsset 的单向所有权、绑定和迁移关系，且未定案前不得编码。

## 最小语义

### 行为实例

一个实例拥有：稳定 `behavior_id`、`run_id`、当前状态、版本化 Blackboard 快照、事件序号和效果句柄。外部输入只能作为带来源与序号的结构化事件进入队列；硬件、云端或自由文本不能直接改写状态或 Blackboard。

### C0 状态与事件

| 状态 | 允许进入事件 | 可观察效果 |
| --- | --- | --- |
| `idle` | `wake_word`、`touch_head`、`boredom_high`、`energy_low` | 中性/快乐/好奇/休息动作意图 |
| `listening` | `speech_end`、`silence_timeout` | 聆听表现 |
| `thinking` | `llm_response`、`timeout`、`interrupt` | 思考表现；`interrupt` 优先 |
| `speaking` | `tts_done`、`interrupt` | 说话与嘴型；`interrupt` 必须取消效果 |
| `sleepy` / `sleeping` | `wake_word`、`touch_head` | 休眠/唤醒表现 |

优先级初始规则为：`safety/interrupt > wake_word > explicit user input > completion/timeout > mood request`。同一批事件须按 `(priority, sequence)` 进行确定性仲裁；无匹配规则的事件产生可诊断的拒绝记录且无副作用。

### 效果与收敛

效果只能调用已声明的 capability，例如 `face.set_expression@1`、`body.plan_action@1`、`audio.play_speech@1`。每个效果必须声明是否可取消、取消后的补偿/安全收敛动作和 owner。对 `speaking` 的中断至少要求：停止/标记取消语音与嘴型效果，写入一次 `interrupted` trace，再进入 `listening`；之后到达的旧 `tts_done` 不得改变状态。

### Blackboard

初始字段为 `happiness`、`energy`、`boredom`、`affection` 与 `last_interaction_at`。每个字段都需要类型、范围、默认值、写入规则与来源。C0 只处理本地模拟值；不记录音频、图像、身份或对话内容。

## C0 工作包与验收

| ID | 工作 | 通过证据 |
| --- | --- | --- |
| `C0.1` | 裁决行为定义在 EventAsset 中的最小表达与单一事实源关系 | schema/契约、正反 fixture 和“无第二可写逻辑源”检查。 |
| `C0.2` | 定义状态、事件、效果、Blackboard、优先级和取消语义 | 版本化 schema、诊断码与 source map 字段。 |
| `C0.3` | 将 AIBI 行为编译为可回放的计划/运行轨迹 | 同一 fixture 重复执行的状态、效果与 trace 字节一致。 |
| `C0.4` | 建立最小 Godot/CLI 离线测试适配器 | 无硬件、网络、麦克风、摄像头或云端依赖。 |

`G-C0` 通过需要同时满足：

1. `idle → listening → thinking → speaking → idle` 轨迹正确；
2. `speaking + interrupt → listening` 只产生一次取消与一次安全收敛；
3. 迟到 `tts_done` 无状态或效果副作用；
4. 同批冲突事件按确定优先级和序号裁决；
5. 非法事件、未声明 capability、越界 Blackboard 写入均拒绝且不生成部分结果；
6. 任一步可由 `EventAsset → rule/state/effect → RuntimeTrace` 回溯。

## 非目标与安全边界

- 不接 ESP32、WebSocket、mDNS、舵机或 `raw_servo`；设备适配器日后仍独立验证动作限位、速度、功率、认证和断连。
- 不采集或存储原始音频、图像、儿童资料、位置或对话；不调用 ASR、LLM、VLM 或 TTS 服务。
- 不在 C0 引入自然语言运行时解释、任意 GDScript 反射、任意并发图、热重载恢复或完整行为树编辑器。
- 不把 C0 成功外推成通用 LimboAI 替代；只有后续 C1/C2 在更多中断、层级、并发与失败反例中通过，才讨论默认运行时切换。

## 依赖与下一裁决

本提案不绕过 `G-P3-U`：P3 的公开用户体验回流继续是当前产品门。C0 若获批准，只能作为隔离、可逆、无外部副作用的运行时能力实验并行推进。批准后，`tasks.md` 应将 C0 明确列为“低后悔并行准备”，再开始任何代码实现。
