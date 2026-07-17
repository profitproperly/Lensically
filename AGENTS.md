# Lensically Agent Rules

## Start Here

- Read this file at the start of every new chat.
- Read `OPERATING_MEMORY.md` immediately after this file. Project durable memory is the default source and write target for project-specific facts.
- Read `C:\Users\brian\.codex\OPERATING_MEMORY.md` before project work for cross-project rules only. Do not write project-specific Lensically facts there.
- Before project work, run `git status --short`, then `git pull --ff-only origin main` when the worktree is clean. ChatGPT may now edit Lensically through the cloud engineering MCP, so GitHub is the source of truth between Codex sessions. If the worktree is dirty, inspect the changes first and do not overwrite them.
- Add detailed, replayable entries to project `OPERATING_MEMORY.md` whenever you find a repeated slowdown, bad assumption, credential/deploy trap, failed path, or workflow fix that future Lensically agents should not rediscover. Prefer `Failed: <exact failed path>. Use: <exact working path>. Applies when: <specific context>.` Include required setup, commands, URLs, paths, success signals, stale-state rules, and fallback paths when they matter.
- Read the repository before editing code.
- Prefer small, production-safe changes over broad rewrites.
- Preserve unrelated local changes. Do not reset or overwrite work you did not make.

## Global Skills

- Do not read every skill at startup. Use skill metadata to choose the relevant skill, then read only that skill's `SKILL.md`.
- Use `operational-memory` when the task involves repeated mistakes, token/usage efficiency, project memory, workflow fixes, failed commands, deploy traps, reusable lessons, or self-improvement.
- Use `project-onboard` when the task involves onboarding a repo, Codex optimizer setup, `AGENTS.md` creation, project memory creation, or existing project merge.
- When a new global skill is created, add its trigger rule here and to the global Project Onboard template so future projects know when to use it from startup.

## Current Reality

- This repo is not a SaaS playbook. Do not describe it that way.
- Treat stale references to removed product areas, auth flows, OAuth flows, reviewer flows, or old response wrappers as legacy unless the current task explicitly targets them.
- Do not reintroduce removed routes, copy, docs, or workflows just because old code or docs still mention them.

## Repo Shape

- `lensically-web/` is the frontend.
- `lensically-worker/` is the backend.
- `lensically-recovery-worker/` is the independent break-glass MCP control plane used by GPT to repair the main backend when the primary Lensically MCP is unavailable. Keep it small, stateless, source-defined, and separately deployed; never add account, generation, or customer data access to it.
- Frontend work belongs in `lensically-web/**`.
- Backend, persistence, and API work belongs in `lensically-worker/**`.

## Working Rules

- Lensically Operator GPT prioritizes capability continuity and workflow reliability over speed. Slow MCP calls are acceptable when they preserve the full intelligence, context, tools, and write authority needed for the workflow. Do not prevent 502s by stripping useful context, removing canonical capabilities, degrading to read-only behavior, or forcing the owner to segment work. Fix transport limits with caching, aggregation, pagination, resumable operations, idempotency, and structured recovery so a single slow/failing dependency cannot make the entire MCP surface unusable mid-workflow.
- Lensically Operator GPT plus the private MCP is the primary always-on agent for Lensically engineering and operations, intentionally replacing routine Codex use so Codex's five-hour/weekly subscription limits remain available for MCP repair, browser-only app maintenance, or unrelated projects. Preserve Codex-equivalent MCP intelligence, repository editing, testing, deployment, memory, and workflow authority. Codex is the emergency/bootstrap path, not the normal execution engine. Treat any 502 or unexpected read-only fallback that interrupts an active GPT workflow as a product-blocking reliability defect requiring systemic fault containment and regression coverage.
- Engineering time is a business resource. Group related exact replacements through `applyRepoPatchSet` so all files validate before one commit advances `main`. For a normal release, do not dispatch separate full typecheck, Operator-test, GPT-memory-test, and deploy workflows. Call `runEngineeringRelease` once for the final SHA, reuse an existing successful receipt, and use `getEngineeringRelease` for bounded server-side waiting. Direct workflow tasks are diagnostic exceptions only.
- Performance learning uses `performance-evaluator-v1`: fingerprint published content, compare only age-matched 6/12/24/48/72-hour post metrics, aggregate repeated feature evidence, require sample-size confidence, and feed the latest learning brief into generation. Threads follower totals are account-level trajectory data only. Never attribute follower movement to an individual post, posting day, batch, surrounding window, or posting period, and never use follower-day association in post ranking, hypotheses, tag performance, or generation guidance.

- Lensically is multi-account by default. Before making an account-specific rule, gate, workflow requirement, wrapper, tool bridge, schema change, or generation-policy change, classify it through the execution policy. Infrastructure, transport, continuity, routing, state-machine, MCP, schema, idempotency, and regression-prevention changes default universal. Selected-account voice, creative interpretation, strategy, source, cadence, or content changes remain account scoped. State the resolved scope in the handoff.
- Required behavior is policy as code. Authority order is backend enforcement, canonical workflow state, execution policy, MCP contract, database configuration, startup documentation, supporting memory, then conversation context. Memory stores rationale and history; it never counts as implementation or enforcement.
- `executeLensicallyIntent` is the only permanent public ChatGPT-facing Lensically MCP tool. Its public schema is frozen: `objective`, `intent`, `inputs`, optional `continuation_id`, optional `incident_id`, and optional `permit`. Startup uses `intent=startup`; do not expose or restore a separate startup tool.
- For ChatGPT MCP work, fresh sessions call `executeLensicallyIntent` with `intent=startup`, then continue using `executeLensicallyIntent` for key selection, continuity, engineering, admin, account, GitHub, Cloudflare, scheduler, publishing, deployment, repair, rollback, smoke tests, and recovery work. The Mandatory Execution Map, verified-route phonebook, and internal handlers select the execution plane, route, payload structure, sequence, retry policy, and recovery path. Direct operational and direct guard calls are rejected before lookup.
- Fresh MCP key selection is map-controlled: submit action intent `select operator key`, show only the exact four-line handshake returned by the mapped execution, wait for explicit owner approval, then submit action intent `confirm operator proceed`. The mapped procedure restores canonical persisted schedule, workflow, production-day source claims, active review batches, the active account-autonomy profile, and pending owner-ratified account decisions; never ask resume or start fresh. Later account-scoped action inputs include `proceed_confirmed=true` and a stable `operation_id` for mutations. Routine repository work, testing, workflow repair, deployment, runtime verification, routing, MCP infrastructure, and universal engineering improvements run under `operator-engineering-authority-v1`: full-discretion, outcome-bound, and without owner proposals or numerical tool budgets. Account content, scheduling, strategy, destructive data actions, ownership changes, and irreversible business decisions remain separately protected. For Manifest, hourly coverage remains a hard operating constraint. Approved content decisions may claim qualified sources without replacement, silently create/reuse and lock source cards, generate and gate drafts, then show only Post 1–4 with Source and Generated post. Approved items schedule into the earliest open hourly slots in item order, and times are reported only after persistence succeeds. Conversation memory is not accepted as workflow or decision state, and no generated continuity handle is passed between actions.
- `mandatory-execution-map-v1` is executable policy, not advisory prose. Every action must resolve to an active entry or a signed discovery incident. Known paths are mandatory and model execution choice is disabled. Lower-level pre-call routes may further constrain a mapped tool but cannot replace the map.
- When an unknown or stale path is encountered, stop the active objective, record every discovery attempt, verify the successful replacement, promote it into a new active map version, supersede the old path when applicable, and only then resume automatically. Recovery is itself a mapped execution plane, not a model-selected fallback. The same solved failure appearing twice is a system regression.
- Keep routine client preflight, payload compaction, alias selection, retry mechanics, and routing friction in telemetry and audit history. Owner-facing engineering updates report `Completed:`, `Showing now:`, and `Next action:`; surface a blocker only when owner action is genuinely required.
- Find the existing integration point before adding new code.
- Reuse existing helpers and patterns where they still reflect the current product.
- Keep changes narrow.
- If you trip on a command, shell syntax, quoting, escaping, credential path, missing tool/package, stale assumption, wrong deploy path, or user-corrected persistent fact, store the reusable fix in global or project memory before final.
- Do not invent placeholder UI, fake navigation, or dead controls.
- Do not hardcode secrets or environment-specific URLs.
- Do not edit `PROJECT_CONTEXT.md` unless the user explicitly asks.
- ChatGPT has private Lensically engineering MCP authority to edit the GitHub repo, dispatch GitHub Actions, and trigger backend deploys. Treat remote changes as expected; pull before judging current source state.

## Git Rules

- Check `git status` before staging or committing.
- Inspect any target file that already has local edits before changing it.
- Stage only the files for the current task.
- Never use `git add .` or `git add -A`.
- Never reset or discard unrelated changes without explicit approval.

## Execution Default

Unless the user says `talk only` or explicitly opts out, implementation tasks default to:

1. make the code change
2. batch related edits into a coherent work set before expensive checks
3. run focused checks during development only when they unblock debugging or reduce meaningful risk
4. run the relevant final checks yourself once the coherent work set is complete
5. commit the task files
6. push to `origin`
7. deploy the affected runtime once after final verification

For long goals, use checkpoint commits: when a coherent safe milestone is reached, or the user says limits are close / asks to checkpoint, run only targeted checks needed for that milestone, commit and push the safe state, and deploy only if that milestone is independently useful or required for the next step.

## Verification And Deploys

- Prefer one final verification/deploy pass per coherent work set. Avoid repeated full tests, frontend builds, Chrome schema refreshes, and Cloudflare deploys inside the same larger task unless a focused check or live deploy is needed to diagnose a blocker.
- During larger goals, avoid refreshing the Lensically Operator GPT schema after each intermediate GPT action change. Batch schema/instruction refreshes at the end, unless the GPT needs the new action immediately for the next step or the user asks for a checkpoint that should be usable from the GPT.
- When the Lensically Operator GPT OpenAPI schema or GPT-facing action behavior changes, refresh the Custom GPT action schema before final handoff unless blocked. Use the Chrome extension browser path first; do not claim schema refresh is unavailable until the Chrome extension skill/browser-client path has been attempted and any blocker is captured in `OPERATING_MEMORY.md`.
- If `lensically-web/**` changed, run frontend checks and deploy the frontend once at the end if runtime code changed.
- If `lensically-worker/**` changed, run backend checks and deploy the worker once at the end if runtime code changed.
- Local agent work is multi-account by default. Do not add brand-specific agent runtimes unless the user explicitly asks for a one-off experiment.
- For browser tasks, use both browser surfaces when available: use the Chrome extension browser for the user's real logged-in/live tab state, and use the Codex in-app browser for isolated verification, local app checks, and clean repro when relevant.
- If `lensically-worker/src/index.ts` changed, include the backend auth/API smoke coverage used by this repo.
- Scheduled publishing uses both Cloudflare Cron and a Durable Object alarm, but both must obey one persisted scheduler mode: `paused`, `canary`, or `normal`. New or missing control state defaults to `paused`. Canary mode requires exactly one scheduled-post ID, attempts at most that one record, and returns to `paused`. Deployments must fail when mode is `normal` and the live overdue count is nonzero; never validate scheduler infrastructure by exposing the full overdue queue.
- Do not tell the user to run checks, push, or deploy. The agent does that work.
- The usage meter is for learning/planning, not a stop sign. If runtime code changed, still shoot for deployment after final relevant checks. Only skip/defer deployment when credentials are unavailable, checks fail, the deploy command cannot run, or the user explicitly opts out.
- In the final handoff, state what you ran and what you deployed.

## Response Rules

- Do not use `CODEX RESPONSE`.
- Do not use `Run These Now`.
- Do not tell the user to run `x`, `y`, or `z`.
- Use a plain handoff: what changed, what was verified/deployed, and any remaining risk.

## Documentation Rules

- Update `AGENTS.md` when workflow rules or default behavior change.
- Update `CURRENT_STATE.md` only when product reality or normal workflow meaningfully changes.
- Treat `AGENTS.md` and `OPERATING_MEMORY.md` as living files. Move durable workflow rules into `AGENTS.md`; store reusable facts, traps, fixes, tool limitations, and cost notes in `OPERATING_MEMORY.md`.
- Remove stale guidance instead of layering new text on top of bad old text.

## Safety

- If the correct integration point is unclear, stop and ask instead of guessing.
- For destructive or high-risk changes, verify adjacent flows that could regress.
- Treat strict TypeScript null safety as required.
