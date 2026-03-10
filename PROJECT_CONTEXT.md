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
Frontend app built with Next.js App Router and deployed with OpenNext on Cloudflare. It includes the main product routes plus login, signup, and authenticated app sections. It talks to the worker through `lib/apiClient.ts`.

lensically-worker
Backend Cloudflare Worker responsible for Threads API integration, email/password auth, OAuth auth, session cookies, email verification, password reset, admin-aware usage enforcement, and D1-backed persistence.

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
Insights
Discovery
Post scheduling
Email verification and password reset

## Recent Changes (Git History)

- auth: catch users.email unique constraint during signup insert
- auth: block OAuth auto-linking when email already exists
- auth: enforce unique provider + provider_user_id in oauth_accounts
- limits: pass is_admin to enforceLimit to enable admin daily-limit bypass
- auth: load and expose is_admin in requireAuth user object
- auth: add is_admin column to users table schema
- limit: change Threads account capacity cap from 800 to 500
- finally fixed everything dev and live login logout works magic link and threads
- feat: make threads oauth redirect uris environment driven via WORKER_BASE_URL
- refactor: replace hard-coded worker urls with apiClient helper and add dev worker origin

## Current Objective
Harden authentication edge cases in the Cloudflare worker, especially duplicate-account handling, OAuth account linking safety, and admin-aware usage enforcement, while keeping the web-to-worker deployment flow stable.
