# CODA Demo Launcher

这是本阶段的统一报告入口。先运行 `npm run demo:smoke` 生成报告及 `demo-data.js`，再使用浏览器打开 `index.html`，可查看六个 Demo 的证据卡、四区布局和报告截图。数值、状态和所选证据项均从本地报告读取；页面不会模拟实时执行。

每次重建数据后，`npm run audit:tasks` 会逐份比较 manifest 与六个源报告，防止页面显示旧状态或脱离报告的数字。

它不替代各 Demo 的运行验证，也不把离线 fixture 当作真实物理或硬件 benchmark。离线报告和 Launcher 数据使用同一命令重建：

```sh
npm run demo:smoke
```

完整离线入口（含 D3 Godot headless smoke）：

```sh
npm run demo:acceptance
```

Launcher 会标明 `offline report` 或 `Godot headless smoke`。本地报告截图不是当前运行窗口；阈值、实时性和设备安全仍按各自门禁验收。
