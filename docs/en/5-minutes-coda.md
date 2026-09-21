# Meet CODA in 5 minutes

CODA is a language for Godot indie developers to write **gameplay flows**.

When you need to say “a player claims a reward, the score changes, an animation finishes, then the next step runs; if the UI disappears, no logic is left hanging,” you should not have to spread that thought across callbacks, `_process`, and temporary state. Write the flow in CODA. CODA checks its structure and generates GDScript you can still inspect.

CODA does not replace GDScript. Use CODA for conditions, sequence, waits, and gameplay/UI events; keep special algorithms and direct Godot work in ordinary GDScript.

## First look: claim a reward

The checked-in Chinese example is [`examples/reward-claim.coda`](../../examples/reward-claim.coda). The same flow in English reads:

```coda
# After the player claims: add points, play the number animation, then continue.
module ui.reward
event claim_reward(current_score, reward, score_label, animation_duration) [id: ui.reward.claim]:
  let new_score = current_score + reward
  if (reward > 0):
    await ui.animate_number@1(target: score_label, from: current_score, to: new_score, duration: animation_duration)
```

The reading model is small:

1. An `event` is a flow your game can trigger.
2. `let` gives a value from this step a name.
3. `if` continues only when a condition is true.
4. `await` makes the dependency explicit: the next step waits for the animation.

That is the point of CODA: **state the order in which the game happens, then let the tool generate the implementation.**

## Change one thing

Add a line such as `let reward = reward + 10`, or swap the awaited animation for one of your declared capabilities. With Node.js 20+ installed, run this from the repository root:

```sh
npm run coda -- text-check examples/reward-claim.coda
npm run coda -- text-generate examples/reward-claim.coda
```

The first command points out an unclear flow. The second writes generated GDScript and a source map under `.gseos/generated/`. The generated files are output, not files to edit by hand.

When asking an AI to help, use a constraint such as:

> Write a CODA event for claiming a reward: check that the reward is greater than zero, update the score, wait for the UI number animation, then continue. Use only `event`, `let`, `if`, `await`, and declared capabilities.

Run `text-check` before connecting the result to your Godot scene.

## CODA and the current Godot workflow

The editor plugin still uses an event tree and `.gse.json` assets as the stable in-project workflow. CODA text is available for quickly expressing, checking, and generating a flow. You can therefore collaborate with an AI in a readable flow language while retaining structured assets, generated code, and traceability to GDScript.

To open the existing project in Godot and inspect its event tree, continue to [Quick start](quick-start.md). For the capabilities available now and the complex logic that should remain in GDScript, read [Core concepts](concepts.md).
