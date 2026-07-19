# Lensically Current State

## Product

- Lensically is a private multi-account Threads workspace with `lensically-web/` as the frontend and `lensically-worker/` as the production backend.
- Active product surfaces include Create Post, Scheduled Posts, Dashboard, Insights, Followers, Post Archive, Saved Patterns, and GPT Memory.
- Public compliance routes are `/privacy`, `/terms`, and `/data-deletion`.
- Backend persistence is the source of truth for accounts, workflow state, schedules, presets, strategy memory, source lineage, performance snapshots, and continuity. Browser storage is convenience-only.

## Operator MCP

- Operator MCP uses the canonical `OPERATOR_MCP_VERSION` value declared in `lensically-worker/src/index.ts`; architecture documentation does not duplicate the writable semantic version. It is exposed at `/api/operator/mcp` with OAuth and one permanent public tool: `executeLensicallyIntent`.
- Engineering failures and explicit contradictions pass through `defect-generalization-gate-v1`. Successful known paths bypass it; duplicated assumptions, contract drift, architectural drift, and known recurrences require a targeted sibling scan and prevention disposition before the interrupted objective resumes.
- `winning-path-promotion-v1` converts proven resolutions into source-controlled matching conditions, prohibited losing paths, mandatory winning procedures, enforcement points, regressions, and supersession rules. Matching known work follows the promoted winner before action; unknown terrain remains available for bounded discovery, and preventable incidents cannot close before promotion and enforcement.
- Operator UI parity reads use one canonical paginated handler for the same Dashboard, Followers, live Insights, Post Archive, and Saved Patterns services used by the web UI. Stale Manifest review batches have a separate canonical retirement action that preserves all underlying sources, analytics, and lineage.
- The permanent public request contract requires registered `profile_id` and bounded `inputs`, with optional `continuation_id`, `incident_id`, and `permit`; public `objective` and `intent` fields are retired. Account initialization remains first-class through exact `startup`, key-selection, and Proceed profile shapes. Direct internal tool calls remain rejected.
- The canonical server-side architecture is the **Execution Kernel** (`lensically-execution-kernel-v1`). It owns capability-directory resolution, payload safety, source-defined routing, pre-call policy, continuity and authorization, execution receipts, and reusable-blocker prevention before one internal typed handler executes.
- Exact deterministic and exact source-defined intents keep precedence over broader directory guidance, preventing read requests from being rewritten into mutations. The model cannot choose the tool, wrapper, retry path, or fallback.
- Each MCP initialize response issues a signed deployment-scoped `Mcp-Session-Id`. A request carrying a session from an older Worker deployment or kernel version receives HTTP 404 and a replacement session identifier before routing, forcing reinitialization instead of executing stale behavior.
- Route selection does not read D1, compile dynamic policy, scan repository knowledge, create incidents, promote routes, or consult OpsMemory or a phonebook. Legacy receipt names remain compatibility fields only until the approved cleanup phase.
- Known engineering operations execute through the direct source-defined lane before account bootstrap. Recovery remains independent while the post-consolidation call campaign identifies and removes any remaining normal-path dependency before cleanup.
- Related repository edits use one atomic patch set when practical. Normal releases use one exact-SHA validate-and-deploy workflow.
- The mandatory autonomous capability lifecycle is source-controlled in `lensically-worker/src/systemDirectory/capabilityLifecycle.json`. Future models resolve and reuse existing capabilities first; when a capability is missing, they create and store its declaration, Directory entry, canonical typed handler, static route, focused regression, validation scope, exact-head release plan, and live-verification contract without routine owner prompting.
- Fast validation and release preflight fail closed when a new tool or Directory entry lacks a complete lifecycle declaration. Compatibility bridges and duplicate implementation paths are forbidden.
- Mandatory startup reports the lifecycle version, canonical location, autonomous execution rule, and required completion sequence.
- Account workflow calls still retain the controls that protect real business state: selected account, explicit Proceed boundary, server-side continuity, idempotency, authorization, content gates, scheduling ownership, and scheduler safety.

## Guided Growth Mission

- Manifest's permanent mission is to reach 1,000,000 followers while protecting audience trust, content quality, account safety, and brand identity.
- `guided-growth-mission-v1` is persisted in `operator_growth_missions`; every prior approved or active version is retained in `operator_growth_mission_revisions`.
- After the key handshake and explicit Proceed, Lensically restores canonical account state, calculates a bounded evidence diagnostic, identifies the current bottleneck, proposes a primary objective and supporting plan, and presents the Growth Mission Brief for owner-model discussion.
- Proceed does not authorize account mutation. Content creation, draft decisions, source deletion or exclusion, scheduling, publishing, and other account mutations remain locked while the mission is in `discussion` or `paused`.
- The owner may revise or approve the proposed plan at any time. An approved or active guided plan unlocks account execution while preserving established owner checkpoints.
- Routine engineering remains autonomous. Full autonomous account execution is a separate explicit owner-authorized mode change and is never inferred from normal plan approval.

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

- `lensically-recovery-worker/` is an independent engineering control Worker and ChatGPT app.
- Recovery has direct source-defined GitHub and Cloudflare controls for free-text source discovery, exact patches, terminal workflow diagnostics, verified deployment dispatch, health checks, deployment inspection, telemetry, rollback, and main-MCP smoke testing.
- Recovery remains separate from the main Worker, D1, account workflows, and Operator router. It is the canonical surface for registered client-blocked engineering classes and the break-glass plane when the main Worker cannot receive or complete a repair.

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
- Automatic delivery is the default. Missing control initializes as `normal`; `paused` is reserved for explicit emergency maintenance, and `canary` is reserved for one-post diagnostics.
- A quarantined `posting` row is isolated from the automatic selector, which continues processing due `approved` rows. One uncertain post can never pause unrelated scheduled inventory.
- Normal activation is blocked only by overdue `approved` rows that could backfill unexpectedly. Quarantined-row recovery is explicit, bounded, transactional, and can run while automatic delivery continues.
- An external publish attempt never returns automatically to `approved`. Failed, stale, or ambiguous attempts remain quarantined in `posting`; normalized SQLite datetime comparisons prevent active attempts from being reclaimed, and only explicit reconciliation may retire or reschedule them.
- A returned Threads post identifier is authoritative and finalizes the scheduled row even when a concurrent local state transition has already changed it.
- Published state is authoritative only when the scheduled row is `posted` and has a nonempty Threads identifier.

## Insights and Learning

- Insights collection runs at 12:00 AM, 6:00 AM, 12:00 PM, and 6:00 PM America/New_York through an hourly cron admitted only at those local windows.
- Each run fetches the newest 40 posts, updates cache and archive state, appends only changed metric snapshots, and preserves available lineage.
- Performance learning uses age-matched 6, 12, 18, and 24-hour checkpoints; 24 hours is final.
- Published-post result reads support a compact verification mode that returns bounded lineage, source, source-card, generation-run, draft, and current-metric evidence without the full performance payload.
- Learning uses each post's own views, likes, replies, reposts, quotes, and shares. Follower totals remain account-level trajectory data and are never attributed to a post, day, batch, or posting period.

## Engineering and Release

- GitHub `main` is the repository source of truth.
- Large Worker files use Git blob, tree, commit, and ref APIs rather than the GitHub Contents API.
- Normal implementation flow is bounded inspection, one coherent change set, focused validation, one exact-SHA release, and live health and smoke verification.
- The deployment workflow runs preflight, TypeScript validation, mandatory System Directory tests, the focused Operator release gate, GPT-memory tests, Worker deployment, cron verification, and scheduler safety verification.
- Full Operator diagnostics run as eight deterministic GitHub matrix shards. Every active Operator test title is assigned to exactly one shard, shards execute in parallel, and the former single-job monolith is forbidden by release preflight.
- Worker releases use the source-controlled verified-release marker. GitHub converts the marker commit into an internal exact-SHA workflow dispatch; checkout must match that SHA before validation or deployment. Workflow jobs cannot self-commit diagnostics back to `main`.
- Routine engineering should complete in under ten minutes whenever the underlying platform operation permits it. Extra frameworks, duplicated registries, repeated polling, and separate validation and deployment loops are not acceptable defaults.

## Deployment Targets

- GitHub remote: `origin`
- Frontend Cloudflare target: `lensically-web`
- Backend Cloudflare target: `lensically-worker`
- Production API: `api.lensically.com`
- Production web: `lensically.com`

## Maintenance Rule

Keep this file limited to current architecture and active behavior. Historical attempts, superseded versions, and retired frameworks belong in Git history, not the live startup context.
