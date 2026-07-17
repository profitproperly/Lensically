# Lensically Current State

## Product

- Lensically is a private multi-account Threads workspace with `lensically-web/` as the frontend and `lensically-worker/` as the production backend.
- Active product surfaces include Create Post, Scheduled Posts, Dashboard, Insights, Followers, Post Archive, Saved Patterns, and GPT Memory.
- Public compliance routes are `/privacy`, `/terms`, and `/data-deletion`.
- Backend persistence is the source of truth for accounts, workflow state, schedules, presets, strategy memory, source lineage, performance snapshots, and continuity. Browser storage is convenience-only.

## Operator MCP

- Operator MCP v1.27.1 is exposed at `/api/operator/mcp` with OAuth and one permanent public tool: `executeLensicallyIntent`.
- The public request contains `objective`, `intent`, and `inputs`. Direct internal tool calls are rejected.
- `static-execution-router-v1` selects one internal typed handler from source-defined aliases and the live schema. The model cannot choose the tool, wrapper, retry path, or fallback.
- Route selection does not read D1, compile policy, scan repository knowledge, create incidents, promote routes, or consult OpsMemory or a phonebook.
- Known engineering operations execute through the direct source-defined lane before account bootstrap. Repository reads, searches, patches, tests, releases, workflow status, and deployment verification use compact requests and receipts.
- Empty GitHub code search falls through automatically to the bounded repository fallback. Exact large-file searches use one named blob read and local text matching.
- Related repository edits use one atomic patch set when practical. Normal releases use one exact-SHA validate-and-deploy workflow.
- Account workflow calls still retain the controls that protect real business state: selected account, explicit Proceed boundary, server-side continuity, idempotency, authorization, content gates, scheduling ownership, and scheduler safety.

## Retired Execution Infrastructure

- The D1 execution library, dynamic execution map, discovery incidents, route promotions, pre-call phonebook, OpsMemory execution store, and execution-event history are retired.
- Production health verification removes their legacy tables and dirty triggers:
  - `operator_execution_library_events`
  - `operator_execution_library_sources`
  - `operator_execution_library_ingestion_state`
  - `operator_execution_map_entries`
  - `operator_execution_map_incidents`
  - `operator_execution_map_attempts`
  - `operator_execution_map_promotions`
  - `operator_pre_call_routes`
  - `operator_ops_memory`
  - `operator_execution_events`
- Historical lessons that remain useful belong in concise source-controlled tests and documentation, with one bounded engineering audit record per completed operation.

## Recovery Plane

- `lensically-recovery-worker/` is an independent break-glass Worker and ChatGPT app.
- Recovery has direct source-defined GitHub and Cloudflare controls for health checks, repository reads/searches/patches, chunked writes, workflow dispatch/status, deployment inspection, telemetry, rollback, and main-MCP smoke testing.
- Recovery must remain separate from the main Worker, D1, account workflows, and Operator router. It is used only when the main Worker or deployment plane cannot receive or complete the repair.

## Account Workflow

- Canonical brand keys are `manifest_mental`, `opmg_deadman`, and `vectrix`.
- Fresh sessions select a key and require explicit Proceed before account data loads.
- After Proceed, continuity is restored from server-side state. Conversation memory is not workflow state.
- The content workflow persists sessions, sources, source cards, generation runs, drafts, gates, approvals, schedules, and result lineage.
- Manifest source eligibility requires at least 1,000 verified likes. Daily claims prevent same-day reuse while allowing later reuse unless a source is excluded.
- Excluding a source prevents future draws while preserving its original record, analytics, source cards, generations, and historical lineage.
- Scheduling requires approved state, account ownership, valid gates, and an open calendar slot.
- State-changing workflow calls use semantic idempotency receipts so interruptions replay the existing durable result instead of creating duplicates.

## Scheduling and Publishing

- `/schedule` is the Create Post surface. `/scheduled-posts` manages upcoming entries and supports edit, retry, single removal, and controlled bulk removal.
- Publishing uses Cloudflare Cron and a Durable Object alarm behind one persisted scheduler control.
- Scheduler modes are `paused`, `canary`, and `normal`. Missing control defaults to `paused`.
- Canary authorizes exactly one scheduled entry and returns to paused after one attempt.
- Normal activation is blocked while overdue approved or posting records exist. Recovery is explicit, bounded, and transactional.
- Published state is authoritative only when the scheduled row is `posted` and has a nonempty Threads identifier.

## Insights and Learning

- Insights collection runs at 12:00 AM, 6:00 AM, 12:00 PM, and 6:00 PM America/New_York through an hourly cron admitted only at those local windows.
- Each run fetches the newest 40 posts, updates cache and archive state, appends only changed metric snapshots, and preserves available lineage.
- Performance learning uses age-matched 6, 12, 18, and 24-hour checkpoints; 24 hours is final.
- Learning uses each post's own views, likes, replies, reposts, quotes, and shares. Follower totals remain account-level trajectory data and are never attributed to a post, day, batch, or posting period.

## Engineering and Release

- GitHub `main` is the repository source of truth.
- Large Worker files use Git blob, tree, commit, and ref APIs rather than the GitHub Contents API.
- Normal implementation flow is bounded inspection, one coherent change set, focused validation, one exact-SHA release, and live health and smoke verification.
- The deployment workflow runs preflight, TypeScript validation, the focused Operator release gate, GPT-memory tests, Worker deployment, cron verification, and scheduler safety verification.
- Full Operator tests are diagnostic and run separately when broader regression investigation is required.
- Releases dispatch on the configured branch while passing the exact commit through `release_sha`; checkout must match that SHA before validation or deployment.
- Routine engineering should complete in under ten minutes whenever the underlying platform operation permits it. Extra frameworks, duplicated registries, repeated polling, and separate validation and deployment loops are not acceptable defaults.

## Deployment Targets

- GitHub remote: `origin`
- Frontend Cloudflare target: `lensically-web`
- Backend Cloudflare target: `lensically-worker`
- Production API: `api.lensically.com`
- Production web: `lensically.com`

## Maintenance Rule

Keep this file limited to current architecture and active behavior. Historical attempts, superseded versions, and retired frameworks belong in Git history, not the live startup context.
