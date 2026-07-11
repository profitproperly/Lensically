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
- Frontend work belongs in `lensically-web/**`.
- Backend, persistence, and API work belongs in `lensically-worker/**`.

## Working Rules

- Lensically is multi-account by default. Before making an account-specific rule, gate, workflow requirement, wrapper, tool bridge, schema change, or generation-policy change, explicitly decide whether the rule should be universal across accounts or scoped to one account. If the answer is not obvious, ask the owner before patching. After patching, verify whether the change is universal or scoped and state that in the handoff.
- At tool-call/workflow inception, read the active repo startup rules and durable Lensically memory before claiming capability or generating. For ChatGPT MCP work, use the Lensically tool surface and strategy memory as source of truth, then record reusable failures/fixes in repo memory and/or ops memory during the same turn.
- For ChatGPT MCP work, fresh sessions must call `getOperatorStartupContext` before engineering, admin, workflow, or account work. If unavailable directly, use `runEngineeringTool` with `tool_name: "getOperatorStartupContext"`, then `listMcpTools` with `execute_tool: "getOperatorStartupContext"` as fallback. This bootstrap is non-account-scoped and must preserve the key-selection/proceed boundary.
- Fresh MCP key selection uses stateless app-compatible enforcement: call `selectOperatorKey`, show only its exact four-line handshake, wait for explicit owner approval, call `confirmOperatorProceed` with the selected key, then include `proceed_confirmed=true` on account-scoped calls. Use the `listMcpTools` bridge when a cached direct schema does not expose the field. Do not rely on `Mcp-Session-Id`; the ChatGPT app does not preserve it across calls.
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
