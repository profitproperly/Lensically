# Lensically Production Backup & Disaster Recovery Runbook

## Scope

This runbook covers production data protection and recovery for the Cloudflare D1 database used by `lensically-worker`.

Primary production database:

- Cloudflare D1 database name: `lensically-db`
- D1 binding in worker config: `DB`
- Worker config path: `lensically-worker/wrangler.jsonc`

## Current Backup Posture (Repository Audit)

Observed from repository configuration:

1. Production backend uses Cloudflare D1 via `lensically-worker/wrangler.jsonc`.
2. No dedicated backup workflow/job configuration is present in this repository today.
3. Existing cron (`0 3 * * *`) is used for token refresh logic, not backup export.
4. No prior backup/disaster-recovery runbook existed in repo docs.

Conclusion:

- Recovery currently depends on D1 Time Travel retention, with no repo-managed long-term archive workflow yet.

## Recovery Objectives

- Target RPO (Recovery Point Objective): <= 60 minutes using D1 Time Travel bookmarks.
- Target RTO (Recovery Time Objective): <= 60 minutes for restore + application health validation.
- For incidents older than Time Travel retention window, restore from exported SQL archives (R2/off-platform archive) when available.

## Backup Strategy

### 1. Native D1 Time Travel (Primary)

- D1 Time Travel is the default short-term backup and point-in-time recovery control.
- Expected retention:
  - Workers Paid: up to 30 days.
  - Workers Free: up to 7 days.
- Engineers must verify the deployed database is on production storage and not legacy alpha.

### 2. Export Archives (Secondary, Long-Term)

- Run a scheduled export from D1 to protected storage (R2) for retention beyond Time Travel windows.
- Minimum export cadence:
  - Daily full SQL export.
  - Weekly "golden" export retained longer than daily exports.
- Minimum retention policy:
  - Daily exports: 35 days.
  - Weekly exports: 12 weeks.
  - Monthly exports (optional but recommended): 12 months.

Recommended implementation path:

- Use Cloudflare Workflows + D1 export API + R2 storage.
- Reference: Cloudflare "Export and save D1 database" workflow example.

## Account Deletion State & Backup Recovery Rules

`account_deletion_tombstones` and `banned_identities` are authoritative identity-control tables.

Non-negotiable recovery rule:

- After any restore, do not consider the system fully recovered until deletion-state controls are validated.
- A restored snapshot must not allow previously deleted or banned identities to regain access because of rollback timing.

Operational requirements:

1. Preserve tombstone records for the active retention window used by account lifecycle enforcement.
2. Preserve all active ban records.
3. If restore point predates deletion/ban events, re-apply missing records from the incident ledger/change log before full go-live.
4. Keep these controls authoritative over user recreation and authentication decisions after restore.

## Access Control Requirements

### Operational Access Model

1. Only designated on-call/platform engineers may run restore commands.
2. Use least-privilege Cloudflare API tokens:
   - restore-capable token only for recovery operators
   - separate read-only/validation token where possible
3. Store recovery tokens only in approved secret stores (never in repo, never in plain text docs).
4. Enforce token rotation and expiry (short TTL preferred for break-glass tokens).
5. Restrict token use by IP and/or policy controls when available.
6. Require auditability:
   - preserve incident ticket ID
   - record actor, timestamp, restore target bookmark/timestamp
   - retain Cloudflare audit logs for the operation

### Data Handling During Recovery

1. Export files are sensitive production data and must be encrypted at rest.
2. Access to backup buckets must be limited to recovery operators.
3. Do not download production backups to unmanaged personal devices.

## Standard Operating Procedure (Restore)

All commands run from repository root unless noted.

### A. Incident Triage

1. Confirm incident type: accidental delete/update, corruption, failed migration, or operational outage.
2. Open incident ticket and assign incident commander.
3. Decide recovery target timestamp/bookmark.

### B. Pre-Restore Safety Checks

1. Verify database backend version:
   - `npx wrangler d1 info lensically-db`
2. Retrieve current bookmark before restore:
   - `npx wrangler d1 time-travel info lensically-db`
3. Save current bookmark in incident ticket as rollback target.

### C. Execute Restore

1. Restore to intended timestamp:
   - `npx wrangler d1 time-travel restore lensically-db --timestamp="<RFC3339_OR_UNIX_TIMESTAMP>"`
2. Or restore directly to a bookmark:
   - `npx wrangler d1 time-travel restore lensically-db --bookmark="<BOOKMARK>"`
3. Confirm restore completion output and capture the "previous bookmark" returned by command output.

### D. Post-Restore Validation

1. Run backend worker checks via the normal task registry.
2. Validate critical workspace journeys:
   - workspace unlock and protected route access
   - Threads account read paths
   - dashboard, insights, followers, and archive loads
   - publish and scheduling flows
3. Validate data integrity queries against current workspace tables (`users`, `threads_accounts`, `app_threads_accounts`, `scheduled_posts`, and related insights/follower caches).
4. Confirm scheduled jobs resume normally after restore and that recent worker logs show successful Threads reads and scheduled task execution.
5. Monitor worker error logs and D1 query error rates for at least 30 minutes after restore.

### F. Deletion-State Verification Procedure (Required)

Run these checks against the restored DB before declaring incident resolved.

1. Verify tables exist:
   - `npx wrangler d1 execute lensically-db --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('account_deletion_tombstones','banned_identities');"`
2. Verify tombstones still inside retention:
   - `npx wrangler d1 execute lensically-db --command="SELECT COUNT(*) AS active_tombstones FROM account_deletion_tombstones WHERE expires_at > CURRENT_TIMESTAMP;"`
3. Verify active bans:
   - `npx wrangler d1 execute lensically-db --command="SELECT COUNT(*) AS active_bans FROM banned_identities WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;"`
4. Spot-check affected identities from the incident window:
   - email tombstones present
   - provider identity tombstones present (google/github/discord) where applicable
   - bans present for known blocked identities
5. If any required records are missing:
   - re-apply them from audited source-of-truth records
   - rerun step 2-4
   - only then proceed with full recovery sign-off

### E. Undo Restore (If Needed)

1. Use the pre-restore bookmark captured in step B/C.
2. Run:
   - `npx wrangler d1 time-travel restore lensically-db --bookmark="<PREVIOUS_BOOKMARK>"`
3. Repeat post-restore validation.

## Periodic DR Preparedness

1. Perform one scheduled recovery drill per month in non-production.
2. Perform one supervised production tabletop drill per quarter.
3. After each drill or incident, update this runbook with:
   - actual RPO/RTO
   - failure points
   - procedural improvements
4. Include at least one drill scenario where restore point predates account deletion events, and verify tombstone/ban re-application workflow.

## Verification Checklist

Run these checks at least monthly:

1. `wrangler d1 info` shows production storage/time-travel-capable backend.
2. Time Travel restore permissions are limited to intended operators.
3. Backup export job is running on schedule (if configured).
4. Retention rules exist and match policy in this runbook.
5. Latest restore drill record exists and includes timestamp, owner, and outcomes.

## References

- D1 Time Travel and backups:
  - https://developers.cloudflare.com/d1/reference/time-travel/
- D1 platform limits (retention windows):
  - https://developers.cloudflare.com/d1/platform/limits/
- D1 import/export commands:
  - https://developers.cloudflare.com/d1/wrangler-commands/
  - https://developers.cloudflare.com/d1/best-practices/import-export-data/
- Workflow example for D1 export to R2:
  - https://developers.cloudflare.com/workflows/examples/backup-d1/
