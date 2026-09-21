# Write your first gameplay flow

Begin with one sentence about what should happen, not with callbacks:

> The player claims a reward. If it is greater than zero, animate the score from its old value to its new value. Only then should the next step appear.

| In the game | In CODA |
| --- | --- |
| Data or nodes arriving from outside | event inputs |
| A result calculated in this step | `let` |
| A condition for continuing | `if` |
| Something that must finish first | `await` |

```coda
event claim_reward(current_score, reward, score_label, animation_duration) [id: ui.reward.claim]:
  let new_score = current_score + reward
  if (reward > 0):
    await ui.animate_number@1(target: score_label, from: current_score, to: new_score, duration: animation_duration)
```

The inputs let you and an AI ask a useful question: “Which Godot node or system supplies each value?” `await` means the animation is a dependency of the next step, not an arbitrary pause.

```sh
npm run coda -- text-check examples/reward-claim.coda
npm run coda -- text-generate examples/reward-claim.coda
```

Keep complex algorithms, performance-sensitive loops, and undeclared Godot APIs in GDScript. CODA is valuable because it makes easy-to-lose gameplay flow readable and checkable.
