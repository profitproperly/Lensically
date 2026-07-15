# Lensically Current State

## Product Shape

- Lensically is operating as a private workspace build with `lensically-web/` as the frontend and `lensically-worker/` as the backend.
- Lensically has an independent recovery MCP Worker as a break-glass control plane. Its source-defined surface can inspect and patch GitHub, perform KV-backed chunked writes, dispatch and inspect CI/deploy workflows, inspect Cloudflare deployments/versions/bindings/domains and observability telemetry, roll back the main Worker with explicit owner approval, and run a full authenticated main-MCP smoke without reading Lensically account or generation data. It is deployed separately so GPT can repair the primary MCP without Codex or a desktop session.
- Main active user workflows currently center on the password gate, Create Post, Scheduled Posts, GPT Memory, saved patterns, dashboard, insights, followers, and post archive flows.
- Public compliance routes are `/privacy`, `/terms`, and `/data-deletion`.
- `/dashboard` now targets an operator-dashboard role rather than a simple profile/stats card.
- `/followers` is a dedicated paginated follower-history surface for daily snapshot tracking.

## Core Scheduling State

- `/schedule` is the Create Post surface.
- single-post publishing and scheduling already exist and must remain stable.
- Batch Schedule exists as a manual-only helper inside the Create Post flow.
- Batch Schedule remains manual-only in the Lensically UI; GPT-assisted generation and learning now happen through Lensically Operator GPT actions and GPT Memory, not through autonomous cron posting.
- Batch Schedule supports:
  - one-off unsaved slot/time structures
  - saved backend presets per user
  - optional favorite presets
  - preview before scheduling
  - scheduling through the existing scheduler

## Standalone Agent State

- The old Manifest Mental-specific Hermes desktop agent has been removed.
- Local agent work should be account-agnostic and use configured Threads account IDs.
- `/agent` is the account-level control surface for enabling or disabling the local worker agent per Threads account.
- The remaining agent API helper stores per-account context snapshots under `agent-vaults/<account-id>/Context/**` and calls Lensically worker APIs for data and scheduling.
- Local agents must schedule through Lensically worker APIs and must not publish directly.

## Scheduled Posts State

- `/scheduled-posts` is the management surface for upcoming scheduled posts.
- It supports edit, retry, single delete, and bulk delete selection mode.
- The source-defined Operator MCP exposes `edit_scheduled_post` across Manifest, OPMG, and Vectrix. It edits approved unpublished scheduled posts through the same shared backend path as the UI, preserves omitted text/time/spoiler fields, requires date and time together when rescheduling, enforces selected-account ownership, and synchronizes linked generation-draft wording for continuity.
- bulk delete currently reuses the existing delete API in a controlled client loop.
- Scheduled posts can be tagged with flexible strategy metadata: pillar, hook style, format, intent, experiment, and novelty level.
- Scheduled strategy tags are descriptive signals for GPT growth review and novelty/fatigue analysis, not rigid content categories.
- GPT growth and generation contexts link posted scheduled-post strategy tags back to archived post metrics and follower-day movement when possible, exposing tagged post results and tag-performance summaries for growth review and pre-generation decisions.

## GPT Operator State

- Lensically Operator is a Custom GPT connected to `/api/gpt/*` actions with API-key auth.
- `LENSICALLY_OPERATOR_GPT.md` is the repo-owned source of truth for the Operator GPT operating loop, learning rules, growth rules, action set, and schema-refresh notes.
- GPT actions expose an operator playbook, compact brand context, generation context, generation brief, taste interview, draft similarity, saved patterns, recent posts, growth context/review, rule suggestions, novelty fatigue, scheduled posts, scheduling, batch presets, strategy memory, generation runs/drafts, taste feedback, rule review, experiments, and pattern adaptations.
- Operator Mode has a backend-only MCP/app foundation under `/api/operator/tools/:toolName`. It keeps `/api/gpt/*` intact while adding account-scoped workflow sessions, context admissions, source cards, operator gates, gate results, and content inventory for the universal `content_operator_v1` 1-9 workflow spine.
- Operator Mode also exposes a real JSON-RPC MCP endpoint at `/api/operator/mcp` for ChatGPT App/Connector use. It advertises the 24 core operator tools plus a 21-tool MCP admin surface, supports ChatGPT app OAuth through `/api/operator/oauth/authorize` and `/api/operator/oauth/token`, uses bearer/internal auth at runtime, and returns MCP `structuredContent` around the existing backend tool behavior.
- The MCP admin surface can inspect failures, list/read/patch tool schemas and behavior notes, disable tool advertisements, run built-in MCP checks, manage DB-backed workflow requirements, enforce server-side full preflight before stage advancement, manage gates, submit/gate drafts, store implementation backlog items, and deploy/rollback runtime MCP configuration snapshots. Runtime MCP deploy/rollback is D1 configuration activation inside the Worker; source-code deploy still happens through the repo/Cloudflare deploy path.
- The MCP surface now includes a private GitHub-backed engineering layer for ChatGPT. It can load the non-account `getOperatorStartupContext` bootstrap, engineering precheck/ops memory, inspect GitHub repo files, read/search source, apply exact text patches, do chunked file writes, create/delete files, dispatch GitHub Actions, trigger the backend deploy workflow, verify deployed MCP initialization, and record engineering audit entries. GitHub is the source of truth when ChatGPT edits through this layer; Codex should pull latest `origin/main` before Lensically project work.
- Operator MCP v1.6.0 uses handle-free automatic continuity, calendar-first production, and durable autonomy governance. Fresh ChatGPT sessions load `getOperatorStartupContext`, perform the exact key handshake, and call `confirmOperatorProceed`; that call immediately restores canonical persisted schedule, workflow, production-day source claims, unresolved review batches, the active autonomy profile, and pending model-originated decisions. The owner is never asked to choose resume or start fresh. The continuity capsule contains autonomy governance, hourly calendar coverage, the active review batch, workflow checkpoint, active artifact IDs, source-batch progress, execution policy, stable operation identity, and repository/runtime identity. Every later account-scoped call requires `proceed_confirmed=true` and `continuity_loaded=true`; conversation memory cannot substitute for workflow or decision state.
- `operator-execution-policy-v1` runs before MCP tool execution. It classifies universal versus account-scoped changes, assigns engineering/control/account/recovery planes, applies hard bounds, treats same-handler wrappers as aliases rather than fallback routes, and blocks known failure recurrence before execution. Repository search uses one bounded GitHub code-search request with a path-only fallback and zero per-file content fan-out.
- `operator-autonomy-governance-v1` is universal infrastructure with an active Manifest Mental profile. Its objective is to grow Manifest Mental to 1,000,000 followers. The operating mode is AI-led and owner-ratified: the model selects problems, investigates evidence, originates decisions, persists rationale/risks/outcomes/execution plans, and presents proposals for approve/reject/revise during training. Read-only investigation remains autonomous. Substantive account, workflow, MCP, and engineering mutations are blocked unless a matching approved decision authorizes the exact tool within a finite execution budget. Decision proposals, owner resolutions, execution events, and outcomes live in D1 and are restored across fresh chats. Autonomy cannot advance beyond owner ratification without a separate approved governance decision backed by operating evidence.
- State-changing operations use persistent `operator-idempotency-v1` receipts and semantic operation identities. Workflow-session creation, Manifest source draws, source-card creation, generation runs, draft submission, owner decisions, and scheduling return the existing durable result when a stream interruption or fresh chat repeats the same operation. Execution decisions and known-failure prevention are written to `operator_execution_events` for regression classification.
- Both the main engineering plane and independent recovery plane use Git blob/tree/commit APIs for oversized repository files. The recovery plane remains independent for main-MCP health, large-file repair, and deployment-plane failure; it is selected proactively for those classes rather than after repeated same-backend failures.
- Operator Mode v1 can start workflow sessions, admit context with partial/complete coverage, list production board items and source candidates, create/lock source cards, create generation runs, submit gated candidate drafts, block failed drafts from being shown, approve/reject shown drafts into strategy memory, schedule approved drafts, list/create gates, and promote strategy memory into account-scoped gates.
- Manifest owner interaction is calendar-first. After continuity loads, Lensically inspects the earliest incomplete future publishing day and asks whether to fill it. Once approved, source selection, source-card creation/reuse, locking, generation, self-rejection, submission, and gate evaluation run silently. The owner receives four numbered items at a time, each showing only the original Source and Generated post. Backend IDs and provisional posting times stay hidden. Decisions are made by number; approved posts schedule into the earliest open hourly slots in item order, and confirmed times are reported only after persistence succeeds. Stored draft strategy metadata is normalized before batch strategy-tag persistence so sparse or older drafts cannot interrupt scheduling after only part of a review batch is saved. The day must be completed before advancing to the next incomplete date.

- Manifest production uses a persisted day-level source ledger. Sources are drawn uniformly at random from the verified 1,000-like pool without replacement for that production date, and stable source identities remain claimed across chats while generating, shown, revised, approved, scheduled, or published. Cross-day reuse remains allowed. A wording rejection retains the source for revision; a day-level source rejection skips it only for that date; an explicit Saved Pattern source deletion excludes it from future draws while preserving its post, analytics, source cards, generations, and lineage. Own-account posts cannot be deleted as sources.
- A skipped numbered Manifest review item can be replaced with a different source from the same production date. The backend verifies the replacement draft, generation run, source card, and source selection belong together; blocks replacement before the old source receives a source-level disposition; prevents duplicate same-day source claims; and atomically updates the review claim’s source identity, selection, batch, card, run, draft, and scheduling lineage. The old selection remains durably skipped for that date.

- Manifest generation preserves the source mechanism, strongest structural choices, meaning, tone, and payoff while materially rewriting distinctive surface language. Near-verbatim rearrangement and synonym swapping are blocked; unrelated scenes or premises remain disallowed. Generation runs persist a compact explicit-hard-ban context instead of full rejected-draft payloads. `historical_owner_rejection_gate` blocks only owner-explicit hard bans for Manifest and requires no model fingerprint review. OPMG and Vectrix retain their configured rejection behavior. `required_gate_execution_gate` still blocks `showable=true` whenever any active blocking gate did not execute with an auditable result.

- GPT Memory in Lensically is available at `/gpt-memory` for reviewing brand-specific taste notes, current beliefs, rules, pattern adaptations, experiments, generation runs, growth prompts, novelty/fatigue signals, and generation readiness.
- GPT strategy memory supports edit/archive updates through GPT action `updateStrategyMemory` and browser-safe `/api/gpt-memory/strategy-memory/update`; archived memory keeps audit history and normal edits preserve archive state unless explicitly changed.
- Browser-safe `/api/gpt-memory/*` routes let Lensically UI save taste feedback, rule reviews, experiments, saved-pattern reviews, generation brief checks, draft approval/rejection feedback, and strategy-memory edits without exposing the GPT API key.
- GPT Memory review separates active, archived, and all strategy memory; archived memory can be restored from the UI without deleting the original audit trail.
- GPT Memory includes a Taste Calibration panel backed by browser-safe `/api/gpt-memory/taste-interview`; it can load objective-aware questions and save useful answers as taste memory before generation.
- GPT brand and generation context are timezone-explicit: brand context returns local/server UTC date-time fields, scheduled reads can filter by local date/timezone, compact generation context strips heavy archive/draft fields, and GPT action `updateDesiredSlots` can update brand posting slots.
- GPT generation preflight should prefer `createPreflightSnapshot` for repeated generation in one GPT chat, then page through `getPreflightSnapshotPage` sections by snapshot id and report exact counts pulled; compact paginated list actions remain the fallback, and heavy aggregate helpers are compact summaries.
- Draft approvals/rejections should include optional feedback notes when useful; those notes persist as flexible `approval_feedback` or `rejection_feedback` memory.
- Saved Patterns supports per-pattern and selected-pattern reviews that persist as approved, rejected, cooldown, or watch/adaptation memory.

## Dashboard State

- `/dashboard` is the growth control room for the connected Threads account.
- `/followers` shows persisted daily follower snapshots in a paginated table.
- It aggregates:
  - today summary metrics
  - all-time top archived post by likes in the hero card
  - yesterday and 7-day winner rankings
  - follower gain trend from persisted daily snapshots

## Persistence Defaults

- cross-device user settings or reusable workflow helpers should prefer backend persistence
- frontend-local storage should be treated as convenience-only, not the source of truth for cross-device behavior
- scheduling data and batch presets belong to backend-managed persistence

## Engineering Defaults

- preserve the existing production flow before introducing a new parallel one
- prefer extending current routes and helpers over inventing duplicate systems
- keep mobile usability first-class for internal product pages
- user-triggered async actions should always show loading, success, error, and empty states when applicable
- destructive flows require explicit confirmation and backend enforcement
- approved implementation tasks should normally be carried through verification, commit, push, and deploy
- commits should always use clear, descriptive commit messages

## Known Deploy Targets

- GitHub remote: `origin`
- frontend Cloudflare target: `lensically-web`
- backend Cloudflare target: `lensically-worker`

## Keep This File Fresh

Update this file when:

- a user-visible workflow changes
- a major feature is added or repurposed
- a product rule becomes important enough that future chats should know it immediately
- a previous current-state statement is no longer accurate
