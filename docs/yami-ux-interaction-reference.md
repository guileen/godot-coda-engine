# YAMI RPG Editor → CODA interaction reference

> Checked: 2026-09-23. This is an interaction reference, not a visual clone or a code port.

## Source and inspection status

- Primary source: [yami-pro/yami-rpg-editor](https://github.com/yami-pro/yami-rpg-editor), the editor creator's public repository.
- Inspected revision: [`1fa694491808eaed223e38358a1e10ea09e00f53`](https://github.com/yami-pro/yami-rpg-editor/commit/1fa694491808eaed223e38358a1e10ea09e00f53), dated 2025-11-20.
- The repository is **not cloned or downloaded into this workspace**. The files listed below were read through the read-only GitHub connection.
- No software-source `LICENSE`/`COPYING` file was found in the inspected default-branch tree. The tree does contain separate license notices for bundled assets; those do not establish a software-code license. The creator announced that the editor source was open-sourced and that games built from it carry the same author rights as Steam builds, but the exact code-reuse terms remain unclear from the repository. Treat it as a read-only product and implementation reference; do not copy or redistribute its code until its code-reuse terms are confirmed.
- The official [Steam open-source announcement](https://store.steampowered.com/news/app/1964480/view/536596558933656706) links to the same repository.

## Observed YAMI interactions and CODA mapping

| YAMI evidence | Interaction principle | CODA counterpart today | Gap / acceptance target |
| --- | --- | --- | --- |
| [Event Window guide](https://github.com/yami-pro/yami-rpg-editor/blob/1fa694491808eaed223e38358a1e10ea09e00f53/Documentation/Docusaurus/docs/003.event-commands/command-list.md) | Search commands by typing; insert at the selected point; edit/toggle from a context menu; copy commands as text for discussion. | Event Dock now filters its named step list in a “找步骤” field, keeps insertion position separate, groups secondary operations under “更多操作”, and separates “流程” from “步骤设置” so both remain usable in a narrow right dock. | Verify that a first-time user can find and insert a step by its plain-language name, can tell where it will be added, and can move between the flow and edit views without losing context. Context-specific edit/toggle and copy-as-text remain future considerations. |
| [If command guide](https://github.com/yami-pro/yami-rpg-editor/blob/1fa694491808eaed223e38358a1e10ea09e00f53/Documentation/Docusaurus/docs/003.event-commands/004.flow/001.if.md) and [Loop guide](https://github.com/yami-pro/yami-rpg-editor/blob/1fa694491808eaed223e38358a1e10ea09e00f53/Documentation/Docusaurus/docs/003.event-commands/004.flow/003.loop.md) | Branches and else are visible as flow structure; condition types, operators, and operands are described explicitly. | CODA renders nested “满足条件时 / 否则” branches, summarizes conditions in the tree, and now provides a visual left-value / relationship / compare-value editor. Raw JSON remains under an explicitly advanced option. | Verify branch labels, operator wording, typed choices, and preview/confirm behavior in the visible editor; collect user feedback before calling this natural or complete. |
| [Command window guide](https://github.com/yami-pro/yami-rpg-editor/blob/1fa694491808eaed223e38358a1e10ea09e00f53/Documentation/Docusaurus/docs/001.basic-interfaces/013.command.md), [command source](https://github.com/yami-pro/yami-rpg-editor/blob/1fa694491808eaed223e38358a1e10ea09e00f53/Project/Script/command.js), and [inspector source](https://github.com/yami-pro/yami-rpg-editor/blob/1fa694491808eaed223e38358a1e10ea09e00f53/Project/Script/inspector.js) | Commands have editable names/keywords; command parameters go through specialized parsers and inspector changes participate in history. | CODA binds action arguments to the capability manifest and exposes labeled controls; new `let` steps have a plain-language result name + expression editor, existing calculations show readable expressions and use preview/confirm before writing. Edits use Godot undo/redo. | Keep parameters domain-labeled, typed, and accompanied by examples; common calculations should not require JSON. Verify first-time insertion, expression editing and preview in the visible editor and with target users. |
| [Event file inspector guide](https://github.com/yami-pro/yami-rpg-editor/blob/1fa694491808eaed223e38358a1e10ea09e00f53/Documentation/Docusaurus/docs/002.inspectors/001.file/009.file-event.md) | Event trigger types and their consequences are explained in the inspector, with tips for common event switching behavior. | CODA presents event assets in a list and labels the selected flow. | Keep event purpose and trigger visible before editing the inner flow; explain what selecting or adding a step will change. |

## CODA implementation and review order

1. Review the new graphical `if` condition builder in the visible editor and with target users; show its condition in the tree as ordinary language.
2. Review the new step search and position cue in the visible editor and with target users.
3. Keep the current single-source asset, typed capability contracts, preview/confirm transaction, and undo/redo behavior. These are CODA boundaries and must not be replaced by copying YAMI's internal design.
4. Review the reward example as a user task: identify the trigger, understand the condition, see the reward change, and recognize completion. The sample now explains trigger → guard → score calculation/wait → row update → feedback and exposes a zero-reward path to observe the skipped branch. Ask participants about clarity and naturalness, not source files or internal implementation.

The source documents establish YAMI's documented interaction model; they do not prove how natural CODA feels. Human observation remains required for that claim.
