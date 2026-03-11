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
Production frontend in `lensically-web`, built with Next.js App Router and deployed with OpenNext on Cloudflare. It serves the public landing page, login, signup, verify-email, forgot-password, reset-password, public compliance pages at `/privacy` and `/data-deletion`, and authenticated app routes including `/dashboard`, `/connect`, `/insights`, `/account`, `/discovery`, `/search`, and `/schedule`. Authenticated routing is driven by `AuthProvider` plus Threads connection checks; the landing page can show a post-deletion confirmation banner via `?accountDeleted=1`.

lensically-worker
Production backend in `lensically-worker`, implemented as a Cloudflare Worker with D1-backed auth and Threads integration. It owns email/password auth, session cookies, current-user lookup, email verification, password reset, account deletion, Google/GitHub/Discord OAuth login, Threads OAuth connection, Threads disconnect, usage enforcement, profile lookup, keyword search, post publishing, insights fetches, and token refresh handling. Auth and OAuth origin handling are centralized through `APP_URL`, `ROOT_SITE_URL`, and `WORKER_ORIGIN`.

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
user_daily_usage
user_usage_daily
scheduled_posts

Runtime-managed Threads tables:
threads_accounts
app_threads_accounts

Schema and migration sources:
`lensically-worker/db/auth_schema.sql`
`lensically-worker/migrations/usage_daily.sql`
`lensically-worker/migrations/limits.sql`

## Core Systems
Email/password authentication
Google, GitHub, and Discord OAuth login
Session-based authenticated API access
Email verification and password reset
Threads account connection and disconnect
Threads profile fetch, profile lookup, keyword search, publishing, and insights
Usage limits and admin-aware limit enforcement
Authenticated account deletion with password re-auth for password users
Public privacy policy and public data deletion instructions

## Notes
The authenticated dashboard and insights flow are wired to live Threads APIs. `/discovery`, `/search`, and `/schedule` exist as internal routes, but their current page implementations are minimal shells compared with the backend Threads capabilities.

## Recent Changes (Git History)

- chore(oauth): reduce Threads OAuth scopes to minimum required permissions
- docs(oauth): add Google OAuth consent configuration values to repository documentation
- docs(meta): add Meta app review configuration values for data deletion URL and support contact
- docs(compliance): align canonical privacy and data-deletion URLs across app and documentation
- fix(account): remove orphaned Threads linkage during account deletion
- feat(auth): enforce session-bound authorization for account deletion endpoint
- fix(account): wrap deletion pipeline in D1 transaction to prevent partial account deletion
- feat(account): add structured log event for completed account deletions
- feat(account): require explicit acknowledgment checkbox before account deletion request
- feat(account): add DELETE phrase confirmation for OAuth-only account deletion

## Current Objective
Keep the production auth, OAuth, and compliance surfaces aligned while hardening account deletion integrity, session-bound authorization, canonical public review URLs, and the Threads connection flow used by the live Cloudflare app.
