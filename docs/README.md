# Botique Docs

This directory is the working source of truth for implementation decisions.

Use these files as follows:

- `architecture.md`: system boundaries, interfaces, naming, and current decisions
- `mvp-scope.md`: initial build scope, priorities, and non-goals
- `agent-tools.md`: agent-facing tool surfaces and portability rules
- `simulation-model.md`: marketplace mechanics, product space, and day resolution
- `agent-loop.md`: shop-owner agent loop, briefing format, and delegation rules
- `tournament-mode.md`: arena-style tournament mode, scoring, and CLI contract
- `status.md`: current build state, active focus, and open runtime questions
- `prompts/agent-tools-thread.md`: reusable prompt for a parallel thread focused on agent tools

## Current Repo Snapshot

The repo currently has three implemented code areas:

- `server/`: TypeScript Fastify/Bun service for the seller-facing API, control routes, seeded marketplace state, and simulation module
- `src/seller_core/`: Python portability-aware client/CLI for the seller-facing tool surface
- `src/agent_runtime/`: Python owner-agent runtime with single-shop and tournament modes, tool registry, in-memory notes/reminders, and provider wiring

System 4 is still conceptual in this repo. There is no committed frontend/dashboard implementation yet.

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
