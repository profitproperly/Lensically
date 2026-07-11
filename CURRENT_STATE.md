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
- Operator Mode has a backend-only MCP/app foundation under `/api/operator/tools/:toolName`. It keeps `/api/gpt/*` intact while adding account-scoped workflow sessions, context admissions, source cards, operator gates, gate results, and content inventory for the universal `content_operator_v1` 1-9 workflow spine.
- Operator Mode also exposes a real JSON-RPC MCP endpoint at `/api/operator/mcp` for ChatGPT App/Connector use. It advertises the 24 core operator tools plus a 21-tool MCP admin surface, supports ChatGPT app OAuth through `/api/operator/oauth/authorize` and `/api/operator/oauth/token`, uses bearer/internal auth at runtime, and returns MCP `structuredContent` around the existing backend tool behavior.
- The MCP admin surface can inspect failures, list/read/patch tool schemas and behavior notes, disable tool advertisements, run built-in MCP checks, manage DB-backed workflow requirements, enforce server-side full preflight before stage advancement, manage gates, submit/gate drafts, store implementation backlog items, and deploy/rollback runtime MCP configuration snapshots. Runtime MCP deploy/rollback is D1 configuration activation inside the Worker; source-code deploy still happens through the repo/Cloudflare deploy path.
- The MCP surface now includes a private GitHub-backed engineering layer for ChatGPT. It can load the non-account `getOperatorStartupContext` bootstrap, engineering precheck/ops memory, inspect GitHub repo files, read/search source, apply exact text patches, do chunked file writes, create/delete files, dispatch GitHub Actions, trigger the backend deploy workflow, verify deployed MCP initialization, and record engineering audit entries. GitHub is the source of truth when ChatGPT edits through this layer; Codex should pull latest `origin/main` before Lensically project work.
- Fresh ChatGPT MCP sessions should call `getOperatorStartupContext` before Lensically engineering/admin/workflow/account work. The bootstrap returns live tool count, tool categories, repo/branch/SHA, MCP version, runtime deployment, startup docs, OpsMemory, recent failures/fixes, open implementation backlog, universal workflow requirements, and fallback routes without loading account state, workflow status, source cards, drafts, scheduled posts, gates, strategy memory, or metrics. Key selection is now backend-enforced per MCP session: `selectOperatorKey` returns the exact four-line handshake, account-scoped tools remain blocked, and `confirmOperatorProceed` opens the selected account only after explicit user approval.
- Operator Mode v1 can start workflow sessions, admit context with partial/complete coverage, list production board items and source candidates, create/lock source cards, create generation runs, submit gated candidate drafts, block failed drafts from being shown, approve/reject shown drafts into strategy memory, schedule approved drafts, list/create gates, and promote strategy memory into account-scoped gates.
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
