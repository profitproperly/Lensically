# Lensically Agent Rules

## Start Here

- Read this file at the start of every new chat.
- Read `OPERATING_MEMORY.md` immediately after this file. Add concise entries there whenever you find a repeated slowdown, bad assumption, credential/deploy trap, or workflow fix that future agents should not rediscover.
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

- Find the existing integration point before adding new code.
- Reuse existing helpers and patterns where they still reflect the current product.
- Keep changes narrow.
- Do not invent placeholder UI, fake navigation, or dead controls.
- Do not hardcode secrets or environment-specific URLs.
- Do not edit `PROJECT_CONTEXT.md` unless the user explicitly asks.

## Git Rules

- Check `git status` before staging or committing.
- Inspect any target file that already has local edits before changing it.
- Stage only the files for the current task.
- Never use `git add .` or `git add -A`.
- Never reset or discard unrelated changes without explicit approval.

## Execution Default

Unless the user says `talk only` or explicitly opts out, implementation tasks default to:

1. make the code change
2. run the relevant checks yourself
3. commit the task files
4. push to `origin`
5. deploy the affected runtime

## Verification And Deploys

- If `lensically-web/**` changed, run frontend checks and deploy the frontend if runtime code changed.
- If `lensically-worker/**` changed, run backend checks and deploy the worker if runtime code changed.
- Local agent work is multi-account by default. Do not add brand-specific agent runtimes unless the user explicitly asks for a one-off experiment.
- For browser tasks, use both browser surfaces when available: use the Chrome extension browser for the user's real logged-in/live tab state, and use the Codex in-app browser for isolated verification, local app checks, and clean repro when relevant.
- If `lensically-worker/src/index.ts` changed, include the backend auth/API smoke coverage used by this repo.
- Do not tell the user to run checks, push, or deploy. The agent does that work.
- In the final handoff, state what you ran and what you deployed.

## Response Rules

- Do not use `CODEX RESPONSE`.
- Do not use `Run These Now`.
- Do not tell the user to run `x`, `y`, or `z`.
- Use a plain handoff: what changed, what was verified/deployed, and any remaining risk.

## Documentation Rules

- Update `AGENTS.md` when workflow rules or default behavior change.
- Update `CURRENT_STATE.md` only when product reality or normal workflow meaningfully changes.
- Remove stale guidance instead of layering new text on top of bad old text.

## Safety

- If the correct integration point is unclear, stop and ask instead of guessing.
- For destructive or high-risk changes, verify adjacent flows that could regress.
- Treat strict TypeScript null safety as required.
