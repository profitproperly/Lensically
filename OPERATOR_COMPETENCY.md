# Lensically Operator Competency Handbook

handbook_version: operator-competency-handbook-v2
purpose: Canonical durable shop knowledge owned by Step 2 of the normalized Operator lifecycle.

## Lifecycle and loading contract
- Step 0 MCP initialize contains only the two mandatory governing display lines plus the pointer to `getOperatorSessionMap`; no handbook content belongs there.
- Step 1 `getOperatorSessionMap` contains only the recursive node skeleton, traversal pointers, session identity, and signed Step-1 proof; no durable knowledge or mutable state belongs there.
- Step 2 `getOperatorKnowledge` accepts the same closed typed planned-action contract used by Step 4, derives exactly that action's canonical knowledge nodes, validates its arguments, fingerprints the action, and binds the resulting knowledge token to it. Callers do not choose node IDs. The handbook is fetched once per Worker deployment/isolate and reused from a deployment-scoped cache; it is never copied into startup.
- Step 3 `getOperatorLiveState` derives exactly the mutable scopes and account target required by the action already bound in Step 2. Callers do not choose scopes or brand targets. Step 4 `executeOperatorAction` must match the prepared capability, resolved tool, arguments fingerprint, knowledge, and live-state proof before execution. Step 5 `closeOperatorAction` verifies evidence and checkpoints.
- Initial boot is Steps 1-5. Every later meaningful task re-enters at Steps 2-5 with one action declared before knowledge/state loading, eliminating mid-workflow toolbox discovery and repeated handbook reads.
- New tools, procedures, hazards, providers, and product details update the relevant node here or the canonical internal capability registry. They do not expand initialize or Step 1 and never require unrelated knowledge to be shed.
- If a genuinely new operating domain appears, fit it under an existing branch when semantically correct. Add a new Step-1 branch only when the operating model itself gains a fundamentally new plane.

## DOMAIN repository_engineering
Load for repository inspection/mutation, Worker/backend work, private web-app work, public-site work, MCP implementation, schema/tool work, source-location questions, or engineering continuation.

### Shop ownership
- `lensically-worker/` = production backend + Operator MCP.
- `lensically-web/` = private operational app at `app.lensically.com`.
- `lensically-worker/public/` = public Lensically sales/download/license/refund/privacy/terms/data-deletion surfaces.
- `lensically-recovery-worker/` = independent break-glass repair plane, not normal engineering.
- `profitproperly/Lensically` `main` = authoritative repository/branch unless live source control proves otherwise.

### Repository procedures
- Known exact file read: `readRepoFile`; bound lines when practical.
- Known exact file search: `searchRepoFiles`; one exact file only.
- Unknown-location/free-text repository discovery: Recovery. Never probe Main with directory prefixes or speculative paths.
- One isolated exact replacement: `applyRepoTextPatch`.
- Related multi-file/multi-replacement work: `applyRepoPatchSet` so one coherent commit advances main.
- Every exact replacement in a patch set must identify exactly one location. If the same literal appears multiple times, include enough enclosing semantic context (for example the test name or surrounding contract block) to make the replacement unique before mutation; never retry the same ambiguous find string.
- Large whole-file replacement: `startRepoFileWrite` -> `appendRepoFileChunk` -> `commitRepoFileWrite`.
- New small file: `createRepoFile`.
- Repository/head state: `getRepoStatus`.

### MCP/schema procedure
- The public invocation contract is the five-stage lifecycle. `executeOperatorAction` exposes a generated closed discriminated union whose branches are derived from the internal typed capability schemas; no public generic `profile_id` or generic `inputs` envelope is allowed.
- Internal capability names listed in this handbook describe canonical server capabilities, not independently callable public tools. Step 4 is the only model-facing operational execution choke point.
- Discovery returns candidates only. Verify declared purpose, side effects, and exact typed branch before Step-4 invocation.
- After a public lifecycle schema change is deployed and live-verified, use the mandatory refresh/context-port handoff before testing the changed client surface.

### Continuation
- `ENGINEERING_CONTINUATION.md` is the sole accepted-job, precedence, active-job, and current-action authority.
- Step 3 `getOperatorLiveState` with scope `engineering_continuation` is the model-facing continuation read; the server reads the canonical ledger behind that scope.
- Chat memory, D1 work state, Growth Mission records, and action-closure receipts are evidence/telemetry only.

### Engineering efficiency
- Bounded inspection -> coherent change set -> focused validation -> exact-SHA release when production changes -> live verification -> checkpoint.
- Once exact specification, target, and integration point are known, do not repeat settled searches/reads without a contradiction.
- Never echo whole large files, patch bodies, logs, or database payloads through the client when a bounded route exists.
- If a client blocks a payload before Lensically receives it, reduce/split it; do not resend the same oversized payload.

## DOMAIN release_infrastructure
Load for GitHub Actions, Cloudflare Worker/Pages deployment, release identity, production verification, scheduler-sensitive release work, or Recovery boundaries.

### Release authority
- Production Worker releases use one explicit exact-SHA release workflow.
- Release only a head that has passed the required validation for that exact SHA.
- Never deploy a moving head when the tested SHA is already known.
- Verify deployed commit identity, MCP version, release authority, and relevant runtime boundaries after deployment.

### GitHub
- `getRepoStatus` = current head/check state.
- `listGitHubWorkflowRuns` = recent compact workflow runs.
- `getGitHubWorkflowRun` = one run and failed-step evidence.
- `runGitHubWorkflow` = configured validation task or exact-SHA Worker release.
- Failed validation blocks release. Diagnose the actual failed assertion/step; do not weaken a valid regression solely to get green.

### Cloudflare
- Worker production release uses the validated release workflow.
- Pages project creation/deployment uses dedicated Pages tools.
- Use the Profit Properly Lensically estate unless authoritative runtime configuration proves otherwise.
- Publishing/scheduler behavior changes require scheduler safety verification in the release path.

### Recovery boundary
- Recovery is break-glass only when Main or its deployment plane cannot receive or complete the repair.
- Return normal work to Main immediately after the break-glass condition is repaired.

## DOMAIN account_runtime
Load for account selection, Proceed boundaries, persisted account state, scheduling, dashboard/analytics reads, Growth Mission state, or account-scoped mutations.

### State authority
- Backend persistence is authoritative for accounts, workflow state, schedules, presets, strategy memory, source lineage, performance snapshots, and continuity.
- Browser state and chat memory are never account truth.
- Guided workflows use key selection + explicit Proceed before protected account state loads.
- Autonomous Manifest cycle tools execute under their direct autonomous contract and do not require the guided interactive Proceed handshake.

### Account controls
- Preserve selected brand, server-side continuity, idempotency, authorization, content gates, ownership checks, and scheduler safety.
- Reconcile live schedule/delivery state before acting on stale summaries.
- Reuse the same `operation_id` only to reconcile uncertain execution state; never create a second identity for the same uncertain mutation.

### Common read surfaces
- `get_account_state` = current workflow/session/draft/schedule/gate snapshot.
- `read_lensically_ui_surface` = authoritative Dashboard, Followers, Insights, Post Archive, or Saved Patterns data.
- `list_scheduled_posts`, `auditScheduledPost`, `getScheduledPostSchedulerState` = schedule/delivery state.
- `getGrowthMission` = persistent mission contract when task-relevant.

### Protected changes
- Spending, credentials/ownership, irreversible deletion, fundamental mission changes, disabling critical infrastructure, and material account/project danger remain owner-ratified.
- Routine reversible account operations do not invent approval requirements beyond the source-defined contract.

## DOMAIN manifest_content
Load for Manifest Mental strategy, source cards, generation, gates, scheduling, cycle receipts, Saved Patterns, performance learning, lineage, or content-family decisions.

### Mission and execution
- Manifest's permanent mission is account growth while protecting audience trust, content quality, account safety, and brand identity.
- The Operator owns routine strategy, generation, scheduling, evaluation, recovery, and evidence-triggered engineering under the active execution mode.
- Owner review is optional/non-blocking unless a protected decision is actually reached.

### Cycle architecture
- Use canonical cycle prepare/strategy/persist/receipt tools; do not invent parallel cycle state in chat.
- Preserve exact rolling runway semantics and existing valid scheduled posts; fill only authoritative missing slots.
- Source selection, source cards, hypotheses, generation runs, drafts, gates, schedule records, revisions, publication lineage, and maturity evaluation remain reconstructable from backend state.
- Main and Innovation/Shadow persistence remain physically isolated according to their source-defined contracts.

### Evidence and learning
- Mature content evidence drives strategy; follower totals are account-level trajectory context and are never attributed to individual posts or posting periods.
- Saved Patterns provide source evidence under the active selection contract; do not silently substitute external popularity for in-account performance when the current policy forbids it.
- Owner edits/deletions are evidence and lineage events; preserve them rather than hiding them from future learning.
- Questions, banned families, franchise rules, preservation rules, exploration policy, current style constraints, and other active content directives belong in canonical account strategy/state, not startup.

### Common capability families
- Foundation/performance: `get_manifest_intelligence_foundation`, `get_performance_learning`, `get_content_focus`.
- Cycle evidence: `get_manifest_cycle_receipt`, `get_manifest_cycle_analysis_page`, `get_manifest_locked_lineup_page`.
- Strategy/prepare/persist: `commit_manifest_cycle_strategy`, `prepare_manifest_autonomous_cycle`, `persist_manifest_autonomous_post`/batch routes as currently advertised.
- Source/generation: source-candidate reads, source-card creation/locking/reads, generation runs, gates, candidate drafts, rejection memory.
- Scheduling/results: scheduled-post reads/edits/deletions, hourly coverage, post results, published-lineage audit/recovery.

## DOMAIN hardening_safety
Load for failures, blockers, regressions, repeat incidents, prevention design, idempotency ambiguity, payload failures, validation defects, or efficiency degradation.

### Failure law
- A real unexpected tool failure interrupts the affected objective.
- Diagnose exact cause, repair it, generalize the lesson, add durable prevention/regression, validate, release when required, live-verify, then resume the interrupted step.
- A workaround, retry, alternate target, sibling business tool, or chat note is not a fix.
- Expected fail-closed control responses are boundaries to satisfy, not excuses to route around the control.

### Recurrence
- New hardening incidents are checked against prior closed incidents and promoted winning paths.
- A repeat of a resolved failure is a prevention regression, not a fresh bug.
- Prevention regression handling starts from the prior incident/root cause/prevention/regressions and asks why that prevention failed; strengthen or replace it before closure.
- First occurrence earns investigation and permanent prevention. Recurrence indicts the prevention mechanism.

### Efficiency incidents
- Repeated fingerprints, excessive call count, or execution-duration degradation without progress can become efficiency incidents.
- Efficiency means fastest complete/correct route, not fewer calls at the expense of diagnosis, validation, or durability.
- Do not duplicate validations, searches, or polling when one authoritative run/read is already in progress.

### Transport/idempotency
- An uncertain mutating transport result may be reconciled with the same stable operation identity only to establish whether execution occurred.
- Never create a second operation identity merely because a response was interrupted.
- Client-side schema/payload rejection means Lensically did not receive the requested operation unless tool evidence says otherwise.

## DOMAIN commercial_product
Load for Lensically public product surfaces, checkout/delivery/license/refund/privacy/terms/data deletion, Stripe operations, product packaging, customer delivery, or public-site ownership questions.

### Product surfaces
- Public customer-facing routes are owned by `lensically-worker/public/` and served from `lensically.com`.
- The private operational application is separate at `app.lensically.com` under `lensically-web/`.
- Identify the owning surface before editing; never infer ownership from the domain name alone.

### Commerce
- Stripe reads/mutations use the advertised Stripe tools and their source-defined protection boundaries.
- Protected financial/account ownership actions require the applicable owner ratification; ordinary read-only commercial inspection does not invent approval.
- Customer delivery/license/refund/privacy/terms behavior must remain consistent with source-controlled product contracts and production verification.

### Product architecture
- Customer-facing copy may evolve; operator/runtime truth must still come from deployed code, canonical documents, and server state rather than marketing prose.
- Public-site or download changes follow repository validation and the correct release path for the owning surface.

## Handbook maintenance rule
This handbook may grow without forcing Step 0 or Step 1 growth because `getOperatorKnowledge` resolves only requested nodes server-side. Update the smallest relevant domain section and keep domain markers stable as canonical node anchors. Historical or superseded procedures belong in Git history or engineering audit, not active competency text.
