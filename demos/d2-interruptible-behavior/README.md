# D2 可中断行为运行时

状态：`GODOT_RUNTIME_SMOKE_PASS / VISUAL_CAPTURE_PENDING`

目标：展示 AIBI 状态、优先级仲裁、取消、迟到回调拒绝和唯一终态。

运行窗口：

```sh
godot --path demos/d2-interruptible-behavior
```

`S` 开始 speaking，`I` 打断并收敛到 listening，`T` 注入迟到 `tts_done`，`R` 重置。无窗口 smoke：

```sh
godot --headless --path demos/d2-interruptible-behavior --script res://tests/d2_interruptible_behavior_smoke.gd
```

离线证据：[D2 report](../../tests/reports/demos/d2-interruptible-behavior.json)。

离线证据：[D2 report](../../tests/reports/demos/d2-interruptible-behavior.json)。重跑全部离线 Demo：`npm run demo:smoke`。

完成入口：`DEMO.2`。
