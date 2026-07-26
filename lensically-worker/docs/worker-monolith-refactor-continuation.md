# Worker Monolith Refactor — Temporary Continuation

This file is the authoritative fresh-chat continuation until all nine implementation stages are complete. Do not reconstruct the next action from chat history, stale Growth Mission diagnostics, or old operator decision records.

## Objective

Complete the audited staged cleanup and modularization of `lensically-worker/src/index.ts` while preserving production behavior, autonomous operation, scheduling, publishing, analytics, lineage, intelligence, and exact-SHA release safety.

## Current production state

- Production and repository head: `a2e5a163dfb864923aa9ac3072154ed162ed5ed3`
- Stage 3 release workflow: `30194883392`
- Final Stage 3 eight-shard validation: `30194807934`
- No temporary migration workflow, marker, or write permission remains.
- GitHub workflow permissions are restored to `contents: read`.

## Stage status

1. Characterization and safety baseline — COMPLETE
2. Physical legacy removal — COMPLETE AND DEPLOYED
3. Human-free workflow consolidation — COMPLETE AND DEPLOYED
4. Database authority — NEXT
5. MCP modularization — PENDING
6. Product-service extraction — PENDING
7. Router and runtime composition — PENDING
8. Test and release modernization — PENDING
9. Final comparison and production release — PENDING

## Immediate next action: Stage 4 — Database authority

Perform a repository-grounded Stage 4 implementation. The required outcome is one canonical, versioned database migration authority with one schema owner per table.

Required work:

- Inventory every active runtime `ensure*`, inline `CREATE TABLE`, `ALTER TABLE`, trigger, compatibility rebuild, and retirement operation still executed from application code.
- Map each active table to its canonical migration and runtime consumers.
- Resolve duplicate schema ownership, including `operator_post_metric_snapshots`.
- Move table creation, indexes, triggers, column additions, and compatibility rebuilds out of request preparation into explicit versioned migrations.
- Drop or permanently retire obsolete human-guidance, workflow-session, review-batch, GPT strategy-memory, Agent, local-execution, and legacy automation tables where still present.
- Reduce runtime preparation to bounded integrity checks only where genuinely necessary.
- Ensure autonomous-cycle and engineering tools do not prepare retired schema.
- Preserve all active scheduling, publishing, archive, Insights, Saved Patterns, source-card, lineage, intelligence, gate, incident, decision, and cycle-receipt data.
- Add focused migration, fresh-database, existing-database upgrade, idempotency, and production-characterization tests.

Stage 4 completion requires:

- TypeScript and lifecycle validation green.
- Push validation green.
- All eight operator shards green on one exact SHA.
- Exact-SHA Worker and web release green.
- Wrangler cron verification green.
- Live production runtime, scheduler, retained website, and retired-surface verification green.
- Production commit independently confirmed.

## Fresh-chat startup procedure

1. Discover `Lensically_Operator_Mode` tools before claiming the project state is unavailable.
2. Read this file.
3. Call `getRepoStatus` and verify the repository/production SHA against the value above.
4. If the SHA differs, inspect intervening commits and validation runs before continuing.
5. Resume the first incomplete stage only. Do not restart Stages 1–3.
6. Do not generate, schedule, delete, or publish posts during Worker engineering unless the owner explicitly requests it.
7. Use bounded, fail-closed changes. On any block: stop, fix root cause, add prevention or regression coverage, then resume.
8. Validate and release each stage independently before moving to the next.
9. Update this file after every completed stage with the new production SHA, workflow run, validation run, and next stage.

## Important stale state warning

Current autonomy/Growth Mission records may still mention completing human-guidance retirement, running the prepared autonomous cycle, old workflow sessions, or `Close atomic_write_reconciliation`. Those records are not the continuation authority for this engineering initiative. This file and live repository evidence are authoritative until Stage 9 is complete.
