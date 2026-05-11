# Lensically Agent Rules

## Start Here

- Read this file at the start of every new chat.
- Read the repository before editing code.
- Prefer small, production-safe changes over broad rewrites.
- Preserve unrelated local changes. Do not reset or overwrite work you did not make.

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
- If `scripts/manifest-agent-desktop.mjs`, `scripts/launch-manifest-agent-desktop.ps1`, or Hermes local app assets change, restart the local Manifest Mental desktop app so the running Hermes surface picks up the new code before handoff.
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
