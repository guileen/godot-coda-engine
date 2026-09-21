# Godot CODA Engine

[简体中文](README.zh-CN.md) · [English](README.md) · [CODA AI skill](skills/coda-gameplay-flow/SKILL.md) · [GitHub Pages](https://guileen.github.io/godot-coda-engine/)

**CODA 是面向 Godot 游戏流程的语言。**

玩家领取奖励、等待动画结束、切换 UI、让对话等玩家选择——难的往往不是某一行代码，而是如何说清楚：什么先发生、什么必须等待、接下来又发生什么。

用 CODA 写下这个顺序。它会检查流程，并生成你能查看的 GDScript。你的独特算法和直接使用 Godot 的部分，仍然使用 GDScript。

## 一个很小但完整的想法

```coda
# 中文别名预览：玩家领取奖励；动画完成前，不能进入下一个事件。
模块 界面.奖励
事件 领取奖励（当前积分，奖励，积分标签，动画时长） [标识：界面.奖励.领取]：
  令 新积分 为 当前积分 加 奖励
  若（奖励 大于 0）：
    等待 界面.播放数字动画@1(目标：积分标签, 起始值：当前积分, 结束值：新积分, 时长：动画时长)
    执行 界面.设置文本@1(目标：积分标签, 内容：新积分)
    发出 战斗.命中已结算@1(奖励)
```

这是中文别名的阅读预览：关键词、模块、能力、主题和参数都使用中文。当前命令行仍以项目契约中定义的机器标识执行，因此可直接运行的版本见 [`examples/reward-claim.coda`](examples/reward-claim.coda)。把这些中文别名接入契约，是下一步产品化工作。

短短一段流程，已经把 CODA 的关键特点表达出来：

- **输入**：这个游戏事件从 Godot 需要哪些值。
- **命名的值**：`新积分` 对你和 AI 都清楚。
- **条件**：奖励路径只会在应该执行时执行。
- **跨帧等待**：下一步不会抢在动画完成之前发生。
- **已声明的 Godot 动作**：UI 操作通过明确的能力边界发生。
- **游戏事件**：下一个系统收到清晰、刻意发出的信号。
- **可查看的输出**：CODA 生成 GDScript 和 source map，不要求你盲信黑箱行为。

## 快速开始

检查和生成 CODA 文本需要 Node.js 20+。打开并运行仓库里的 Godot 项目需要 Godot 4.7.2。

```sh
git clone https://github.com/guileen/godot-coda-engine.git
cd godot-coda-engine
npm run coda -- text-check examples/reward-claim.coda
npm run coda -- text-generate examples/reward-claim.coda
godot --editor --path .
```

从修改 [`examples/reward-claim.coda`](examples/reward-claim.coda) 里的奖励流程开始，再运行一次 `text-check`。生成文件位于 `.gseos/generated/`；它们是输出，不应手动修改。

如果和 AI 协作，把 [CODA AI skill](skills/coda-gameplay-flow/SKILL.md) 交给它，并这样提出任务：

> 为我的 Godot 游戏写一个 CODA 事件。先列出事件输入；让每个条件和跨帧等待都明确；只使用已声明的能力；特殊算法和未列出的 Godot API 留在 GDScript。

## 语言速览

| CODA 写法 | 含义 |
| --- | --- |
| `模块` | 为一组相关游戏事件命名。 |
| `事件（输入） [标识：…]` | 声明可触发流程和它需要的值。 |
| `令` | 为流程计算出的值命名。 |
| `若` | 明确写出分支。 |
| `执行` | 调用立即完成的已声明 Godot 能力。 |
| `等待` | 调用会跨帧完成的已声明能力。 |
| `发出` | 向游戏下一部分发送已声明事件。 |

同样支持英文关键字：`module`、`event`、`id`、`let`、`if`、`do`、`await`、`publish`。仓库内的 [`examples/reward-claim.coda`](examples/reward-claim.coda) 就是同一个奖励流程的中文写法。

CODA 现在刻意保持小巧：事件、输入、局部值、条件、同步动作、等待动作和事件发布。复杂算法、任意 Godot 反射或项目未声明的 API，请使用 GDScript。稳定的项目内编辑器工作流也支持结构化 `.gse.json` 事件资产。

## 需要深入时

大多数用户从这个 README 开始即可；需要时再打开下列资料：

- [5 分钟认识 CODA](docs/zh-CN/5-minutes-coda.md) / [English introduction](docs/en/5-minutes-coda.md)
- [写出第一个游戏流程](docs/zh-CN/first-game-flow.md) / [First gameplay flow](docs/en/first-game-flow.md)
- [CODA 语法小抄](docs/zh-CN/language.md) / [Language reference](docs/en/language.md)
- [中文技术文档](docs/zh-CN/README.md) / [Technical documentation](docs/en/README.md)

贡献和发布验证请运行 `npm test`、`npm run check` 和 `npm run test:all`。CODA 代码采用 MIT 许可；文档和网站文案采用 CC BY 4.0。可选的 Made with CODA 徽章请见[品牌政策](TRADEMARKS.md)。
