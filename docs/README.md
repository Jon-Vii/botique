# Botique Docs

This directory is the working source of truth for implementation decisions.

Use these files as follows:

- `architecture.md`: system boundaries, interfaces, naming, and current decisions
- `mvp-scope.md`: initial build scope, priorities, and non-goals
- `agent-tools.md`: agent-facing tool surfaces and portability rules
- `simulation-model.md`: marketplace mechanics, product space, and day resolution
- `agent-loop.md`: shop-owner agent loop, briefing format, workspace behavior, and tournament relationship
- `tournament-mode.md`: arena-style tournament mode, scoring, and CLI contract
- `status.md`: current build status, active focus, likely next work, and open questions
- `prompts/agent-tools-thread.md`: reusable prompt for a parallel thread focused on agent tools
- `prompts/frontend-operator-threads.md`: reusable prompts for the next frontend/operator work

## Current Repo Snapshot

The repo currently has four implemented code areas:

- `server/`: TypeScript Fastify/Bun service for the seller-facing API, control routes, seeded marketplace state, tournament resets, and simulation module
- `src/seller_core/`: Python portability-aware client/CLI for the seller-facing tool surface
- `src/agent_runtime/`: Python owner-agent runtime with single-shop and tournament modes, artifact bundles, workspace/reminder memory, and provider wiring
- `frontend/`: React/Vite operator-facing frontend shell for marketplace, shops, listings, and simulation overview pages

The next major step is not creating System 4 from scratch; it is turning the existing frontend into a benchmark/operator surface.

## Status Conventions

Not everything in these docs is a locked decision.

Treat statements using these labels differently:

- `Current decision`: agreed direction unless explicitly changed
- `Recommended default`: strong proposal for the initial build, but still open to revision
- `Open question`: not decided yet

Guidelines:

- keep portability claims precise; Botique is its own platform with an Etsy-compatible subset
- separate agent-facing tools from runtime control surfaces
- prefer creative-goods-first constrained business physics over broad marketplace realism
- when adding decisions, record both the decision and the reason
