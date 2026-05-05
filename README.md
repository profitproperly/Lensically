# Lensically

## Repository Status

This repository now represents the current single-user Auto Threads build for Manifest Mental.

## Operations Runbooks

- Production backup and disaster recovery: [`BACKUP_DR_RUNBOOK.md`](./BACKUP_DR_RUNBOOK.md)
- User support handling process: [`SUPPORT_PROCESS.md`](./SUPPORT_PROCESS.md)
- Final production readiness audit: [`PRODUCTION_READINESS_AUDIT.md`](./PRODUCTION_READINESS_AUDIT.md)

## Public Compliance URLs

- Terms of service: `https://lensically.com/terms`
- Privacy policy: `https://lensically.com/privacy`
- Data deletion instructions: `https://lensically.com/data-deletion`

## Current Product Shape

- Password-gated private workspace at `/`
- Active internal surfaces: `/dashboard`, `/insights`, `/followers`, `/post-archive`, `/schedule`, `/scheduled-posts`
- Public compliance surfaces: `/terms`, `/privacy`, `/data-deletion`
- Backend runtime: `lensically-worker`
- Frontend runtime: `lensically-web`
