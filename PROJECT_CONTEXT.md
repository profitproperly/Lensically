# Lensically — Project Context

## Project
Lensically

## Stack
Next.js App Router
OpenNext for Cloudflare
Cloudflare Workers
Cloudflare D1
Tailwind CSS

## Architecture

lensically-web
Production frontend in `lensically-web`, built with Next.js App Router and deployed with OpenNext on Cloudflare. It serves the public landing page, login, signup, verify-email, forgot-password, reset-password, and public compliance pages at `/terms`, `/privacy`, and `/data-deletion`, plus authenticated app routes including `/dashboard`, `/connect`, `/insights`, `/account`, `/discovery`, `/search`, and `/schedule`. Session state is driven by `AuthProvider`; the shared `(internal)` layout centrally gates authenticated routes with login redirect behavior and a session-expired re-auth prompt.

lensically-worker
Production backend in `lensically-worker`, implemented as a Cloudflare Worker with D1-backed auth and Threads integration. It owns email/password auth, secure session cookies, current-user lookup, email verification, password reset, account deletion, Google/GitHub/Discord OAuth login, Threads OAuth connection/disconnect, Meta Threads deletion and uninstall callbacks, usage enforcement, profile lookup, keyword search, post publishing, insights fetches, and token refresh handling. Auth request validation, D1-backed auth rate limiting, response sanitization, route hardening for internal/admin paths, and sanitized operational logging are part of the worker surface. Auth and OAuth origin handling are centralized through `APP_URL`, `ROOT_SITE_URL`, and `WORKER_ORIGIN`.

Legacy directories
Root-level `server`, `client`, `database`, and `migrations` directories remain from older scaffolding. Current production behavior is centered on `lensically-web` and `lensically-worker`.

## Database
Cloudflare D1

Core persisted tables:
users
sessions
oauth_accounts
email_verification_tokens
password_reset_tokens
auth_rate_limits
account_deletion_guards
account_deletion_tombstones
banned_identities
user_daily_usage
user_usage_daily
scheduled_posts
meta_deletion_requests

Runtime-managed Threads tables:
threads_accounts
app_threads_accounts

Schema and migration sources:
`lensically-worker/db/auth_schema.sql`
`lensically-worker/migrations/auth_rate_limits.sql`
`lensically-worker/migrations/account_deletion_guards.sql`
`lensically-worker/migrations/identity_controls.sql`
`lensically-worker/migrations/usage_daily.sql`
`lensically-worker/migrations/limits.sql`
`lensically-worker/migrations/meta_deletion_requests.sql`
`lensically-worker/migrations/app_threads_accounts.sql`

## Core Systems
Email/password authentication
Google, GitHub, and Discord OAuth login
Session-based authenticated API access
Email verification and password reset
Threads account connection and disconnect
Meta Threads deletion and uninstall callbacks
Threads profile fetch, profile lookup, keyword search, publishing, and insights
Usage limits and admin-aware limit enforcement
Auth endpoint rate limiting, strict request validation, and sanitized error responses
Sanitized operational logging for auth, email, account deletion, and worker error paths
Authenticated account deletion with password re-auth for password users, explicit DELETE confirmation text for OAuth-only users, and schema-aware cleanup/integrity safeguards
Identity-control enforcement via deletion tombstones and banned identities
Centralized internal-route authentication gating with session-expired re-auth prompts
Public homepage, terms of service, privacy policy, and data deletion instructions
Reviewer guide for OAuth/provider verification
Operational runbooks for backup/DR, support process, and production readiness audit

## Notes
The authenticated dashboard and insights flow are wired to live Threads APIs. `/discovery`, `/search`, and `/schedule` exist as internal routes, but their current page implementations are minimal shells compared with the backend Threads capabilities.

## Recent Changes (Git History)

- docs(audit): add final production readiness audit
- docs(ops): add user support process and contact workflow
- chore(security): audit and update project dependencies
- docs(ops): define deletion-state safeguards for backup recovery
- docs(ops): add D1 backup and disaster recovery runbook
- feat(security): add schema-aware deletion safeguards for user-linked records
- feat(db): enforce user-linked referential integrity with foreign keys and cleanup safeguards
- feat(security): harden API response sanitization and remove internal identifiers from public responses
- chore(security): enforce environment isolation and prevent secret leakage from build artifacts
- feat(security): restrict internal and administrative worker routes from public access

## Current Objective
Maintain production authentication/account lifecycle hardening and operational readiness while continuing to mature internal product routes (`/discovery`, `/search`, `/schedule`) without regressions.
