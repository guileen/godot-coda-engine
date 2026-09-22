# Release policy

CODA releases are evidence-led. A release candidate must have a versioned source asset and contract set, reproducible generation, passing offline tests, passing affected Godot checks, and a runtime-boundary audit when the export surface changes.

## Versioning

- Patch releases contain compatible fixes, documentation, and evidence updates.
- Minor releases may add backward-compatible commands, capabilities, topics, and editor behavior.
- Major releases may change EventAsset, runtime, or generated-code contracts only with explicit migration notes.
- Capability and topic IDs are versioned independently when their inputs, outputs, lifecycle, or failure semantics change.

## Publication gate

Before a version is published, the project owner must confirm the repository owner, license, release notes, supported Godot/Node versions, and the exact evidence commands. A GitHub tag or Pages deployment is not a substitute for those decisions.

## Community commitments

The project does not promise bounty payments or Co-Maintainer roles in advance. A bounty may be announced only after its scope, budget, acceptance evidence, payment responsibility, and maintenance capacity have been approved as a separate decision. Contributor status and review participation do not imply a role or payment commitment.

## Current status

The E0 implementation baseline is complete and locally verified. The software code is licensed under MIT, and documentation/website content is licensed under CC BY 4.0. The project owner has selected CODA as the working brand for the first GitHub Pages release; this does not claim trademark clearance. The optional `coda.ipub.io` entry is deferred.
