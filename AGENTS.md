# Lensically — Agent Execution Rules

## Execution Model

When implementing a task:

1. Read the repository before editing code.
2. Follow existing architecture and patterns.
3. Modify only files necessary for the change.
4. Do not break authentication, routes, or database logic.
5. Prefer minimal and production-safe implementations.

## Implementation Procedure

1. Locate the relevant files in the repository.
2. Identify the safest integration point.
3. Implement the change with minimal modifications.

## Environment Consistency

The development environment and runtime versions are controlled by the
VS Code task system.

Agents must NOT:

- diagnose local Node versions
- recommend runtime upgrades
- modify environment configuration
- block implementation due to local runtime assumptions

All builds, Node versions, and deployment commands are executed through
the task registry defined in the development workflow.

If a build failure appears to be environment-related, assume the runtime
is correct and focus only on code-level causes unless explicitly told
otherwise.

## Verification

Every implementation must include:

- explanation of how the change works
- exact VS Code task labels required to verify the fix

Verification is task-driven and user-executed through the task registry.
Agents must not re-run equivalent local checks in-agent by default when
the task registry is available.

Agents must not run local lint/build/test commands when VS Code task
registry equivalents exist, unless the user explicitly requests local
execution.

Required check tasks when relevant:

- `CHECK: FE Build`
- `CHECK: FE Lint`
- `CHECK: BE Test`
- `CHECK: BE Auth API Smoke` for authentication, session, account lifecycle, or auth API contract changes

Required deploy tasks when relevant:

- `DEPLOY: FE Cloudflare`
- `DEPLOY: BE Worker`

## Task Selection Matrix (Zero Ambiguity)

Agents must derive `Run These Now` strictly from changed paths. Do not
use judgment terms like "when relevant" for task inclusion.

Rules:

- If any file under `lensically-web/**` changed, include:
  - `CHECK: FE Lint`
  - `CHECK: FE Build`
- If any file under `lensically-worker/**` changed, include:
  - `CHECK: BE Test`
- If any file under `lensically-worker/auth/**` changed, include:
  - `CHECK: BE Auth API Smoke`
- If `lensically-worker/src/index.ts` changed, include:
  - `CHECK: BE Auth API Smoke`
- If runtime code changed under `lensically-web/**`, include:
  - `DEPLOY: FE Cloudflare`
- If runtime code changed under `lensically-worker/**`, include:
  - `DEPLOY: BE Worker`
- If changes are docs-only (`**/*.md`) outside runtime directories, do not
  include deploy tasks.

Ordering:

- Always list checks first, then deploys.
- Check order: `CHECK: FE Lint`, `CHECK: FE Build`, `CHECK: BE Test`,
  `CHECK: BE Auth API Smoke`.
- Deploy order: `DEPLOY: FE Cloudflare`, `DEPLOY: BE Worker`.

## Required Output

Summary  
Files Modified  
Run These Now  
Risks / Edge Cases

Response Header
Every assistant response must start with this exact first line:
`CODEX RESPONSE`

`Run These Now` rules:

- list exact task labels in execution order as a numbered list
- include only tasks relevant to the files changed
- treat listed tasks as mandatory
- do not use conditional wording in the user-facing list
- output exactly the tasks produced by the Task Selection Matrix

## Rule

If the correct integration point cannot be confidently determined from
the repository, stop and ask for clarification instead of guessing.

`PROJECT_CONTEXT.md` is an AI context document. Agents must not modify
or reference `PROJECT_CONTEXT.md` unless the user explicitly instructs
them to do so.

## Frontend Production Rules

- Every user-triggered async action must provide visible loading, success, and error states.
- Form submissions and async action buttons must show a loading state, be disabled while the request is in flight, and display a visible error message when the action fails.
- Agents must not introduce placeholder links, dead buttons, `href="#"`, or non-functional CTAs in production-facing UI unless explicitly requested.
- Destructive actions must require explicit confirmation, clear irreversible-action copy, and backend-side validation.
- Agents must never rely on frontend-only checks for authorization, permissions, or destructive action protection when backend enforcement is required.
- Frontend integrations with backend endpoints must use explicit request and response shapes instead of loose untyped handling.
- Agents should extend existing helpers, components, and backend utilities instead of creating duplicate logic when an established pattern already exists.
- Changes affecting API contracts, auth payloads, database schema, or backend response shapes must update all affected layers in the same change.
- Database-affecting changes must include the appropriate schema or migration update and must not rely on undocumented manual database edits.
- New UI must account for empty, loading, error, and success states instead of only the happy path.
- New pages and major UI changes must remain usable on both mobile and desktop layouts.
- Interactive controls must use semantic elements where possible and include accessible labels, keyboard reachability, and visible focus behavior.
- Backend or network failures must not fail silently; meaningful user-facing errors should be shown when safe.
- Agents must provide mandatory user-run verification tasks after code changes using the task labels defined in this repository.
- Agents must not break existing public routes, auth routes, OAuth callback URLs, or redirect flows when making frontend or authentication changes.
- Agents must follow existing environment and configuration patterns and must not hardcode secrets, origins, or environment-specific URLs when a configured source already exists.
- User-facing copy for destructive actions, authentication flows, and compliance pages must be explicit, production-ready, and free of placeholder wording.
- Public compliance pages such as privacy, terms, and data deletion must use stable public routes and remain accessible without authentication.
- Interactive UI elements intended to be clickable must include `cursor-pointer`, unless they are disabled or intentionally use a different state-specific cursor.

## Review Rule

If the user asks for a review, agents must stay in review mode: findings,
risks, regressions, and missing coverage come first. Do not switch into
implementation-first behavior unless the user explicitly asks for fixes.

## Change Safety Checklist

For any authentication, destructive-action, compliance, or account-lifecycle
change, agents must verify:

- backend enforcement exists and frontend gating is not the only protection
- loading, success, and error states are present
- unauthorized and expired-session behavior is handled
- redirects and post-action navigation still work
- affected public documentation and compliance pages remain accurate
- relevant API, request, and response contracts are updated consistently
- existing public routes, auth routes, callback URLs, and session behavior are not broken

## Account Lifecycle Rule

If a change touches signup, login, logout, email verification, password reset,
OAuth, account settings, or account deletion, agents must evaluate the broader
account lifecycle for regressions instead of treating the change as isolated.

## Priority Order

When tradeoffs exist, agents must prioritize in this order:

1. security and data integrity
2. correctness of authentication, routing, and backend behavior
3. regression prevention for existing user flows
4. production readiness of user experience and copy
5. implementation speed and code convenience

## Regression Prevention Rule

Agents must evaluate what existing behavior could break before shipping a
change. Any modification to shared logic, authentication flows, routing,
compliance pages, or destructive actions must consider adjacent user journeys
and not only the immediate task.

## Consistency Rule

Agents must preserve a consistent product experience across pages and flows.
New UI, copy, validation behavior, confirmation patterns, and error handling
should align with the existing product unless the task explicitly requires a
new pattern.

## Observability And Supportability Rule

For high-risk or high-impact changes, agents should preserve or improve the
system's supportability. They should avoid changes that make production issues
harder to diagnose, and should maintain clear user-facing failure states and
accurate documentation so support and debugging remain practical.

## Authentication Change Checklist

For signup, login, logout, email verification, password reset, session, or
account settings changes, agents must verify:

- authenticated and unauthenticated routing still behave correctly
- session cookies and logout behavior still clear access appropriately
- email verification and password reset flows still work end to end
- success, error, expired, invalid-token, and unauthorized states are handled
- frontend and backend error messages remain coherent and safe to show users
- any auth payload or response changes are reflected in frontend types and consumers

## OAuth And Provider Review Checklist

For OAuth or provider-facing changes, agents must verify:

- callback URLs, start URLs, and redirect targets remain correct
- provider-specific flows do not break existing login or account-linking behavior
- public review pages such as privacy and data deletion remain reachable
- provider-facing documentation references the correct stable public URLs
- OAuth-only accounts and password-based accounts both retain correct lifecycle behavior

## Destructive Action Checklist

For account deletion or any destructive workflow, agents must verify:

- the action requires deliberate user confirmation
- irreversible-action copy is explicit and visible before submission
- backend validation exists before destructive work is executed
- partial failure paths do not silently leave the UI in an inconsistent state
- post-action logout, redirect, and user-facing confirmation behavior still work
- associated cleanup remains aligned with the documented data deletion behavior

## Public Compliance Page Checklist

For privacy, data deletion, terms, or other public compliance pages, agents
must verify:

- the route is stable and reachable without authentication
- the content matches actual backend and product behavior
- navigation or documentation links to the page remain valid
- deletion, privacy, and support contact language is explicit and production-ready
- changes to lifecycle or retention behavior update the affected compliance pages in the same change

## Release Readiness Rule

Before closing a substantial task, agents should ask whether the change feels
safe, complete, and supportable enough for a production SaaS release. If the
answer depends on an unhandled edge case, missing verification, inconsistent
copy, or unclear behavior, the task is not complete yet.

## Non-Negotiable Anti-Patterns

Agents must not ship any of the following unless the user explicitly requests
them and understands the tradeoff:

- frontend-only protection for privileged or destructive actions
- placeholder UI in production-facing surfaces
- broken or fake navigation paths
- undocumented database changes
- mismatched frontend/backend API contracts
- compliance copy that does not match real behavior
- destructive actions without confirmation and visible irreversible-action language
- silent failures or swallowed errors for user-triggered actions
- copy that sounds temporary, vague, or unfinished
- duplicate logic when an existing repo pattern already solves the problem

## Definition Of Done

A task is not done unless all of the following are true:

- the requested behavior is implemented end to end
- the safest integration point was used
- existing impacted flows were checked for regressions
- the UI includes the required user feedback states
- backend enforcement exists where required
- documentation or compliance content was updated if behavior changed
- mandatory relevant task-based checks and deploys were listed in `Run These Now`
- the final response explains what changed, how to test it, and any remaining risks

## Documentation Synchronization Rule

If a code change alters product behavior, user-visible policy, deletion
behavior, authentication flow, provider-facing behavior, or route structure,
agents must update the corresponding reviewer-facing or user-facing
documentation in the same change when applicable.

## Auth Change Execution Template

When handling authentication or account lifecycle work, agents should confirm:

- which routes are public versus authenticated
- which backend endpoint is the source of truth
- which session or cookie behaviors are affected
- which frontend consumers depend on the changed response shape
- which adjacent flows can regress, including login, logout, reset, verify, OAuth, and deletion

Lensically auth routes and flows that should be considered together when relevant:

- `/login`
- `/signup`
- `/verify-email`
- `/forgot-password`
- `/reset-password`
- authenticated account settings
- authenticated delete-account flow
- provider start and callback flows for Google, GitHub, and Discord
- `/api/auth/me`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/register`
- `/api/auth/verify-email`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/auth/delete-account`

## Destructive Flow Execution Template

When handling destructive workflows, agents should confirm:

- what the user sees before submission
- what backend validation happens before deletion or mutation
- what happens on success
- what happens on failure
- what data is cleaned up
- what public policy or documentation needs to remain accurate

For Lensically account deletion specifically, agents should keep these aligned:

- authenticated account settings deletion UI
- password re-auth behavior for password-based accounts
- `/api/auth/delete-account`
- session cleanup and logout outcome
- landing-page post-deletion redirect behavior
- public deletion messaging on `/data-deletion`
- privacy/disclosure language on `/privacy`

## Compliance And Public Page Execution Template

When handling privacy, deletion, or provider-review pages, agents should confirm:

- the route is public and stable
- the content reflects actual implementation
- the page is linked where reviewers or users can reasonably find it
- support contact details are correct
- related docs and references point to the correct canonical URL

For Lensically, reviewer-facing and public-reference surfaces include:

- `/privacy`
- `/data-deletion`
- `/README.md`
- `/lensically-web/README.md`

Agents must keep these references aligned when lifecycle, deletion, privacy,
or provider-review behavior changes.

## Route And URL Canonicalization Rule

When a public or provider-facing URL is introduced, agents should treat one
stable route as canonical and reuse it consistently across UI, redirects,
documentation, and compliance references instead of creating multiple competing
paths for the same purpose.

## Lensically Canonical Public References

- Privacy policy: `/privacy`
- Data deletion instructions: `/data-deletion`

## Lensically High-Risk Areas

Agents should apply extra caution when touching:

- authentication and session handling
- OAuth start/callback flows
- account deletion and cleanup logic
- public compliance pages
- route redirects after auth or destructive actions
- shared auth payloads consumed by the web app

## Output Quality Rule

Agents should communicate like a production engineer handing work to another
production engineer:

- no fluff
- no vague claims of completion without verification context
- no hiding uncertainty
- no overstating confidence when tests were not run
- no changelog-style noise when a concise explanation will do
- final responses must include a concise `Run These Now` task list with exact labels and no conditional phrasing
