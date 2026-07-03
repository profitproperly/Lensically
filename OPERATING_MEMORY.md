# Operating Memory

Read this after `AGENTS.md` at the start of every Lensically chat. Keep entries short, factual, and reusable.

## Global Memory

- Use the global `operational-memory` skill for reusable lessons, repeated slowdowns, and token/usage efficiency.
- Global memory lives at `C:\Users\brian\.codex\OPERATING_MEMORY.md`; project-specific Lensically memory stays in this file.

## Deployment Credentials

- Do not assume Cloudflare credentials are unavailable because direct `wrangler` lacks `CLOUDFLARE_API_TOKEN`.
- Do not inspect `.dev.vars` with commands that print matching lines; it contains live token-looking secrets. Verify env presence with booleans or key names only.
- The Cloudflare deploy token/account are loaded by `lensically-worker/.cloudflare.deploy.ps1`.
- Use the repo deploy scripts so credentials are sourced:
  - Worker: `cd lensically-worker; npm run deploy:cf`
  - Web: `cd lensically-web; npm run deploy:cf`
- `lensically-web` has no plain `npm run deploy` script; use `deploy:cf`.
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

## Custom GPT Growth Direction

- Lensically Operator GPT should evolve from post generation into page-growth optimization. Add a GPT growth context action that exposes follower trend, net daily follower change, best/weak growth days, posts near growth windows, saved patterns, scheduled posts, and strategy memory.
- Advanced loop: GPT tags each scheduled post with pillar/hook/style/experiment metadata, Lensically later compares those tags against follower growth and engagement, then GPT proposes rule changes with sample-size caution. Approved changes should persist as `approved_rule` strategy memory.

## Account Separation

- Batch Schedule presets are account-specific, not user-global. Always pass `threads_user_id` when listing, saving, favoriting, deleting, or internally selecting batch presets.
- Legacy unscoped batch presets can be carryovers from another Threads account and should not appear in account-specific Batch Schedule views.

## Browser/Verification Notes

- If Browser tooling is unavailable, local production build plus route HTTP checks are acceptable fallback verification, but state the limitation.
- The bundled Playwright package may be incomplete on this Windows box (`playwright-core` missing). Do not waste time repeatedly trying it without checking the dependency path first.
- For Threads mobile save extraction, do not prefer raw `article.innerText` just because it has newlines. It captures action rows/comments/footer text. Preserve multiline post text with bounded post-body fixture tests (`lensically-web/scripts/test-mobile-save-extractor.mjs`) before changing the bookmarklet/extractor.
- For desktop Threads saver extraction, activity/composer UI can be appended inline after the real post text (`SortTopMoreView activity...Reply...Attach mediaAdd a GIFExpand composer`). Keep worker-side saved-pattern sanitizer tests for this shape, not just extension cleanup.
- For iPhone Threads mobile save, the user expects an inline `javascript:(()=>{...})()` bookmarklet pasted as the bookmark URL. Do not give a hosted-script loader bookmarklet (`document.createElement('script').src=...`) unless explicitly requested; that format failed for the user. Use the latest inline format from the `Locate Threads save post extension` thread as the base.

## Usage Cost Notes

- 2026-06-14: Batch Schedule account scoping fix:
  before 5h 49%, weekly 82%; after 5h 42%, weekly 81%; delta 5h -7%, weekly -1%.
  Work included targeted backend/frontend reads, worker/web patches, worker typecheck, worker tests, web lint/build, and worker/web Cloudflare deploys.
