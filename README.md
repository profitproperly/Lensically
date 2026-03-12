# Lensically
Social Signal Analytics

## Reviewer Guide

- Reviewer guide: [`REVIEWER_GUIDE.md`](./REVIEWER_GUIDE.md)

## Operations Runbooks

- Production backup and disaster recovery: [`BACKUP_DR_RUNBOOK.md`](./BACKUP_DR_RUNBOOK.md)
- User support handling process: [`SUPPORT_PROCESS.md`](./SUPPORT_PROCESS.md)
- Final production readiness audit: [`PRODUCTION_READINESS_AUDIT.md`](./PRODUCTION_READINESS_AUDIT.md)

## Public Compliance URLs

- Terms of service: `https://lensically.com/terms`
- Privacy policy: `https://lensically.com/privacy`
- Data deletion instructions: `https://lensically.com/data-deletion`

## Meta App Review Values

Use these exact values in the Meta developer dashboard:

- Data deletion callback URL: `https://api.lensically.com/auth/threads/delete`
- Data deletion instructions URL: `https://lensically.com/data-deletion`
- Support contact email: `support@lensically.com`

## Google OAuth Consent Values

Use these exact values in the Google Cloud OAuth consent screen:

- Application name: `Lensically`
- Homepage URL: `https://lensically.com`
- Privacy policy URL: `https://lensically.com/privacy`
- Support email: `support@lensically.com`
- App logo URL: `https://lensically.com/lensically-logo-black-no-border.png`

## OAuth Branding Values (All Providers)

Use these branding values consistently across Google, GitHub, Discord, and Threads provider dashboards:

- Application name: `Lensically`
- Homepage URL: `https://lensically.com`
- Support email: `support@lensically.com`
- App logo URL: `https://lensically.com/lensically-logo-black-no-border.png`

Verification checklist:

1. Google OAuth consent screen branding matches the values above.
2. GitHub OAuth app branding matches the values above.
3. Discord OAuth app branding matches the values above.
4. Threads/Meta app branding matches the values above.
