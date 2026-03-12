# Lensically Support Process

## Support Channel

Users can submit support requests by email:

- `support@lensically.com`

Support requests should use a clear subject line, for example:

- `Account Access Issue`
- `Email Verification Issue`
- `Privacy Request`
- `Account Deletion Confirmation`

## Information Users Should Provide

To process requests quickly, ask users to include:

1. Account email address.
2. Issue category (access, verification, privacy, deletion confirmation).
3. Short description of what happened and current error message (if any).
4. Approximate time the issue occurred and timezone.
5. Relevant screenshots (without passwords, reset tokens, session cookies, or API keys).

## Response Procedure

1. Acknowledge receipt and classify the request type.
2. Verify requester identity before sharing account-specific details.
3. Check relevant auth/deletion state in backend logs and database records.
4. Provide the user with next steps or resolution status.
5. Record the final outcome in the support thread.

## Request Handling Playbook

### 1. Account Access Problems

Examples:

- cannot log in
- session expired repeatedly
- OAuth sign-in fails

Engineer handling:

1. Confirm the email/account exists (without exposing sensitive internals).
2. Verify account status (active, deleted, restricted identity controls).
3. Confirm session and auth endpoint behavior.
4. Respond with safe remediation steps (retry login, reset password, re-authenticate provider).

### 2. Email Verification Issues

Examples:

- verification link expired
- verification email not received

Engineer handling:

1. Verify whether account exists and `email_verified` status.
2. Confirm token expiry path behaved correctly.
3. Trigger or instruct re-send through the supported flow.
4. Confirm the user can proceed after verification.

### 3. Privacy Inquiries

Examples:

- what data is stored
- retention/deletion policy questions

Engineer handling:

1. Point users to public policies:
   - `https://lensically.com/privacy`
   - `https://lensically.com/data-deletion`
2. Provide high-level product-accurate answers only.
3. Escalate legal/compliance edge cases to product owners before making commitments.

### 4. Account Deletion Confirmation Requests

Examples:

- user asks if deletion completed
- user cannot access account after deletion and wants confirmation

Engineer handling:

1. Verify deletion outcome through account lifecycle records:
   - user record removed
   - session invalidated
   - deletion tombstone records present where applicable
2. Confirm to user that deletion completed, or provide safe next steps if pending/failed.
3. Do not disclose internal identifiers, tokens, or infrastructure details in user-facing replies.

## Communication & Security Rules

1. Never ask users for passwords, reset tokens, or session cookies.
2. Never share stack traces, SQL output, internal IDs, or infrastructure details.
3. Keep responses concise, factual, and aligned with published privacy/deletion pages.
4. If abuse indicators or banned identities are involved, provide policy-based responses and avoid disclosing internal enforcement logic.

## Escalation Guidelines

Escalate internally when:

1. A deletion appears inconsistent with expected lifecycle behavior.
2. A privacy request conflicts with documented public policy.
3. A request suggests security compromise or account takeover.
