# Botique — Hackathon Reference Document

**Project**: Autonomous organizations — AI agents that independently run Etsy-like shops in a simulated marketplace. Each shop is a minimal autonomous org: a boss agent making strategic decisions, optionally hiring specialist sub-agents, creating products, and managing customers. Rich multi-business competition is an important roadmap direction, but it does not need to be the first thing the initial build proves. The platform is Botique-first, with a seller-facing surface informed by Etsy's API patterns so the agent logic is portability-aware rather than tightly Botique-specific.

**Solo, 48 hours, any Mistral model, vibe-coded with AI coding agents (Claude Code + Codex hybrid).**

---

## The Five Parts (High Level)

1. **Autonomous organizations** — AI agents that independently run businesses, making strategic decisions, creating products, handling customers, hiring specialists. The core unit.
2. **A realistic environment** — an Etsy-informed seller API the organizations operate through. Compatibility-minded shapes and data conventions, without requiring a literal replica of the real platform.
3. **An economic simulation** — the world behind the environment. Demand models, customer personas, trends that shift, and a seeded market the organizations react to. Richer direct competition can be layered in later.
4. **A product creation space** — agents ideate and create products in a semi-structured combinatorial space. Creative-strategic decisions, not just pricing knobs. The key differentiator from existing work.
5. **An observation layer** — frontend where humans watch it unfold, interact as customer, inject events, and see how organizations self-structure. Rich inter-shop competition can become part of that story later.

**Where the thinking power goes**: Not the infrastructure. The platform API, database, frontend — those are solved problems and highly AI-codeable. The hard part is everything surrounding what the agents see and do: the system prompt, the morning briefing format, the tool response formatting, the turn structure, how strategy evaluation works, how sub-agent delegation works. This is what hackathon judges will care about — "what is the agent actually doing and why?" If agents are visibly strategizing and adapting, that's already a win; richer competition can deepen the story later.

**How VendingBench informs this work**: Botique is not trying to mimic VendingBench. It is useful as adjacent prior work because it surfaces general lessons about tool-constrained agents operating over time in business environments. Botique differs in the center of gravity: VendingBench is closer to constrained optimization, while Botique introduces genuine open-endedness where creativity matters and success is probabilistic. That's harder to benchmark cleanly, but it's *much closer to how agents will actually be used in the real world*. Real businesses don't have deterministic demand curves and known-optimal strategies.

## Research-Informed Defaults

These are defaults informed by adjacent work, not constraints copied from it:

- the world owns outcomes, delays, and failures
- agents should optimize for one explicit business objective plus supporting diagnostics
- simple notes and reminders come before complex memory systems
- a single-shop loop should be stable before richer competition or delegation
- narrative events should enrich the simulation, not replace formula-driven core mechanics
- multi-business competition is a roadmap expansion unless explicitly pulled forward

---

## Architecture Overview

Four logical systems plus one bridge layer:

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (React/TypeScript)                        │
│  - Marketplace dashboard                            │
│  - Agent activity viewer                            │
│  - Interactive: user can be customer, boss, chaos   │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket + REST
┌──────────────────────┴──────────────────────────────┐
│  SYSTEM 1: PLATFORM API SERVER                      │
│  Seller-facing HTTP contract, validation, routing   │
│  of reads/writes into marketplace state             │
└──────────────────────┬──────────────────────────────┘
                       │ Internal calls
┌──────────────────────┴──────────────────────────────┐
│  SYSTEM 2: SIMULATION ENGINE                        │
│  The world itself: shops, listings, orders,         │
│  reviews, search, demand, trends, and day           │
│  resolution                                          │
└──────────────────────┬──────────────────────────────┘
                       │ REST API calls
┌──────────────────────┴──────────────────────────────┐
│  BRIDGE LAYER: SELLER TOOLING / CLI                 │
│  Botique-first tool names with portability-aware    │
│  seller contract mapping                            │
└──────────────────────┬──────────────────────────────┘
                       │ Mistral function calling
┌──────────────────────┴──────────────────────────────┐
│  SYSTEM 3: AGENT ORCHESTRATOR                       │
│  Custom Python loop (NOT Mistral Agents API)        │
│  - Agent turn management                            │
│  - Optional delegation / sub-agent support          │
│  - Context window management                        │
│  - Mistral chat completions + tool use              │
└─────────────────────────────────────────────────────┘
```

**Key principle**: Systems 1 and 2 form the non-AI environment. System 3 runs agents against that environment through the bridge layer. Swapping the bridge layer's backend from simulated Botique to another Etsy-like seller platform should require minimal or no changes to agent code.

---

## Decisions Already Made

- **Own agentic loop**, not Mistral Agents API. We need full control over simulation clock, turn ordering, context windows, and logging.
- **Mistral chat completions with function calling** for agent decisions.
- **Etsy-informed compatibility** — the seller surface should be shaped by Etsy's seller API patterns and data model conventions without claiming a literal 1:1 replica everywhere.
- **Discrete day-based simulation** — each day: morning briefing → N agent actions → day resolves.
- **Probabilistic demand + optional narrative events** — formula-driven core mechanics, with narrative generation reserved for lower-frequency events where it adds texture.
- **Simple memory** — `write_note` / `read_notes` / `set_reminder`. Keep memory inspectable and legible before adding more complex retrieval.
- **Sub-agent spawning costs simulated salary** — hiring eats into margin.
- **Agents create products** — they ideate, write listings, set prices. This is the key differentiator from VendingBench where agents sell pre-existing products.

---

## Agent Communication Design

Two channels, matching how a real Etsy seller would communicate:

**Agent ↔ Customer**: Through the platform's messaging system (mirrors Etsy's buyer-seller messages). Agents read and reply to DMs via `read_messages` / `send_message` tools. Feels natural — this is how Etsy actually works.

**Agent ↔ Sub-agent**: Through the tool call interface itself. The main agent calls `delegate_task(agent="copywriter", instruction="improve the listing for mushroom stickers")` and gets a result back. No need to simulate a whole Slack or email system. The tool calls *are* the communication. This is clean and keeps the focus on the decisions, not the plumbing.

Simulated email (like VendingBench) doesn't fit here — VendingBench uses email because a vending machine operator would realistically email suppliers. An Etsy seller messages customers through the platform and manages their team internally.

---

## Agent Cognitive Loop — The Core of the Project

This is where most thinking power goes and what hackathon judges will care most about. The platform, API, and frontend are infrastructure — solved problems. The hard and interesting part is: what does the agent's world look like from the inside?

The agent isn't just calling tools in sequence. There are distinct modes of thinking:

**Sense** — read the morning briefing, check sales numbers, read new reviews and messages, look at what competitors are doing. Information gathering.

**Evaluate** — is my current strategy working? Sales are down 20% this week. That negative review mentions pricing. My copywriter sub-agent's listings aren't converting. What's going wrong?

**Strategize** — should I pivot to a different product category? Lower prices? Fire the copywriter and do it myself? Double down on what's working? This is where the interesting decisions live.

**Act** — create a listing, update a price, hire an agent, respond to a customer. The actual tool calls.

**Reflect** — did that work? After I lowered prices, did sales recover? After I hired a market researcher, did I get useful intel? This feeds back into the next cycle.

**Design question**: make these modes explicit (e.g., a forced "strategy review" phase each day where the agent writes notes) or let the agent find its own rhythm through a good system prompt? Adjacent work suggests agents do better with stable routines and legible prompts than with chaotic loops. Nudge the structure without hardcoding it — e.g., morning briefing ends with "what are your priorities today?" and the agent has a `write_strategy_note` tool.

**Strategy evaluation is a big part of this.** The agent needs to be able to step back, evaluate whether its approach is working, and change course. Not just "call tools in a loop" but genuinely strategize — "my cottagecore listings are outselling my minimalist ones 3:1, should I double down or diversify?" This meta-reasoning about its own strategy is what makes the project interesting and what judges want to see. Tools like `write_strategy_note` and `read_notes` enable this, but the system prompt needs to encourage it.

**What determines emergent behavior**: the system prompt, the briefing format, the tool design, the turn structure, the context window management. Everything between the agent and the environment. A useful lesson from adjacent work is that many agent failures come from ambiguous briefings and confusing tool responses more than from raw model capability.

---

## Multi-Agent Architecture Decision

Three options, in order of complexity:

**Option A: Single agent does everything.** One system prompt, full tool access, it decides when to create listings vs. answer customers vs. analyze competitors. Simpler to build, easiest to debug, most coherent behavior. Downside: doesn't demonstrate multi-agent anything.

**Option B: Boss agent + on-demand sub-agents.** Boss has strategy and delegates specific tasks — "write me a listing for kawaii cat stickers" or "respond to this customer complaint." Sub-agents are stateless; they do a job and return a result. Shows delegation and resource allocation, but sub-agents are really expensive function calls, not true agents.

**Option C: Persistent agents with distinct roles.** Shop owner, copywriter, customer service, market researcher. Each has own context, memory, perspective. They communicate through a shared workspace. The copywriter might push back — "I think we should focus on minimalist styles." Most interesting architecturally, hardest to build. Needs coordination, shared state, turn ordering within a single shop.

**Recommendation**: Start with Option B. It's buildable in 48 hours, demonstrates hiring/delegation, and the economic cost tradeoff is real. If working well by hour 20, evolve one shop toward Option C as a showcase — give one sub-agent persistent memory so it develops its own view.

---

## Hybrid Coding Workflow: Claude Code + Codex

Use both AI coding agents, playing to their respective strengths:

**Claude Code (Opus 4.6)** — the deep thinker:
- Complex multi-file architecture and refactoring
- Understanding how systems connect (platform API ↔ CLI layer ↔ orchestrator)
- Simulation engine design, agent loop structure
- Produces more thorough code in one pass (~1,200 lines in 5 minutes)
- Burns more tokens, but gets complex things right the first time
- Use for: platform API structure, simulation engine, agent orchestration loop, integration work

**Codex (GPT-5.x)** — the fast executor:
- 2-3x more token-efficient for comparable results
- Cloud sandbox lets you fire off multiple parallel tasks
- Better for focused, well-scoped implementation tasks
- Faster iteration cycle, more autonomous
- Use for: individual endpoint implementations, React components, CLI tool wrappers, test files

**Hackathon workflow**: While Claude Code builds out the simulation engine, have Codex tasks running in parallel generating React components, writing tool wrapper functions, scaffolding tests. This is how you compress the build timeline further — true parallelism across coding agents.

---

## Open Questions (Decide Before or Early in Hackathon)

### Product Domain
- **What categories?** Options: stickers, digital art prints, jewelry, candles, pottery. Suggestion: start with 2-3 categories that are easy to simulate demand for. Digital products (stickers, prints) avoid shipping complexity entirely.
- **How is product "creation" evaluated?** The simulation needs a way to score listing quality. Options: (a) keyword/tag matching against current trends, (b) LLM-as-judge scoring the listing text, (c) formula combining tag relevance + price competitiveness + description length/quality. Recommendation: (a) is cheapest, (c) is most controllable, (b) is most interesting but expensive.
- **How do trends shift?** Static categories vs. seasonal drift vs. random trend injection. Suggestion: start static, add trend shifts as a stretch goal.

### Scope of Etsy API Replica
- **How many endpoints?** The full Etsy API has ~70. We need a minimum viable subset. See "Endpoint Selection" section below.
- **How faithful to Etsy's data model?** Do we replicate taxonomy IDs, shipping profiles, return policies? Or simplify to just the core listing/shop/order/review entities? Recommendation: simplify aggressively. The public surface should stay Etsy-informed, but the underlying data model can be thinner.

### Agent Architecture
- **How many competing shops?** For a richer later demo, 3-5 is probably the sweet spot. More creates richer dynamics but costs more in API calls. The initial build does not need full direct multi-shop competition as a requirement.
- **Different agent personalities?** Different system prompts per shop (trend-chaser vs. artisan vs. price-undercutter) would create more interesting emergent behavior. Worth doing — it's just prompt engineering.
- **Sub-agent role definitions?** Which specialist roles can be hired? Suggestion: copywriter (listing creation), customer service (DMs/reviews), market researcher (competitor analysis). Each gets a restricted tool set.
- **Sub-agent pricing?** How much does hiring cost per day? This needs to be calibrated against revenue so it's a meaningful decision. Probably tuned during testing.

### Frontend
- **How ambitious?** Range from "terminal output with logs" to "polished React dashboard." Given vibe coding, a decent React dashboard is feasible. Key views: marketplace browse, individual shop dashboard, agent decision log, inter-agent message feed.
- **Interactive elements?** User as customer (browse, buy, DM) is the most impressive demo feature. User as "boss" (inject directives) is second. Both are feasible.

### Simulation
- **How does search ranking work?** Real Etsy uses recency, listing quality, reviews, conversion rate, price. Simulated version can use a simpler weighted formula.
- **How are customers simulated?** Probabilistic browsing with search queries drawn from a category distribution. Purchase probability = f(price, listing quality, reviews, search relevance). Occasional LLM-generated DMs and reviews.

---

## Product Creation: Semi-Structured Approach

Rather than fully open-ended ideation (hard to score) or a fixed catalog (boring, just VendingBench with extra steps), use a **combinatorial product space**:

**Product = Base Type × Style × Subject × Listing Text**

- Base types: sticker sheet, art print, digital planner, phone wallpaper
- Styles: minimalist, cottagecore, retro, kawaii
- Subjects: mushrooms, mountains, cats, florals, celestial

The demand model defines which combinations are trending (cottagecore + mushrooms = hot this week). Scoring becomes: **attribute trend match × listing text quality × price competitiveness** — all computable without an LLM call per evaluation.

The agent is still making creative-strategic decisions (read trends → choose attributes → write compelling listing → price it). But the simulation can evaluate those decisions deterministically through purchases.

**Stretch goal**: Bolt on image generation (Mistral has FLUX) so agents generate actual product images for their listings. An agent that writes a listing AND generates a matching image is a strong demo moment.

---

## Measurement & What This Project Actually Is

**This is not a benchmark.** VendingBench can say "Claude scored $2,217" because the entire value chain is objectively measurable. Botique's product creation introduces genuine open-endedness where success is probabilistic, not deterministic.

**Revenue is the implicit score.** The demand model is the judge — agents that read trends correctly, write good listings, price competitively, and handle customers well will earn more. You don't need to score listing quality independently; the market scores it through purchases.

**The real value is observable behavior.** VendingBench's most cited findings aren't leaderboard numbers — they're Claude emailing the FBI and agents forming cartels. Botique's contribution is similar: "we gave agents a realistic e-commerce environment and here's what they did." Did agents discover trends? Copy competitors? Hire strategically? Enter price wars? Melt down? Those qualitative observations are the output.

**The pitch to Mistral**: "We built a realistic economic environment with real API signatures and observed how your models handle genuine open-ended business decisions — product creation, competitive strategy, resource allocation, customer interaction — tasks where there's no single right answer."

---

## Customer Simulation: Persona-Based Approach

Don't just use pure probability for customers. Pre-generate 20-50 customer personas with structured attributes:

- Style preferences (which product styles they're drawn to)
- Price sensitivity (budget-conscious vs. premium buyer)
- Review behavior (detailed reviewer vs. never reviews)
- Interaction tendency (asks questions via DM vs. just buys)
- Browsing pattern (trend-follower vs. niche seeker)

Sample from these personas when generating browsing sessions, purchases, DMs, and reviews. This creates more realistic and varied interactions for agents to deal with, and makes the demo more interesting to watch.

Key insight from persona generation research: don't just prompt "generate a diverse customer" — you'll get samey outputs. Define the persona space structurally and sample with intentional diversity.

---

## Build Speed: AI-Assisted Coding Changes the Math

With Claude Code + Codex in parallel, the implementation phases compress dramatically. The bottleneck shifts from "hours writing code" to "minutes generating, then time reviewing and making decisions." Claude Code handles the architectural/complex work, Codex handles parallel focused tasks. Expect tens of thousands of lines of code generated fast.

**Actual bottlenecks during the hackathon:**
1. **Design decisions** — demand model parameters, search ranking weights, product space definition. Can't be delegated.
2. **Integration** — making Systems 1 and 2 talk correctly through the CLI layer. Generated code works in isolation; the seams need attention.
3. **Agent tuning** — prompt engineering, fixing degenerate behaviors, iterating on briefing format. The hardest part, and the least parallelizable.

The platform API endpoints, CLI tool wrappers, React components, and even the agent loop boilerplate are all highly AI-codeable. Expect to generate tens of thousands of lines quickly. The time savings should be reinvested into agent tuning and demo polish — the two things that actually determine hackathon placement.

---

## Endpoint Selection — Minimum Viable Etsy API

Grouped by priority. **Tier 1 is essential**, Tier 2 adds richness, Tier 3 is stretch.

### Tier 1 — Core Business Loop (must have)

| Etsy Endpoint | Botique Tool Name | What It Does |
|---|---|---|
| `createDraftListing` | `create_draft_listing` | Agent creates a new product listing |
| `updateListing` | `update_listing` | Change price, title, description, state (draft→active) |
| `getListingsByShop` | `get_shop_listings` | Agent sees its own active/draft/sold listings |
| `getListing` | `get_listing` | Get details of a specific listing |
| `deleteListing` | `delete_listing` | Remove a listing |
| `findAllListingsActive` | `search_marketplace` | Browse/search all active listings (see competitors) |
| `getShopReceipts` | `get_orders` | See incoming orders and sales |
| `getShop` | `get_shop_info` | See own shop stats |
| `updateShop` | `update_shop` | Change shop title, announcement, description |

### Tier 2 — Customer Interaction & Feedback (adds depth)

| Etsy Endpoint | Botique Tool Name | What It Does |
|---|---|---|
| `getReviewsByShop` | `get_reviews` | Read customer reviews |
| N/A (custom) | `read_messages` | Read customer DMs |
| N/A (custom) | `send_message` | Reply to customer DMs |
| `getShopReceiptTransactions` | `get_order_details` | Detailed order info |

### Tier 3 — Advanced Management (stretch goals)

| Etsy Endpoint | Botique Tool Name | What It Does |
|---|---|---|
| `createShopSection` | `create_shop_section` | Organize listings into sections |
| `uploadListingImage` | `upload_listing_image` | Add images (could be AI-generated) |
| `getListingInventory` | `get_listing_inventory` | Check stock levels |
| `updateListingInventory` | `update_listing_inventory` | Restock |
| `getPaymentsByShop` | `get_financials` | Revenue/payment tracking |

### Agent-Only Tools (no Etsy equivalent)

| Tool | What It Does |
|---|---|
| `write_note` | Persistent scratchpad for agent's own notes |
| `read_notes` | Retrieve saved notes |
| `set_reminder` | Set a reminder for a future day |
| `get_balance` | Check current cash balance |
| `hire_agent` | Spawn a specialist sub-agent (costs $/day) |
| `fire_agent` | Remove a sub-agent |
| `get_marketplace_trends` | See what categories/tags are trending |
| `wait_for_next_day` | Skip to next day |

---

## Task Breakdown & Sequencing

The build flows in phases. Each phase produces something testable.

### Phase 0: Setup & Spec (Hours 0–2)
**Goal**: Lock in decisions, set up project skeleton.

- [ ] Finalize product categories (2-3)
- [ ] Finalize endpoint list (Tier 1 + select Tier 2)
- [ ] Write the OpenAPI spec for the Botique platform API (derive from Etsy's JSON, strip down)
- [ ] Set up project repos, Python env, Mistral API key, basic project structure
- [ ] Define the agent's system prompt (shop owner persona)

**Output**: Spec docs, project skeleton.

### Phase 1: Platform API — System 1 (Hours 2–7)
**Goal**: A working REST API that you can curl against.

This is the foundation everything else depends on. It's highly **parallelizable with AI coding agents** — spec endpoints and let Cursor/Claude Code generate the FastAPI routes, Pydantic models, and database layer. The simulation engine behind the endpoints needs your design decisions.

- [ ] Data models: Shop, Listing, Order, Review, Message, Customer
- [ ] Database layer (SQLite with SQLAlchemy, or just in-memory dicts for speed)
- [ ] Implement Tier 1 endpoints
- [ ] Implement customer simulation engine:
  - Search/browse: weighted ranking (relevance × price × quality × reviews)
  - Purchase probability: function of listing attributes
  - Daily demand generation: base_traffic × category_popularity × day_multiplier + noise
- [ ] Implement LLM-generated scenario triggers:
  - Customer DM (pre-purchase question, complaint, custom request)
  - Review generation (post-purchase, sentiment based on price/quality ratio)
  - Schedule: ~2-4 LLM-generated events per simulated day
- [ ] Basic marketplace state: trending categories, competitor visibility

**Output**: Runnable FastAPI server. Can create shops, listings, simulate a day's sales.

**Time estimate**: ~5 hours. Endpoints are mechanical and highly AI-codeable. The simulation engine design decisions are where your time goes.

### Phase 2: CLI Tool Layer (Hours 7–8)
**Goal**: Agent-callable tools that hit the platform API.

Relatively thin layer, but important to get right because these are the exact function signatures the agent will call.

- [ ] Python functions for each tool, matching Etsy signatures
- [ ] Each function: makes HTTP call to System 1, formats response as readable text
- [ ] Permission sets: define which tools each agent role can access
  - Shop Owner: all tools
  - Copywriter: `create_draft_listing`, `update_listing`, `search_marketplace`, `get_marketplace_trends`
  - Customer Service: `read_messages`, `send_message`, `get_reviews`, `get_orders`
  - Market Researcher: `search_marketplace`, `get_marketplace_trends`, `get_reviews`
- [ ] Convert tool functions to Mistral function-calling JSON schemas

**Output**: A set of Python functions + their JSON tool definitions ready for Mistral.

**Time estimate**: ~1 hour. Mechanical work, extremely fast with AI coding.

### Phase 3: Agent Orchestrator — System 2 (Hours 8–17)
**Goal**: Agents running in a loop, making decisions, calling tools.

This is the **intellectually hardest** part — getting the agent loop, prompting, and turn structure right. Less parallelizable with AI coding; requires your judgment on prompt engineering and loop design.

- [ ] Main simulation loop:
  ```
  for day in range(1, num_days + 1):
      platform.advance_day()  # resolve overnight sales, generate events
      for shop in shops:
          briefing = platform.get_morning_briefing(shop.id)
          messages = [system_prompt, briefing]
          for turn in range(max_turns_per_day):
              response = mistral.chat(messages, tools=shop.available_tools)
              if response.tool_calls:
                  result = execute_tool(response.tool_calls[0])
                  messages.append(result)
              elif "wait_for_next_day" called:
                  break
  ```
- [ ] System prompt engineering: shop owner persona with business goal framing
- [ ] Context window management: sliding window, keep last N tokens, always include system prompt + today's briefing
- [ ] Morning briefing generation: overnight sales summary, new messages, new reviews, balance update, any reminders
- [ ] Sub-agent spawning mechanics:
  - `hire_agent(role)` deducts daily salary from balance
  - Spawns a new Mistral instance with restricted tool set
  - Main agent delegates via natural language instruction
  - Sub-agent executes autonomously, returns result
- [ ] Logging: every tool call, every agent decision, every LLM response → structured JSON log
- [ ] Error handling: what happens when Mistral returns garbage, rate limits, etc.

**Output**: Multiple agent shops running through simulated days, making decisions, creating listings, responding to customers.

**Time estimate**: ~9 hours. The loop code is quick, but prompt engineering and debugging agent behavior is THE bottleneck. This is where most of your intellectual effort goes. Expect many iterations on the system prompt and briefing format.

### Phase 4: Frontend (Hours 17–23)
**Goal**: A visual dashboard that makes the demo compelling.

This is where your React skills and vibe coding pay off. The frontend makes or breaks the hackathon demo.

- [ ] Marketplace view: browse all active listings across shops, see prices, reviews
- [ ] Shop dashboard view: per-agent view showing their listings, sales, balance, hired agents
- [ ] Agent activity feed: real-time log of agent decisions ("Shop A created listing: Minimalist Mountain Print at $12.99", "Shop B hired a market researcher")
- [ ] Agent decision tree / thought process viewer (show the actual LLM reasoning)
- [ ] Chat/message viewer: see agent-customer conversations
- [ ] Interactive elements:
  - User can browse as customer, buy items, send DMs
  - User can inject events ("holiday season starts", "competitor undercuts all prices")
- [ ] WebSocket connection for real-time updates as simulation runs

**Output**: Polished React dashboard. The thing judges see.

**Time estimate**: ~6 hours. Highly parallelizable with vibe coding. The data is all available via System 1's API; React dashboards are exactly what AI coding agents are best at.

### Phase 5: Polish & Demo Prep (Hours 23–40)
**Goal**: Everything works end-to-end, demo is rehearsed. This phase is deliberately large — it's where quality happens.

- [ ] End-to-end run: 3-5 shops, 10-30 simulated days, verify interesting behavior emerges
- [ ] Tune simulation parameters: demand curves, pricing sensitivity, trend shifts
- [ ] Tune agent prompts: fix any degenerate behaviors, improve decision quality
- [ ] Record a compelling demo run (screen recording as backup)
- [ ] Write README / project description
- [ ] Prepare 2-3 minute pitch: architecture diagram, demo video, key insight ("agents independently discover X")
- [ ] Clean up any rough UI edges

**Time estimate**: ~17 hours. This is intentionally generous. The compressed build phases give you a huge budget for tuning, polishing, and making the demo compelling. Most hackathon teams have no time left for this — you will.

---

## Where Time Actually Gets Spent (Honest Assessment)

Given AI-assisted coding speed, implementation compresses significantly. Decision-making and tuning expand to fill the saved time.

| Component | Estimated Hours | AI-Codeable? | Notes |
|---|---|---|---|
| Setup & decisions | 2 | Low | Lock in product space, demand model, endpoint list |
| Platform API (endpoints) | 2 | **High** | Mechanical FastAPI routes, ideal for Cursor |
| Platform API (simulation engine) | 3 | Medium | Demand curves, scoring — needs design decisions |
| CLI tool layer | 1 | **High** | Thin wrapper, very mechanical |
| Agent loop (code) | 1 | **High** | The loop pattern is standard |
| Agent loop (prompts & tuning) | 8 | Low | Iterative, requires reading agent outputs — THE bottleneck |
| Frontend (components) | 4 | **High** | React dashboards, ideal for vibe coding |
| Frontend (WebSocket/real-time) | 2 | Medium | Plumbing work |
| Integration & debugging | 4 | Low | Making all systems talk to each other |
| Demo prep & polish | 8 | Low | Tuning, recording, pitch prep |
| Buffer for surprises | 5 | — | Something will break |
| **Total** | **40** | | ~8 hours slack |

**The critical path**: Platform API → CLI layer → Agent loop → first successful agent run. Everything before frontend. Get an agent making decisions against the API in a terminal before touching React.

**Biggest risk**: Agent behavior. You can build perfect infrastructure and the agents might make nonsensical decisions, enter doom loops (like VendingBench's meltdowns), or just be boring. Budget extra time for prompt iteration.

**Highest leverage for demo quality**: The frontend. Judges experience the project through the UI. A mediocre simulation with a beautiful dashboard beats a brilliant simulation viewed through terminal logs.

---

## Model Selection & Cost

| Role | Model | Cost (per 1M tokens) | Why |
|---|---|---|---|
| Shop owner (main agent) | Mistral Large 3 | $0.50 in / $1.50 out | Best reasoning for strategic decisions |
| Sub-agents (hired specialists) | Mistral Small 3.2 | $0.06 in / $0.18 out | 8× cheaper, good enough for focused tasks |
| Customer/review generation | Mistral Small 3.2 | $0.06 in / $0.18 out | Narrative generation doesn't need Large |
| Listing quality scoring (if LLM-as-judge) | Mistral Small 3.2 | $0.06 in / $0.18 out | Scoring is a simpler task |

**Cost estimate for a full demo run**: 5 shops × 30 days × ~20 tool calls/day × ~2K tokens/call ≈ 6M tokens. At Mistral Large rates: ~$12. With Small for sub-agents and generation: ~$4-5. Very manageable for a hackathon.

---

## Relevant Lessons from Adjacent Work

1. **Simple memory beats complex memory.** Notes + reminders, not vector DBs.
2. **The morning briefing is crucial.** Agents need a clear, structured summary of what happened overnight. Poor briefing → poor decisions.
3. **One tool call per turn prevents chaos.** Recent agent-business environments found this helps keep behavior legible. Do the same unless there is a strong reason not to.
4. **Variable time costs per action create interesting pressure.** Consider making some actions "expensive" in simulated time.
5. **Agents will melt down.** Plan for it. Log everything. Have a "day limit" failsafe.
6. **The most interesting findings are emergent.** Don't over-script. Let agents surprise you — price wars, trend copying, strategic hiring. These emergent behaviors ARE the demo.
7. **Timing ambiguity causes avoidable failures.** In Botique, be clear about when orders resolve, when reviews appear, when hired agents start working. Ambiguity in the briefing leads to agent confusion and brittle behavior.

---

## Demo Pitch Structure (2-3 minutes)

1. **Hook** (15s): "What if AI agents had to run an Etsy shop from scratch — create products, price them, handle customers, hire employees, and compete against other AI shops?"
2. **Architecture** (30s): Show the three-layer diagram. Emphasize the Etsy API signature matching. "Each shop is an autonomous organization — the agent code could theoretically run against real Etsy."
3. **Live demo** (90s): Show the dashboard. Highlight one agent's journey: it created a listing, a customer asked a question via DM, it hired a copywriter to improve listings, it noticed a competitor undercutting and adjusted prices. Show the agent's strategy notes — its own reasoning about what's working.
4. **Emergent insight** (30s): "What surprised us was X" — maybe agents converged on similar pricing, or one agent dominated by hiring early, or a price war emerged. This is the money moment.
5. **Tech** (15s): Built with Mistral Large 3 + Small 3.2, FastAPI, React, 48 hours, solo.

**For Mistral judges specifically**: The interesting thing isn't the platform — it's how their models handle genuine open-ended business decisions. Agent orchestration, the cognitive loop, how agents strategize and adapt, how they delegate to sub-agents. Demonstrating that Mistral models can run autonomous organizations competently in a realistic environment.

---

## Quick Reference: What to Build First

If you're 12 hours in and behind schedule, here's the **minimum viable demo**:

1. Platform API with just 5 endpoints: `create_draft_listing`, `update_listing`, `get_shop_listings`, `search_marketplace`, `get_orders`
2. Hardcoded customer simulation (no LLM, just probabilistic purchases)
3. One agent running in a terminal making decisions
4. Simple React page showing the agent's shop and its listings updating over time

Everything else is additive from there.
