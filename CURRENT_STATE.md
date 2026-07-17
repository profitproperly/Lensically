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
- Fresh-chat Operator continuity reconciles past-due approved/posting records into durable operational incidents. Needs Attention posts are excluded from published coverage, block new scheduling from superseding the failed hour, carry an explicit recovery action across chats and deployments, and close only after verified `posted` state with a published Threads ID.

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
- Operator MCP v1.21.0 uses `performance-evaluator-v2` with the existing newest-40 full-Insights collection unchanged. The evaluator persists content fingerprints, selects comparable 6/12/18/24-hour snapshots, treats 24 hours as final, invalidates obsolete 48/72-hour learning rows, scores reach/resonance/propagation/conversation against same-maturity cohorts, aggregates feature evidence, creates confidence-scored hypotheses, tracks fatigue, and produces generation/source-selection briefs with adaptive exploitation, improvement, and exploration allocations. It does not make targeted calls for older posts. `get_performance_learning` exposes only current-version evidence. Follower count is account-level goal trajectory only; post/day/batch/period attribution is forbidden.
- Operator MCP v1.24.0 freezes the public ChatGPT-facing schema permanently at one tool: `executeLensicallyIntent` with `objective`, `intent`, `inputs`, optional `continuation_id`, optional `incident_id`, and optional `permit`. Startup uses `intent=startup`; no separate startup, Operator, engineering, account, admin, repository, GitHub, Cloudflare, scheduler, deployment, repair, rollback, smoke-test, or recovery tool is publicly discoverable or directly callable. `mandatory-execution-map-v1` is the universal historical manual and execution controller. The model submits an objective, an intent, and variable inputs; it cannot select an internal tool, route, payload structure, sequence, retry policy, or fallback when a verified procedure exists. The map seeds and versions procedures from the internal typed registry, enforces the active procedure, and records every attempt in `operator_execution_map_attempts`. Unknown work opens an `operator_execution_map_incidents` record and returns a signed discovery permit. A mapped path that genuinely fails is marked stale and blocked. Successful discovery automatically creates a verified replacement in `operator_execution_map_entries`, supersedes the obsolete path when applicable, records `operator_execution_map_promotions`, and only then allows the original objective to resume. The existing pre-call phonebook remains an internal lower-level constraint beneath the map.
- Operator MCP v1.24.0 also hardens the map for autonomous engineering: exact operational classes such as MCP status, runtime/repository alignment, repository inspection, engineering diagnosis/repair, tests, deployment, and post-deployment verification resolve deterministically before fuzzy semantic scoring. Status and engineering intents cannot route to account-content procedures such as draft submission. Discovery permits round-trip against the exact open incident, intent, incident ID, and normalized inputs before a discovery tool is required.
- MCP status and health requests are compact by design. `engineeringPrecheck` returns bounded runtime identity, repository head, small operational-memory/failure samples, and routing guidance; it must not return the full startup context. Fresh-session bootstrap still uses `executeLensicallyIntent` with `intent=startup`. Startup runtime identity reports the current Cloudflare Worker deployment metadata from `CF_VERSION_METADATA`; D1 runtime-config snapshots are separately labeled as runtime configuration deployments.

- Operator MCP v1.25.1 makes scheduled publishing fail closed across deployment and recovery. Normal activation is serialized against Cron/alarm execution and returns the exact overdue post IDs instead of draining them. While paused, `recoverOverdueScheduledPosts` can transactionally retire or reschedule up to 25 explicitly selected overdue rows; reschedules require future timestamps, retired rows are excluded from all later claims, and activation is allowed only after a second overdue check returns empty.
- Operator MCP v1.26.0 replaces separate map, phonebook, and passive-memory behavior with `execution-policy-library-v2`, consulted before every routed action through the sole public tool `executeLensicallyIntent`. One normalized D1 registry materializes repository operating knowledge and a complete repository-file manifest; every D1 table/schema; Ops Memory; pre-call routes; workflow requirements; tool overrides; deployments; continuity; idempotency receipts; autonomy decisions; engineering audits; incidents; map history; backlog; strategy memory; workflow state; source-selection history; current source cards; gate policies/results; content inventory; performance snapshots; and the typed tool registry. Core policy sources and the complete D1 manifest must be ready before execution. Relevant candidates are retrieved through bounded lookup, static sources refresh only when their source fingerprint changes, dynamic sources refresh on a bounded interval or immediately after policy-changing actions, stale registry rows are deactivated, and every result is written back as execution evidence. Known routes remain mandatory; discovery exists only for unknown terrain or an exact verified route that genuinely failed, and the verified replacement is promoted before the interrupted objective resumes.

- The execution library materializes `SOURCE_DEFINED_PRE_CALL_ROUTES` directly as authoritative `pre_call_route` policies during initial compilation and forced refresh. D1 `operator_pre_call_routes` rows are separate `pre_call_route_override` entries; an empty override table cannot remove the canonical phonebook. Canonical routes and overrides are both boosted, always consulted, and eligible as mandatory rules. Dynamic D1 source groups use isolated settled reads, so an absent non-existent table cannot discard successful sources; non-missing-table query failures still fail admission. Full source coverage remains persisted in D1, while public receipts return only consulted source types and aggregate counts to preserve compact startup and status payloads.
- Exact-SHA engineering releases dispatch GitHub Actions on the configured branch, pass the requested commit through `release_sha`, checkout that exact SHA, and verify `git rev-parse HEAD` before preflight, tests, or deployment. Raw commit SHAs are never used as workflow-dispatch refs.
- Mandatory Execution Map path failures exclude deterministic patch-input errors such as exact-match ambiguity and stale expected-head concurrency. Any false-stale incident created by those signatures is automatically resolved and its prior entry reactivated during map seeding.
- Automatic scheduled publishing has two execution sources—Cloudflare Cron and a recurring Durable Object alarm—but one persisted control state. `paused` holds all due inventory, `canary` allowlists exactly one scheduled-post ID and returns to `paused` after one attempt, and `normal` runs the bounded due queue. Missing control defaults to `paused`. MCP exposes read-only scheduler state, exact account-scoped scheduled-post auditing, governed overdue recovery, and governed mode activation. Deployment verification and runtime control both block unsafe `normal` activation when the live overdue count is nonzero.
- `operator-execution-policy-v2` is now subordinate to the Mandatory Execution Map. `executeLensicallyIntent` resolves the action before any internal tool can be selected, then applies typed-schema normalization, the lower-level pre-call phonebook, continuity, authorization, and idempotency. Direct operational calls and direct guard calls are rejected before tool lookup. Known procedures are compulsory. Unknown or stale terrain is the only condition that can issue a signed discovery permit, and an open discovery incident keeps the interrupted objective paused until a successful path is promoted and activated.
- `operator-autonomy-governance-v3` places Manifest Mental in `autonomous_operator` mode. Routine content, source selection, generation, gate-passing approval, scheduling, analytics, experiments, workflow sequencing, and strategy changes execute without per-action owner approval or numerical budgets. Existing content gates, source fidelity, duplicate prevention, idempotency, hourly coverage, and scheduler safety remain mandatory. Protected destructive actions, credential or ownership changes, scheduler safety mode, repository deletion, rollback, tool disabling, and irreversible business decisions still require a specific owner-ratified decision. `operator-engineering-authority-v1` continues to govern routine engineering.
- State-changing operations use persistent `operator-idempotency-v1` receipts and semantic operation identities. Workflow-session creation, Manifest source draws, source-card creation, generation runs, draft submission, owner decisions, and scheduling return the existing durable result when a stream interruption or fresh chat repeats the same operation. Execution decisions and known-failure prevention are written to `operator_execution_events` for regression classification.
- Both the main engineering plane and independent recovery plane use Git blob/tree/commit APIs for oversized repository files. The recovery plane remains an independent break-glass ChatGPT app with direct source-defined repair tools for recovery health, repository status/read/search/patch/write, GitHub workflows, Cloudflare state/telemetry, rollback, and full main-MCP smoke. It must not depend on the main Operator gateway or Mandatory Execution Map.
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
