# Lensically Reviewer Guide

## Purpose

Lensically is a web application for Threads-related analytics and workflow support. Users can:

- authenticate with email/password or supported OAuth providers
- connect a Threads account
- review Threads profile and insights data
- access account settings and delete their account

## Public URLs

- Homepage: `https://lensically.com`
- Terms of service: `https://lensically.com/terms`
- Privacy policy: `https://lensically.com/privacy`
- Data deletion instructions: `https://lensically.com/data-deletion`

## How To Access The App

1. Open `https://lensically.com`.
2. Use the public homepage navigation to review the Terms, Privacy Policy, and Data Deletion pages without signing in.
3. To test authentication, select `Log in` or `Sign up`.
4. To test Google OAuth, use the `Continue with Google` button on the login or signup page.

## Google OAuth Review Notes

- Google account data is used only for authentication, account creation, and account access within Lensically.
- Lensically stores the OAuth account linkage needed to sign users in and maintain their account access.
- The application does not request broad or sensitive Google scopes beyond basic identity scopes.

## Account Deletion Review

1. Sign in to Lensically.
2. Open the authenticated account settings page at `/account`.
3. For OAuth-only accounts, open the delete-account panel.
4. Confirm the warning, check the acknowledgment box, and type `DELETE`.
5. Submit the deletion request.
6. After success, the app logs the user out and redirects to `/?accountDeleted=1`.

Expected result:

- the account deletion request succeeds only after the required confirmation step
- the user is redirected to the public homepage
- the homepage displays the account-deleted confirmation banner

## Privacy And Compliance Review

Reviewers can confirm the public compliance surfaces here:

- `https://lensically.com/terms`
- `https://lensically.com/privacy`
- `https://lensically.com/data-deletion`

These pages are intended to be reachable without authentication and describe:

- what Lensically does
- the legal terms for use of the service
- what account-linked data is used and how it is handled
- how self-serve account deletion works

## Meta / Threads Callback References

- Meta deletion callback URL: `https://api.lensically.com/auth/threads/delete`
- Meta uninstall callback URL: `https://api.lensically.com/auth/threads/uninstall`

## OAuth Branding Verification

Verify all provider consent/app branding values match production website references:

- Application name: `Lensically`
- Homepage URL: `https://lensically.com`
- Support email: `support@lensically.com`
- App logo URL: `https://lensically.com/lensically-logo-black-no-border.png`

Providers to verify:

1. Google OAuth consent screen
2. GitHub OAuth app
3. Discord OAuth app
4. Threads/Meta app

## Support

- Support email: `support@lensically.com`

## Operations

- Production backup and disaster recovery runbook: [`BACKUP_DR_RUNBOOK.md`](./BACKUP_DR_RUNBOOK.md)
- User support handling process: [`SUPPORT_PROCESS.md`](./SUPPORT_PROCESS.md)
- Final production readiness audit: [`PRODUCTION_READINESS_AUDIT.md`](./PRODUCTION_READINESS_AUDIT.md)
