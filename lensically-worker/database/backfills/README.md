# Lensically D1 backfills

Large data rewrites do not belong in `database/migrations` and are never executed by the normal release workflow.

Each backfill must be a source-controlled JSON plan in this directory with:

- `version`: `lensically-d1-backfill-plan-v1`
- a stable `backfill_id`
- database `lensically-db`
- one table and integer primary key
- bounded `batch_size` and `max_batches_per_run`
- one predicate in `where_sql`
- one assignment list in `set_sql`
- `execution_mode`: `explicit_only`
- a concrete rationale

Validate a plan without mutation:

```bash
node scripts/run-d1-backfill.mjs --check --plan database/backfills/<plan>.json
```

Execute or resume one explicitly named operation:

```bash
node scripts/run-d1-backfill.mjs --remote \
  --plan database/backfills/<plan>.json \
  --operation-id <stable-operation-id> \
  --confirm <backfill_id>
```

The runner persists plan identity, cursor progress, batch receipts, changed-row counts, remaining-row counts, status, and failures in D1. Reusing the same operation ID resumes the same unchanged plan. A completed operation is idempotent. A failed operation requires investigation and a new operation ID after the root cause is repaired.
