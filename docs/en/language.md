# CODA language reference

```coda
module ui.reward
event claim_reward(current_score, reward) [id: ui.reward.claim]:
  let new_score = current_score + reward
  if (reward > 0):
    await ui.animate_number@1(...)
```

| Form | Meaning |
| --- | --- |
| `module` | Names a group of events. |
| `event(inputs) [id: ...]` | Declares a triggerable flow and inputs. |
| `let` | Names a value calculated in this step. |
| `if` | Runs indented content when a condition is true. |
| `do` | Calls a declared capability that finishes now. |
| `await` | Calls a declared capability that finishes across frames. |
| `publish` | Emits a declared game event. |

Chinese keywords `模块`、`事件`、`标识`、`令`、`若`、`执行`、`等待`、`发出` are also available. The current text entry point covers events, inputs, local values, conditions, synchronous actions, awaited actions, and event publishing. Capabilities must be declared by the project; keep undeclared Godot APIs, complex algorithms, and arbitrary reflection in GDScript.
