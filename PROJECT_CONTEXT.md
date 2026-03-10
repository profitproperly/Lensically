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
Frontend app built with Next.js App Router and deployed with OpenNext on Cloudflare. It includes login, signup, verify-email, and authenticated app sections. It talks to the worker through `lib/apiClient.ts` and routes authenticated users based on Threads connection state.

lensically-worker
Backend Cloudflare Worker responsible for Threads API integration, email/password auth, OAuth auth, session cookies, email verification, password reset, Threads-account capacity checks, admin-aware usage enforcement, and D1-backed persistence.

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

## Recent Changes (Git History)

- fix: narrow user before threads connection check to satisfy TypeScript
- feat: route verified users without Threads connection to connect page after login
- feat: add styled HTML template for verification emails
- fix: update verification email link to use current frontend domain via WEB_APP_URL
- fix: guard verify-email token before encodeURIComponent to satisfy TypeScript
- auth: add verify-email route and redirect signup success to verification screen
- auth: disable automatic retries for signup POST to prevent duplicate registration requests
- auth: decouple signup success from email delivery; make verification email best-effort
- auth: standardize login, signup, and OAuth error messages across UI and worker
- auth: wrap login route in Suspense and move useSearchParams into LoginPageClient

## Current Objective
Stabilize the end-to-end authentication and onboarding flow, especially signup, verification, post-login routing, and Threads connection gating, while preserving capacity limits and admin-aware enforcement in the worker.
