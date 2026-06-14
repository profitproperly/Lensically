# Operating Memory

Read this after `AGENTS.md` at the start of every Lensically chat. Keep entries short, factual, and reusable.

## Global Memory

- Use the global `operational-memory` skill for reusable lessons, repeated slowdowns, and token/usage efficiency.
- Global memory lives at `C:\Users\brian\.codex\OPERATING_MEMORY.md`; project-specific Lensically memory stays in this file.

## Deployment Credentials

- Do not assume Cloudflare credentials are unavailable because direct `wrangler` lacks `CLOUDFLARE_API_TOKEN`.
- The Cloudflare deploy token/account are loaded by `lensically-worker/.cloudflare.deploy.ps1`.
- Use the repo deploy scripts so credentials are sourced:
  - Worker: `cd lensically-worker; npm run deploy:cf`
  - Web: `cd lensically-web; npm run deploy:cf`
- Direct `npx wrangler ...` calls need the same credential loader sourced first.

## GitHub Credentials

- Root `.github.deploy.ps1` loads `GH_TOKEN`.
- It was fixed on 2026-06-14 after a malformed same-line env assignment caused a PowerShell parser error.
- Do not print secret values while debugging credential loading; verify with booleans or token length only.

## Qwen Direction

- Qwen is not to be used for Lensically project automation or post generation.
- Do not delete local Qwen/llama.cpp files unless explicitly asked.
- Remove or avoid startup/task flows that launch the Qwen worker for Lensically.

## Hermes Direction

- Hermes/GPT-backed generation belongs inside Lensically's normal Create Post and Batch Schedule workflow.
- First priority is wiring Hermes to the data Lensically already has: post archive, top posts, saved patterns, scheduled posts, and selected Threads account context.
- Hold off on heavy quality gates until the generation workflow is usable.

## Account Separation

- Batch Schedule presets are account-specific, not user-global. Always pass `threads_user_id` when listing, saving, favoriting, deleting, or internally selecting batch presets.
- Legacy unscoped batch presets can be carryovers from another Threads account and should not appear in account-specific Batch Schedule views.

## Browser/Verification Notes

- If Browser tooling is unavailable, local production build plus route HTTP checks are acceptable fallback verification, but state the limitation.
- The bundled Playwright package may be incomplete on this Windows box (`playwright-core` missing). Do not waste time repeatedly trying it without checking the dependency path first.

## Usage Cost Notes

- 2026-06-14: Batch Schedule account scoping fix:
  before 5h 49%, weekly 82%; after 5h 42%, weekly 81%; delta 5h -7%, weekly -1%.
  Work included targeted backend/frontend reads, worker/web patches, worker typecheck, worker tests, web lint/build, and worker/web Cloudflare deploys.
