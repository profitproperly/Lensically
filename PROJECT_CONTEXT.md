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
Frontend app built with Next.js App Router and deployed with OpenNext on Cloudflare. It includes login, signup, verify-email, and authenticated app sections. It talks to the worker through `lib/apiClient.ts`, using `NEXT_PUBLIC_WORKER_ORIGIN` with a production fallback of `https://api.lensically.com`, and routes authenticated users based on Threads connection state.

lensically-worker
Backend Cloudflare Worker responsible for Threads API integration, email/password auth, OAuth auth, session cookies, email verification, password reset, Threads-account capacity checks, admin-aware usage enforcement, and D1-backed persistence. Production domain handling is centralized through `APP_URL`, `ROOT_SITE_URL`, and `WORKER_ORIGIN`.

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

- fix(frontend): update API origin fallback to api.lensically.com and remove workers.dev dependency
- Add WORKER_ORIGIN configuration for production worker host Replace hardcoded OAuth callback URLs with env-driven builder Route all provider callbacks through api.lensically.com
- Centralize domain resolution using APP_URL and ROOT_SITE_URL Replace hardcoded origins with env-driven validation helpers Update CORS, redirects, and OAuth fallback handling
- Add canonical APP_URL and ROOT_SITE_URL configuration Update WEB_APP_URL to production app domain Update auth email links and env typing to use new domain config
- fix: narrow user before threads connection check to satisfy TypeScript
- feat: route verified users without Threads connection to connect page after login
- feat: add styled HTML template for verification emails
- fix: update verification email link to use current frontend domain via WEB_APP_URL
- fix: guard verify-email token before encodeURIComponent to satisfy TypeScript
- auth: add verify-email route and redirect signup success to verification screen

## Current Objective
Finalize production-domain alignment across the Cloudflare stack so frontend API traffic, worker redirects, auth email links, CORS/origin validation, and OAuth callback handling all resolve through `app.lensically.com`, `lensically.com`, and `api.lensically.com` consistently.
