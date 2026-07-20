# Lensically Agent Rules

## Startup

- Read `AGENTS.md`, `OPERATING_MEMORY.md`, and `CURRENT_STATE.md` before Lensically work.
- GitHub `main` is authoritative. Pull current source before local Codex work and preserve unrelated changes.
- Read the target integration point before editing. Do not restore removed systems because old commits or stale documentation mention them.

## Repository Shape

- `lensically-web/` is the frontend.
- `lensically-worker/` is the main backend and Operator MCP.
- `lensically-recovery-worker/` is the independent engineering control plane for free-text source discovery, exact repair patches, terminal workflow diagnostics, and Worker deployment. Keep it small, source-defined, separately deployed, and free of account or customer data.

## Execution Contract

- Main MCP advertises a curated set of direct typed tools. Each public tool has one closed, bounded input schema with `additionalProperties: false`; `executeLensicallyIntent`, `profile_id`, generic `inputs`, objective/intent routing text, wrappers, and internal handler names are not advertised. Recovery remains an independent break-glass plane.
- The canonical server-side architecture is the **Execution Kernel** (`lensically-execution-kernel-v1`). It owns capability resolution, payload safety, source-defined routing, pre-call policy, continuity and authorization, execution receipts, reusable-blocker prevention, continuous hardening, durable work state, and action closure.
- The runtime role is the **Lensically Autonomous Business Operator** under `agent-native-operating-contract-v1`. It restores durable state, reconciles, diagnoses, selects one priority, executes, verifies, records, declares the next action, and checkpoints. Chat memory is not an operating dependency.
- The source-controlled capability directory and `static-execution-router-v1` remain active components inside the Execution Kernel. Exact deterministic and exact source-defined intents keep precedence over broader directory hints. Model tool choice, wrapper hopping, database route lookup, discovery incidents, and route promotion are forbidden.
- Legacy top-level receipt names such as `mandatory_execution_map`, `system_directory`, `client_safety`, and `execution_policy` are retired. Keep active routing and safety behavior inside the Execution Kernel and do not emit or rebuild those compatibility surfaces.
- Direct internal tool calls are rejected.
- Recovery remains an independent break-glass repair plane. Any current normal-path dependency on Recovery must be identified during the extensive post-consolidation call campaign and removed before dead-weight cleanup begins.
- Account workflows retain explicit Proceed, server-side continuity, idempotency, authorization, content gates, ownership checks, and scheduler safety after routing.
- For Manifest, Proceed restores state and opens `guided-growth-mission-v1`: the model presents a preemptive diagnostic and proposed plan, then discusses and revises it with the owner. Proceed alone never authorizes account mutation.
- Account execution requires the current persistent Growth Mission to be approved or active. Routine engineering remains autonomous. Full autonomous account mode requires an explicit owner-authorized mode change and must never be inferred from ordinary approval language.

## Engineering Default

- Implementation tasks default to complete execution unless the owner explicitly requests discussion only.
- Routine engineering target is under ten minutes when the underlying platform operation permits it.
- Use bounded inspection, one coherent change set, focused validation, one exact-SHA release, and one live verification pass.
- Maintain one active implementation outcome. New ideas are explicitly activated, deferred, merged, or rejected through `single-active-outcome-v1`; only P0/P1 incidents, required prerequisites, or material irreversible rework may interrupt frozen scope.
- Do not create a new framework, registry, memory system, map, or control layer when a direct source-defined route can enforce the requirement.
- Do not preserve obsolete infrastructure for sentimental reasons. Git history is the archive.
- Use one atomic patch set for related replacements when practical. Use a chunked write for large whole-file replacements.
- If the client blocks a payload before Lensically receives it, do not resend the same payload. Reduce or split it.
- Keep responses and receipts compact. Never echo large patch bodies, repository files, database rows, or logs through the client.
- Do not tell the owner to run checks, push, or deploy. Perform the available work directly.

## Autonomous Capability Lifecycle

- `lensically-worker/src/systemDirectory/capabilityLifecycle.json` is the mandatory source of truth for capability creation and extension.
- Resolve the System Directory first. Reuse an existing canonical capability when it can complete the objective correctly.
- When a required capability is missing, the model must create and store the declaration, Directory entry, one canonical typed handler, one static route, focused regression, minimum validation scope, exact-head release plan, and live-verification statement itself.
- Routine capability work does not require an owner prompt or owner-written specification. The model completes the lifecycle automatically and reports the result after live verification.
- Compatibility bridges, duplicate handlers, parallel registries, and memory-only capability declarations are forbidden.
- A capability is incomplete until focused validation passes, the exact verified head is released, live startup or runtime verification succeeds, and current architecture documentation is updated when behavior changed.
- Release preflight and fast validation fail closed when a new tool or System Directory entry lacks a complete lifecycle declaration.

## Repository and Git

- Check the current repository head before mutations.
- Large Worker files use Git blob, tree, commit, and ref APIs rather than the GitHub Contents API.
- Known exact files should be read once through the main bounded file-read route and searched locally. Free-text or unknown-location repository discovery uses Recovery; do not send it through the main public gateway.
- Exact text replacements must match once. A stale head or ambiguous anchor requires refreshed source and corrected input, not a new route.
- YAML workflow changes require complete-block or whole-file replacement, correct indentation, and readback before dispatch.
- Stage only task files in local Codex workflows. Never discard unrelated changes.
- Never print credentials or secret values.

## Validation and Release

- Normal backend release order is exact-head Cloudflare validation, required focused tests, a validation receipt bound to that SHA, one `[verified-worker-release]` marker commit, gated deployment of that same SHA, live runtime verification, and scheduler safety verification when publishing behavior changed.
- Ordinary commits run `npm ci && npm run validate:cloudflare`; `npm run deploy:cloudflare-gated` intentionally skips deployment unless the exact validated commit carries the verified release marker.
- Full Operator tests are diagnostic and run separately when broad account behavior changed or focused checks are insufficient.
- Recovery may repair or inspect a broken Main plane, but it must not bypass the Cloudflare exact-head validation receipt or become the normal deployment path.
- Avoid separate full validation and deployment workflows for one coherent change.
- Use bounded workflow status reads. Detailed failure diagnostics are read only after a terminal failure.
- Version changes require synchronized runtime constants, exact assertions, and current-state documentation. Do not bump versions for cleanup alone.

## Account and Content Rules

- Lensically is multi-account by default. Infrastructure, gateway, schema, workflow, continuity, idempotency, release, and regression-prevention fixes default to universal unless a real account-specific reason exists.
- Canonical brand keys are `manifest_mental`, `opmg_deadman`, and `vectrix`.
- Fresh Operator sessions use the fixed key handshake and load no account state before explicit Proceed.
- After Proceed, restore workflow state from persisted schedule, sessions, source claims, and active review records. Conversation memory is not workflow state.
- State-changing account operations use semantic idempotency so interrupted calls replay the existing result.
- Source, source-card, generation, draft, scheduling, and published-result lineage must remain intact.
- Required behavior belongs in code, typed schemas, gates, and focused tests. Documentation and memory explain the rule but do not enforce it.

## Scheduler and Learning Safety

- Cron and the Durable Object alarm obey one persisted scheduler mode: `paused`, `canary`, or `normal`.
- Missing scheduler control defaults to paused. Canary permits exactly one scheduled entry and returns to paused after one attempt.
- Normal activation is blocked while overdue approved or posting records exist. Recovery is explicit, bounded, and transactional.
- Insights collection keeps the newest-40 policy and the four America/New_York collection windows.
- Performance learning uses age-matched 6, 12, 18, and 24-hour checkpoints; 24 hours is final.
- Account follower totals are trajectory data only. Never attribute follower movement to a post, day, batch, window, or posting period.

## Documentation

- `CURRENT_STATE.md` contains only live architecture and current behavior.
- `OPERATING_MEMORY.md` contains only active reusable rules and verified traps.
- Historical attempts, superseded versions, and retired frameworks belong in Git history and bounded engineering audit records.
- Remove stale instructions instead of layering new guidance above them.
- Update these files only when active architecture or normal operating behavior changes.

## Handoff and Safety

- Owner-facing engineering updates state current live state, target agent-native state, active outcome, completed evidence, one operator-selected next action, and whether owner action is genuinely required. Analysis-only closure and vague future promises are forbidden.
- Final handoffs state what changed, what was verified, what was deployed, and any remaining external risk.
- Preserve strict TypeScript safety.
- Destructive or irreversible business actions require the existing owner-ratified protections.
- Do not invent placeholder UI, fake navigation, dead controls, or environment-specific secrets.
