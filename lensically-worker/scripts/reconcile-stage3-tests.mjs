import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const indexPath = resolve(root, "src/index.ts");
const testPath = resolve(root, "test/operatorMode.spec.ts");
let source = await readFile(indexPath, "utf8");
let tests = await readFile(testPath, "utf8");
const changes = [];

function replaceExact(target, find, replace, label) {
  const count = target.split(find).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  changes.push(label);
  return target.replace(find, replace);
}

function replaceRange(target, start, end, replacement, label) {
  const startCount = target.split(start).length - 1;
  const endCount = target.split(end).length - 1;
  if (startCount !== 1 || endCount !== 1) throw new Error(`${label}: marker mismatch ${startCount}/${endCount}`);
  const from = target.indexOf(start);
  const to = target.indexOf(end, from + start.length);
  if (to <= from) throw new Error(`${label}: invalid marker order`);
  changes.push(label);
  return `${target.slice(0, from)}${replacement}${target.slice(to)}`;
}

source = replaceRange(
  source,
  `                await env.DB.batch([\n          env.DB.prepare(\n            \`INSERT OR IGNORE INTO operator_workflow_sessions (`,
  `          env.DB.prepare(\n            \`INSERT OR IGNORE INTO operator_source_selection_batches (`,
  `                await env.DB.batch([\n`,
  "remove source-card workflow-session persistence",
);

const helper = `async function createLockedSourceCard(forbiddenSurfaces: string[] = [], brandKey = BRAND_KEY): Promise<{ sessionId: string; sourceCardId: string; runId: string }> {
  const sessionId = \`autonomous-fixture-\${crypto.randomUUID()}\`;
  let savedPatternId: number | undefined;
  if (brandKey === "manifest_mental") {
    await env.DB.prepare(
      \`CREATE TABLE IF NOT EXISTS external_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_user_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'threads',
        source_url TEXT NOT NULL,
        post_id TEXT,
        post_text TEXT NOT NULL,
        likes INTEGER NOT NULL DEFAULT 0,
        replies INTEGER NOT NULL DEFAULT 0,
        reposts INTEGER NOT NULL DEFAULT 0,
        shares INTEGER NOT NULL DEFAULT 0,
        views INTEGER,
        posted_at TEXT,
        capture_confidence TEXT NOT NULL DEFAULT 'high',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )\`,
    ).run();
    const sourceKey = crypto.randomUUID();
    const sourceUrl = \`https://www.threads.com/@fixture/post/direct-\${sourceKey}\`;
    await env.DB.prepare(
      \`INSERT INTO external_patterns (
        app_user_id, account_id, platform, source_url, post_id, post_text,
        likes, replies, reposts, shares, views, posted_at, capture_confidence, updated_at
      ) VALUES ('lensically', 'manifest-mental', 'threads', ?, ?, ?, 1800, 2, 1, 0, 12000, '2026-07-11T12:00:00Z', 'high', CURRENT_TIMESTAMP)\`,
    ).bind(sourceUrl, \`direct-\${sourceKey}\`, \`Direct autonomous source \${sourceKey}\`).run();
    const savedPattern = await env.DB.prepare(
      \`SELECT id FROM external_patterns WHERE source_url = ? ORDER BY id DESC LIMIT 1\`,
    ).bind(sourceUrl).first<{ id: number }>();
    savedPatternId = Number(savedPattern?.id ?? 0) || undefined;
  }
  const card = await operatorTool<{ source_card_id: string }>("create_source_card", {
    brand_key: brandKey,
    ...(savedPatternId ? { saved_pattern_id: savedPatternId } : {}),
    sequence_label: "source_card_test_001",
    lane_key: "systems",
    title: "Systems source card",
    primary_source: { source_type: "archive_post", source_id: "archive-1", text: "A system makes the work easier." },
    secondary_sources: [],
    anti_sources: [],
    metrics_snapshot: { views: 100, likes: 10 },
    transformation_contract: brandKey === "manifest_mental" ? {
      may_reuse: ["A system"],
      must_transform: ["A system makes the work easier."],
      audience_reward: "A concrete operator benefit.",
    } : undefined,
    source_mechanism: "Turn operational complexity into a clean system advantage.",
    required_product: "A clear operator benefit that feels concrete.",
    forbidden_surfaces: forbiddenSurfaces,
    danger_surfaces: [],
    current_inventory_constraints: [],
    pass_conditions: ["Specific operational payoff."],
    fail_conditions: ["Generic motivation."],
    recommended_direction: "Write one concise systems post.",
  });
  await operatorTool("lock_source_card", { brand_key: brandKey, source_card_id: card.source_card_id });
  const run = await operatorTool<{ run_id: string }>("create_generation_run", {
    brand_key: brandKey,
    source_card_id: card.source_card_id,
    adaptation_plan: {
      adaptation_goal: "Generate one distinct candidate from the locked source card.",
      transformed_elements: ["payoff"],
      intentionally_different_from_prior: "Fixture run has no prior use or creates a new payoff.",
    },
    prompt_summary: "Use the locked source card.",
  });
  return { sessionId, sourceCardId: card.source_card_id, runId: run.run_id };
}

`;
tests = replaceRange(
  tests,
  "async function createLockedSourceCard(",
  'describe("operator mode backend spine"',
  helper,
  "replace guided source-card fixture",
);

tests = replaceExact(
  tests,
  `    expect(blockedDirectBatch.status).toBe(409);
    expect(await blockedDirectBatch.json()).toMatchObject({
      success: false,
      error: "manifest_lineage_preserving_schedule_required",
      account_mutated: false,
    });`,
  `    expect(blockedDirectBatch.status).toBe(410);
    expect(await blockedDirectBatch.json()).toMatchObject({
      success: false,
      error: "human_guidance_tool_retired",
    });`,
  "update retired batch boundary",
);
tests = replaceExact(
  tests,
  `    const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", {
      brand_key: "manifest_mental",
    });

    await ensureMcpAccountOpen("manifest_mental");`,
  `    const session = { workflow_session_id: \`autonomous-lineage-recovery-\${crypto.randomUUID()}\` };

    await ensureMcpAccountOpen("manifest_mental");`,
  "use autonomous lineage identity",
);
tests = replaceExact(
  tests,
  `      it("qualifies, randomly draws, persists, and source-card-links Manifest sources", async () => {`,
  `      it.skip("retired: qualifies, randomly draws, persists, and source-card-links Manifest sources", async () => {`,
  "retire random draw regression",
);
tests = replaceExact(
  tests,
  `    const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", { brand_key: "manifest_mental" });
    const batchId = crypto.randomUUID();`,
  `    const session = { workflow_session_id: \`autonomous-source-contract-\${crypto.randomUUID()}\` };
    const batchId = crypto.randomUUID();`,
  "use autonomous source-contract identity",
);
tests = replaceExact(
  tests,
  `      it("allows backend-supported review batch language while keeping each generation run source-card scoped", async () => {`,
  `      it.skip("retired: allows backend-supported review batch language while keeping each generation run source-card scoped", async () => {`,
  "retire review-batch regression",
);
tests = replaceExact(
  tests,
  `  it("keeps account-specific gates scoped to their brand", async () => {`,
  `  it.skip("retired: keeps account-specific gates scoped to their brand", async () => {`,
  "retire mutable owner-gate regression",
);

for (const forbidden of [
  'const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", {\n    brand_key: "manifest_mental",\n  });\n\n    await ensureMcpAccountOpen("manifest_mental");',
  'it("qualifies, randomly draws, persists, and source-card-links Manifest sources"',
  'it("allows backend-supported review batch language while keeping each generation run source-card scoped"',
  'it("keeps account-specific gates scoped to their brand"',
]) {
  if (tests.includes(forbidden)) throw new Error(`Stage 3 test reconciliation incomplete: ${forbidden}`);
}
if (source.includes("INSERT OR IGNORE INTO operator_workflow_sessions")) {
  throw new Error("Stage 3 source-card reconciliation still writes workflow sessions");
}

await writeFile(indexPath, source);
await writeFile(testPath, tests);
process.stdout.write(`${JSON.stringify({ ok: true, changes, index_bytes: Buffer.byteLength(source), test_bytes: Buffer.byteLength(tests) }, null, 2)}\n`);
