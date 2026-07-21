# Lensically Current State

## Product

- Lensically is a private multi-account Threads workspace with `lensically-web/` as the frontend and `lensically-worker/` as the production backend.
- Active product surfaces include Create Post, Scheduled Posts, Dashboard, Insights, Followers, Post Archive, Saved Patterns, and GPT Memory.
- Public compliance routes are `/privacy`, `/terms`, and `/data-deletion`.
- Backend persistence is the source of truth for accounts, workflow state, schedules, presets, strategy memory, source lineage, performance snapshots, and continuity. Browser storage is convenience-only.

## Operator MCP

- Operator MCP uses the canonical `OPERATOR_MCP_VERSION` value declared in `lensically-worker/src/index.ts`; architecture documentation does not duplicate the writable semantic version. It is exposed at `/api/operator/mcp` with OAuth and a curated public surface of direct typed tools.
- Engineering failures and explicit contradictions pass through `defect-generalization-gate-v1`. Successful known paths bypass it; duplicated assumptions, contract drift, architectural drift, and known recurrences require a targeted sibling scan and prevention disposition before the interrupted objective resumes.
- `winning-path-promotion-v1` converts proven resolutions into source-controlled matching conditions, prohibited losing paths, mandatory winning procedures, enforcement points, regressions, and supersession rules. Matching known work follows the promoted winner before action; unknown terrain remains available for bounded discovery, and preventable incidents cannot close before promotion and enforcement.
- Operator UI parity reads use one canonical paginated handler for the same Dashboard, Followers, live Insights, Post Archive, and Saved Patterns services used by the web UI. Stale Manifest review batches have a separate canonical retirement action that preserves all underlying sources, analytics, and lineage.
- Main MCP now uses a curated direct typed public surface. Every advertised tool has one closed bounded schema; `executeLensicallyIntent`, `profile_id`, generic `inputs`, objective/intent routing text, wrappers, and internal handler names remain server-internal and are not advertised. Account initialization remains first-class through direct startup, key-selection, and Proceed tools.
- The canonical server-side architecture is the **Execution Kernel** (`lensically-execution-kernel-v1`). It owns capability-directory resolution, payload safety, source-defined routing, pre-call policy, continuity and authorization, execution receipts, and reusable-blocker prevention before one internal typed handler executes.
- Exact deterministic and exact source-defined intents keep precedence over broader directory guidance, preventing read requests from being rewritten into mutations. The model cannot choose the tool, wrapper, retry path, or fallback.
- Each MCP initialize response issues a signed deployment-scoped `Mcp-Session-Id`. A request carrying a session from an older Worker deployment or kernel version receives HTTP 404 and a replacement session identifier before routing, forcing reinitialization instead of executing stale behavior.
- Route selection does not read D1, compile dynamic policy, scan repository knowledge, create incidents, promote routes, or consult OpsMemory or a phonebook. Legacy top-level receipt names are retired; the Execution Kernel is the sole execution receipt.
- Known engineering operations execute through the direct source-defined lane before account bootstrap. Recovery remains independent while the post-consolidation call campaign identifies and removes any remaining normal-path dependency before cleanup.
- Related repository edits use one atomic patch set when practical. Routine pushes use one fast validation workflow; production releases use one explicit exact-SHA validate-and-deploy workflow.
- The mandatory autonomous capability lifecycle is source-controlled in `lensically-worker/src/systemDirectory/capabilityLifecycle.json`. Future models resolve and reuse existing capabilities first; when a capability is missing, they create and store its declaration, Directory entry, canonical typed handler, static route, focused regression, validation scope, exact-head release plan, and live-verification contract without routine owner prompting.
- Fast validation and release preflight fail closed when a new tool or Directory entry lacks a complete lifecycle declaration. Compatibility bridges and duplicate implementation paths are forbidden.
- Mandatory startup reports the lifecycle version, canonical location, autonomous execution rule, and required completion sequence.
- Account workflow calls still retain the controls that protect real business state: selected account, explicit Proceed boundary, server-side continuity, idempotency, authorization, content gates, scheduling ownership, and scheduler safety.

## Continuous Hardening and Autonomous Operation

- `continuous-hardening-loop-v1` persists incidents and evidence through Detected, Contained, Classified, Reproduced, Generalized, Repaired, Prevention-locked, Validated, Released, Live-verified, Resumed, and Closed. P0/P1 incidents block normal work; P2 requires a safe checkpoint.
- The runtime role is the **Lensically Autonomous Business Operator** under `agent-native-operating-contract-v1`, not a chat-dependent assistant. Each activation restores durable state, reconciles, diagnoses, selects a priority, executes, verifies, records, declares one next action, and checkpoints.
- `single-active-outcome-v1` persists one frozen active implementation outcome in `operator_work_state`. Proposed work is explicitly activated, deferred, merged, or rejected in `operator_work_ledger`; only P0/P1 incidents, required prerequisites, or material irreversible rework may interrupt the active outcome.
- Every gateway result includes an action-closure receipt containing current live state, target agent-native state, active outcome, selected next action, priority reason, completion evidence, owner-action requirement, and a retirement condition whenever a temporary dependency exists.
- The current active outcome is to validate, release, and live-verify `manifest-autonomous-growth-engine-v1`, then prove the first one-time 48-hour autonomous cycle before installing the daily 6:15 AM task.

## Manifest Autonomous Growth Engine

- Manifest's permanent mission is to reach 1,000,000 followers while protecting audience trust, content quality, account safety, and brand identity.
- `autonomous-growth-mission-v2` and `operator-autonomy-governance-v4` make the Lensically Autonomous Business Operator responsible for routine strategy, generation, scheduling, evaluation, recovery, and evidence-triggered engineering. Owner participation is optional criticism, taste, market intelligence, and override—not a production dependency.
- After the fixed key handshake and explicit Proceed, continuity reconciles live schedule and delivery state before selecting the next autonomous action. Stale calendar summaries never override live state, and fresh sessions do not open a mandatory Growth Mission discussion or resume a four-post approval batch.
- `prepare_manifest_autonomous_cycle` persists an exact rolling horizon, preserves existing scheduled posts, identifies missing hourly slots, and returns current follower trajectory, performance learning, Content Focus, recent audience exposure, adaptive strategy policy, and generation contract.
- `commit_manifest_autonomous_runway` accepts up to 24 exact missing slots per bounded call. Each accepted post receives an operator hypothesis or source-card family, generation run, draft, mandatory gates, strategy tags, inventory tracking, scheduled-post lineage, and an idempotent cycle receipt.
- The rolling runway target is 48 hours. The bootstrap may require two bounded commit calls; after stabilization, a daily run ordinarily replenishes approximately 24 consumed hours rather than creating another 48-post backlog.
- Content selection uses adaptive expected marginal value rather than fixed ratios. Families are evaluated as franchise, core, emerging, prospect, cooling, or dormant. Strong winners keep earning opportunities while comparable performance remains strong; frequency alone is never treated as fatigue. Mechanism repetition and weak execution repetition are evaluated separately.
- The four-post review workflow remains available only as an optional display surface. It no longer blocks generation or scheduling.
- `review_manifest_scheduled_post` records optional owner feedback and can gate and replace one unpublished post in the same slot. Temporary repetition, family strategy, hypotheses, post-specific taste, and explicit permanent rules remain distinct.
- Protected owner boundaries are limited to spending, credential or ownership changes, irreversible deletion, fundamental mission changes, disabling critical infrastructure, or material account/project danger.

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
- Recovery has direct source-defined GitHub and Cloudflare controls for free-text source discovery, exact repairs, terminal workflow diagnostics, health checks, deployment inspection, telemetry, rollback, and main-MCP smoke testing.
- Recovery remains separate from the main Worker, D1, account workflows, and Operator router. It is break-glass infrastructure only when Main or its deployment plane cannot receive or complete the required repair; normal engineering state, hardening, work intake, validation, and release remain Main-owned.

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
- Normal implementation flow is bounded inspection, one coherent change set, focused exact-head validation, one gated release, and live health and smoke verification.
- Main validation and deployment run through GitHub Actions. Routine pushes use fast validation, complete Operator coverage uses eight deterministic parallel shards, and production uses one explicit exact-SHA release workflow.
- Local node enrollment uses short-lived single-use tokens and per-node credentials. Main stores only credential hashes, can report enrollment/heartbeat/revocation state, creates server-signed `local-validation-receipt-v1` records from authenticated node evidence, and can revoke one node without rotating any global Cloudflare secret.
- One-time local node installation is `powershell -ExecutionPolicy Bypass -File .\lensically-local-node\scripts\install-local-node.ps1 -Mode Install -NodeId brian-win-node -LensicallyOrigin https://api.lensically.com -EnrollmentToken <single-use-token>`.
- Production deployment is owned by `.github/workflows/lensically-engineering.yml`. The `worker-deploy` task checks out and verifies one explicit 40-character SHA, runs the release gates, deploys that exact head, verifies Wrangler cron triggers, and confirms the live scheduler and runtime identity.
- The validation script runs TypeScript, capability lifecycle preflight, Operator acceptance, mandatory System Directory tests, Threads publishing tests, and GPT-memory tests before writing the exact-head receipt.
- Full Operator diagnostics remain available as eight deterministic shards when focused release evidence is insufficient. GitHub Actions billing is not part of the normal release dependency.
- The deploy gate passes the exact validated SHA to Wrangler as `LENSICALLY_COMMIT_SHA`; production and repository heads align only after live verification of that release. Ordinary source commits never deploy production.
- Routine engineering should complete in under ten minutes whenever the underlying platform operation permits it. Extra frameworks, duplicated registries, repeated polling, and separate validation and deployment loops are not acceptable defaults.

## Deployment Targets

- GitHub remote: `origin`
- Frontend Cloudflare target: `lensically-web`
- Backend Cloudflare target: `lensically-worker`
- Production API: `api.lensically.com`
- Production web: `lensically.com`

## Maintenance Rule

Keep this file limited to current architecture and active behavior. Historical attempts, superseded versions, and retired frameworks belong in Git history, not the live startup context.
