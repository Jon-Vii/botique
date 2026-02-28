# Botique Docs

This directory is the working source of truth for implementation decisions.

Use these files as follows:

- `architecture.md`: system boundaries, interfaces, naming, and current decisions
- `mvp-scope.md`: initial build scope, priorities, and non-goals
- `agent-tools.md`: agent-facing tool surfaces and portability rules
- `simulation-model.md`: marketplace mechanics, product space, and day resolution
- `agent-loop.md`: shop-owner agent loop, briefing format, and delegation rules
- `prompts/agent-tools-thread.md`: reusable prompt for a parallel thread focused on agent tools

## Status Conventions

Not everything in these docs is a locked decision.

Treat statements using these labels differently:

- `Current decision`: agreed direction unless explicitly changed
- `Recommended default`: strong proposal for the initial build, but still open to revision
- `Open question`: not decided yet

Guidelines:

- Keep portability claims precise. Botique is its own platform with an Etsy-compatible subset.
- Separate agent-facing tools from runtime control surfaces.
- Prefer a narrow digital-first initial build over broad marketplace realism.
- When adding decisions, record both the decision and the reason.
