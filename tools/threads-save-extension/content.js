(function () {
  const DEFAULT_WORKER = "https://api.lensically.com";
  const DEFAULT_APP_USER_ID = "lensically";
  const DEFAULT_ACCOUNT_ID = "";
  const DEFAULT_LABEL_ENABLED = true;
  const DEFAULT_LABEL_THRESHOLD = 1000;
  const DEFAULT_LABEL_TEXT = "1K+ Likes";
  const FAB_ID = "lensically-save-fab";
  const ACCOUNT_SELECT_ID = "lensically-account-select";
  const TOAST_ID = "lensically-save-toast";
  const LABEL_STYLE_ID = "lensically-label-style";
  const LABEL_BADGE_CLASS = "lensically-like-label";
  const LABEL_ATTR_PROCESSED = "data-lensically-like-label-version";
  const LABEL_ATTR_POSITIONED = "data-lensically-like-label-positioned";

  let labelSettings = {
    labelEnabled: DEFAULT_LABEL_ENABLED,
    labelThreshold: DEFAULT_LABEL_THRESHOLD,
    labelText: DEFAULT_LABEL_TEXT
  };
  let labelRefreshQueued = false;
  let labelDebounceTimer = null;

  function parseCompactNumber(raw) {
    if (!raw) return null;
    const value = String(raw).trim().toLowerCase().replace(/,/g, "");
    const m = value.match(/^(\d+(\.\d+)?)([kmb])?$/);
    if (!m) return null;
    const base = Number(m[1]);
    if (!Number.isFinite(base)) return null;
    const suffix = m[3] || "";
    const scale = suffix === "k" ? 1000 : suffix === "m" ? 1000000 : suffix === "b" ? 1000000000 : 1;
    return Math.floor(base * scale);
  }

  function extractCompactNumberTokens(text) {
    const tokens = [];
    const pattern = /(?:^|[^a-z0-9])(\d+(?:[.,]\d+)?\s*[kmb]?)(?![a-z0-9])/gi;
    let match;
    while ((match = pattern.exec(String(text || ""))) !== null) {
      const parsed = parseCompactNumber(match[1]);
      if (Number.isFinite(parsed)) tokens.push(parsed);
    }
    return tokens;
  }

  function formatCompactNumber(value) {
    if (!Number.isFinite(value) || value < 0) return "0";
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(value >= 10000000000 ? 0 : 1).replace(/\.0$/, "")}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1).replace(/\.0$/, "")}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
    return String(Math.floor(value));
  }

  function parseLikesFromText(raw) {
    const text = String(raw || "");
    if (!text) return null;

    const patterns = [
      /(?:^|[^a-z0-9])(\d+(?:[.,]\d+)?\s*[kmb]?)\s*likes?\b/i,
      /\blikes?\s*[:\-]?\s*(\d+(?:[.,]\d+)?\s*[kmb]?)/i,
      /\blike\s*(\d+(?:[.,]\d+)?\s*[kmb]?)/i
    ];
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (!m || !m[1]) continue;
      const parsed = parseCompactNumber(m[1].replace(/\s+/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function extractLikesFromActionRow(postEl) {
    const likeControls = Array.from(
      postEl.querySelectorAll("[aria-label='Like' i], [aria-label*='Like this' i], [title='Like' i], [title*='Like' i]")
    );

    for (const control of likeControls) {
      let current = control;
      for (let depth = 0; depth < 5 && current && current !== postEl; depth += 1) {
        const text = String(current.textContent || "").trim();
        if (!text) {
          current = current.parentElement;
          continue;
        }

        const explicit = parseLikesFromText(text);
        if (explicit !== null) return explicit;

        const tokens = extractCompactNumberTokens(text);
        if (tokens.length >= 3) {
          return tokens[0];
        }

        current = current.parentElement;
      }
    }

    return null;
  }

  function extractLikesForPost(postEl) {
    const hinted = postEl.querySelectorAll("[aria-label], [title]");
    for (const node of hinted) {
      const aria = parseLikesFromText(node.getAttribute("aria-label"));
      if (aria !== null) return aria;
      const title = parseLikesFromText(node.getAttribute("title"));
      if (title !== null) return title;
    }

    const fromRow = extractLikesFromActionRow(postEl);
    if (fromRow !== null) return fromRow;

    const lines = String(postEl.innerText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      const parsed = parseLikesFromText(line);
      if (parsed !== null) return parsed;
    }

    return null;
  }

  function getLabelVersion() {
    return [
      labelSettings.labelEnabled ? "1" : "0",
      String(labelSettings.labelThreshold),
      labelSettings.labelText
    ].join("|");
  }

  function resolveLabelText(likes) {
    const template = String(labelSettings.labelText || DEFAULT_LABEL_TEXT);
    return template
      .replace(/\{likes\}/gi, formatCompactNumber(likes))
      .replace(/\{threshold\}/gi, formatCompactNumber(labelSettings.labelThreshold));
  }

  function ensureLabelStyle() {
    if (document.getElementById(LABEL_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LABEL_STYLE_ID;
    style.textContent = `
      .${LABEL_BADGE_CLASS} {
        position: absolute;
        top: 8px;
        right: 56px;
        z-index: 2147483640;
        background: #22c55e;
        color: #04130a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.02em;
        line-height: 1;
        border-radius: 999px;
        padding: 7px 10px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(4, 19, 10, 0.2);
        pointer-events: none;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removePostLabel(postEl) {
    const badge = postEl.querySelector(`:scope > .${LABEL_BADGE_CLASS}`);
    if (badge) badge.remove();
    if (postEl.getAttribute(LABEL_ATTR_POSITIONED) === "1") {
      postEl.style.removeProperty("position");
      postEl.removeAttribute(LABEL_ATTR_POSITIONED);
    }
  }

  function upsertPostLabel(postEl, text) {
    if (getComputedStyle(postEl).position === "static") {
      postEl.style.setProperty("position", "relative");
      postEl.setAttribute(LABEL_ATTR_POSITIONED, "1");
    }
    let badge = postEl.querySelector(`:scope > .${LABEL_BADGE_CLASS}`);
    if (!badge) {
      badge = document.createElement("div");
      badge.className = LABEL_BADGE_CLASS;
      postEl.appendChild(badge);
    }
    badge.textContent = text;
  }

  function processLikeLabels() {
    ensureLabelStyle();
    const version = getLabelVersion();
    const posts = document.querySelectorAll("article, [role='article'], [data-pressable-container='true']");
    for (const postEl of posts) {
      if (!(postEl instanceof HTMLElement)) continue;
      const processedVersion = postEl.getAttribute(LABEL_ATTR_PROCESSED);
      if (processedVersion === version) continue;

      if (!labelSettings.labelEnabled) {
        removePostLabel(postEl);
        postEl.setAttribute(LABEL_ATTR_PROCESSED, version);
        continue;
      }

      const likes = extractLikesForPost(postEl);
      if (likes !== null && likes >= labelSettings.labelThreshold) {
        upsertPostLabel(postEl, resolveLabelText(likes));
      } else {
        removePostLabel(postEl);
      }

      postEl.setAttribute(LABEL_ATTR_PROCESSED, version);
    }
  }

  function scheduleLikeLabelRefresh() {
    if (labelRefreshQueued) return;
    labelRefreshQueued = true;

    requestAnimationFrame(() => {
      if (labelDebounceTimer) clearTimeout(labelDebounceTimer);
      labelDebounceTimer = setTimeout(() => {
        labelRefreshQueued = false;
        processLikeLabels();
      }, 120);
    });
  }

  function loadLabelSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["labelEnabled", "labelThreshold", "labelText"], (stored) => {
          const threshold = Number(stored.labelThreshold);
          labelSettings = {
            labelEnabled: typeof stored.labelEnabled === "boolean" ? stored.labelEnabled : DEFAULT_LABEL_ENABLED,
            labelThreshold: Number.isFinite(threshold) && threshold > 0 ? Math.floor(threshold) : DEFAULT_LABEL_THRESHOLD,
            labelText: String(stored.labelText || DEFAULT_LABEL_TEXT).trim() || DEFAULT_LABEL_TEXT
          };
          resolve(labelSettings);
        });
      } catch {
        labelSettings = {
          labelEnabled: DEFAULT_LABEL_ENABLED,
          labelThreshold: DEFAULT_LABEL_THRESHOLD,
          labelText: DEFAULT_LABEL_TEXT
        };
        resolve(labelSettings);
      }
    });
  }

  function isLikelyMetricLine(line) {
    const s = line.trim();
    if (!s) return false;
    if (s.includes("/")) return false;
    return /^\d+([.,]\d+)?\s*[kmb]?$/i.test(s);
  }

  function isLensicallyInjectedLabelLine(line) {
    const s = String(line || "").trim().toLowerCase();
    if (!s) return false;
    return /^(?:\d+(?:[.,]\d+)?\s*[kmb]?|\+)\+?\s+likes?$/.test(s);
  }

  function getTextWithoutLensicallyLabels(el) {
    if (!el) return "";
    const clone = el.cloneNode(true);
    clone.querySelectorAll(`.${LABEL_BADGE_CLASS}`).forEach((node) => node.remove());
    return String(clone.innerText || clone.textContent || "");
  }

  function isLikelyMetaLine(line) {
    const s = line.trim().toLowerCase();
    if (!s) return true;
    if (isLensicallyInjectedLabelLine(s)) return true;
    if (s === "top" || s === "view activity") return true;
    if (s.includes("post is shared to fediverse")) return true;
    if (/^\d+\s*(s|m|h|d|w|mo|y)$/i.test(s)) return true;
    return false;
  }

  function stripInlineMetaNoise(raw) {
    let text = String(raw || "");
    if (!text) return "";

    text = text
      .replace(/\s*(?:Sort\s*)?Top\s*More\s*View activity.*$/gi, "")
      .replace(/\s*View activity\s*View activity\s*Reply to .*/gi, "")
      .replace(/\s*Reply to [^\n]*?(?:Attach media|Add a GIF|Expand composer).*$/gi, "")
      .replace(/post is shared to fediverse/gi, "\n")
      .replace(/(?:^|\n)\s*(?:\d+(?:[.,]\d+)?\s*[kmb]?|\+)\+?\s+likes?\s*(?=\n|$)/gi, "\n")
      .replace(/\bfollow@?[a-z0-9._]{2,40}\s*\d+\s*(?:s|m|h|d|w|mo|y)\s*more/gi, "\n")
      .replace(/\bfollow@?[a-z0-9._]{2,40}\s*(?:more)?/gi, "\n")
      .replace(/\bmore\b/gi, "\n")
      .replace(/\b\d+\s*(?:s|m|h|d|w|mo|y)\b/gi, "\n")
      .replace(/(?:\b|^)(like|reply|repost|share)\s*\d[\d.,kmb]*/gi, "\n")
      .replace(/(like|reply|repost|share)\d[\d.,kmb]*/gi, "\n");

    text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
    return text.trim();
  }

  function pickPrimaryText(lines) {
    let best = "";
    for (const line of lines) {
      const cleaned = line.trim();
      if (!cleaned) continue;
      if (isLikelyMetricLine(cleaned)) continue;
      if (isLikelyMetaLine(cleaned)) continue;
      if (cleaned.length < 12) continue;
      const letters = cleaned.replace(/[^a-zA-Z]/g, "").length;
      if (letters < 8) continue;
      if (cleaned.length > best.length) best = cleaned;
    }
    return best;
  }

  function isLikelyHandleLine(line) {
    const s = String(line || "").trim();
    if (!s) return false;
    return /^@?[a-z0-9._]{2,40}$/i.test(s);
  }

  function extractPostTextBlock(lines) {
    const indexed = lines.map((line, idx) => ({ line: String(line || "").trim(), idx }));
    let startIdx = 0;
    for (let i = 0; i < Math.min(5, indexed.length); i += 1) {
      if (isLikelyMetaLine(indexed[i].line)) startIdx = i + 1;
    }

    const candidates = indexed.filter(({ line, idx }) => {
      if (idx < startIdx) return false;
      if (!line) return false;
      if (isLikelyMetricLine(line)) return false;
      if (isLikelyMetaLine(line)) return false;
      if (isLikelyHandleLine(line)) return false;
      const letters = line.replace(/[^a-zA-Z]/g, "").length;
      return letters >= 6;
    });

    if (!candidates.length) return "";

    const blocks = [];
    let current = [candidates[0]];
    for (let i = 1; i < candidates.length; i += 1) {
      const prev = candidates[i - 1];
      const now = candidates[i];
      if (now.idx === prev.idx + 1) {
        current.push(now);
      } else {
        blocks.push(current);
        current = [now];
      }
    }
    if (current.length) blocks.push(current);

    let bestText = "";
    let bestScore = -1;
    for (const block of blocks) {
      const text = block.map((x) => x.line).join("\n").trim();
      if (!text) continue;
      const score = text.length + block.length * 20;
      if (score > bestScore) {
        bestScore = score;
        bestText = text;
      }
    }
    return bestText;
  }

  function sanitizePostText(text, authorHandle) {
    if (!text) return "";
    const lines = stripInlineMetaNoise(text)
      .split("\n")
      .map((line) => String(line || "").trim())
      .filter(Boolean);

    const cleaned = [];
    for (let line of lines) {
      const lower = line.toLowerCase();
      if (isLensicallyInjectedLabelLine(line)) continue;
      if (lower === "follow" || lower === "more" || lower === "thread") continue;
      if (/^(like|reply|repost|share)$/i.test(line)) continue;
      if (lower.includes("post is shared to fediverse")) continue;
      if (lower.includes("follow") && lower.includes("more") && line.length < 80) continue;
      if (/^(like|reply|repost|share)\s*\d[\d.,kmb]*$/i.test(line)) continue;
      if (/^\d+\s*(s|m|h|d|w|mo|y)$/i.test(line)) continue;

      line = line.replace(
        /\s*like\s*\d[\d.,kmb]*\s*reply\s*\d[\d.,kmb]*\s*repost\s*\d[\d.,kmb]*\s*share\s*\d[\d.,kmb]*\s*$/i,
        ""
      );
      line = line.replace(
        /\s*like\d[\d.,kmb]*reply\d[\d.,kmb]*repost\d[\d.,kmb]*share\d[\d.,kmb]*\s*$/i,
        ""
      );

      line = line.trim();
      if (!line) continue;
      cleaned.push(line);
    }

    if (!cleaned.length) return "";

    const first = cleaned[0];
    if (authorHandle && first.toLowerCase().includes(authorHandle.toLowerCase()) && first.toLowerCase().includes("follow")) {
      const quotePos = first.indexOf("\"");
      if (quotePos > 0) cleaned[0] = first.slice(quotePos).trim();
    }

    return cleaned.join("\n").trim();
  }

  function linesBeforeReplies(lines) {
    const out = [];
    for (const line of lines) {
      const s = String(line || "").trim();
      if (!s) continue;
      const lower = s.toLowerCase();
      if (lower === "top" || lower.startsWith("top ")) break;
      if (lower.includes("view activity")) break;
      if (lower.includes("expand composer")) break;
      if (lower.includes("attach media") || lower.includes("add a gif")) break;
      if (lower.startsWith("view activity")) break;
      out.push(s);
    }
    return out;
  }

  function extractCompactMetricTokens(line) {
    const s = String(line || "").trim();
    if (!s) return [];
    if (s.includes("/")) return [];
    if (s.toLowerCase().includes(":")) return [];
    return extractCompactNumberTokens(s);
  }

  function extractActionMetricsFromText(raw) {
    const text = String(raw || "");
    if (!text) return [];
    const compactNumber = "(\\d+(?:[.,]\\d+)?\\s*[kmb]?)";
    const match = text.match(new RegExp(
      `like\\s*${compactNumber}(?=\\s*reply)\\s*reply\\s*${compactNumber}(?=\\s*repost)\\s*repost\\s*${compactNumber}(?=\\s*share)\\s*share\\s*${compactNumber}`,
      "i",
    ));
    if (!match) return [];
    return match.slice(1, 5)
      .map((value) => parseCompactNumber(String(value || "").replace(/\s+/g, "")))
      .filter((value) => Number.isFinite(value));
  }

  function extractViewsFromPage() {
    const body = (document.body && document.body.innerText) || "";
    const m = body.match(/(\d+(?:[.,]\d+)?\s*[kmb]?)\s+views\b/i);
    if (!m) return null;
    return parseCompactNumber(m[1]);
  }

  function parseJsonLdMainPost() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of scripts) {
      const raw = (script.textContent || "").trim();
      if (!raw) continue;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed && parsed["@graph"])
          ? parsed["@graph"]
          : [parsed];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const typ = String(item["@type"] || "").toLowerCase();
        const url = String(item.url || item.mainEntityOfPage || window.location.href);
        const text = String(item.articleBody || item.text || item.description || "").trim();
        if (!text) continue;
        if (!typ.includes("posting") && !typ.includes("article")) continue;
        if (!url.includes("/post/") && !window.location.href.includes("/post/")) continue;

        const author = item.author || {};
        const authorHandle = String(author.alternateName || author.identifier || "").replace(/^@/, "") || null;
        const authorDisplayName = String(author.name || "").trim() || null;

        let likes = 0;
        let replies = 0;
        let reposts = 0;
        let shares = 0;
        let views = null;
        const stats = Array.isArray(item.interactionStatistic) ? item.interactionStatistic : [];
        for (const s of stats) {
          const t = String((s && s.interactionType && s.interactionType.name) || "").toLowerCase();
          const c = Number(s && s.userInteractionCount);
          if (!Number.isFinite(c)) continue;
          if (t.includes("like")) likes = Math.max(likes, Math.floor(c));
          else if (t.includes("comment")) replies = Math.max(replies, Math.floor(c));
          else if (t.includes("repost")) reposts = Math.max(reposts, Math.floor(c));
          else if (t.includes("share")) shares = Math.max(shares, Math.floor(c));
          else if (t.includes("view")) views = Math.floor(c);
        }

        const postIdMatch = (url || window.location.href).match(/\/post\/([^/?#]+)/i);
        const postId = postIdMatch ? postIdMatch[1] : null;
        const postedAtRaw = String(item.datePublished || "").trim();
        const postedAt = postedAtRaw || null;

        return {
          ok: true,
          payload: {
            platform: "threads",
            source_url: window.location.href,
            post_id: postId,
            author_handle: authorHandle,
            author_display_name: authorDisplayName,
            post_text: text,
            likes,
            replies,
            reposts,
            shares,
            views,
            posted_at: postedAt,
            capture_confidence: "high",
            raw_payload: {
              extractor_version: "0.1.0",
              mode: "json_ld"
            }
          }
        };
      }
    }
    return null;
  }

  function candidateContainersFromDom() {
    const selectors = [
      "article",
      '[role="article"]',
      '[data-pressable-container="true"]'
    ];
    const out = [];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (el && !out.includes(el)) out.push(el);
      }
    }
    return out;
  }

  function pickTopContainer(containers) {
    const currentPostMatch = window.location.href.match(/\/post\/([^/?#]+)/i);
    const currentPostId = currentPostMatch ? currentPostMatch[1] : "";
    if (currentPostId) {
      for (const node of containers) {
        const links = Array.from(node.querySelectorAll('a[href*="/post/"]'));
        const hasCurrent = links.some((a) => String(a.getAttribute("href") || "").includes(currentPostId));
        if (hasCurrent) return node;
      }
    }
    return containers[0] || null;
  }

  function extractMainPost() {
    const jsonLd = parseJsonLdMainPost();

    const containers = candidateContainersFromDom();
    if (!containers.length) {
      if (jsonLd && jsonLd.ok) return jsonLd;
      return { ok: false, error: "No post card detected on this page." };
    }

    const topArticle = pickTopContainer(containers);
    if (!topArticle) {
      if (jsonLd && jsonLd.ok) return jsonLd;
      return { ok: false, error: "No post card detected on this page." };
    }

    const text = getTextWithoutLensicallyLabels(topArticle).trim();
    const postTextSource = stripInlineMetaNoise(text);
    if (!text && (!jsonLd || !jsonLd.ok)) return { ok: false, error: "Top post card has no readable text." };

    const lines = postTextSource
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const rawLines = text
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const scopedLines = linesBeforeReplies(lines);
    const extractedText = extractPostTextBlock(scopedLines) || pickPrimaryText(scopedLines);
    if (!extractedText && (!jsonLd || !jsonLd.ok)) return { ok: false, error: "Could not confidently isolate post text." };

    let authorHandle = null;
    let authorDisplayName = null;
    const authorAnchor = topArticle.querySelector('a[href^="/@"]');
    if (authorAnchor) {
      const href = authorAnchor.getAttribute("href") || "";
      const hm = href.match(/\/@([^/?#]+)/);
      if (hm) authorHandle = hm[1];
      const rawName = (authorAnchor.textContent || "").trim();
      if (rawName) authorDisplayName = rawName;
    }

    const metricCandidates = scopedLines
      .filter((line) => isLikelyMetricLine(line))
      .map((line) => parseCompactNumber(line))
      .filter((n) => Number.isFinite(n));

    let actionMetrics = [];
    for (const line of scopedLines) {
      const labeledMetrics = extractActionMetricsFromText(line);
      if (labeledMetrics.length === 4) {
        actionMetrics = labeledMetrics;
        break;
      }
      const tokens = extractCompactMetricTokens(line);
      if (tokens.length >= 4) {
        actionMetrics = tokens.slice(-4);
        break;
      }
    }
    if (!actionMetrics.length) {
      const beforeReplyText = linesBeforeReplies(text.split(/\n|(?=View activity)|(?=SortTopMore)|(?=Reply to )/i)).join("\n");
      const labeledMetrics = extractActionMetricsFromText(beforeReplyText);
      if (labeledMetrics.length === 4) {
        actionMetrics = labeledMetrics;
      } else {
        const tokens = extractCompactNumberTokens(beforeReplyText);
        if (tokens.length >= 4) {
          actionMetrics = tokens.slice(-4);
        }
      }
    }
    if (!actionMetrics.length) {
      actionMetrics = metricCandidates.length >= 4 ? metricCandidates.slice(-4) : metricCandidates;
    }

    const likes = actionMetrics[0] || 0;
    const replies = actionMetrics[1] || 0;
    const reposts = actionMetrics[2] || 0;
    const shares = actionMetrics[3] || 0;
    const views = extractViewsFromPage() || (metricCandidates.length >= 5 ? metricCandidates[0] : null);

    const url = window.location.href;
    const postIdMatch = url.match(/\/post\/([^/?#]+)/i);
    const postId = postIdMatch ? postIdMatch[1] : null;
    let postedAt = null;
    const timeEl = topArticle.querySelector("time");
    if (timeEl) {
      const datetime = String(timeEl.getAttribute("datetime") || "").trim();
      const title = String(timeEl.getAttribute("title") || "").trim();
      const candidate = datetime || title;
      if (candidate) postedAt = candidate;
    }

    const jsonPayload = jsonLd && jsonLd.ok ? jsonLd.payload : null;
    const primaryText = sanitizePostText(extractedText || (jsonPayload && jsonPayload.post_text) || "", authorHandle);
    if (!primaryText) return { ok: false, error: "Could not cleanly isolate post text." };

    const confidence = url.includes("/post/") && primaryText.length >= 20 ? "high" : "medium";

    return {
      ok: true,
      payload: {
        platform: "threads",
        source_url: url,
        post_id: postId,
        author_handle: authorHandle || (jsonPayload && jsonPayload.author_handle) || null,
        author_display_name: authorDisplayName || (jsonPayload && jsonPayload.author_display_name) || null,
        post_text: primaryText,
        likes: likes || (jsonPayload && jsonPayload.likes) || 0,
        replies: replies || (jsonPayload && jsonPayload.replies) || 0,
        reposts: reposts || (jsonPayload && jsonPayload.reposts) || 0,
        shares: shares || (jsonPayload && jsonPayload.shares) || 0,
        views: views || (jsonPayload && jsonPayload.views) || null,
        posted_at: postedAt || (jsonPayload && jsonPayload.posted_at) || null,
        capture_confidence: confidence,
        raw_payload: {
          extractor_version: "0.1.2",
          mode: jsonPayload ? "json_ld_with_dom_metrics" : "dom",
          container_count: containers.length,
          top_article_line_sample: rawLines.slice(0, 25),
          scoped_line_sample: scopedLines.slice(0, 25),
          metric_candidates: metricCandidates,
          action_metrics: actionMetrics
        }
      }
    };
  }

  function getSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["workerUrl", "appUserId", "accountId"], (stored) => {
          const workerUrl = String(stored.workerUrl || DEFAULT_WORKER).trim().replace(/\/+$/, "");
          const appUserId = String(stored.appUserId || DEFAULT_APP_USER_ID).trim();
          const accountId = String(stored.accountId || DEFAULT_ACCOUNT_ID).trim().toLowerCase();
          resolve({ workerUrl, appUserId, accountId });
        });
      } catch {
        resolve({ workerUrl: DEFAULT_WORKER, appUserId: DEFAULT_APP_USER_ID, accountId: DEFAULT_ACCOUNT_ID });
      }
    });
  }

  async function saveAccountId(accountId) {
    try {
      await chrome.storage.local.set({ accountId: String(accountId || "").trim().toLowerCase() });
    } catch {
      // Ignore storage failures; the current save still uses the selected value.
    }
  }

  async function importPattern(workerUrl, appUserId, accountId, payload) {
    const accountPayload = accountId ? { account_id: accountId } : {};
    const res = await fetch(`${workerUrl}/api/patterns/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        app_user_id: appUserId,
        ...accountPayload,
        ...payload
      })
    });

    let data = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      const err = (data && data.error) || `HTTP ${res.status}`;
      throw new Error(String(err));
    }
    return data;
  }

  function showToast(message, isError) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = TOAST_ID;
      el.style.position = "fixed";
      el.style.top = "70px";
      el.style.right = "20px";
      el.style.zIndex = "2147483647";
      el.style.padding = "8px 12px";
      el.style.borderRadius = "10px";
      el.style.fontSize = "12px";
      el.style.fontWeight = "600";
      el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
      document.body.appendChild(el);
    }

    el.textContent = message;
    el.style.background = isError ? "#7f1d1d" : "#14532d";
    el.style.color = "#ffffff";
    el.style.opacity = "1";
    clearTimeout(window.__lensicallyToastTimer);
    window.__lensicallyToastTimer = setTimeout(() => {
      const current = document.getElementById(TOAST_ID);
      if (current) current.style.opacity = "0";
    }, 2400);
  }

  function onSinglePostPage() {
    return /\/post\/[^/?#]+/i.test(window.location.href);
  }

  async function handleFabClick(button) {
    if (!onSinglePostPage()) {
      showToast("Open a single post page first.", true);
      return;
    }
    button.disabled = true;
    button.textContent = "Saving...";
    try {
      const extracted = extractMainPost();
      if (!extracted || !extracted.ok) {
        throw new Error((extracted && extracted.error) || "Extraction failed.");
      }
      const { workerUrl, appUserId, accountId } = await getSettings();
      const picker = document.getElementById(ACCOUNT_SELECT_ID);
      const selectedAccountId = String(picker?.value || accountId || "").trim().toLowerCase();
      await saveAccountId(selectedAccountId);
      await importPattern(workerUrl, appUserId, selectedAccountId, extracted.payload);
      showToast(selectedAccountId ? `Saved to ${selectedAccountId}` : "Saved", false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", true);
    } finally {
      button.disabled = false;
      button.textContent = "Save Post";
    }
  }

  function ensureFloatingButton() {
    if (document.getElementById(FAB_ID)) return;
    const wrapper = document.createElement("div");
    wrapper.id = FAB_ID;
    wrapper.style.position = "fixed";
    wrapper.style.top = "20px";
    wrapper.style.right = "20px";
    wrapper.style.zIndex = "2147483647";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "6px";

    const select = document.createElement("select");
    select.id = ACCOUNT_SELECT_ID;
    select.title = "Save to profile";
    select.innerHTML = [
      '<option value="">Default</option>',
      '<option value="deadman">Deadman</option>',
      '<option value="manifest-mental">Manifest Mental</option>',
      '<option value="vectrix">Vectrix</option>'
    ].join("");
    select.style.width = "32px";
    select.style.height = "32px";
    select.style.border = "0";
    select.style.borderRadius = "999px";
    select.style.background = "#22c55e";
    select.style.color = "transparent";
    select.style.fontSize = "16px";
    select.style.fontWeight = "900";
    select.style.textAlign = "center";
    select.style.cursor = "pointer";
    select.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
    select.style.appearance = "none";
    select.style.webkitAppearance = "none";
    select.style.backgroundImage = "linear-gradient(45deg, transparent 50%, #052e16 50%), linear-gradient(135deg, #052e16 50%, transparent 50%)";
    select.style.backgroundPosition = "9px 13px, 15px 13px";
    select.style.backgroundSize = "7px 7px, 7px 7px";
    select.style.backgroundRepeat = "no-repeat";
    select.addEventListener("change", () => {
      void saveAccountId(select.value);
      showToast(select.value ? `Profile: ${select.options[select.selectedIndex]?.text || select.value}` : "Profile: Default", false);
    });

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Save Post";
    button.style.padding = "9px 12px";
    button.style.border = "0";
    button.style.borderRadius = "999px";
    button.style.background = "#2563eb";
    button.style.color = "#fff";
    button.style.fontSize = "12px";
    button.style.fontWeight = "700";
    button.style.cursor = "pointer";
    button.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
    button.addEventListener("click", () => {
      void handleFabClick(button);
    });
    wrapper.appendChild(select);
    wrapper.appendChild(button);
    document.body.appendChild(wrapper);

    getSettings().then((settings) => {
      select.value = settings.accountId || "";
    }).catch(() => {
      select.value = "";
    });
  }

  function watchDomForLabels() {
    const observer = new MutationObserver(() => {
      scheduleLikeLabelRefresh();
      if (onSinglePostPage()) ensureFloatingButton();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "EXTRACT_THREADS_POST") {
      sendResponse(extractMainPost());
      return true;
    }

    if (message && message.type === "LENSICALLY_LABEL_SETTINGS_CHANGED") {
      loadLabelSettings().then(() => {
        document.querySelectorAll(`[${LABEL_ATTR_PROCESSED}]`).forEach((el) => {
          el.removeAttribute(LABEL_ATTR_PROCESSED);
        });
        scheduleLikeLabelRefresh();
      });
    }

    return undefined;
  });

  loadLabelSettings().then(() => {
    if (onSinglePostPage()) ensureFloatingButton();
    scheduleLikeLabelRefresh();
    watchDomForLabels();
  });
})();
