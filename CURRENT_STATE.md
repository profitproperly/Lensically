# Lensically Current State

## Product Shape

- Lensically is operating as a production app with `lensically-web/` as the frontend and `lensically-worker/` as the backend.
- Main active user workflows currently center on Create Post, Scheduled Posts, dashboard/insights, discovery, search, and archive flows.
- Public compliance routes are `/privacy`, `/terms`, and `/data-deletion`.
- `/dashboard` now targets an operator-dashboard role rather than a simple profile/stats card.
- `/followers` is a dedicated paginated follower-history surface for daily snapshot tracking.

## Core Scheduling State

- `/schedule` is the Create Post surface.
- single-post publishing and scheduling already exist and must remain stable.
- Batch Schedule exists as a manual-only helper inside the Create Post flow.
- Batch Schedule does not use AI generation, taste analysis, or autonomous posting logic.
- Batch Schedule supports:
  - one-off unsaved slot/time structures
  - saved backend presets per user
  - optional favorite presets
  - preview before scheduling
  - scheduling through the existing scheduler

## Scheduled Posts State

- `/scheduled-posts` is the management surface for upcoming scheduled posts.
- It supports edit, retry, single delete, and bulk delete selection mode.
- bulk delete currently reuses the existing delete API in a controlled client loop.

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
- approved implementation tasks should normally be carried through verification, commit, push, and deploy unless the user explicitly says `talk only` or opts out
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
