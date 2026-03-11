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
Frontend app built with Next.js App Router and deployed with OpenNext on Cloudflare. It includes the public landing page, the public data deletion instructions page at `/data-deletion`, login, signup, verify-email, forgot-password, reset-password, account settings, and authenticated app sections. It talks to the worker through `lib/apiClient.ts`, using `NEXT_PUBLIC_WORKER_ORIGIN` with a production fallback of `https://api.lensically.com`, and routes authenticated users based on Threads connection state.

lensically-worker
Backend Cloudflare Worker responsible for Threads API integration, email/password auth, OAuth auth, session cookies, email verification, password reset, authenticated account deletion, Threads-account capacity checks, admin-aware usage enforcement, and D1-backed persistence. Production domain handling is centralized through `APP_URL`, `ROOT_SITE_URL`, and `WORKER_ORIGIN`.

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

## Recent Changes (Git History)

- feat(account): add authenticated account settings page with delete account action
- feat(auth): confirm permanent account deletion and clear auth cookies
- feat(auth): remove scheduled posts during account deletion
- feat(auth): remove usage tracking records during account deletion
- feat(auth): remove verification and password reset tokens during account deletion
- feat(auth): remove oauth provider linkages during account deletion
- feat(auth): remove all user sessions during account deletion
- feat(auth): delete primary user record in delete-account handler
- feat(auth): add authenticated delete-account endpoint entry point
- feat(email): use verified sender support@lensically.com for all auth emails

## Current Objective
Finish the end-to-end self-serve account lifecycle by hardening authenticated account deletion and connecting the frontend account settings flow to the backend cleanup path without leaving orphaned application data.
