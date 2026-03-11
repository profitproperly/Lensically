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
Production frontend in `lensically-web`, built with Next.js App Router and deployed with OpenNext on Cloudflare. It serves the public landing page, login, signup, verify-email, forgot-password, reset-password, and public compliance pages at `/terms`, `/privacy`, and `/data-deletion`, plus authenticated app routes including `/dashboard`, `/connect`, `/insights`, `/account`, `/discovery`, `/search`, and `/schedule`. Session state is driven by `AuthProvider`; authenticated account settings include guarded account deletion flows for password and OAuth users, and the landing page can show a post-deletion confirmation banner via `?accountDeleted=1`.

lensically-worker
Production backend in `lensically-worker`, implemented as a Cloudflare Worker with D1-backed auth and Threads integration. It owns email/password auth, secure session cookies, current-user lookup, email verification, password reset, account deletion, Google/GitHub/Discord OAuth login, Threads OAuth connection, Threads disconnect, Meta Threads deletion and uninstall callbacks, usage enforcement, profile lookup, keyword search, post publishing, insights fetches, and token refresh handling. Auth request validation, D1-backed auth rate limiting, centralized safe error handling, and sanitized operational logging are part of the worker surface. Auth and OAuth origin handling are centralized through `APP_URL`, `ROOT_SITE_URL`, and `WORKER_ORIGIN`.

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
`lensically-worker/migrations/usage_daily.sql`
`lensically-worker/migrations/limits.sql`
`lensically-worker/migrations/meta_deletion_requests.sql`

## Core Systems
Email/password authentication
Google, GitHub, and Discord OAuth login
Session-based authenticated API access
Email verification and password reset
Threads account connection and disconnect
Meta Threads deletion and uninstall callbacks
Threads profile fetch, profile lookup, keyword search, publishing, and insights
Usage limits and admin-aware limit enforcement
Auth endpoint rate limiting, strict request validation, and centralized safe error handling
Sanitized operational logging for auth, email, account deletion, and worker error paths
Authenticated account deletion with password re-auth for password users and explicit DELETE confirmation text for OAuth-only users
Public homepage, terms of service, privacy policy, and data deletion instructions
Reviewer guide for OAuth/provider verification
In-product Google OAuth privacy disclosures on login, signup, and OAuth-only account settings

## Notes
The authenticated dashboard and insights flow are wired to live Threads APIs. `/discovery`, `/search`, and `/schedule` exist as internal routes, but their current page implementations are minimal shells compared with the backend Threads capabilities.

## Recent Changes (Git History)

- feat(security): add centralized log sanitization to prevent sensitive data exposure
- feat(logging): add structured operational logging for auth, email, and account deletion events
- feat(security): add centralized worker error handling and safe response boundary
- fix(security): remove generated file containing secrets and ignore .open-next build artifacts
- feat(security): sanitize OAuth errors and remove token exposure paths from logs
- feat(security): add session-scoped guard to prevent duplicate account deletion execution
- feat(security): add strict request validation for auth and account endpoints
- feat(security): enforce authenticated user ownership on Threads mutation endpoints
- feat(security): enforce secure session cookies with __Host prefix and centralized cookie helpers
- feat(security): add auth endpoint rate limiting with D1-backed limiter

## Current Objective
Harden the production authentication and Threads integration surfaces with safer request handling, sanitized observability, and regression-resistant account lifecycle behavior while keeping provider-facing compliance routes aligned.
