# Lensically Continuation Ledger

status: active
updated_at: 2026-07-30
repository: profitproperly/Lensically
branch: main
continuation_contract: canonical-continuation-v1
active_job_id: manifest-shadow-cycle-and-sub-ten-minute-optimization
active_checkpoint: stage_1_in_progress
implementation_source_head: debf4dfbf3969c2a385fa9f848c5f0b80b510b09
production_sha: 04e682e8a69fef5222fd713a019682e7edcfda0a

This root file is the sole authority for all incomplete Lensically work. Chat history, D1 work-state tables, action-closure receipts, Growth Mission records, and other documents may provide evidence but may not establish, reorder, or resume work.

## Authority and Precedence

1. A directly verified P0/P1 security, data-loss, credential, production-safety, or irreversible incident may interrupt normal work only after its concrete production harm is established and recorded here.
2. A failed diagnostic, stale mirror, repository/production mismatch, or verifier false negative is not a P0/P1 when the affected production capability succeeds directly.
3. Otherwise execute exactly the one ACTIVE job and Current Action below.
4. The owner's newest explicit ordering instruction may change the queue; record that change here before execution.
5. D1 execution state is non-authoritative telemetry. This file wins every conflict.
6. Keep one active outcome, freeze its acceptance contract before validation, and reject unrelated scope until the active outcome closes.

## Unified Job Queue

### ACTIVE — Manifest Shadow Cycle and Sub-Ten-Minute Optimization

job_id: `manifest-shadow-cycle-and-sub-ten-minute-optimization`

Owner objective:

- Create a reusable end-to-end Manifest cycle testing environment that can repeatedly exercise normal 24-post replenishment and full 48-post recovery without scheduling or publishing test posts and without corrupting production lineage, source exposure, strategy history, hypotheses, experiments, semantic signatures, Content Focus, learning, or performance math.
- Use the harness to reduce the complete model-orchestrated cycle below ten minutes, including the 48-post recovery case. Normal 24-post operation should be materially faster.
- Do not restore the autonomous daily generation trigger until the shadow acceptance matrix and one bounded live adoption verification pass.

### Frozen architectural decision

Implement one **physically isolated, disposable Shadow Cycle workspace** using a dedicated Cloudflare D1 binding named `SHADOW_DB`.

- Production and shadow use the same canonical migrations and the same production domain services.
- Shadow behavior differs only at dependency-composition boundaries: database binding, evidence input adapter, schedule destination, external Threads mutation boundary, receipt sink, and clock/scenario overlay.
- Do not duplicate Manifest business logic or create a second growth engine.
- Do not add `is_test` rows to production operational tables.
- Do not generate in production and delete afterward.
- Do not depend on cross-call transaction rollback.
- Do not use real schedule slots as test inventory.
- Do not permit any Threads write or publish request from a shadow run.

### Disposable workspace model

Version 1 supports exactly one active detailed shadow run at a time.

- Before a new run, reset production-shaped operational tables inside `SHADOW_DB`, then seed a frozen production evidence snapshot.
- Preserve production IDs where safe because physical database isolation prevents collision.
- Every run receives a unique `shadow_run_id`, stable idempotency root, snapshot hash, scenario, variant key, and exact code SHA.
- Success details expire after 72 hours by default.
- Failed-run diagnostics retain for up to 14 days.
- A requested detail-retention override is bounded to 14 days; indefinite pinning is forbidden.
- A compact benchmark receipt remains permanently in the dedicated production table `manifest_shadow_benchmark_receipts`; it contains no generated post text and is excluded from all Manifest intelligence and learning queries.
- Cleanup runs before each preparation and once through an existing maintenance/cron path. It must delete expired snapshots, posts, strategies, hypotheses, experiments, signatures, lineage, events, and archives and verify zero orphans.
- No concurrent shadow runs, dashboard, or generalized test-platform infrastructure in Version 1.

This disposable model is intentional. Mixing multiple runs inside production-shaped tables would require run-scoping every existing query and would recreate the same contamination risk inside the shadow database. Sequential reset-and-seed preserves exact production schema behavior and keeps the first implementation bounded.

### Evidence modes

Each run uses one of two explicit modes:

1. `snapshot` — default for repeated speed, strategy, gate, recovery, and refactor tests. Reads a frozen bounded production snapshot and performs no Threads network calls.
2. `live_read` — bounded acceptance mode. Uses existing read-only Threads collection paths to capture current evidence but still writes only to `SHADOW_DB` and cannot reach scheduling or publishing mutations.

A production snapshot contains only data required by the current Manifest contract:

- rolling 28-day post evidence and age-matched maturity records,
- relevant metric snapshots and newest-40 collection state,
- active learning brief, Content Focus, benchmarks, comparisons, portfolio states, experiments, and confidence transitions,
- locked eligible source cards, source families, source exclusions, Saved Pattern intelligence, and hard bans,
- current scheduled and published exposure needed for repetition and placement,
- account/profile identity required by the existing services,
- the current strategy authority and scheduler/delivery state needed for reconciliation.

It is not a full production database export.

### Read-only production boundary

The shadow orchestration path may never receive unrestricted production `DB` access after snapshot capture.

- Build one source-defined snapshot reader through a read-only D1 wrapper that rejects any SQL statement other than approved `SELECT`/read CTE statements.
- Seed and execute exclusively through `SHADOW_DB` after capture.
- Write the compact benchmark receipt only after noninterference verification, through one dedicated receipt writer that cannot access operational production tables.
- Focused tests must make every attempted production mutation fail immediately.
- Release preflight must reject shadow code that imports or invokes production schedule creation, Threads publishing, or unrestricted production D1 mutation routes.

### Reusable future testing boundary

The Shadow Cycle is a permanent Manifest engineering laboratory for:

- 24-slot normal replenishment,
- 48-slot recovery,
- source-selection changes,
- strategy-contract changes,
- prompt and generation changes,
- gate changes,
- batch persistence,
- failure recovery and idempotent replay,
- refactors,
- A/B operational comparisons from the same frozen snapshot.

A/B runs reuse the same snapshot hash sequentially and receive different variant keys. Shadow output never becomes input to a later run unless the test explicitly reuses the frozen production snapshot. Fake engagement is never synthesized into learning truth. The harness can compare speed, source choices, diversity, novelty, gates, lineage, and operational outcomes; it cannot prove which strategy will earn more real likes without live audience evidence.

## Baseline Evidence

The most recent 48-slot production restoration cycle ran from `2026-07-29T23:58:59.033Z` to `2026-07-30T03:21:14.632Z`, approximately 3 hours 22 minutes 15 seconds.

- Authoritative slots: 48
- Cycle events: 221
- Hypotheses: 48
- Preparation currently advances through repeated client calls for live collection, evaluator work, semantic signatures, maturity evaluations, comparables, bounded learning batches, portfolio/experiments, measurement audit, Content Focus, and construction.
- Current persistence is one post per external call and performs per-post gates, lineage, experiment assignment, decision influence, coverage reconciliation, and completion checks.
- Current production scheduler remains enabled, healthy, and publishing existing legitimate inventory. This job does not pause it.
- Repository head `9e4e6da00bc2a52fe33e2970f0131a023973c8d9` differs from deployed code only by the canonical continuation update. Exact-SHA validation, Operator tests, typecheck, deployment, and live production verification succeeded for code SHA `04e682e8a69fef5222fd713a019682e7edcfda0a`.

## Implementation Stages

### Stage 0 — Contract and Failure-Mode Review — COMPLETE

Completed planning inspection:

- canonical continuation reconciled,
- current repository and production identities reconciled,
- Worker D1 binding and migration authority inspected,
- Manifest preparation, construction, strategy, persistence, lineage, and test seams inspected,
- production write contamination risk confirmed,
- repeated preparation-call latency confirmed,
- one-post persistence overhead confirmed,
- strongest architecture risks challenged and resolved below.

Scope is now frozen. New enhancements remain deferred unless they are required to satisfy the acceptance contract.

### Stage 1 — Physical Isolation Foundation

Implement the disposable shadow workspace without changing production Manifest behavior.

Required work:

1. Provision and bind `SHADOW_DB` through the normal protected Cloudflare/GitHub release path; no owner credential work.
2. Extend canonical migration release authority so the same `database/migrations` set is applied and verified against both `DB` and `SHADOW_DB`. Do not create a second migration policy or copied schema directory.
3. Add the canonical migration for:
   - `manifest_shadow_runs`,
   - `manifest_shadow_snapshots`,
   - `manifest_shadow_stage_events`,
   - `manifest_shadow_diagnostic_archives`,
   - `manifest_shadow_benchmark_receipts`,
   - cleanup/lease fields required for one active disposable workspace.
4. Implement the read-only production snapshot reader and SQL mutation rejection.
5. Implement shadow reset, bounded snapshot seeding, retention, stale-run recovery, and orphan verification.
6. Implement shadow-only schedule persistence and a no-Threads-mutation adapter.
7. Add focused tests proving:
   - production D1 mutation attempts fail,
   - Threads write attempts fail,
   - reset removes every prior operational artifact,
   - canonical migrations produce schema parity,
   - benchmark receipts cannot enter production intelligence queries.

Stage 1 release changes infrastructure only. No public Shadow Cycle tools and no production cycle behavior switch occur until isolation tests pass.

### Stage 2 — Production-Parity Shadow Runtime

Compose existing production services against `SHADOW_DB`.

Required work:

1. Add one direct shadow runtime composition; do not add `if shadow` branches throughout domain services.
2. Reuse the canonical services for:
   - preparation checkpoints,
   - cycle construction,
   - source selection and locking,
   - rolling evidence and exposure snapshots,
   - strategy validation and locking,
   - candidate admission,
   - deterministic gate execution,
   - hypothesis and experiment records,
   - schedule persistence,
   - complete lineage,
   - semantic signatures,
   - decision influence,
   - coverage reconciliation,
   - completion receipts.
3. Extract only narrow dependency seams where existing code closes directly over `env.DB`, production schedule creation, live collection, or external publishing state.
4. Add parity regressions that run identical frozen fixtures through the production service composition and shadow composition and compare authoritative source plan, gates, lineage completeness, remaining coverage, and completion status.
5. Register the minimum direct typed public tools through the mandatory capability lifecycle:
   - `prepare_manifest_shadow_cycle`,
   - `commit_manifest_shadow_cycle_strategy`,
   - `persist_manifest_shadow_batch`,
   - `get_manifest_shadow_cycle_receipt`.
6. The tools are Manifest-only, idempotent, closed-schema, server-bounded, and cannot mutate production account state.

### Stage 3 — Preparation Orchestration and Delta Learning

Remove mechanical client orchestration while preserving correctness and recovery.

Required work:

1. Keep durable preparation checkpoints as internal recovery state.
2. Add one server orchestrator that advances deterministic preparation phases in sequence until complete or until a real Worker time/subrequest safety threshold requires a continuation.
3. Normal snapshot preparation target: one external call.
4. Live-read preparation target: one external call, maximum two when bounded external collection requires continuation.
5. Stop recomputing the complete intelligence stack during every daily cycle.
6. Make the four daily Insights/learning windows maintain semantic signatures, maturity, comparables, learning observations, portfolio states, experiments, measurement audit, and Content Focus continuously.
7. Daily preparation consumes the latest valid durable snapshot and refreshes only newly due or stale deltas.
8. A full intelligence rebuild remains an explicit repair path when staleness, missing checkpoints, or integrity gates prove it is required.
9. Staleness and due-checkpoint gates fail closed; speed may never consume incomplete evidence silently.

### Stage 4 — Complete Decision Bundle and Server-Owned Deterministic Gates

Reduce model payload and repeated manual evidence work without removing model judgment.

Required work:

1. Build one versioned compact decision bundle from the complete rolling evidence snapshot.
2. Preserve the full evidence pages and their hashes durably for audit, but let strategy commit verify one consumed bundle ID instead of requiring the model to call every page individually.
3. The bundle must include exact IDs and material exceptions for:
   - strongest and weakest mature posts,
   - family performance and confidence,
   - recent and future exposure,
   - source eligibility and locked source plan,
   - active experiments and unresolved evidence gaps,
   - hard bans and required directives,
   - current strategy authority and change threshold.
4. When the bundle flags a genuine ambiguity, allow one bounded detail read; do not restore routine page-by-page consumption.
5. Move every deterministic hard-ban, exact duplicate, slot, source-lineage, and server-computable repetition check entirely server-side.
6. The model remains responsible for strategy, wording, adaptation fidelity, novelty judgment, audience reward, placement, and responses to real candidate failures.
7. Remove the requirement for repetitive model-written hard-ban pass evidence when the server can evaluate the exact text itself.

### Stage 5 — Four-Post Batch Persistence

Reduce external round trips while preserving item-level correctness.

Required work:

1. Extract one shared candidate persistence core and one shared post-batch reconciliation step.
2. `persist_manifest_shadow_batch` accepts one to four exact planned candidates.
3. Each candidate keeps its own operation ID, source selection, plan item, gates, hypothesis, lineage, experiment, decision influence, and result.
4. One candidate failure does not roll back or hide successful siblings.
5. Reconcile authoritative coverage once after the batch, not after every item.
6. Return exact rejected slots and reasons for selective regeneration.
7. Preserve the existing production single-post tool initially as a size-one wrapper around the shared core.
8. Only after shadow acceptance, adopt the same four-post wrapper for production and retire duplicated per-post reconciliation logic.
9. Default model generation chunk is eight candidates, persisted through two four-post calls; the model may use smaller chunks when payload or quality evidence requires it.

Expected external persistence calls:

- 24 missing posts: 6 calls.
- 48 missing posts: 12 calls.

### Stage 6 — Timing Instrumentation and Acceptance Matrix

Every run must produce an immutable compact benchmark receipt containing:

- run ID, scenario, variant key, evidence mode, snapshot hash, code SHA, contract versions,
- target, occupied, generated, accepted, rejected, and remaining counts,
- preparation-phase timings,
- evidence-bundle timing and size,
- strategy timing,
- model/client gaps measured between server response and next request arrival,
- gate, persistence, lineage, reconciliation, cleanup, and total wall-clock timing,
- external read count, retries, continuation count, payload bytes,
- production noninterference result,
- cleanup/orphan result,
- pass/fail and exact failed acceptance rule.

Required scenarios:

1. Fully covered no-op.
2. Normal 24-slot replenishment.
3. Full 48-slot recovery.
4. Mid-batch occupied-slot collision.
5. Deterministic gate rejection and selective regeneration.
6. Interrupted call with idempotent replay.
7. Stale intelligence requiring bounded delta refresh.
8. Invalidated planned source requiring authoritative replacement.
9. Failed shadow run retained for diagnosis and later cleanup.
10. Same-snapshot A/B operational comparison.
11. Live-read collection with zero Threads mutations.
12. Production noninterference verification after every case.

Performance acceptance:

- No-op: three consecutive runs at or below 30 seconds.
- Snapshot 24-slot cycle: three consecutive complete runs at or below 6 minutes.
- Snapshot 48-slot cycle: three consecutive complete runs below 10 minutes.
- Live-read 24-slot cycle: one complete run below 10 minutes.
- Zero unresolved lineage, gate, schedule, cleanup, or contamination defects.
- No production mutation outside the compact benchmark-receipt table.
- No Threads mutation request.

These are wall-clock requirements, not server-only timings. Model/client gaps and tool round trips count.

### Stage 7 — Production Adoption, Canary, and Trigger Restoration

Production changes occur only after Stage 6 passes.

Required work:

1. Switch production preparation to the accepted shared orchestrator and delta-learning path.
2. Switch production strategy consumption to the complete decision bundle.
3. Switch production persistence to the accepted four-post wrapper while keeping item-level idempotency and selective failure handling.
4. Remove the retired page-by-page normal path, repeated client-driven preparation loop, manual deterministic hard-ban evidence requirement, and duplicated per-post reconciliation path. Git history is the archive.
5. Run focused validation, exact-head Operator coverage required by the change, one exact-SHA production release, and independent live runtime verification.
6. Execute one legitimate live canary against real missing inventory. Do not create artificial live slots or junk posts.
7. Verify exact schedule coverage, scheduler health, complete lineage, zero overdue rows, and benchmark timing.
8. Restore the autonomous daily generation trigger only after the canary passes.
9. Keep the existing scheduled-post publishing scheduler enabled throughout unless a concrete scheduler incident independently requires containment.

### Stage 8 — Closure and Permanent Prevention

1. Update `CURRENT_STATE.md` and `OPERATING_MEMORY.md` only with the final live architecture and reusable constraints.
2. Add release-preflight guards preventing:
   - production-table test flags,
   - shadow access to production mutation APIs,
   - Threads writes from shadow code,
   - duplicate shadow business logic,
   - intelligence queries reading shadow benchmark tables,
   - restoration of routine page-by-page strategy consumption,
   - restoration of per-post coverage reconciliation when batch reconciliation is active.
3. Run automatic cleanup and prove zero expired detail rows and zero orphans.
4. Compress this continuation entry to a completed receipt with exact SHAs, workflow runs, benchmark results, and live verification.

## Stress-Test Findings and Resolutions

### Risk 1 — Shadow logic drifts from production

Resolution: production services are reused through dependency injection. Shadow-only code is limited to adapters, snapshot/reset, orchestration, and receipts. Parity tests and release preflight reject copied business logic.

### Risk 2 — One missed filter corrupts production learning

Resolution: no test rows enter production operational tables. Physical `SHADOW_DB` isolation replaces filtering. The production snapshot path is read-only and mutation-trapped.

### Risk 3 — Multiple shadow runs collide inside production-shaped tables

Resolution: Version 1 serializes runs and resets one disposable workspace before seeding. Concurrency is explicitly excluded.

### Risk 4 — Snapshot copying becomes slower than the cycle

Resolution: seed only the bounded evidence contract, reuse a frozen snapshot for repeated variants, instrument snapshot capture and seeding separately, and fail acceptance if setup dominates total time.

### Risk 5 — Faster preparation consumes stale learning

Resolution: Insights maintains intelligence continuously; preparation checks freshness and due checkpoints and performs bounded delta repair. Missing or stale authoritative evidence blocks strategy rather than silently downgrading correctness.

### Risk 6 — Server orchestration exceeds Worker limits

Resolution: advance phases until a measured safety threshold, persist the checkpoint, and return one precise continuation. Normal target is one call; bounded continuation remains a recovery mechanism, not routine client choreography.

### Risk 7 — Batch persistence hides partial failure

Resolution: each item is independently idempotent and returns its own result. Successful siblings remain authoritative; failed slots are returned for selective regeneration; coverage reconciles once after the batch.

### Risk 8 — Shadow strategy tests imply fake performance certainty

Resolution: no generated engagement is treated as evidence. Operational A/B comparison is allowed; real winner claims require mature live audience metrics.

### Risk 9 — The harness becomes a second product

Resolution: no UI, dashboard, concurrent runner, generic simulation framework, or arbitrary account support in Version 1. The implementation exists only to validate and accelerate the Manifest cycle.

## Explicit Exclusions

- No simulated likes, views, replies, reposts, quotes, shares, or follower attribution as learning truth.
- No production post creation followed by deletion.
- No real Threads scheduling or publishing from shadow.
- No production operational-table `test`, `shadow`, or `dry_run` rows.
- No separate copied migration directory.
- No duplicated Manifest strategy, source-selection, gate, lineage, or learning engine.
- No shadow dashboard.
- No concurrent shadow runs in Version 1.
- No unrelated product or account work until this active outcome closes.

## Current Action

Execute **Stage 1 — Physical Isolation Foundation** only:

1. Re-read the current repository head after this plan-lock commit.
2. Implement the dedicated `SHADOW_DB` binding and canonical dual-database migration verification.
3. Implement the read-only production snapshot boundary, disposable reset/retention schema, shadow-only schedule adapter, and zero-Threads-write guard.
4. Add focused isolation, schema-parity, cleanup, and noninterference regressions.
5. Run the smallest complete validation proving Stage 1.
6. Record the checkpoint here before starting Stage 2.

Do not add public Shadow Cycle tools, change production Manifest behavior, restore the autonomous generation trigger, or begin speed optimization before Stage 1 isolation is verified.

## Completed Work

### Manifest Autonomous Posting Restoration — COMPLETE

- Canonical cycle `eb525a40-375f-4a34-89ee-0a65f83610c0` completed with 48/48 occupied slots, complete lineage, zero unresolved defects, and strategy `c16f4320-6542-439b-9536-8ceeac41907f`.
- Exact production code SHA: `04e682e8a69fef5222fd713a019682e7edcfda0a`.
- Scheduler verified enabled, healthy, operational, publishing enabled, zero overdue, and zero quarantined posts.

### Worker Monolith Refactor — COMPLETE

- All nine stages are complete and deployed.
- Canonical service extraction, database authority, direct typed MCP, validation modernization, release hardening, and stale-residue cleanup are permanent architecture.
- Completed implementation detail remains in Git history and engineering audit records.

## Rewrite Contract

- Keep exactly one authoritative `ENGINEERING_CONTINUATION.md` at repository root.
- Keep exactly one ACTIVE job and one Current Action.
- Keep only accepted incomplete work in the active queue.
- Keep completed detail compact; Git history, workflow runs, benchmark receipts, and engineering audit are the archive.
- Rewrite this file after every meaningful stage checkpoint, verified interrupt, acceptance change, or completion.
- Never create a competing continuation or implementation-plan file.
