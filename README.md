# Godot CODA Engine

[English](README.md) · [简体中文](README.zh-CN.md) · [CODA AI skill](skills/coda-gameplay-flow/SKILL.md) · [GitHub Pages](https://guileen.github.io/godot-coda-engine/)

**CODA is a language for Godot gameplay flow.**

When a player claims a reward, an animation must finish, a UI screen changes, or a dialogue beat waits for a choice, the hard part is often not the individual line of code—it is saying clearly what happens first, what must wait, and what comes next.

Write that order in CODA. It checks the flow and generates GDScript you can inspect. Keep using GDScript for your unique algorithms and direct Godot work.

## One small, complete idea

```coda
# The player claims a reward. The animation must finish before the next event.
module ui.reward
event claim_reward(current_score, reward, score_label, animation_duration) [id: ui.reward.claim]:
  let new_score = current_score + reward
  if (reward > 0):
    await ui.animate_number@1(target: score_label, from: current_score, to: new_score, duration: animation_duration)
    do ui.set_text@1(target: score_label, content: new_score)
    publish combat.hit_resolved@1(reward)
```

In one short flow, CODA makes several important things visible:

- **Inputs** — what this game event needs from Godot.
- **Named values** — `new_score` is clear to both you and an AI.
- **Conditions** — the reward path only runs when it should.
- **Cross-frame waits** — the next step cannot race ahead of the animation.
- **Declared Godot actions** — UI work happens through an explicit capability.
- **Game events** — the next system receives a deliberate, named signal.
- **Inspectable output** — CODA generates GDScript plus a source map; it never asks you to blindly trust hidden behavior.

## Quick start

You need Node.js 20+ to check and generate CODA text. Godot 4.7.2 is needed to open and run this repository’s checked-in Godot project.

```sh
git clone https://github.com/guileen/godot-coda-engine.git
cd godot-coda-engine
npm run coda -- text-check examples/reward-claim.coda
npm run coda -- text-generate examples/reward-claim.coda
godot --editor --path .
```

Start by changing the reward flow in [`examples/reward-claim.coda`](examples/reward-claim.coda), then run `text-check` again. Generated files appear under the hidden `.coda/generated/` compatibility folder; they are output, not files to edit by hand.

To work with an AI, give it the [CODA AI skill](skills/coda-gameplay-flow/SKILL.md) and this request:

> Write a CODA event for my Godot game. First list the event inputs. Make every condition and cross-frame wait explicit. Use only declared capabilities. Keep unusual algorithms and unlisted Godot APIs in GDScript.

## The language, in brief

| CODA form | What it means |
| --- | --- |
| `module` | Names a group of related game events. |
| `event(inputs) [id: ...]` | Declares a triggerable flow and the values it needs. |
| `let` | Names a value computed by this flow. |
| `if` | Makes a branch explicit. |
| `do` | Calls a declared Godot capability that finishes now. |
| `await` | Calls a declared capability that finishes across frames. |
| `publish` | Sends a declared event to the next part of the game. |

Chinese keywords are also supported: `模块`、`事件`、`标识`、`令`、`若`、`执行`、`等待`、`发出`. The checked-in [`examples/reward-claim.coda`](examples/reward-claim.coda) is a Chinese version of the same reward flow.

CODA is intentionally small today: events, inputs, local values, conditions, synchronous actions, awaited actions, and event publishing. For complex algorithms, arbitrary Godot reflection, or APIs that are not declared for your project, use GDScript. The stable in-project editor workflow also supports structured `.coda.json` event assets.

## When you need more

Most users can start from this README. The deeper references are available when you need them:

- [5-minute introduction](docs/en/5-minutes-coda.md) / [中文 5 分钟介绍](docs/zh-CN/5-minutes-coda.md)
- [First gameplay flow](docs/en/first-game-flow.md) / [写出第一个游戏流程](docs/zh-CN/first-game-flow.md)
- [Language reference](docs/en/language.md) / [CODA 语法小抄](docs/zh-CN/language.md)
- [Technical documentation](docs/en/README.md) / [中文技术文档](docs/zh-CN/README.md)
- [AIBI Behavior Runtime](docs/aibi-behavior-runtime-proposal.md)（C0 已实现：EventAsset、Node/Godot 运行时与 AIBI 接入）
- [Robot Motion Intent](docs/robot-motion-intent-proposal.md)（C1-M 提案：运动意图、抢占与安全收敛；尚未实现）

For contributors and release verification, run `npm test`, `npm run check`, and `npm run test:all`. CODA code is MIT-licensed; documentation and website copy are CC BY 4.0. See [brand policy](TRADEMARKS.md) for the optional Made with CODA badge.
