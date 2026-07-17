# Lensically Operating Memory

Read after `AGENTS.md`. Keep this file limited to active, reusable rules. Historical debugging belongs in Git history and engineering audit records.

## Execution Architecture

- Every main-MCP operation enters through the sole public tool `executeLensicallyIntent`.
- The source-defined static router selects one live typed internal handler. The model does not choose tools, wrappers, retries, or fallbacks.
- Route selection must remain D1-independent. Do not reintroduce execution-library compilation, dynamic maps, route incidents, promotions, phonebook overrides, OpsMemory routing, or execution-event recording.
- Direct internal tool calls are rejected. Recovery is not a model-selected fallback; it is an independent break-glass plane used only when the main Worker or deployment plane cannot receive or complete the repair.
- Preserve account protections after routing: selected brand, explicit Proceed, server-side continuity, idempotency, authorization, content gates, ownership checks, and scheduler safety.

## Engineering Speed

- Routine implementation target is under ten minutes when the platform operation permits it.
- Speed comes from removing unnecessary work, not skipping required correctness checks.
- Use bounded source inspection, one coherent change set, focused validation, one exact-SHA release, and one live verification pass.
- Do not run separate full validation and deployment loops for a normal change.
- Do not poll rapidly from chat. Use bounded server-side workflow status reads and inspect detailed logs only after a terminal failure.
- Related edits should use one atomic patch set when practical. If the client blocks an oversized payload before it reaches Lensically, do not resend the same shape; divide it into compact exact patches or a chunked write session.
- Keep public receipts compact. Never echo full patch bodies, repository files, generated knowledge, or large database records through the client.

## Repository Operations

- GitHub `main` is authoritative. Read the current head before mutations.
- Large Worker files use Git blob, tree, commit, and ref APIs. Do not use the GitHub Contents API for oversized files.
- For a known exact file, read that blob once and search locally. Do not repeat empty GitHub code searches.
- Broader repository search is bounded: one code-search request followed by the compact tree-path fallback when search is empty or unavailable.
- Exact replacements must match once. If the head changed or the anchor is ambiguous, reload current source and correct the variable input; the tool route is still valid.
- YAML workflow changes require a complete reviewed block or whole-file replacement with correct indentation and readback before dispatch.
- Never expose tokens or secret values while diagnosing GitHub, Cloudflare, OAuth, or deployment configuration.

## Validation and Deployment

- Normal release order: dependency-free preflight, `npx tsc --noEmit`, focused Operator release gate, GPT-memory tests, Worker deployment, cron verification, and scheduler safety verification.
- Full Operator tests are diagnostic. Run them separately when a change affects broad account behavior or when the focused gate cannot identify the regression.
- Release dispatch uses the configured branch plus the exact commit in `release_sha`. Checkout must equal that SHA before validation and deployment.
- A superseded or cancelled workflow is not an implementation failure when a newer run for the same intended commit is authoritative.
- Version changes require synchronized runtime constants, exact test assertions, and `CURRENT_STATE.md`. Do not bump versions for architecture cleanup unless the public/runtime contract requires it.
- Live completion requires health on the exact commit, OAuth and initialize success, one-tool discovery, direct-call rejection, mapped execution success, and the expected registry generation.

## Account Continuity and Idempotency

- Canonical keys are `manifest_mental`, `opmg_deadman`, and `vectrix`.
- Fresh sessions use the fixed key handshake and load no account state before explicit Proceed.
- After Proceed, continuity is reconstructed from D1 schedule, workflow, source claims, and active review state. Do not ask the owner to reconstruct state from chat memory.
- Mutating workflow operations use semantic idempotency receipts. Repeating an interrupted operation must return the existing durable result rather than create a duplicate.
- Preserve source-card, generation, draft, scheduling, and published-result lineage.
- A source wording rejection keeps the source available for revision. A same-day source skip blocks it only for that production date. Durable source exclusion prevents future draws while preserving historical data.

## Scheduling Safety

- Cron and the Durable Object alarm share one persisted scheduler control.
- Missing control defaults to `paused`.
- `canary` authorizes exactly one scheduled entry and automatically returns to paused after one attempt.
- `normal` activation is forbidden while overdue approved or posting records exist.
- Overdue recovery is explicit, bounded, and transactional. Retire or reschedule exact selected rows, then verify the overdue set is empty before normal activation.
- A scheduled item is successfully published only when its row is `posted` and contains a nonempty Threads identifier.
- Scheduled wording corrections use the shared edit path and preserve omitted fields. Posting and posted rows are not editable.

## Performance Learning

- Autonomous Insights collection runs at four America/New_York windows: midnight, 6 AM, noon, and 6 PM.
- Preserve the newest-40 collection policy. Do not add targeted older-post calls solely to satisfy learning checkpoints.
- Store only changed metric snapshots and quarantine structurally impossible metrics rather than deleting history.
- Evaluate posts at age-matched 6, 12, 18, and 24-hour checkpoints; 24 hours is final.
- Post evidence uses the post's own metrics. Account follower totals are trajectory data only and must never be attributed to a post, day, batch, or posting period.
- Source selection and generation may use supported performance mechanisms, confidence, and fatigue, while retaining exploration when evidence is weak.

## Recovery and Client Boundaries

- Recovery remains independently deployed and source-defined. It must not depend on the main gateway, main D1 preparation, account data, or Operator routing.
- A transport failure before the Worker receives a request cannot be repaired by code inside that Worker. Use Recovery when the main path is unreachable; otherwise keep work on the main source-defined route.
- ChatGPT may cache a public MCP schema after a deployment. Server smoke proves the live schema; the installed app may still require an explicit Refresh when the public tool schema itself changes.
- The public main schema is frozen at one tool. Internal handler additions and implementation changes should not require a ChatGPT app schema refresh.
- Keep client payloads narrow enough to pass preflight: compact intent and typed variable inputs only.

## Scope and Maintenance

- Lensically is multi-account by default. Classify changes as universal or account-scoped before implementation.
- Infrastructure, gateway, schema, workflow, continuity, idempotency, release, and regression-prevention fixes default to universal unless a real account-specific reason exists.
- Memory-only instructions are insufficient when code, schema, a gate, or a focused test can enforce the behavior.
- Record a completed engineering fix once: source-controlled implementation, focused regression coverage, concise current documentation when architecture changed, and one bounded engineering audit entry.
- Do not preserve retired systems in active documentation merely because they consumed effort. Git history is the archive.
- Remove obsolete rules when their supporting runtime is retired. Do not let this file grow into a transcript of every past failure.
