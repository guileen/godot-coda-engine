---
name: coda-gameplay-flow
description: Help Godot game developers express event-driven gameplay sequences in CODA, check and generate the flow, and decide what belongs in GDScript. Use for scenario-to-flow authoring or review, not general GDScript-only tasks.
---

# CODA gameplay flow

For Godot game developers using a Codex-compatible assistant that can load `SKILL.md` files. Project maintainers own updates to this skill. The user can invoke it explicitly or describe a gameplay scenario that needs event sequencing.

Produce a small, readable `.coda` flow that captures the requested sequence. Explain its inputs, waits, and any behavior that must stay in GDScript. When the CODA repository is available, ground capabilities and syntax in its current contracts and validate the flow with the commands below. When working in another Godot project without the CODA repository, ask for or inspect that project's capability manifest before claiming the flow is valid.

## What CODA should express

- List the event inputs first: values, Godot nodes, and durations that arrive from outside the flow.
- Name values calculated inside the flow with `let` / `令`.
- Make every decision a visible `if` / `若` branch.
- Use `await` / `等待` whenever the next step must wait for an animation or other cross-frame capability.
- Use only declared capability IDs and event topics. Check `contracts/coda/capabilities.json` before inventing one.

## What should remain GDScript

Keep unusual algorithms, performance-sensitive loops, arbitrary Godot reflection, and APIs absent from the capability manifest in GDScript. Do not disguise them as CODA capabilities.

## Current workflow

The reference toolchain requires Node.js 20 or newer. Opening and running the checked-in reference Godot project requires Godot 4.7.2. A consuming game project may have its own pinned Godot version and capability registry.

1. List the external event inputs and the intended outcome.
2. Check the capability manifest and keep undeclared APIs or unusual algorithms in GDScript.
3. Write a `.coda` file, then run:

```sh
npm run coda -- text-check <flow.coda>
npm run coda -- text-generate <flow.coda>
```

4. Inspect the generated GDScript and source map. Generated output is derived and must not be edited by hand; change the `.coda` source and regenerate.

If `text-check` reports a syntax, binding, or capability error, use its file and source location to correct the source or declare the missing capability in the consuming project through its normal review process. Do not invent a capability or bypass the error by editing generated code. If generation fails, preserve the source, rerun `text-check`, and report the diagnostic; fall back to ordinary GDScript only when the user prefers it or the behavior exceeds CODA's supported surface. The project also has a stable event-tree and `.coda.json` workflow in the Godot editor.

This skill covers the current event-flow surface: inputs, local values, conditions, declared synchronous/asynchronous capabilities, and event publishing. It does not define arbitrary Godot APIs, general algorithms, robot control, or the proposed embodied-language features as implemented behavior.

## Output shape

Give the user a short plain-language summary followed by CODA text. Explain any inputs and waits in the surrounding prose. Prefer the user's language: CODA accepts both English and Chinese keywords.
