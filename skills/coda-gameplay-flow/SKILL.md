---
name: coda-gameplay-flow
description: Write or review CODA gameplay-flow text for a Godot project. Use when an AI is asked to turn a game scenario into clear conditions, waits, declared actions, and follow-up events; do not use for general GDScript-only work.
---

# CODA gameplay flow

Turn the user's game situation into a small, readable flow before proposing implementation details.

## What CODA should express

- List the event inputs first: values, Godot nodes, and durations that arrive from outside the flow.
- Name values calculated inside the flow with `let` / `令`.
- Make every decision a visible `if` / `若` branch.
- Use `await` / `等待` whenever the next step must wait for an animation or other cross-frame capability.
- Use only declared capability IDs and event topics. Check `contracts/gseos/capabilities.json` before inventing one.

## What should remain GDScript

Keep unusual algorithms, performance-sensitive loops, arbitrary Godot reflection, and APIs absent from the capability manifest in GDScript. Do not disguise them as CODA capabilities.

## Current workflow

Write a `.coda` file, then run:

```sh
npm run coda -- text-check <flow.coda>
npm run coda -- text-generate <flow.coda>
```

The generated GDScript is inspectable output. Do not edit it by hand. The project also has a stable event-tree and `.gse.json` asset workflow in the Godot editor.

## Output shape

Give the user a short plain-language summary followed by CODA text. Explain any inputs and waits in the surrounding prose. Prefer the user's language: CODA accepts both English and Chinese keywords.
