# Lensically Current State

## Product Shape

- Lensically is operating as a private workspace build with `lensically-web/` as the frontend and `lensically-worker/` as the backend.
- Lensically has an independent recovery MCP Worker as a break-glass control plane. Its source-defined surface can inspect and patch GitHub, perform KV-backed chunked writes, dispatch and inspect CI/deploy workflows, inspect Cloudflare deployments/versions/bindings/domains and observability telemetry, roll back the main Worker with explicit owner approval, and run a full authenticated main-MCP smoke without reading Lensically account or generation data. It is deployed separately so GPT can repair the primary MCP without Codex or a desktop session.
- Main active user workflows currently center on the password gate, Create Post, Scheduled Posts, GPT Memory, saved patterns, dashboard, insights, followers, and post archive flows.
- Public compliance routes are `/privacy`, `/terms`, and `/data-deletion`.
- `/dashboard` now targets an operator-dashboard role rather than a simple profile/stats card.
- `/followers` is a dedicated paginated follower-history surface for daily snapshot tracking.
- Insights collection is backend-owned and runs at 12:00 AM, 6:00 AM, 12:00 PM, and 6:00 PM America/New_York. An hourly Cloudflare cron is admitted only at those four local-time windows so daylight-saving changes cannot shift the schedule.
- Each autonomous Insights run pulls the latest 40 posts without pagination, upserts Post Archive and the live cache, appends only changed metric snapshots, links available source-card/generation/draft/scheduled-post lineage, and marks structurally abnormal snapshots ineligible for learning instead of deleting historical evidence.

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
- GPT growth and generation contexts link posted strategy tags and source/generation lineage to the post's own metric history. Post learning is normalized at 6, 12, 18, and 24-hour maturity checkpoints, with 24 hours as the final authoritative learning result. The existing newest-40 full-Insights collection remains unchanged, later totals are incidental archive context only, and account follower totals remain separate trajectory data that are never attributed to a post, posting day, batch, or posting period.


## GPT Operator State

- Lensically Operator is a Custom GPT connected to `/api/gpt/*` actions with API-key auth.
- `LENSICALLY_OPERATOR_GPT.md` is the repo-owned source of truth for the Operator GPT operating loop, learning rules, growth rules, action set, and schema-refresh notes.
- GPT actions expose an operator playbook, compact brand context, generation context, generation brief, taste interview, draft similarity, saved patterns, recent posts, growth context/review, rule suggestions, novelty fatigue, scheduled posts, scheduling, batch presets, strategy memory, generation runs/drafts, taste feedback, rule review, experiments, and pattern adaptations.
- Operator Mode has a backend-only MCP/app foundation under `/api/operator/tools/:toolName`. It keeps `/api/gpt/*` intact while adding account-scoped workflow sessions, context admissions, source cards, operator gates, gate results, and content inventory for the universal `content_operator_v1` 1-9 workflow spine.
- Operator Mode also exposes a real JSON-RPC MCP endpoint at `/api/operator/mcp` for ChatGPT App/Connector use. It advertises the 24 core operator tools plus a 21-tool MCP admin surface, supports ChatGPT app OAuth through `/api/operator/oauth/authorize` and `/api/operator/oauth/token`, uses bearer/internal auth at runtime, and returns MCP `structuredContent` around the existing backend tool behavior.
- The MCP admin surface can inspect failures, list/read/patch tool schemas and behavior notes, disable tool advertisements, run built-in MCP checks, manage DB-backed workflow requirements, enforce server-side full preflight before stage advancement, manage gates, submit/gate drafts, store implementation backlog items, and deploy/rollback runtime MCP configuration snapshots. Runtime MCP deploy/rollback is D1 configuration activation inside the Worker; source-code deploy still happens through the repo/Cloudflare deploy path.
- The MCP surface includes a private GitHub-backed engineering layer for ChatGPT. It loads canonical startup context, inspects source, and now applies up to 20 exact replacements across 12 files through one atomic Git tree/commit. `runEngineeringRelease` reuses successful exact-SHA release receipts, prevents duplicate active releases, dispatches one complete validate-and-deploy workflow, and returns its exact run identity. `getEngineeringRelease` performs bounded server-side waiting so ordinary releases no longer require chat-side sleep/check loops. GitHub remains the source of truth; Codex should pull latest `origin/main` before Lensically project work.
- Operator MCP v1.13.1 uses `performance-evaluator-v2` with the existing newest-40 full-Insights collection unchanged. The evaluator persists content fingerprints, selects comparable 6/12/18/24-hour snapshots, treats 24 hours as final, invalidates obsolete 48/72-hour learning rows, scores reach/resonance/propagation/conversation against same-maturity cohorts, aggregates feature evidence, creates confidence-scored hypotheses, tracks fatigue, and produces generation/source-selection briefs with adaptive exploitation, improvement, and exploration allocations. It does not make targeted calls for older posts. `get_performance_learning` exposes only current-version evidence. Follower count is account-level goal trajectory only; post/day/batch/period attribution is forbidden.

- Automatic scheduled publishing now has two execution sources—Cloudflare Cron and a recurring Durable Object alarm—but one persisted control state. `paused` holds all due inventory, `canary` allowlists exactly one scheduled-post ID and returns to `paused` after one attempt, and `normal` runs the bounded due queue. Missing control defaults to `paused`. MCP exposes read-only scheduler state and exact account-scoped scheduled-post auditing plus governed mode activation. Deployment verification blocks unsafe `normal` activation when the live overdue count is nonzero.
- `operator-execution-policy-v2` runs before every MCP tool execution and resolves a mandatory source-defined known path before the call. It selects compact governance payloads, one callable canonical alias, exact named-file Git-blob search for oversized source, YAML whole-block indentation and readback, bounded same-run polling, and deployed-version identity checks before evaluating new runtime fields. Newly solved reusable blockers trigger stop-fix-test-resume promotion into policy, regression coverage, engineering audit, and operating memory before the original objective continues.
- `operator-autonomy-governance-v3` places Manifest Mental in `autonomous_operator` mode. Routine content, source selection, generation, gate-passing approval, scheduling, analytics, experiments, workflow sequencing, and strategy changes execute without per-action owner approval or numerical budgets. Existing content gates, source fidelity, duplicate prevention, idempotency, hourly coverage, and scheduler safety remain mandatory. Protected destructive actions, credential or ownership changes, scheduler safety mode, repository deletion, rollback, tool disabling, and irreversible business decisions still require a specific owner-ratified decision. `operator-engineering-authority-v1` continues to govern routine engineering.
- State-changing operations use persistent `operator-idempotency-v1` receipts and semantic operation identities. Workflow-session creation, Manifest source draws, source-card creation, generation runs, draft submission, owner decisions, and scheduling return the existing durable result when a stream interruption or fresh chat repeats the same operation. Execution decisions and known-failure prevention are written to `operator_execution_events` for regression classification.
- Both the main engineering plane and independent recovery plane use Git blob/tree/commit APIs for oversized repository files. The recovery plane remains independent for main-MCP health, large-file repair, and deployment-plane failure; it is selected proactively for those classes rather than after repeated same-backend failures.
- Operator Mode v1 can start workflow sessions, admit context with partial/complete coverage, list production board items and source candidates, create/lock source cards, create generation runs, submit gated candidate drafts, block failed drafts from being shown, approve/reject shown drafts into strategy memory, schedule approved drafts, list/create gates, and promote strategy memory into account-scoped gates.
- Manifest operation is autonomous and calendar-aware. After continuity loads, Lensically restores schedule coverage, workflow state, performance learning, source claims, and current constraints, then executes the next operational priority without routine owner approval. Source selection, source-card creation/reuse, locking, generation, self-rejection, submission, gate evaluation, autonomous approval, and scheduling run silently. Passing posts schedule into the earliest open hourly slots while maintaining a rolling 48-hour buffer. The owner monitors, may intervene at any time, and receives completed-action reports, material strategy changes, meaningful risk, or true protected-operation blockers rather than mandatory four-post approval batches.

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
