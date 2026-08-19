export type SignalRadarSourceDefinition = {
  sourceId: string;
  vendor: string;
  product: string;
  sourceType: "changelog" | "release_feed" | "docs" | "news" | "repo_feed" | "needs_adapter";
  canonicalUrl: string;
  fetchUrl: string;
  enabled: boolean;
  priority: number;
  pollIntervalMinutes: number;
};

const SIGNAL_RADAR_SOURCE_REGISTRY: SignalRadarSourceDefinition[] = [
  {
    sourceId: "openai-codex-changelog",
    vendor: "OpenAI",
    product: "Codex",
    sourceType: "changelog",
    canonicalUrl: "https://developers.openai.com/codex/changelog/",
    fetchUrl: "https://developers.openai.com/codex/changelog/",
    enabled: true,
    priority: 100,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "openai-codex-releases",
    vendor: "OpenAI",
    product: "Codex",
    sourceType: "release_feed",
    canonicalUrl: "https://github.com/openai/codex/releases",
    fetchUrl: "https://github.com/openai/codex/releases.atom",
    enabled: true,
    priority: 100,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "anthropic-claude-code-feed",
    vendor: "Anthropic",
    product: "Claude Code",
    sourceType: "release_feed",
    canonicalUrl: "https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md",
    fetchUrl: "https://raw.githubusercontent.com/anthropics/claude-code/main/feed.xml",
    enabled: true,
    priority: 100,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "cursor-changelog",
    vendor: "Cursor",
    product: "Cursor",
    sourceType: "changelog",
    canonicalUrl: "https://cursor.com/changelog",
    fetchUrl: "https://cursor.com/changelog",
    enabled: true,
    priority: 95,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "google-antigravity-changelog",
    vendor: "Google",
    product: "Antigravity",
    sourceType: "changelog",
    canonicalUrl: "https://www.antigravity.google/changelog",
    fetchUrl: "https://www.antigravity.google/changelog",
    enabled: true,
    priority: 95,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "spacexai-api-release-notes",
    vendor: "SpaceXAI",
    product: "xAI API / Grok",
    sourceType: "changelog",
    canonicalUrl: "https://docs.x.ai/developers/release-notes",
    fetchUrl: "https://docs.x.ai/developers/release-notes",
    enabled: true,
    priority: 100,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "spacexai-news",
    vendor: "SpaceXAI",
    product: "xAI / Grok",
    sourceType: "news",
    canonicalUrl: "https://x.ai/news",
    fetchUrl: "https://x.ai/news",
    enabled: true,
    priority: 95,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "spacexai-grok-build-commits",
    vendor: "SpaceXAI",
    product: "grok-build",
    sourceType: "repo_feed",
    canonicalUrl: "https://github.com/xai-org/grok-build",
    fetchUrl: "https://github.com/xai-org/grok-build/commits/main.atom",
    enabled: true,
    priority: 100,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "qwen-code-changelog",
    vendor: "Alibaba Qwen",
    product: "Qwen Code",
    sourceType: "changelog",
    canonicalUrl: "https://github.com/QwenLM/qwen-code/blob/main/CHANGELOG.md",
    fetchUrl: "https://raw.githubusercontent.com/QwenLM/qwen-code/main/CHANGELOG.md",
    enabled: true,
    priority: 90,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "kimi-code-whats-new",
    vendor: "Moonshot AI",
    product: "Kimi Code",
    sourceType: "changelog",
    canonicalUrl: "https://www.kimi.com/code/docs/en/kimi-code/whats-new.html",
    fetchUrl: "https://www.kimi.com/code/docs/en/kimi-code/whats-new.html",
    enabled: true,
    priority: 90,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "kimi-cli-changelog",
    vendor: "Moonshot AI",
    product: "Kimi CLI",
    sourceType: "changelog",
    canonicalUrl: "https://github.com/MoonshotAI/kimi-cli/blob/main/CHANGELOG.md",
    fetchUrl: "https://raw.githubusercontent.com/MoonshotAI/kimi-cli/main/CHANGELOG.md",
    enabled: true,
    priority: 85,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "cline-changelog",
    vendor: "Cline",
    product: "Cline",
    sourceType: "changelog",
    canonicalUrl: "https://github.com/cline/cline/blob/main/CHANGELOG.md",
    fetchUrl: "https://raw.githubusercontent.com/cline/cline/main/CHANGELOG.md",
    enabled: true,
    priority: 80,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "opencode-changelog",
    vendor: "OpenCode",
    product: "OpenCode",
    sourceType: "changelog",
    canonicalUrl: "https://opencode.ai/changelog",
    fetchUrl: "https://opencode.ai/changelog",
    enabled: true,
    priority: 80,
    pollIntervalMinutes: 60,
  },
  {
    sourceId: "windsurf-current-changelog",
    vendor: "Windsurf",
    product: "Windsurf",
    sourceType: "needs_adapter",
    canonicalUrl: "https://windsurf.com/changelog",
    fetchUrl: "https://windsurf.com/changelog",
    enabled: false,
    priority: 70,
    pollIntervalMinutes: 60,
  },
];

type SignalRadarSourceRow = {
  source_id: string;
  vendor: string;
  product: string;
  source_type: string;
  canonical_url: string;
  fetch_url: string;
  enabled: number;
  priority: number;
  poll_interval_minutes: number;
  last_checked_at: string | null;
  last_changed_at: string | null;
  last_http_status: number | null;
  last_etag: string | null;
  last_modified: string | null;
  last_content_hash: string | null;
  last_content: string | null;
  last_error: string | null;
};

type SignalRadarDiff = {
  added: string[];
  removed: string[];
};

const MAX_NORMALIZED_CONTENT_CHARS = 400_000;
const MAX_DIFF_LINES = 30;

function decodeCommonHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'");
}

function normalizeSourceContent(body: string, contentType: string): string {
  let value = body.replace(/\r\n?/g, "\n");
  const markup = /html|xml/i.test(contentType) || /^\s*</.test(value);

  if (markup) {
    value = value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "\n")
      .replace(/<\/(?:p|li|h[1-6]|article|section|entry|item|div)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  }

  value = decodeCommonHtmlEntities(value);

  const lines = value
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1)
    .filter((line) => !/^(skip to|menu|search|sign in|sign up|cookie settings)$/i.test(line));

  return lines.join("\n").slice(0, MAX_NORMALIZED_CONTENT_CHARS);
}

async function hashContent(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function diffNormalizedContent(previous: string, current: string): SignalRadarDiff {
  const previousLines = previous.split("\n").filter(Boolean);
  const currentLines = current.split("\n").filter(Boolean);
  const previousSet = new Set(previousLines);
  const currentSet = new Set(currentLines);

  return {
    added: currentLines.filter((line) => !previousSet.has(line)).slice(0, MAX_DIFF_LINES),
    removed: previousLines.filter((line) => !currentSet.has(line)).slice(0, MAX_DIFF_LINES),
  };
}

function cleanSignalLine(value: string): string {
  return value
    .replace(/^[-*#>\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function classifySignal(lines: string[]): string {
  const value = lines.join(" ").toLowerCase();
  if (/\b(cve|security|vulnerability|exploit|permission)\b/.test(value)) return "security";
  if (/\b(pricing|price|credits?|rate limits?|billing|subscription)\b/.test(value)) return "pricing_access";
  if (/\b(model|gpt-|grok|claude|gemini|qwen|kimi|context window)\b/.test(value)) return "model";
  if (/\b(mcp|agent|subagent|coding agent|cloud agent|tool call|computer use|terminal)\b/.test(value)) return "agent_capability";
  if (/\b(api|sdk|integration|extension|plugin)\b/.test(value)) return "integration";
  if (/\b(release|version|changelog|available|launch)\b/.test(value)) return "release";
  return "documentation";
}

function scoreImportance(category: string, lines: string[]): number {
  const value = lines.join(" ").toLowerCase();
  let score = 45;
  if (category === "security") score += 35;
  if (category === "pricing_access") score += 25;
  if (category === "model") score += 25;
  if (category === "agent_capability") score += 20;
  if (category === "integration") score += 10;
  if (/\b(new|launch|launched|generally available|ga|breaking|deprecated|deprecation|major)\b/.test(value)) score += 15;
  if (/\b(fix|fixed|bug|minor|docs only|typo)\b/.test(value)) score -= 10;
  return Math.max(1, Math.min(100, score));
}

function buildSignalSummary(diff: SignalRadarDiff): { title: string; summary: string; evidenceLines: string[] } {
  const evidenceLines = diff.added.map(cleanSignalLine).filter(Boolean);
  const fallback = diff.removed.map(cleanSignalLine).filter(Boolean);
  const selected = evidenceLines.length ? evidenceLines : fallback;
  const title = (selected[0] || "First-party source changed").slice(0, 180);
  const summary = selected.slice(0, 5).join(" · ").slice(0, 900) || "First-party source content changed.";
  return { title, summary, evidenceLines: selected };
}

async function syncSignalRadarRegistry(db: D1Database): Promise<void> {
  for (const source of SIGNAL_RADAR_SOURCE_REGISTRY) {
    await db.prepare(`
      INSERT INTO signal_radar_sources (
        source_id, vendor, product, source_type, canonical_url, fetch_url,
        enabled, priority, poll_interval_minutes, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(source_id) DO UPDATE SET
        vendor = excluded.vendor,
        product = excluded.product,
        source_type = excluded.source_type,
        canonical_url = excluded.canonical_url,
        fetch_url = excluded.fetch_url,
        enabled = excluded.enabled,
        priority = excluded.priority,
        poll_interval_minutes = excluded.poll_interval_minutes,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      source.sourceId,
      source.vendor,
      source.product,
      source.sourceType,
      source.canonicalUrl,
      source.fetchUrl,
      source.enabled ? 1 : 0,
      source.priority,
      source.pollIntervalMinutes,
    ).run();
  }
}

function sourceIsDue(source: SignalRadarSourceRow, nowMs: number): boolean {
  if (!source.enabled) return false;
  if (!source.last_checked_at) return true;
  const previous = Date.parse(source.last_checked_at);
  if (!Number.isFinite(previous)) return true;
  return nowMs - previous >= Math.max(1, source.poll_interval_minutes) * 60_000;
}

async function updateSourceFailure(
  db: D1Database,
  source: SignalRadarSourceRow,
  checkedAt: string,
  status: number | null,
  error: string,
): Promise<void> {
  await db.prepare(`
    UPDATE signal_radar_sources
    SET last_checked_at = ?, last_http_status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE source_id = ?
  `).bind(checkedAt, status, error.slice(0, 500), source.source_id).run();
}

async function pollOneSource(
  db: D1Database,
  source: SignalRadarSourceRow,
  checkedAt: string,
): Promise<{ changed: boolean; signalCreated: boolean; error: boolean }> {
  const headers = new Headers({
    "Accept": "text/html,application/atom+xml,application/xml,text/plain,text/markdown;q=0.9,*/*;q=0.5",
    "User-Agent": "Lensically-Signal-Radar/1.0",
  });
  if (source.last_etag) headers.set("If-None-Match", source.last_etag);
  if (source.last_modified) headers.set("If-Modified-Since", source.last_modified);

  let response: Response;
  try {
    response = await fetch(source.fetch_url, { headers, redirect: "follow" });
  } catch (error) {
    await updateSourceFailure(db, source, checkedAt, null, error instanceof Error ? error.message : String(error));
    return { changed: false, signalCreated: false, error: true };
  }

  if (response.status === 304) {
    await db.prepare(`
      UPDATE signal_radar_sources
      SET last_checked_at = ?, last_http_status = 304, last_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE source_id = ?
    `).bind(checkedAt, source.source_id).run();
    return { changed: false, signalCreated: false, error: false };
  }

  if (!response.ok) {
    await updateSourceFailure(db, source, checkedAt, response.status, `HTTP ${response.status}`);
    return { changed: false, signalCreated: false, error: true };
  }

  const body = await response.text();
  const normalized = normalizeSourceContent(body, response.headers.get("content-type") || "");
  if (!normalized) {
    await updateSourceFailure(db, source, checkedAt, response.status, "empty_normalized_source");
    return { changed: false, signalCreated: false, error: true };
  }

  const currentHash = await hashContent(normalized);
  const etag = response.headers.get("etag");
  const lastModified = response.headers.get("last-modified");

  if (!source.last_content_hash) {
    await db.prepare(`
      UPDATE signal_radar_sources
      SET last_checked_at = ?, last_changed_at = ?, last_http_status = ?,
          last_etag = ?, last_modified = ?, last_content_hash = ?, last_content = ?,
          last_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE source_id = ?
    `).bind(
      checkedAt,
      checkedAt,
      response.status,
      etag,
      lastModified,
      currentHash,
      normalized,
      source.source_id,
    ).run();
    return { changed: false, signalCreated: false, error: false };
  }

  if (currentHash === source.last_content_hash) {
    await db.prepare(`
      UPDATE signal_radar_sources
      SET last_checked_at = ?, last_http_status = ?, last_etag = ?, last_modified = ?,
          last_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE source_id = ?
    `).bind(checkedAt, response.status, etag, lastModified, source.source_id).run();
    return { changed: false, signalCreated: false, error: false };
  }

  const diff = diffNormalizedContent(source.last_content || "", normalized);
  const material = diff.added.length > 0 || diff.removed.length > 0;
  let signalCreated = false;

  if (material) {
    const details = buildSignalSummary(diff);
    const category = classifySignal(details.evidenceLines);
    const importance = scoreImportance(category, details.evidenceLines);
    const signalId = `${source.source_id}:${currentHash.slice(0, 24)}`;
    const evidence = JSON.stringify({
      source_url: source.canonical_url,
      source_type: source.source_type,
      added_lines: diff.added,
      removed_lines: diff.removed,
    });

    const result = await db.prepare(`
      INSERT OR IGNORE INTO signal_radar_signals (
        signal_id, source_id, vendor, product, category, title, summary,
        evidence_json, previous_hash, current_hash, confidence, importance,
        status, detected_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
    `).bind(
      signalId,
      source.source_id,
      source.vendor,
      source.product,
      category,
      details.title,
      details.summary,
      evidence,
      source.last_content_hash,
      currentHash,
      0.98,
      importance,
      checkedAt,
    ).run();

    signalCreated = Number(result.meta?.changes || 0) > 0;
  }

  await db.prepare(`
    UPDATE signal_radar_sources
    SET last_checked_at = ?, last_changed_at = ?, last_http_status = ?,
        last_etag = ?, last_modified = ?, last_content_hash = ?, last_content = ?,
        last_error = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE source_id = ?
  `).bind(
    checkedAt,
    checkedAt,
    response.status,
    etag,
    lastModified,
    currentHash,
    normalized,
    source.source_id,
  ).run();

  return { changed: material, signalCreated, error: false };
}

export async function pollSignalRadar(
  db: D1Database,
  scheduledTimeMs: number = Date.now(),
): Promise<{
  run_id: string;
  source_count: number;
  checked_count: number;
  changed_count: number;
  signal_count: number;
  error_count: number;
}> {
  await syncSignalRadarRegistry(db);

  const startedAt = new Date(scheduledTimeMs).toISOString();
  const runId = `signal-radar:${startedAt}:${crypto.randomUUID()}`;
  const rows = await db.prepare(`
    SELECT *
    FROM signal_radar_sources
    WHERE enabled = 1
    ORDER BY priority DESC, vendor, product
  `).all<SignalRadarSourceRow>();

  const sources = rows.results || [];
  await db.prepare(`
    INSERT INTO signal_radar_runs (run_id, started_at, source_count, status)
    VALUES (?, ?, ?, 'running')
  `).bind(runId, startedAt, sources.length).run();

  let checkedCount = 0;
  let changedCount = 0;
  let signalCount = 0;
  let errorCount = 0;

  for (const source of sources) {
    if (!sourceIsDue(source, scheduledTimeMs)) continue;
    checkedCount += 1;
    const result = await pollOneSource(db, source, startedAt);
    if (result.changed) changedCount += 1;
    if (result.signalCreated) signalCount += 1;
    if (result.error) errorCount += 1;
  }

  const completedAt = new Date().toISOString();
  await db.prepare(`
    UPDATE signal_radar_runs
    SET completed_at = ?, checked_count = ?, changed_count = ?, signal_count = ?,
        error_count = ?, status = ?
    WHERE run_id = ?
  `).bind(
    completedAt,
    checkedCount,
    changedCount,
    signalCount,
    errorCount,
    errorCount > 0 ? "completed_with_errors" : "completed",
    runId,
  ).run();

  return {
    run_id: runId,
    source_count: sources.length,
    checked_count: checkedCount,
    changed_count: changedCount,
    signal_count: signalCount,
    error_count: errorCount,
  };
}

export async function readSignalRadarOverview(
  db: D1Database,
  requestedLimit: number = 60,
): Promise<Record<string, unknown>> {
  await syncSignalRadarRegistry(db);
  const limit = Math.min(Math.max(Math.trunc(requestedLimit || 60), 1), 100);

  const sources = await db.prepare(`
    SELECT
      source_id, vendor, product, source_type, canonical_url, enabled, priority,
      poll_interval_minutes, last_checked_at, last_changed_at, last_http_status,
      last_content_hash, last_error
    FROM signal_radar_sources
    ORDER BY enabled DESC, priority DESC, vendor, product
  `).all();

  const signals = await db.prepare(`
    SELECT
      signal_id, source_id, vendor, product, category, title, summary,
      evidence_json, confidence, importance, status, published_at, detected_at
    FROM signal_radar_signals
    ORDER BY detected_at DESC, importance DESC
    LIMIT ?
  `).bind(limit).all();

  const latestRun = await db.prepare(`
    SELECT
      run_id, started_at, completed_at, source_count, checked_count,
      changed_count, signal_count, error_count, status
    FROM signal_radar_runs
    ORDER BY started_at DESC
    LIMIT 1
  `).first();

  return {
    success: true,
    generated_at: new Date().toISOString(),
    poll_cadence_minutes: 60,
    sources: sources.results || [],
    signals: signals.results || [],
    latest_run: latestRun || null,
  };
}
