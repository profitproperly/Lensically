# Lensically — Project Context

## Project
Lensically

## Stack
Next.js
OpenNext for Cloudflare
Cloudflare Workers
Cloudflare D1
Tailwind CSS

## Architecture

lensically-web
Frontend app built with Next.js App Router and deployed with OpenNext on Cloudflare. It includes the public landing page, a public privacy policy at `/privacy`, public data deletion instructions at `/data-deletion`, login, signup, verify-email, forgot-password, reset-password, account settings, and authenticated app sections. The landing page uses a Suspense-wrapped client banner for post-deletion confirmation state. The app talks to the worker through `lib/apiClient.ts`, using `NEXT_PUBLIC_WORKER_ORIGIN` with a production fallback of `https://api.lensically.com`, and routes authenticated users based on Threads connection state.

lensically-worker
Backend Cloudflare Worker responsible for Threads API integration, email/password auth, OAuth auth, session cookies, email verification, password reset, authenticated account deletion, password re-authentication requirements for password-based account deletion, Threads-account capacity checks, admin-aware usage enforcement, and D1-backed persistence. Production domain handling is centralized through `APP_URL`, `ROOT_SITE_URL`, and `WORKER_ORIGIN`.

Legacy directories
`server`, `client`, and `database` still exist as earlier scaffolding, but the active deployment target is the `lensically-web` + `lensically-worker` Cloudflare stack.

## Database
Cloudflare D1

Core tables:
users
sessions
oauth_accounts
email_verification_tokens
password_reset_tokens
user_daily_usage
user_usage_daily
scheduled_posts

Schema source:
lensically-worker/db/auth_schema.sql
lensically-worker/migrations/usage_daily.sql
lensically-worker/migrations/limits.sql

## Core Systems
Authentication
OAuth
Usage limits
Threads account capacity enforcement
Insights
Discovery
Post scheduling
Email verification and password reset
Authenticated account deletion
Public privacy policy
Public data deletion instructions

## Recent Changes (Git History)

- feat(account): add DELETE phrase confirmation for OAuth-only account deletion
- fix(frontend): move accountDeleted query handling into suspense-wrapped client component
- feat(auth): require password re-authentication before account deletion for password-based users
- feat(account): add permanent deletion warning to account deletion confirmation panel
- docs(legal): add permanent data deletion statement to privacy and data-deletion pages
- feat(legal): add public privacy policy page and navigation link
- feat(legal): add public data deletion instructions page and navigation link
- feat(account): redirect to landing page with deletion confirmation banner after account deletion
- feat(account): connect frontend deletion confirmation to backend delete-account endpoint
- feat(account): add explicit confirmation step before account deletion request

## Current Objective
Maintain and harden the production-ready self-serve account lifecycle across password and OAuth users, including authenticated account deletion safeguards, post-deletion UX, and public compliance pages that accurately reflect system behavior.
