# Lensically Support Process

## Support Channel

Support requests are handled by email:

- `support@lensically.com`

Support requests should use a clear subject line, for example:

- `Workspace Access Issue`
- `Threads Connection Issue`
- `Privacy Request`
- `Data Deletion Request`

## Information Users Should Provide

To process requests quickly, ask users to include:

1. Issue category (workspace access, Threads connection, privacy, deletion).
3. Short description of what happened and current error message (if any).
4. Approximate time the issue occurred and timezone.
5. Relevant screenshots (without workspace passwords, cookies, or API keys).

## Response Procedure

1. Acknowledge receipt and classify the request type.
2. Verify requester identity before sharing workspace-specific details.
3. Check relevant runtime, Threads, or deletion state in backend logs and database records.
4. Provide the user with next steps or resolution status.
5. Record the final outcome in the support thread.

## Request Handling Playbook

### 1. Workspace Access Problems

Examples:

- workspace password rejected
- protected route redirects unexpectedly

Engineer handling:

1. Confirm the workspace gate and cookie behavior.
2. Verify protected-route middleware behavior.
3. Respond with safe remediation steps.

### 2. Threads Connection Or Publishing Problems

Examples:

- connected Threads account does not load
- scheduling or publishing fails
- follower/archive/insights data looks stale

Engineer handling:

1. Verify configured Threads account/token state.
2. Confirm the relevant worker endpoint behavior.
3. Check recent logs and stored records for the affected workflow.
4. Confirm whether the issue is data, provider, or UI related.

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

### 4. Data Deletion Requests

Examples:

- user asks for removal of stored Lensically data
- provider review or callback-driven deletion confirmation

Engineer handling:

1. Verify what dataset or Threads-linked records are in scope.
2. Confirm deletion outcome through the relevant records and logs.
3. Confirm to the requester that deletion completed, or provide safe next steps if pending/failed.
3. Do not disclose internal identifiers, tokens, or infrastructure details in user-facing replies.

## Communication & Security Rules

1. Never ask users for workspace passwords, tokens, or session cookies.
2. Never share stack traces, SQL output, internal IDs, or infrastructure details.
3. Keep responses concise, factual, and aligned with published privacy/deletion pages.
4. If abuse or security indicators are involved, provide policy-based responses and avoid disclosing internal enforcement logic.

## Escalation Guidelines

Escalate internally when:

1. A deletion appears inconsistent with expected runtime behavior.
2. A privacy request conflicts with documented public policy.
3. A request suggests security compromise.
