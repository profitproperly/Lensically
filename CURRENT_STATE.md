# Lensically Current State

## Product Shape

- Lensically is operating as a private workspace build with `lensically-web/` as the frontend and `lensically-worker/` as the backend.
- Main active user workflows currently center on the password gate, Create Post, Scheduled Posts, GPT Memory, saved patterns, dashboard, insights, followers, and post archive flows.
- Public compliance routes are `/privacy`, `/terms`, and `/data-deletion`.
- `/dashboard` now targets an operator-dashboard role rather than a simple profile/stats card.
- `/followers` is a dedicated paginated follower-history surface for daily snapshot tracking.

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
- bulk delete currently reuses the existing delete API in a controlled client loop.
- Scheduled posts can be tagged with flexible strategy metadata: pillar, hook style, format, intent, experiment, and novelty level.
- Scheduled strategy tags are descriptive signals for GPT growth review and novelty/fatigue analysis, not rigid content categories.
- GPT growth and generation contexts link posted scheduled-post strategy tags back to archived post metrics and follower-day movement when possible, exposing tagged post results and tag-performance summaries for growth review and pre-generation decisions.

## GPT Operator State

- Lensically Operator is a Custom GPT connected to `/api/gpt/*` actions with API-key auth.
- `LENSICALLY_OPERATOR_GPT.md` is the repo-owned source of truth for the Operator GPT operating loop, learning rules, growth rules, action set, and schema-refresh notes.
- GPT actions expose an operator playbook, compact brand context, generation context, generation brief, taste interview, draft similarity, saved patterns, recent posts, growth context/review, rule suggestions, novelty fatigue, scheduled posts, scheduling, batch presets, strategy memory, generation runs/drafts, taste feedback, rule review, experiments, and pattern adaptations.
- GPT Memory in Lensically is available at `/gpt-memory` for reviewing brand-specific taste notes, current beliefs, rules, pattern adaptations, experiments, generation runs, growth prompts, novelty/fatigue signals, and generation readiness.
- GPT strategy memory supports edit/archive updates through GPT action `updateStrategyMemory` and browser-safe `/api/gpt-memory/strategy-memory/update`; archived memory keeps audit history and normal edits preserve archive state unless explicitly changed.
- Browser-safe `/api/gpt-memory/*` routes let Lensically UI save taste feedback, rule reviews, experiments, saved-pattern reviews, generation brief checks, draft approval/rejection feedback, and strategy-memory edits without exposing the GPT API key.
- GPT Memory review separates active, archived, and all strategy memory; archived memory can be restored from the UI without deleting the original audit trail.
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
