# Core concepts

## EventAsset

An `EventAsset@1` is the versioned semantic source of truth. It contains a stable `event_id`, stable `node_id` values, typed parameters, child nodes, and preserved unknown fields. The tree is what is saved, checked, lowered, and regenerated.

## Capability and topic contracts

Capabilities are versioned adapters such as `ui.animate_number@1` or `ui.set_text@1`. Topics are versioned publish/subscribe boundaries such as `combat.hit_resolved@1`. The contract records the inputs, outputs, thread requirements, wait and cancellation behavior, and E0 failure semantics.

## ExecutionPlan

The planner lowers a valid EventAsset into an execution plan with bound references, explicit source references, and backend support checks. A plan is not emitted when semantic errors remain.

## Generated GDScript and source maps

The code generator turns a valid plan into a private runner. Each generated step has a stable event/node marker, and the source map records the event, node, field, backend, and generated line. The runner is reproducible from the asset, contracts, and generator version.

## Owner and RunHandle

`EventRegistry.start(event_id, args, owner)` returns a `RunHandle` synchronously. The owner is part of the run boundary: when it becomes invalid, the run can settle as cancelled and late callbacks become no-ops.

## E0 waiting semantics

Every managed cross-frame wait has one `WaitRegistration` and one completion gate. Completion, failure, cancellation, timeout, owner invalidation, and a late callback compete through that gate, so a run settles once and cleans up once.

## Text surfaces

Chinese, English, and mixed-language GSE text are import and editing surfaces for the same asset. They use the same lexer, parser, binder, checker, and diagnostic protocol. Text is not a second persistent source of truth, and the current release does not promise long-lived `*.gse` text files.

## escape boundary

When a flow needs logic outside the structured backend, a bounded `escape` node may declare explicit inputs and outputs. It cannot become an undeclared reflection path or a way to hide arbitrary runtime behavior from the contract and source map.
