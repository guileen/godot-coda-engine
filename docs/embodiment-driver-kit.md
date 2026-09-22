# Embodiment Adapter 无硬件开发包

本开发包提供协议合同、Node 参考 mock、可复用 conformance runner 和 mock-session 确定性回放。它用于下游 Adapter 的离线接口/状态机实现，不直接连接设备，也不授予写权。

## Adapter 对接面

驱动应暴露一个可序列化身份与快照，以及以下三个操作：

- `receive(message, { now_tick })`：处理 `EmbodimentProtocol@1` 的入站协议消息。
- `publishObservation(request)`：产出 observation 消息。
- `settleLease({ lease_ref, generation, status, now_tick })`：为当前 lease 形成唯一 terminal receipt。
- `snapshot()`：返回可 canonical-JSON 编码的状态，用于检查拒绝路径没有局部写入。

每个操作返回 `{ accepted, response, ledger }`。不接受的请求必须返回协议 `reject`、`partial_write:false`，且 ledger 与调用前一致；receipt 必须绑定协议所要求的 generation/epoch/有效时域。Mock 的实现位于 [`mock-embodiment-adapter.js`](../packages/local-core/src/gseos/mock-embodiment-adapter.js)，独立撤权端口参考实现位于 [`mock-safety-authority.js`](../packages/local-core/src/gseos/mock-safety-authority.js)。

## 运行一致性套件

下游实现可在不接硬件的模拟实例上调用公共 runner：

```js
import { runEmbodimentAdapterConformance } from "../packages/local-core/src/index.js";

const adapter = new MySimulatedAdapter({ capabilities: ["arm@1"] });
const report = runEmbodimentAdapterConformance(adapter);
if (!report.ok) throw new Error(JSON.stringify(report.cases.filter((item) => !item.passed)));
```

runner 检查能力查询、资源 lease 准入、reference/mode/handoff、资源不支持拒绝、handoff contract 错配、过期 lease、唯一终态、terminal 后迟到命令和 observation schema。所有拒绝用例都检查 `partial_write:false` 与 ledger 不变。项目内完整参考验证通过 `npm test` 执行。

`recordMockEmbodimentSession` / `replayMockEmbodimentSession` 是 **MockEmbodimentAdapter 专用**的故障录制工具：封存输入操作、输出摘要和逐步状态 digest，并可稳定重放/报告 divergence。它不能拿来录制厂商设备或替代设备审计记录。当前不提供跨供应商二进制日志格式；设备时间戳/时钟映射和安全事件保留策略须由目标 Profile 与部署另行定义。

## 能证明什么

该套件只验证 Adapter 对结构化协议输入的接受/拒绝、状态隔离和回执形状。它不证明物理模型准确、传感器校准、WCET/实时性、执行器安全、独立 SafetyAuthority 的物理实现或真实设备 handoff。所有 mock/replay 报告都必须与目标设备 Profile 的证据分开。
