import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(workerRoot, "..");

function read(relativePath) {
  return fs.readFileSync(path.resolve(workerRoot, relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(path.resolve(workerRoot, relativePath), content);
}

function replaceOnce(content, find, replacement, label) {
  const occurrences = content.split(find).length - 1;
  if (occurrences !== 1) throw new Error(`${label}: expected one exact match, found ${occurrences}`);
  return content.replace(find, replacement);
}

let index = read("src/index.ts");
index = replaceOnce(
  index,
  `    inputSchema: { type: "object", properties: { brand_key: BRAND_KEY_SCHEMA, published_post_id: { type: "string" }, include_history: { type: "boolean" } }, required: ["brand_key", "published_post_id"], additionalProperties: false },`,
  `    inputSchema: { type: "object", properties: { brand_key: BRAND_KEY_SCHEMA, published_post_id: { type: "string" }, include_history: { type: "boolean" }, compact: { type: "boolean", description: "Return only bounded verification fields and compact generation evidence." } }, required: ["brand_key", "published_post_id"], additionalProperties: false },`,
  "get_post_results compact schema",
);

const compactInsertionPoint = `    if (metrics && evaluatedMetrics) {`;
const compactBlock = `    if (payload.compact === true) {\n      const generationRun = lineageRow?.run_id\n        ? await env.DB.prepare(\n          \`SELECT id, source_card_id, source_card_family_id, source_card_version_number,\n                  objective, prompt_summary, status, metadata_json, adaptation_plan_json, created_at, updated_at\n           FROM gpt_generation_runs\n           WHERE id = ? AND account_id = ? AND threads_user_id = ?\n           LIMIT 1\`,\n        ).bind(String(lineageRow.run_id), brand.account_id, brand.profile.threads_user_id).first<Record<string, unknown>>()\n        : null;\n      const draftDetail = lineageRow?.draft_id\n        ? await env.DB.prepare(\n          \`SELECT id, run_id, source_card_id, text, status, scheduled_post_id, published_post_id,\n                  strategy_json, metadata_json, created_at, updated_at\n           FROM gpt_generation_drafts\n           WHERE id = ? AND account_id = ? AND threads_user_id = ?\n           LIMIT 1\`,\n        ).bind(String(lineageRow.draft_id), brand.account_id, brand.profile.threads_user_id).first<Record<string, unknown>>()\n        : null;\n      const primarySource = sourceCard?.primary_source && typeof sourceCard.primary_source === "object"\n        ? sourceCard.primary_source as Record<string, unknown>\n        : null;\n      return operatorJsonResponse({\n        post: {\n          published_post_id: publishedPostId,\n          text: archivePost?.post_text ?? lineageRow?.post_text ?? null,\n          posted_at: archivePost?.post_timestamp ?? lineageRow?.published_at ?? null,\n        },\n        metrics,\n        lineage: {\n          source_selection_id: sourceSelection?.id ?? null,\n          source_batch_id: sourceSelection?.batch_id ?? null,\n          source_identity_key: sourceSelection?.source_identity_key ?? null,\n          source_card_id: sourceCardId,\n          generation_run_id: lineageRow?.run_id ?? null,\n          draft_id: lineageRow?.draft_id ?? null,\n          scheduled_post_id: lineageRow?.scheduled_post_id ?? null,\n          published_post_id: publishedPostId,\n        },\n        source: sourceSelection ? {\n          saved_pattern_id: sourceSelection.source_type === "saved_pattern" ? Number(sourceSelection.internal_source_id) : null,\n          source_type: sourceSelection.source_type ?? null,\n          source_identity_key: sourceSelection.source_identity_key ?? null,\n          source_text: sourceSelection.post_text ?? primarySource?.text ?? null,\n          source_likes: Number((safeParseJsonString(String(sourceSelection.metrics_snapshot_json ?? "{}")) as Record<string, unknown> | null)?.likes ?? 0),\n        } : null,\n        source_card: sourceCard ? {\n          id: sourceCard.id,\n          family_id: sourceCard.family_id ?? null,\n          version_number: sourceCard.version_number ?? null,\n          is_current: sourceCard.is_current ?? null,\n          title: sourceCard.title ?? null,\n          transformation_contract: sourceCard.transformation_contract ?? null,\n        } : null,\n        generation_run: generationRun ? {\n          id: generationRun.id,\n          source_card_id: generationRun.source_card_id ?? null,\n          source_card_family_id: generationRun.source_card_family_id ?? null,\n          source_card_version_number: generationRun.source_card_version_number ?? null,\n          objective: generationRun.objective ?? null,\n          prompt_summary: generationRun.prompt_summary ?? null,\n          status: generationRun.status ?? null,\n          metadata: safeParseJsonString(String(generationRun.metadata_json ?? "{}")) ?? {},\n          adaptation_plan: safeParseJsonString(String(generationRun.adaptation_plan_json ?? "{}")) ?? {},\n        } : null,\n        draft: draftDetail ? {\n          id: draftDetail.id,\n          run_id: draftDetail.run_id ?? null,\n          source_card_id: draftDetail.source_card_id ?? null,\n          status: draftDetail.status ?? null,\n          scheduled_post_id: draftDetail.scheduled_post_id ?? null,\n          published_post_id: draftDetail.published_post_id ?? null,\n          strategy: safeParseJsonString(String(draftDetail.strategy_json ?? "{}")) ?? {},\n          metadata: safeParseJsonString(String(draftDetail.metadata_json ?? "{}")) ?? {},\n        } : null,\n        warning: archivePost ? null : "Published post lineage was found, but synced Threads metrics are not available yet.",\n        response_mode: "compact",\n      });\n    }\n\n`;
index = replaceOnce(index, compactInsertionPoint, `${compactBlock}${compactInsertionPoint}`, "compact post-results response");

index = replaceOnce(
  index,
  `export const OPERATOR_MCP_VERSION = "1.31.8";`,
  `export const OPERATOR_MCP_VERSION = "1.31.9";`,
  "Operator version bump",
);
write("src/index.ts", index);

let tests = read("test/operatorMode.spec.ts");
tests = replaceOnce(
  tests,
  `    expect(results.source_card.transformation_contract.must_preserve_exact)\n      .toContain("Universe, make the person reading this");\n  }, 30000);`,
  `    expect(results.source_card.transformation_contract.must_preserve_exact)\n      .toContain("Universe, make the person reading this");\n\n    const compact = await operatorTool<{\n      response_mode: string;\n      lineage: { source_card_id: string; generation_run_id: string; draft_id: string };\n      source: { saved_pattern_id: number; source_text: string };\n      source_card: { id: string; version_number: number };\n      generation_run: { id: string; metadata: Record<string, unknown> };\n      draft: { id: string };\n      performance_evaluation?: unknown;\n      metric_history?: unknown;\n    }>("get_post_results", {\n      brand_key: "manifest_mental",\n      published_post_id: publishedPostId,\n      compact: true,\n    });\n    expect(compact.response_mode).toBe("compact");\n    expect(compact.lineage).toMatchObject({\n      source_card_id: recovered.source_card_id,\n      generation_run_id: recovered.recovered_posts[0].generation_run_id,\n      draft_id: recovered.recovered_posts[0].draft_id,\n    });\n    expect(compact.source.saved_pattern_id).toBe(savedPatternId);\n    expect(compact.source.source_text).toContain("Universe");\n    expect(compact.source_card.id).toBe(recovered.source_card_id);\n    expect(compact.generation_run.id).toBe(recovered.recovered_posts[0].generation_run_id);\n    expect(compact.draft.id).toBe(recovered.recovered_posts[0].draft_id);\n    expect(compact.performance_evaluation).toBeUndefined();\n    expect(compact.metric_history).toBeUndefined();\n    expect(new TextEncoder().encode(JSON.stringify(compact)).byteLength).toBeLessThan(8000);\n  }, 30000);`,
  "compact post-results regression",
);
write("test/operatorMode.spec.ts", tests);

const statePath = path.resolve(repoRoot, "CURRENT_STATE.md");
let state = fs.readFileSync(statePath, "utf8");
state = replaceOnce(
  state,
  `- Performance learning uses age-matched 6, 12, 18, and 24-hour checkpoints; 24 hours is final.`,
  `- Performance learning uses age-matched 6, 12, 18, and 24-hour checkpoints; 24 hours is final.\n- Published-post result reads support a compact verification mode that returns bounded lineage, source, source-card, generation-run, draft, and current-metric evidence without the full performance payload.`,
  "CURRENT_STATE compact post results",
);
fs.writeFileSync(statePath, state);

const workflowPath = path.resolve(repoRoot, ".github/workflows/lensically-engineering.yml");
let workflow = fs.readFileSync(workflowPath, "utf8");
const temporaryStep = `\n      - name: Apply one-run compact post-results maintenance\n        id: compact_post_results_maintenance\n        if: \${{ inputs.task == 'typecheck' }}\n        continue-on-error: true\n        working-directory: .\n        run: node lensically-worker/scripts/run-compact-maintenance.mjs\n\n      - name: Commit compact maintenance outcome\n        if: \${{ inputs.task == 'typecheck' && always() }}\n        working-directory: .\n        env:\n          GH_TOKEN: \${{ github.token }}\n          GH_REPOSITORY: \${{ github.repository }}\n        run: |\n          git config user.name "lensically-engineering"\n          git config user.email "lensically-engineering@users.noreply.github.com"\n          git add -A\n          if git diff --cached --quiet; then\n            exit 0\n          fi\n          if [ "\${{ steps.compact_post_results_maintenance.outcome }}" = "success" ]; then\n            message="Add compact published-post verification [operator-tests]"\n          else\n            message="Record compact maintenance diagnostic"\n          fi\n          git commit -m "$message"\n          git push origin HEAD:main\n\n      - name: Surface compact maintenance failure\n        if: \${{ inputs.task == 'typecheck' && steps.compact_post_results_maintenance.outcome == 'failure' }}\n        run: exit 1\n`;
workflow = replaceOnce(workflow, "  contents: write\n  actions: write", "  contents: read\n  actions: write", "restore workflow permission");
workflow = replaceOnce(workflow, temporaryStep, "", "remove compact maintenance step");
fs.writeFileSync(workflowPath, workflow);

fs.unlinkSync(path.resolve(workerRoot, "scripts/apply-compact-post-results-patch.mjs"));
console.log("Compact post-results patch applied and temporary maintenance removed.");
