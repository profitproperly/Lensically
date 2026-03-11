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
Production frontend in `lensically-web`, built with Next.js App Router and deployed with OpenNext on Cloudflare. It serves the public landing page, login, signup, verify-email, forgot-password, reset-password, and public compliance pages at `/terms`, `/privacy`, and `/data-deletion`, plus authenticated app routes including `/dashboard`, `/connect`, `/insights`, `/account`, `/discovery`, `/search`, and `/schedule`. Authenticated routing is driven by `AuthProvider` plus Threads connection checks; the landing page can show a post-deletion confirmation banner via `?accountDeleted=1`.

lensically-worker
Production backend in `lensically-worker`, implemented as a Cloudflare Worker with D1-backed auth and Threads integration. It owns email/password auth, session cookies, current-user lookup, email verification, password reset, account deletion, Google/GitHub/Discord OAuth login, Threads OAuth connection, Threads disconnect, Meta Threads deletion and uninstall callbacks, usage enforcement, profile lookup, keyword search, post publishing, insights fetches, and token refresh handling. Auth and OAuth origin handling are centralized through `APP_URL`, `ROOT_SITE_URL`, and `WORKER_ORIGIN`.

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
meta_deletion_requests

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
Meta Threads deletion and uninstall callbacks
Threads profile fetch, profile lookup, keyword search, publishing, and insights
Usage limits and admin-aware limit enforcement
Authenticated account deletion with password re-auth for password users and backend DELETE confirmation for OAuth-only users
Public homepage, terms of service, privacy policy, and data deletion instructions
Reviewer guide for OAuth/provider verification
In-product Google OAuth privacy disclosures on login, signup, and OAuth-only account settings

## Notes
The authenticated dashboard and insights flow are wired to live Threads APIs. `/discovery`, `/search`, and `/schedule` exist as internal routes, but their current page implementations are minimal shells compared with the backend Threads capabilities.

## Recent Changes (Git History)

- docs(review): add OAuth provider reviewer guide and reference from READMEs
- feat(meta): implement Threads uninstall callback and unify linkage cleanup logic
- feat(meta): implement Threads data deletion callback and status endpoint
- feat(compliance): add public terms of service page and link from homepage
- chore(oauth): remove legacy workers.dev callback and align scaffold with production domain
- feat(site): create public homepage with product explanation and compliance links
- fix(account): enforce backend DELETE confirmation for OAuth-only account deletion
- chore(oauth): reduce Threads OAuth scopes to minimum required permissions
- docs(oauth): add Google OAuth consent configuration values to repository documentation
- docs(meta): add Meta app review configuration values for data deletion URL and support contact

## Current Objective
Keep the production auth, OAuth, Meta callback, and public compliance surfaces aligned for provider review, including reviewer guidance, canonical legal pages, Threads uninstall/delete callbacks, and hardened account deletion safeguards.
