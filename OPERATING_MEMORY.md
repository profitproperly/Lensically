# Lensically Operating Memory

Read after `AGENTS.md`. Keep this file limited to active, reusable rules. Historical debugging belongs in Git history and engineering audit records.

## Execution Architecture

- Every main-MCP operation enters through the sole public tool `executeLensicallyIntent` using registered `profile_id` and bounded `inputs`; optional continuation fields are `continuation_id`, `incident_id`, and `permit`. Public `objective` and `intent` fields are retired and compiled server-side. This public contract is permanent; internal capabilities may change without changing the client schema.
- The canonical architecture is the **Execution Kernel** (`lensically-execution-kernel-v1`). It resolves the capability directory, payload contract, source-defined route, pre-call policy, continuity and authorization, execution receipt, blocker prevention, continuous hardening, durable work state, and action closure before one typed handler executes.
- Exact deterministic and exact source-defined intents keep precedence over broader directory guidance. The model does not choose tools, wrappers, retries, or fallbacks.
- Route selection must remain D1-independent. Do not reintroduce execution-library compilation, dynamic maps, route incidents, promotions, phonebook overrides, OpsMemory routing, or execution-event recording. Retired top-level receipt names must not be emitted or restored.
- Initialize issues a signed deployment-scoped MCP session. Reject a session from an older Worker deployment or Execution Kernel version before routing and require reinitialization.
- Direct internal tool calls are rejected. Recovery remains independent break-glass infrastructure; the extensive post-consolidation call campaign must identify and remove any remaining normal-path dependency before cleanup.
- Preserve account protections after routing: selected brand, explicit Proceed, server-side continuity, idempotency, authorization, content gates, ownership checks, and scheduler safety.
- Manifest uses `guided-growth-mission-v1`. After Proceed, restore account state and produce the persistent Growth Mission Brief: mission, follower target, diagnostic, current bottleneck, primary objective, supporting objectives, experiments, evidence, risks, and recommended next action.
- Proceed authorizes diagnosis and discussion only. Keep account mutations locked while the mission is `discussion` or `paused`; unlock guided execution only when the owner explicitly approves or activates the plan.
- Routine engineering remains autonomous. `autonomous_operator` is a separate explicit owner-authorized execution mode and must survive fresh chats once deliberately enabled.

## Autonomous Business Operator

- The runtime role is the **Lensically Autonomous Business Operator** under `agent-native-operating-contract-v1`. It restores durable state, reconciles, diagnoses, selects one priority, executes, verifies, records, declares one next action, and checkpoints. Chat is an optional interface, not the business engine.
- `operator_work_state` stores one frozen active outcome. `operator_work_ledger` stores every proposed, queued, deferred, interrupting, merged, rejected, and completed work item with priority, reason, dependencies, completion condition, order, and evidence.
- `single-active-outcome-v1` permits interruption only for P0/P1 incidents, required prerequisites, or material irreversible rework. All other ideas are durably deferred without changing the active outcome.
- Every operational result must contain an action-closure receipt with current live state, target agent-native state, active outcome, one selected next action, priority reason, completion evidence, and owner-action requirement. A temporary dependency is invalid without an explicit retirement condition.
- Do not ask the owner what happens next when mission and durable evidence are sufficient. Owner approval is authorization only; the Operator arrives with the recommendation, prepared action, verification plan, and follow-on checkpoint.

## Engineering Speed

- Routine implementation target is under ten minutes when the platform operation permits it.
- Speed comes from removing unnecessary work, not skipping required correctness checks.
- Protect throughput with one active implementation outcome, one interrupting P0/P1 incident when necessary, unlimited captured deferred ideas, and zero untracked side objectives.
- Freeze scope when validation begins. A failing test permits only the smallest repair required by the frozen acceptance criteria; enhancements wait for the next outcome.
- Use bounded source inspection, one coherent change set, focused validation, one exact-SHA release, and one live verification pass.
- Do not run separate full validation and deployment loops for a normal change.
- Do not poll rapidly from chat. Use bounded server-side workflow status reads and inspect detailed logs only after a terminal failure.
- Related edits should use one atomic patch set when practical. If the client blocks an oversized payload before it reaches Lensically, do not resend the same shape; divide it into compact exact replacements through the registered Recovery patch path. Do not fall back to client-blocked chunked write-session calls.
- Keep public receipts compact. Never echo full patch bodies, repository files, generated knowledge, or large database records through the client.

## Autonomous Capability Lifecycle

- The canonical manifest is `lensically-worker/src/systemDirectory/capabilityLifecycle.json`.
- Resolve and reuse an existing capability first. Create a new capability only when the current Directory and typed handlers cannot complete the objective correctly.
- For a missing capability, the model performs the entire lifecycle autonomously: declaration, Directory registration, one canonical typed handler, one static route, focused regression, smallest valid test scope, exact-head release, live verification, and architecture-document update when needed.
- Routine capability engineering does not wait for owner instructions, approval, file writing, test execution, deployment, or memory recording. Existing protected destructive and irreversible business controls still apply.
- New tools and new Directory entries are rejected by validation unless the lifecycle declaration is complete. Compatibility bridges and duplicate implementation paths are forbidden.
- The task remains incomplete until the deployed startup/runtime receipt proves the capability is live on the intended commit.

## Repository Operations

- GitHub `main` is authoritative. Read the current head before mutations.
- Large Worker files use Git blob, tree, commit, and ref APIs. Do not use the GitHub Contents API for oversized files.
- For a known exact file, use one bounded main-gateway read and search the returned text locally.
- Free-text or unknown-location repository discovery uses Recovery. Do not submit repository-search payloads through the main public gateway.
- Exact replacements must match once. If the head changed or the anchor is ambiguous, reload current source and correct the variable input; the tool route is still valid.
- YAML workflow changes require a complete reviewed block or whole-file replacement with correct indentation and readback before dispatch.
- Never expose tokens or secret values while diagnosing GitHub, Cloudflare, OAuth, or deployment configuration.

## Validation and Deployment

- Normal release order: dependency-free preflight, `npx tsc --noEmit`, mandatory System Directory tests, focused Operator release gate, GPT-memory tests, Worker deployment, cron verification, and scheduler safety verification.
- Full Operator diagnostics run as eight deterministic parallel shards. Do not restore the serial single-file workflow; every active test title must remain assigned to exactly one shard and any shard failure must fail the overall run.
- Recovery dispatches releases using the configured branch plus the exact commit in `release_sha`. Checkout must equal that SHA before validation and deployment; the main gateway never dispatches deployment.
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
- Automatic scheduled delivery is the default. A missing control initializes as `normal`; `paused` is an explicit emergency-maintenance state only.
- An uncertain publish attempt quarantines only that scheduled row as `posting`. It never pauses unrelated future posts, and later runs continue selecting only due `approved` rows.
- `canary` authorizes exactly one scheduled entry for explicit diagnostics and automatically returns to its prior safe mode after one attempt.
- `normal` activation is blocked only by overdue `approved` rows that could backfill unexpectedly; quarantined `posting` rows remain isolated and do not block delivery.
- Overdue or quarantined-row recovery is explicit, bounded, and transactional and may run while automatic delivery continues.
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
- Use Recovery for registered control-plane classes: free-text repository discovery, terminal workflow failure diagnostics, exact repair when the main client blocks the payload, verified Worker deployment, and main-path break-glass recovery. Keep known-file reads and normal account work on the main source-defined route.
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
