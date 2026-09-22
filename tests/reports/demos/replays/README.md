# Demo Replay 证据

状态：`D2_D3_REPLAY_INPUT_FIXTURES_PASS / RUNTIME_OBSERVATION_SEPARATE`

保存可重放输入、DecisionRecord、PredictionReceipt 与 RuntimeObservation 的关联索引。运行观察不要求跨机器字节一致，但必须保留因果顺序和唯一终态。

当前回放 fixture：[D2 interrupt replay](d2-interruptible-behavior.replay.json)、[D3 Skeleton transition replay](d3-skeleton-transition.replay.json)。D2 验证事件序列、唯一终态和迟到回调拒绝；D3 验证 source → plan → Adapter 输入序列以及旧 generation、外部 writer 和 owner lost 的拒绝预期。Godot 帧时序和面部渲染观察仍单独记录在 smoke report。
