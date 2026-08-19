# Lensically Current State

## Product

- Lensically is a private multi-account Threads workspace with `lensically-web/` as the frontend and `lensically-worker/` as the production backend.
- Active product surfaces include Create Post, Scheduled Posts, Dashboard, Cycles, Intelligence, Insights, Followers, Post Archive, Saved Patterns, and GPT Memory.
- `Cycles` is one normal sidebar destination beneath Dashboard. It opens Main by default and uses an in-page `Main | Innovation` switch; there is no Cycles dropdown and no Compare surface.
- Main Cycle releases use one durable semantic Champion registry. The accepted baseline is `Main Cycle v1.0.0`, bound to source SHA `ec52201fab48e0a00926c8e7319b90e0a925a584`, selector `source-selection-engine-v6`, and preselection policy `source-preselection-policy-v1`.
- Active Innovation state is not copied into Main persistence. The paired UI state is derived read-only from the released Main Champion and physically isolated `SHADOW_DB` run/benchmark receipts. Main stores only released Champion identity and immutable promotion history.
- Read-only `/api/cycles/*` surfaces provide current paired state, server-paginated Main/Innovation history, bounded summaries, six-row source-selection previews, and exact persisted Stage 4 detail on demand. Missing historical fields are labeled unavailable rather than inferred.
- Public compliance routes are `/privacy`, `/terms`, and `/data-deletion`.
- Production public sales routes are served from `lensically-worker/public/` at `https://lensically.com/`, including root checkout, `/download/`, `/license/`, `/refund-policy/`, `/privacy`, `/terms`, and `/data-deletion`. The private operational Next.js app is canonical at `https://app.lensically.com/`.
- Backend persistence is the source of truth for accounts, workflow state, schedules, presets, strategy memory, source lineage, performance snapshots, and continuity. Browser storage is convenience-only.

## Operator MCP

- Fresh model sessions assume zero retained Lensically knowledge and use `operator-lifecycle-v1`. Step 0 MCP initialize is a tiny bootloader with only the two mandatory governing display lines plus the pointer to `getOperatorSessionMap`. Step 1 `getOperatorSessionMap` is a recursive pointer tree only. Step 2 `getOperatorKnowledge` receives one typed planned action, derives exactly its durable knowledge from deployment-local `operatorKnowledgeRegistry.json`, and binds an action fingerprint; Step 3 `getOperatorLiveState` derives exactly that prepared action's current mutable truth and account target; Step 4 `executeOperatorAction` executes only the unchanged prepared internal typed capability; Step 5 `closeOperatorAction` verifies and checkpoints. Initial boot is Steps 1-5; later meaningful tasks loop through Steps 2-5.


- Full `operator-governing-standards-v7` durable authority is owned by Step 2's `governance` knowledge node. Step 0 does not duplicate that body; it displays only `Governing standards: Autonomy. Efficiency. Prevention.` and the mandatory governing rule before pointing to Step 1. Every lifecycle tool still requires the exact source-controlled acknowledgment.
- Operator MCP uses the canonical `OPERATOR_MCP_VERSION` value declared in `lensically-worker/src/operatorMcpProtocol.ts`; architecture documentation does not duplicate the writable semantic version. It is exposed at `/api/operator/mcp` with OAuth and exactly five public lifecycle tools; operational capabilities remain internal behind Step 4.
- Engineering failures and explicit contradictions pass through `defect-generalization-gate-v1`. Successful known paths bypass it; duplicated assumptions, contract drift, architectural drift, and known recurrences require a targeted sibling scan and prevention disposition before the interrupted objective resumes.
- `winning-path-promotion-v1` converts proven resolutions into source-controlled matching conditions, prohibited losing paths, mandatory winning procedures, enforcement points, regressions, and supersession rules. Matching known work follows the promoted winner before action; unknown terrain remains available for bounded discovery, and preventable incidents cannot close before promotion and enforcement.
- Operator UI parity reads use one canonical paginated handler for the same Dashboard, Followers, live Insights, Post Archive, and Saved Patterns services used by the web UI. Stale Manifest review batches have a separate canonical retirement action that preserves all underlying sources, analytics, and lineage.
- Main MCP's public surface is only `getOperatorSessionMap`, `getOperatorKnowledge`, `getOperatorLiveState`, `executeOperatorAction`, and `closeOperatorAction`. Step 4 is the mandatory execution choke point: its public schema is generated as a closed discriminated union from the internal typed capability registry, so new internal capabilities expand execution competence without adding public startup tools or exposing generic `profile_id`/`inputs`. Account key selection and Proceed remain internal typed actions and their persisted server-side continuity boundary is enforced when Step 3 requests account state.
- The canonical server-side architecture is the **Execution Kernel** (`lensically-execution-kernel-v1`). It owns capability-directory resolution, payload safety, source-defined routing, pre-call policy, continuity and authorization, execution receipts, and reusable-blocker prevention before one internal typed handler executes.
- Exact deterministic and exact source-defined intents keep precedence over broader directory guidance, preventing read requests from being rewritten into mutations. The model cannot choose the tool, wrapper, retry path, or fallback.
- Each MCP initialize response issues a signed deployment-scoped `Mcp-Session-Id`. A request carrying a session from an older Worker deployment or kernel version receives HTTP 404 and a replacement session identifier before routing, forcing reinitialization instead of executing stale behavior.
- Route selection does not read D1, compile dynamic policy, scan repository knowledge, create incidents, promote routes, or consult OpsMemory or a phonebook. Legacy top-level receipt names are retired; the Execution Kernel is the sole execution receipt.
- Known engineering operations execute through the direct source-defined lane before account bootstrap. Recovery remains independent while the post-consolidation call campaign identifies and removes any remaining normal-path dependency before cleanup.
- Related repository edits use one atomic patch set when practical. Routine pushes use one fast validation workflow; production releases use one explicit exact-SHA validate-and-deploy workflow.
- The mandatory autonomous capability lifecycle is source-controlled in `lensically-worker/src/systemDirectory/capabilityLifecycle.json`. Future models resolve and reuse existing capabilities first; when a capability is missing, they create and store its declaration, Directory entry, canonical typed handler, static route, focused regression, validation scope, exact-head release plan, and live-verification contract without routine owner prompting.
- Fast validation and release preflight fail closed when a new tool or Directory entry lacks a complete lifecycle declaration. Compatibility bridges and duplicate implementation paths are forbidden.
- Mandatory startup reports the lifecycle version, canonical location, autonomous execution rule, and required completion sequence.
- `operator-governing-standards-v7` additionally enforces the authority before every MCP tool action. All advertised engineering, administrative, account, repository, workflow, deployment, content, scheduling, recovery, measurement, and read-only schemas require one exact source-controlled `governing_standards_ack`; the dispatcher rejects missing or altered acknowledgment before routing, account loading, idempotency, authorization, or execution, then strips it before the internal handler. Exact owner specifications may not be condensed or rediscovered once the target is known. Failure audits may not close on analysis, retry, recommendation, or chat memory; durable prevention evidence is required before resumption.
- Account workflow calls still retain the controls that protect real business state: selected account, explicit Proceed boundary, server-side continuity, idempotency, authorization, content gates, scheduling ownership, and scheduler safety.

## Continuous Hardening and Autonomous Operation

- `continuous-hardening-loop-v1` persists incidents and evidence through Detected, Contained, Classified, Reproduced, Generalized, Repaired, Prevention-locked, Validated, Released, Live-verified, Resumed, and Closed. P0/P1 incidents block normal work; P2 requires a safe checkpoint.
- The runtime role is the **Lensically Autonomous Business Operator** under `agent-native-operating-contract-v1`, not a chat-dependent assistant. Each activation restores durable state, reconciles, diagnoses, selects a priority, executes, verifies, records, declares one next action, and checkpoints.
- `single-active-outcome-v1` persists one frozen active implementation outcome in `operator_work_state`. Proposed work is explicitly activated, deferred, merged, or rejected in `operator_work_ledger`; only P0/P1 incidents, required prerequisites, or material irreversible rework may interrupt the active outcome.
- Every gateway result includes an action-closure receipt containing current live state, target agent-native state, active outcome, selected next action, priority reason, completion evidence, owner-action requirement, and a retirement condition whenever a temporary dependency exists.
- Manifest Intelligence is complete in production. All four turns and all 20 capabilities are implemented, validated, deployed, and live-proven at exact head `53dc878517feb767b2e29149bd5a590de0c37f6c`, deployment `568a3056-b427-4aed-b017-5311b336f123`, MCP version `1.37.2`.

## Manifest Autonomous Growth Engine

- Manifest Intelligence is permanent product architecture. Fresh chats resume from this current-state record, live Lensically state, source-controlled tests, and deployed runtime receipts; no temporary implementation campaign remains active.
- Turns 1 through 4 are complete. The production system has immutable and reconstructable cycle receipts, durable strategy versions, locked hypotheses, exposure revisions, complete lineage, noninterference and follower boundaries, 6/12/18/24-hour maturity evaluation, age-matched comparable cohorts, twelve-level learning, semantic collision prevention, adaptive family portfolio states, controlled experiments, durable confidence transitions, automatic evidence-gated learning briefs, operator benchmarks, run-to-run comparison, enriched Saved Pattern intelligence, bounded conversational audit reads, account-level follower checkpoints, an internal Intelligence dashboard, scheduled-task decision consumption, and per-post decision-influence receipts.
- Manifest's permanent mission is to reach 1,000,000 followers while protecting audience trust, content quality, account safety, and brand identity.
- `autonomous-growth-mission-v2` and `operator-autonomy-governance-v4` make the Lensically Autonomous Business Operator responsible for routine strategy, generation, scheduling, evaluation, recovery, and evidence-triggered engineering. Owner participation is optional criticism, taste, market intelligence, and override—not a production dependency.
- After the fixed key handshake and explicit Proceed, continuity reconciles live schedule and delivery state before selecting the next autonomous action. Stale calendar summaries never override live state, and fresh sessions do not open a mandatory Growth Mission discussion or resume a four-post approval batch.
- `prepare_manifest_autonomous_cycle` persists an exact rolling horizon, preserves existing scheduled posts, identifies missing hourly slots, and returns a bounded decision-intelligence contract containing the latest durable strategy, learning brief, required directives, family priorities, experiments, Saved Pattern candidates, repetition evidence, benchmark response, account-level checkpoint state, and every mandatory generation and scheduling output.
- `persist_manifest_autonomous_post` writes exactly one model-evaluated post into one authoritative missing slot. Each accepted post receives source-or-hypothesis lineage, generation run, draft, mandatory gates, strategy tags, inventory tracking, semantic collision evidence, scheduled-post lineage, an idempotent cycle receipt, and a server-derived decision-influence receipt.
- The rolling runway target is 48 hours. The bootstrap may require two bounded commit calls; after stabilization, a daily run ordinarily replenishes approximately 24 consumed hours rather than creating another 48-post backlog.
- Content selection uses adaptive expected marginal value rather than fixed ratios. Families are evaluated as franchise, core, emerging, prospect, cooling, or dormant from authoritative mature evidence and confidence state. Strong winners keep earning opportunities while age-matched comparable performance remains strong; cooling requires verified recent decay, and frequency alone is never treated as fatigue. Semantic signatures distinguish mechanism reuse from repeated premise, financial scenario, tension, reward, sentence architecture, opening, closing, and meaning before scheduling.
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
- `manifest-measurement-audit-v1` synthesizes authoritative evidence into a durable learning brief and creates a new strategy version only when confidence, effect, decay, disproven-assumption, or terminal-experiment evidence warrants structural change.
- Each autonomous cycle receives persistent operator benchmarks and a direction-aware comparison with the prior cycle. The campaign currently proves 100 routes, 45 live read-only capabilities, and 55 no-side-effect mutation preflights.
- Saved Patterns persist stable identity, semantic mechanism, adaptation boundaries, similarity risk, usage history, mature results, confidence, exclusion state, and reuse state. `get_manifest_intelligence_audit` exposes bounded pageable summary, briefs, benchmarks, comparisons, patterns, follower checkpoints, transitions, portfolio, experiments, decision influence, and evidence gaps without mutating account state. The internal Intelligence page renders these canonical records through the production API.
- Published-post result reads support a compact verification mode that returns bounded lineage, source, source-card, generation-run, draft, and current-metric evidence without the full performance payload.
- Learning uses each post's own views, likes, replies, reposts, quotes, and shares. Follower totals remain account-level trajectory data and are never attributed to a post, day, batch, or posting period.

## Engineering and Release

### White-Label Product Parity

- `lensically-white-label-parity.yml` is the source-owned automation that keeps `profitproperly/Lensically-Operator-Threads` aligned with product-safe Lensically deltas.
- `scripts/white-label-parity.mjs` clones the product repository, classifies source changes as `SYNCED`, `EXCLUDED`, or `PENDING`, copies only allowlisted product-safe files, runs the product repository validation commands, and advances `.lensically-parity/state.json` only after validation succeeds.
- `config/white-label-parity.config.json` is the parity policy. It excludes private continuation/state files, seller-only public/commercial surfaces, production database/migration surfaces, Manifest vault content, and forbidden seller values. Product-relevant changes outside the allowlist are reported as `PENDING` rather than mirrored.
- The scheduled workflow runs every six hours and can also be manually dispatched. It requires the `WHITE_LABEL_PARITY_TOKEN` repository secret with write access to `profitproperly/Lensically-Operator-Threads`; without that token it fails closed and does not pretend parity was written.

### Manifest Innovation Cycle

- Manifest now has two cycle-level rails. The **Innovation Cycle** is the permanent upstream engineering rail; the **Main Cycle** is the protected downstream production rail and authoritative historical truth.
- The one bootstrap clone is complete. Innovation remains at parity with or ahead of Main and sits idle when no manually approved improvement is active. Main is never cloned again.
- A new improvement begins only after an explicit 007-and-M decision. Development, fault injection, stress testing, benchmarking, and end-to-end proof occur only in Innovation. There is no autonomous activation, continuous experimentation, automatic promotion, or automatic next challenger.
- Main is not a test environment. Its server-generated order, mathematics, source exposure, strategies, hypotheses, experiments, generation records, semantic signatures, Content Focus, lineage, learning, and performance evidence are protected from synthetic or partial test artifacts.
- Innovation uses the canonical production schema and production-shaped lineage inside isolated `SHADOW_DB`. Its runtime composition receives no production `DB`; acceptance is snapshot-only, rejects `live_read`, performs no Threads request, and writes benchmark receipts only inside `SHADOW_DB`.
- The verified Innovation flow covers preparation, frozen decision bundle, authoritative source plan, strategy lock, generation, deterministic gates, one-to-four candidate persistence, hypotheses, experiments, decision influences, schedule-shaped rows, complete lineage, one batch reconciliation, completion, replay, retention, cleanup, and compact redacted receipts.
- Exact-head validation `30585818598` passed at source SHA `6792038bd7ba6d72298f2e6264122d3a5b4af382`. The acceptance matrix proves three consecutive no-op runs at or below 30 seconds, three complete 24-slot runs at or below 6 minutes, and three complete 48-slot recovery runs below 10 minutes. The previous 48-slot Main baseline was approximately 3 hours 22 minutes, so the proven recovery ceiling is more than 20 times faster while preserving the required operational contract.
- Release preflight fails if Innovation regains Main database access, exposes live evidence mode, writes benchmark receipts outside `SHADOW_DB`, loses zero-access/redaction regressions, or restores the retired production-bound composition.
- No Innovation code has been deployed or promoted into Main. Production remains exact SHA `0da4252e6c8cc587ba7352b0ba0b50aa40f013db`. Any future promotion requires a new explicit 007-and-M engineering decision and a separate job.

- GitHub `main` is the repository source of truth.
- `ENGINEERING_CONTINUATION.md` is the sole root-level continuation authority for all Lensically work, not only engineering. It contains every accepted incomplete job, deterministic precedence, exactly one active job, and exactly one current action. `getEngineeringContinuation` exposes it directly; D1 work-state tables and action-closure receipts are telemetry and may never override it.
- Stage 4 database authority is enforced by `lensically-worker/database/schema-authority.json` and `scripts/validate-database-authority.mjs`. Release preflight now inventories runtime DDL owners, blocks undeclared sources or duplicate owners, and freezes retired-table recreation debt until migration extraction removes it.

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
- Private operational frontend Cloudflare target: `lensically-web`
- Backend Cloudflare target: `lensically-worker`
- Production API: `api.lensically.com`
- Production public sales web: `lensically.com`
- Production private app web: `app.lensically.com`

## Maintenance Rule

Keep this file limited to current architecture and active behavior. Historical attempts, superseded versions, and retired frameworks belong in Git history, not the live startup context.
