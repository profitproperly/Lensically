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
Frontend app built with Next.js (App Router), deployed through OpenNext to Cloudflare Pages/Workers. Includes dashboard, discovery, schedule, insights, connect, login, and signup routes.

lensically-worker
Backend Cloudflare Worker responsible for Threads API integration, auth flows (email/password + OAuth), OAuth callbacks, session handling, usage enforcement, and D1-backed persistence.

Legacy directories
`server`, `client`, and `database` still exist in the repository as earlier local scaffolding, but the active deployment work is centered on `lensically-web` and `lensically-worker`.

## Database
Cloudflare D1

Core tables:
users
sessions
oauth_accounts
email_verification_tokens
password_reset_tokens
user_daily_usage / user_usage_daily
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

- stabilize threads insights pipeline and usage enforcement
- auth system stable: google, github, discord oauth working
- Update wrangler.toml to use OpenNext worker and ASSETS binding
- move opennext worker into pages asset output
- attach opennext worker for cloudflare pages routing
- add pages routes for opennext worker
- fix opennext pages output directory
- remove invalid pages function worker
- connect opennext worker to pages functions
- add wrangler.toml for non-interactive OpenNext build

## Current Objective
Stabilize the Threads insights pipeline and usage-limit enforcement while preserving the deployed OpenNext-to-Cloudflare routing and stable multi-provider authentication flow.
