# Lensically Operating Memory

Read after `AGENTS.md`. Keep this file limited to active, reusable rules. Historical debugging belongs in Git history and engineering audit records.

## Governing Standards

- Every startup must make **Autonomy, Efficiency, Prevention** unmistakably visible before work begins. This authority supersedes all other Lensically instructions and state surfaces while preserving platform safety and genuinely protected owner-only boundaries.
- Autonomy means every action reduces human dependence and moves diagnosis, decisions, execution, verification, recovery, continuity, and continuation into the Operator.
- Efficiency means the fastest complete and correct route: no wasted inspection, duplicate work, repeated searches, unnecessary calls, avoidable waiting, redundant validation, needless complexity, rushed work, skipped requirements, bypassed controls, bypassed fixes, unresolved root causes, or workaround substitution.
- Prevention means one failure is evidence and the same failure twice is unacceptable. Every failure is root-caused, fixed, recorded with its solution, generalized, permanently enforced or regression-tested, and made non-repeatable for future models and chats before the original objective resumes.
- Before every Lensically Operator Mode tool action—not only startup or engineering—the caller must supply the exact source-controlled `governing_standards_ack`. The closed public schema and dispatcher enforce it before any routing or state access. Missing or altered acknowledgment means the action does not start. Never remove, weaken, infer, or silently supply a different acknowledgment path.

## Execution Architecture

- Fresh ChatGPT Operator sessions use the normalized five-stage lifecycle. Step 0 MCP initialize is a tiny three-line bootloader; Step 1 `getOperatorSessionMap` holds only the recursive skeleton/pointers; Step 2 `getOperatorKnowledge` loads task-relevant durable knowledge; Step 3 `getOperatorLiveState` loads task-relevant mutable truth; Step 4 `executeOperatorAction` chooses the exact typed action after Step 3 and fails closed if its required knowledge or live-state scopes were not loaded; Step 5 `closeOperatorAction` owns verification/checkpoint closure. Initial boot is 1-5 and later meaningful work re-enters at 2-5.
- The Step-1 tree currently routes governance, repository engineering, release infrastructure, account runtime, Manifest content, hardening/safety, and commercial product. New knowledge grows behind those pointers, never inside initialize or the session map. A genuinely new fundamental plane may add one branch without moving unrelated content.
- Repository capability semantics remain explicit inside Step-2 knowledge: internal `readRepoFile` and `searchRepoFiles` are known-exact-file capabilities, with `searchRepoFiles` requiring one exact file path. Unknown-location/free-text repository discovery belongs to Recovery. Because internal capabilities are not public model tools, future sessions cannot directly misroute a directory prefix into `searchRepoFiles`; Step 4 remains the execution choke point.


- Main MCP advertises exactly five public lifecycle tools. Operational capabilities are internal typed contracts beneath Step 4. `executeOperatorAction` generates one closed discriminated union from those contracts, so the model gets strong per-action schemas without public `profile_id`, generic `inputs`, freehand routing text, wrappers, or independent direct capability calls. Any real change to the five public lifecycle schemas requires an app refresh.
- When deployment changes a public MCP schema and the current chat still holds the previous closed schema, treat that state as the normal client-refresh boundary—not a product blocker or unresolved engineering defect. Do not create server workarounds, compatibility bridges, Recovery detours, or additional investigation to make the stale chat call the new schema. Finish the handoff with the exact deployed SHA/version and verification evidence, stop, and use the exact terminal line `refresh the lensically operator mode mcp now`.
- The canonical architecture is the **Execution Kernel** (`lensically-execution-kernel-v1`). It resolves the capability directory, payload contract, source-defined route, pre-call policy, continuity and authorization, execution receipt, blocker prevention, continuous hardening, durable work state, and action closure before one typed handler executes.
- Exact deterministic and exact source-defined intents keep precedence over broader directory guidance. The model does not choose tools, wrappers, retries, or fallbacks.
- Route selection must remain D1-independent. Do not reintroduce execution-library compilation, dynamic maps, route incidents, promotions, phonebook overrides, OpsMemory routing, or execution-event recording. Retired top-level receipt names must not be emitted or restored.
- Initialize issues a signed deployment-scoped MCP session. Reject a session from an older Worker deployment or Execution Kernel version before routing and require reinitialization.
- Direct internal tool calls are rejected. Recovery remains independent break-glass infrastructure; the extensive post-consolidation call campaign must identify and remove any remaining normal-path dependency before cleanup.
- Preserve account protections after routing: selected brand, explicit Proceed, server-side continuity, idempotency, authorization, content gates, ownership checks, and scheduler safety.
- Manifest uses `manifest-autonomous-growth-engine-v1` under `autonomous-growth-mission-v2`. After Proceed, reconcile live schedule, delivery state, metrics, Content Focus, recent audience exposure, and durable cycle state; then resume routine operation without opening a mandatory discussion or review gate.
- The Operator owns routine strategy, generation, scheduling, evaluation, recovery, and evidence-triggered engineering. The owner is an optional critic, taste partner, market-intelligence source, and unrestricted override.
- Maintain an exact rolling 48-hour runway. Preserve valid existing posts, generate only missing hourly slots, commit no more than 24 posts per bounded call, verify live coverage afterward, and replay interruptions through the same stable operation identity.
- Use adaptive expected marginal value rather than fixed ratios. Frequency alone is not fatigue. Keep proven winners active while comparable performance remains strong, distinguish mechanism repetition from weak execution repetition, and continuously develop additional winner families.
- The four-post batch is an optional presentation surface only. It must never block autonomous generation or scheduling.
- Only spending, credential or ownership changes, irreversible deletion, fundamental mission changes, disabling critical infrastructure, or material account/project danger require owner ratification.

## Autonomous Business Operator

- The runtime role is the **Lensically Autonomous Business Operator** under `agent-native-operating-contract-v1`. It restores durable state, reconciles, diagnoses, selects one priority, executes, verifies, records, declares one next action, and checkpoints. Chat is an optional interface, not the business engine.
- Root `ENGINEERING_CONTINUATION.md` is the sole continuation ledger for all Lensically jobs. It owns accepted-job visibility, precedence, the one active job, and the one current action.
- `operator_work_state` and `operator_work_ledger` remain non-authoritative execution telemetry and historical intake evidence. They cannot create, activate, reorder, or resume work that is absent from the canonical continuation ledger.
- `single-active-outcome-v1` permits interruption only for verified P0/P1 incidents recorded in the canonical ledger. All other ideas remain visible as queued or captured work without changing the active job.
- Every operational result must contain an action-closure receipt, but that receipt points back to `getEngineeringContinuation` and may not independently define continuation. A temporary dependency is invalid without an explicit retirement condition.
- Do not ask the owner what happens next when mission and durable evidence are sufficient. Owner approval is authorization only; the Operator arrives with the recommendation, prepared action, verification plan, and follow-on checkpoint.

## Engineering Speed

- Routine implementation target is under ten minutes when the platform operation permits it.
- Speed comes from removing unnecessary work, not skipping required correctness checks.
- Protect throughput with one active implementation outcome, one interrupting P0/P1 incident when necessary, unlimited captured deferred ideas, and zero untracked side objectives.
- Freeze scope when validation begins. A failing test permits only the smallest repair required by the frozen acceptance criteria; enhancements wait for the next outcome.
- Exact owner-supplied implementation text is a frozen specification once its target is known: do not condense it, reinterpret it, or restart discovery. Apply the atomic change and proceed directly through focused validation, exact-SHA release, and live verification. A failure audit cannot close with analysis, retry, recommendation, or chat memory; prevention must be durably enforced first.
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

- Failed: starting Lensically work from `C:\Auto-Threads` and running `git status` or reading root continuation/state there treats the parent workspace as the repository and returns `fatal: not a git repository` or empty root state. Use: immediately switch to `C:\Auto-Threads\lensically` for all Lensically git, continuation, state, validation, and edit work. Applies when: a Codex session opens with cwd `C:\Auto-Threads`; that folder only houses the real Lensically repository as a child.
- Failed: local Lensically source can lag GitHub `main` because most work happens in ChatGPT/web/cloud. Use: at every new local Codex session, after reading startup files in `C:\Auto-Threads\lensically`, run `git status --short --branch`, then update from GitHub `main` before source inspection or edits. If local changes exist, preserve them and use a safe non-destructive update path; do not overwrite user work.
- Failed: ending Lensically turns with a dirty repo leaves the next session to rediscover unrelated local state. Use: before final, run `git status --short --branch`; commit and push intentional tracked changes, ignore generated/local artifacts in `.gitignore`, or remove disposable generated files. Applies when: any Lensically local Codex work creates, preserves, or reveals dirty tracked/untracked files.
- Failed: pushing `profitproperly/Lensically` with `C:\Users\brian\.codex\profiles\briangriffin355.env` `GITHUB_TOKEN` returned `Permission to profitproperly/Lensically.git denied to opmgdeadman`. Use: do not use Brian/opmgdeadman global GitHub token for Lensically pushes; require the Profit Properly GitHub credential or a connected app/tool with write access to `profitproperly/Lensically`. Applies when: local Git push asks for credentials or `gh auth status` is unauthenticated.
- Failed: plain `git push origin main` in Lensically can fail with `could not read Username for 'https://github.com': terminal prompts disabled` because global Git config routes GitHub auth through logged-out GitHub CLI (`gh auth git-credential`). Use: bypass the `gh` helper and force Windows Git Credential Manager for Lensically pushes with `git -c credential.https://github.com.helper= -c credential.helper=manager push origin main`. Success signal: push fast-forwards `profitproperly/Lensically` and `git rev-parse HEAD` matches `git rev-parse origin/main`.
- GitHub `main` is authoritative. Read the current head before mutations.
- Large Worker files use Git blob, tree, commit, and ref APIs. Do not use the GitHub Contents API for oversized files.
- For a known exact file, use one bounded main-gateway read and search the returned text locally.
- Free-text or unknown-location repository discovery uses Recovery. Do not submit repository-search payloads through the main public gateway.
- Exact replacements must match once. If the head changed or the anchor is ambiguous, reload current source and correct the variable input; the tool route is still valid.
- YAML workflow changes require a complete reviewed block or whole-file replacement with correct indentation and readback before dispatch.
- Never expose tokens or secret values while diagnosing GitHub, Cloudflare, OAuth, or deployment configuration.
- Failed: using global `C:\Users\brian\.codex\scripts\Invoke-CodexDefaultProfile.ps1` for Lensically Cloudflare diagnostics selected Brian's default account, which does not contain `lensically-worker`. Use: Lensically's Profit Properly Cloudflare account is recorded in project Wrangler cache at `C:\Auto-Threads\lensically\.wrangler\cache\wrangler-account.json` as account `42ea358a42af1def2087ba93a2391b3d`; project Cloudflare access requires token/profile reference `fancy-math-e8d1`. Applies when: reading Worker Builds logs, deployments, D1, or Cloudflare health for `profitproperly/Lensically`. Never print or store the underlying secret token value.
- Resolved: local Codex has Profit Properly Cloudflare access through Windows user environment variables `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID=42ea358a42af1def2087ba93a2391b3d`. Use: from `C:\Auto-Threads\lensically\lensically-worker`, run Wrangler commands with the user environment token; verified on 2026-08-01 by `npx wrangler whoami` showing the Profit Properly account and `npx wrangler deployments list --config wrangler.jsonc` reading latest `lensically-worker` deployment `78e71410-f949-409a-9f47-7a69d73d3804`. Do not echo the token value.
- Domain architecture is fixed: `lensically.com` is the public sales site served by `lensically-worker/public/`, `app.lensically.com` is the private operational `lensically-web` Next.js app, and `api.lensically.com` is the Worker/API/MCP backend. Do not restore `lensically-web` apex ownership or `/operator/*` proxying, and do not attach the apex to the temporary `lensically-operator` Pages project.
- Failed: local `npx wrangler whoami` can report `Failed to fetch auth token: 400 Bad Request` for Lensically even while Recovery has valid Cloudflare access. Use: `tool_search` for Lensically Recovery Cloudflare tools, then call `lensically_recovery.getCloudflareWorkerState` for read-only Worker deployments, versions, bindings, domains, and account verification. Success signal: it returns `lensically-worker`, custom domain `api.lensically.com`, and a production `LENSICALLY_COMMIT_SHA` matching the expected release head.
- Failed: GitHub check `Workers Builds: lensically-worker` from the Cloudflare Workers and Pages app can fail on a docs-only commit such as `551cc6e8a3ded180fda84b1b386592ee9144d4cb` even when the source-controlled Lensically `worker-release` workflow deploys and verifies the same commit successfully. Use: treat `worker-release` plus `lensically_recovery.getCloudflareWorkerState` and `/api/operator/health` as authoritative production evidence; diagnose the native Cloudflare Builds integration separately as duplicate/misaligned CI, not as proof that production is broken. Applies when: `getRepoStatus` shows `cloudflare_validation_state=failed` but `worker-release` is green and Cloudflare Worker bindings show the exact expected `LENSICALLY_COMMIT_SHA`.

## Validation and Deployment

- Normal release order: fast push validation, TypeScript and capability lifecycle preflight, one exact-SHA Operator shard campaign when required, an explicit `worker-deploy` dispatch for the same SHA, supporting release gates, deployment, and live verification.
- Failed: broad local `npm test` for `lensically-worker` can OOM inside workerd/V8 on Windows before producing assertions. Use focused Vitest files for the changed behavior and keep full production confidence on the source-controlled release workflow unless the OOM is the target defect.
- Failed: `npm run release:acceptance:check` failed on Windows with `release_acceptance_source_outside_repository:scripts/run-d1-backfill.mjs` because `validate-release-acceptance.mjs` compared Windows backslash paths against a POSIX slash prefix. Use `path.relative()` containment checks for repository-boundary validation.
- Failed: `npm run lint -- --file 'app/(internal)/saved-patterns/page.tsx'` in `lensically-web` returned `Invalid option '--file'` under ESLint flat config. Use: pass the path directly, e.g. `npm run lint -- 'app/(internal)/saved-patterns/page.tsx'`. Applies when: running focused ESLint checks for Next app files.
- Failed: `DROP TABLE IF EXISTS external_patterns` in `lensically-worker/test/patternsImport.spec.ts` reset setup caused every `/api/patterns/*` route to fail with `database_integrity_failed:external_patterns` after external patterns became migration-owned. Use: keep the global `test/apply-migrations.ts` setup and reset saved-pattern tests with `DELETE FROM external_patterns`. Applies when: updating saved-pattern Worker tests under the database-authority architecture.
- Failed: `spawnSync("npm", args, { shell: process.platform === "win32" })` in `lensically-worker/scripts/run-operator-validation.mjs`, `lensically-worker/scripts/run-cloudflare-validation.mjs`, or local-node worker command dispatch when `--testNamePattern` contains `|`. Use: invoke `node.exe` with `C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js` or `npx-cli.js` and pass the original args array without shell parsing. Applies when: running Lensically validation scripts or local execution node jobs on Windows.
- Failed: importing `node:child_process` from tests running inside `@cloudflare/vitest-pool-workers`. Use: keep Worker endpoint and D1 integration assertions in Vitest, and run actual local subprocess/installer proof through standalone Node or PowerShell scripts invoked by `scripts/run-cloudflare-validation.mjs`. Applies when: proving local execution node worker behavior that must spawn local Windows processes.
- Failed: redacting every 32+ character token before exact-SHA comparison in local-node worker command output. Use: allow unredacted output only for `git rev-parse HEAD`, then compare the exact requested SHA; keep redaction for ordinary command stdout/stderr. Applies when: local validation receipt generation must prove the checked-out repository SHA.
- Failed: running local-node validation against an isolated exact-SHA worktree while assuming the owner repo's `node_modules` are available. Use: run `npm ci` inside the isolated job worktree before TypeScript, Vitest, full validation, or worker build stages. Applies when: local execution node jobs run from node-controlled source directories.
- Failed: hashing a committed worker package on Windows after a checkout that applied line-ending conversion. Use: configure the local-node bare cache/worktree with `core.autocrlf=false` before adding exact-SHA worktrees, then hash the node-controlled package bytes. Applies when: worker update packages are authorized by SHA-256 on Windows.
- Failed: reading an installed local-node `config.json` with Node `JSON.parse(readFileSync(path, "utf8"))` after Windows PowerShell 5 wrote UTF-8 with BOM. Use: strip a leading `\uFEFF` before JSON parsing or write BOM-free JSON. Applies when: Scheduled Task commissioning writes config files with Windows PowerShell.
- Ordinary commits validate and intentionally skip deployment. `cloudflare-deploy-gate.mjs` may deploy only when the validation receipt matches the current commit and its message contains the verified release marker.
- Full Operator diagnostics remain available as eight deterministic parallel shards when focused evidence is insufficient. GitHub Actions billing or availability is not a normal release dependency.
- Recovery cannot bypass the exact-head Cloudflare receipt. It may restore Main or inspect a broken deployment plane, then normal validation and release return to the gated path.
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
- Source selection and generation use adaptive expected marginal value. Treat recent frequency as audience-exposure context, not fatigue proof. Cooling requires comparable performance decay or degraded execution quality; strong winners continue playing while the Operator develops emerging, adjacent, and original mechanisms.

## Manifest Innovation Cycle

- Maintain exactly two Manifest cycle rails: Innovation upstream and Main downstream. The one bootstrap clone has already been performed; never clone Main again.
- Innovation is permanently equal to or ahead of Main. When no improvement is active, it remains idle at parity. When 007 and M explicitly authorize an improvement, only Innovation advances until it is fully proven.
- Main preserves authoritative operational and historical truth. Never use it for experiments, stress tests, dry runs, canaries, fault injection, synthetic schedule rows, benchmark receipts, or acceptance validation.
- Innovation work is a manual 007-and-M workflow. Never activate it autonomously, run a continuous self-improvement loop, promote automatically, or create a new challenger after completion.
- Innovation acceptance is physically isolated in `SHADOW_DB`, snapshot-only, production-shaped, and zero-network. The runtime may not receive production `DB`; `live_read` is forbidden; Threads reads and writes are forbidden; test receipts and lineage remain isolated.
- Preserve parity by reusing canonical schemas and shared domain contracts rather than copying a second Manifest engine. Innovation may add narrow adapters, orchestration, fault injection, isolated persistence, and benchmark receipts, but duplicated strategy, source-selection, gate, lineage, or learning logic is prohibited.
- Promotion is not part of Innovation development. After complete end-to-end proof, stop. A separate explicit 007-and-M decision may authorize porting only the validated implementation into Main; never promote test data, synthetic history, or Innovation lineage.
- The current proven envelope is no-op at or below 30 seconds, 24 slots at or below 6 minutes, and 48 slots below 10 minutes, with complete lineage, selective regeneration, idempotent replay, retained-failure cleanup, same-snapshot A/B, compact text-redacted receipts, and zero Main/Threads access.

## Recovery and Client Boundaries


- Recovery remains independently deployed and source-defined. It must not depend on the main gateway, main D1 preparation, account data, or Operator routing.
- Main `repository_status` is the normal source for the current repository SHA, bounded GitHub checks, commit statuses, and Cloudflare validation state. Use Recovery only for break-glass classes that Main or its deployment plane cannot receive or complete: free-text discovery when the location is unknown, terminal failure diagnostics, exact repair of a blocked Main contract, health inspection, rollback, and smoke verification. Return normal engineering state, work intake, validation, and release to Main immediately after repair.
- ChatGPT may cache a public MCP schema after a deployment. Server smoke proves the live schema; the installed app may still require an explicit Refresh when the public tool schema itself changes.
- Main advertises exactly five public lifecycle tools. A real schema change to those five requires the mandatory ChatGPT app refresh/context-port handoff after the exact deployed head is live; internal capability additions behind Step 4 do not enlarge the public tool count or startup payload.
- Keep client payloads narrow enough to pass preflight: compact intent and typed variable inputs only.

## Scope and Maintenance

- Lensically is multi-account by default. Classify changes as universal or account-scoped before implementation.
- Infrastructure, gateway, schema, workflow, continuity, idempotency, release, and regression-prevention fixes default to universal unless a real account-specific reason exists.
- Memory-only instructions are insufficient when code, schema, a gate, or a focused test can enforce the behavior.
- Record a completed engineering fix once: source-controlled implementation, focused regression coverage, concise current documentation when architecture changed, and one bounded engineering audit entry.
- Do not preserve retired systems in active documentation merely because they consumed effort. Git history is the archive.
- Remove obsolete rules when their supporting runtime is retired. Do not let this file grow into a transcript of every past failure.
