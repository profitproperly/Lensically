# Lensically Web

Frontend application for Lensically, built with Next.js App Router and deployed with OpenNext on Cloudflare.

## Reviewer Guide

- Repository reviewer guide: [`../REVIEWER_GUIDE.md`](../REVIEWER_GUIDE.md)

## Public Review References

- Terms of service: `https://lensically.com/terms`
- Privacy policy: `https://lensically.com/privacy`
- Data deletion instructions: `https://lensically.com/data-deletion`

These URLs are the official public pages for provider review. The terms page explains the basic usage framework, the privacy policy explains data handling, and the data deletion page explains how users can delete their Lensically account and associated application data.

## Meta Compliance Values

Copy these values directly into the Meta app configuration:

- Data deletion callback URL: `https://api.lensically.com/auth/threads/delete`
- Data deletion instructions URL: `https://lensically.com/data-deletion`
- Support contact email: `support@lensically.com`

## Google OAuth Consent Values

Copy these values directly into the Google OAuth consent screen:

- Homepage URL: `https://lensically.com`
- Privacy policy URL: `https://lensically.com/privacy`
- Support email: `support@lensically.com`

## Application Scope

- Public marketing and landing pages
- Public authentication flows
- Authenticated product routes
- Account settings and self-serve account deletion

## Development

Run the web application with the project task or package scripts defined for this repository.
