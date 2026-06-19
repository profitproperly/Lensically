(function () {
  const SCRIPT_VERSION = "1.1.2";
  const TARGET_URL = "https://app.lensically.com/mobile-save";

  function clean(value) {
    return String(value || "").trim();
  }

  function parseCompactNumber(raw) {
    const value = clean(raw).toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
    const match = value.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
    if (!match) return null;
    const base = Number(match[1]);
    if (!Number.isFinite(base)) return null;
    const suffix = match[2] || "";
    const scale = suffix === "k" ? 1000 : suffix === "m" ? 1000000 : suffix === "b" ? 1000000000 : 1;
    return Math.floor(base * scale);
  }

  function parseMetricText(text, label) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`(\\d+(?:[.,]\\d+)?\\s*[kmb]?)\\s+${escapedLabel}s?\\b`, "i"),
      new RegExp(`${escapedLabel}s?\\s*[:\\-]?\\s*(\\d+(?:[.,]\\d+)?\\s*[kmb]?)`, "i"),
    ];
    for (const pattern of patterns) {
      const match = clean(text).match(pattern);
      if (!match || !match[1]) continue;
      const parsed = parseCompactNumber(match[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function parseMetricFromTextVariants(text, labels) {
    for (const label of labels) {
      const parsed = parseMetricText(text, label);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  function findControlTextMetric(postEl, selector, labels) {
    const controls = Array.from(postEl.querySelectorAll(selector));
    for (const control of controls) {
      const directText = [
        control.getAttribute("aria-label"),
        control.getAttribute("title"),
        control.textContent,
      ].map(clean).join("\n");
      const directParsed = parseMetricFromTextVariants(directText, labels);
      if (directParsed !== null) return directParsed;

      let current = control;
      for (let depth = 0; depth < 8 && current && current !== postEl; depth += 1) {
        const text = clean(current.textContent);
        if (text) {
          const parsed = parseMetricFromTextVariants(text, labels);
          if (parsed !== null) return parsed;

          const tokens = text.match(/\d+(?:[.,]\d+)?\s*[kmb]?/gi) || [];
          if (tokens.length >= 3 && labels.includes("like")) {
            const first = parseCompactNumber(tokens[0]);
            if (Number.isFinite(first)) return first;
          }
        }
        current = current.parentElement;
      }
    }
    return null;
  }

  function extractActionRowMetrics(postEl) {
    const metricSelectors = {
      likes: {
        selector: "[aria-label*='like' i], [title*='like' i], [role='button']",
        labels: ["like"],
      },
      replies: {
        selector: "[aria-label*='reply' i], [aria-label*='comment' i], [title*='reply' i], [title*='comment' i], [role='button']",
        labels: ["reply", "comment"],
      },
      reposts: {
        selector: "[aria-label*='repost' i], [aria-label*='quote' i], [title*='repost' i], [title*='quote' i], [role='button']",
        labels: ["repost", "quote"],
      },
      shares: {
        selector: "[aria-label*='share' i], [title*='share' i], [role='button']",
        labels: ["share"],
      },
    };

    return {
      likes: findControlTextMetric(postEl, metricSelectors.likes.selector, metricSelectors.likes.labels),
      replies: findControlTextMetric(postEl, metricSelectors.replies.selector, metricSelectors.replies.labels),
      reposts: findControlTextMetric(postEl, metricSelectors.reposts.selector, metricSelectors.reposts.labels),
      shares: findControlTextMetric(postEl, metricSelectors.shares.selector, metricSelectors.shares.labels),
    };
  }

  function isNoiseLine(line) {
    const value = clean(line).toLowerCase();
    if (!value) return true;
    if (value === "follow" || value === "more" || value === "top" || value === "view activity") return true;
    if (value.includes("post is shared to fediverse")) return true;
    if (/^\d+\s*(s|m|h|d|w|mo|y)$/.test(value)) return true;
    if (/^\d+(?:[.,]\d+)?\s*[kmb]?$/.test(value)) return true;
    if (/^(likes?|replies|reply|reposts?|shares?|views?)$/i.test(value)) return true;
    if (/^(like|reply|repost|share)\s*\d/i.test(value)) return true;
    return false;
  }

  function cleanPostText(rawText, authorHandle, authorDisplayName) {
    const normalizedHandle = clean(authorHandle).toLowerCase().replace(/^@/, "");
    const normalizedName = clean(authorDisplayName).toLowerCase();
    const lines = clean(rawText)
      .split("\n")
      .map(clean)
      .map((line) => {
        let next = line;
        if (normalizedHandle) {
          next = next.replace(new RegExp(`^@?${normalizedHandle}\\s+`, "i"), "");
        }
        if (normalizedName) {
          next = next.replace(new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "");
        }
        next = next.replace(/^@?[a-z0-9._]{2,40}\s+\d+\s*(?:s|m|h|d|w|mo|y)\s+/i, "");
        next = next.replace(/^\d+\s*(?:s|m|h|d|w|mo|y)\s+/i, "");
        return clean(next);
      })
      .filter((line) => !isNoiseLine(line));

    const filtered = lines.filter((line, index) => {
      const lower = line.toLowerCase();
      if (normalizedHandle && (lower === normalizedHandle || lower === `@${normalizedHandle}`)) return false;
      if (normalizedName && lower === normalizedName) return false;
      if (index < 4 && /^@?[a-z0-9._]{2,40}$/i.test(line)) return false;
      return true;
    });

    return filtered.join("\n").trim();
  }

  function isPostBodyBoundary(line, hasBodyText) {
    const value = clean(line).toLowerCase();
    if (!value) return false;
    if (value === "top" || value.startsWith("top ")) return true;
    if (value === "view activity" || value.startsWith("view activity")) return true;
    if (value === "more" || value === "follow") return hasBodyText;
    if (/^(like|reply|repost|share)$/.test(value)) return hasBodyText;
    if (/^(likes?|replies|reply|reposts?|shares?|views?)$/.test(value)) return hasBodyText;
    if (/^\d+(?:[.,]\d+)?\s*[kmb]?\s+(likes?|replies|reply|reposts?|shares?|views?)$/.test(value)) return hasBodyText;
    if (/^(likes?|replies|reply|reposts?|shares?|views?)\s+\d/.test(value)) return hasBodyText;
    return false;
  }

  function extractPostBodyTextFromDom(postEl, authorHandle, authorDisplayName) {
    const normalizedHandle = clean(authorHandle).toLowerCase().replace(/^@/, "");
    const normalizedName = clean(authorDisplayName).toLowerCase();
    const bodyLines = [];
    const rawLines = clean(postEl.innerText).split("\n").map(clean).filter(Boolean);

    for (const rawLine of rawLines) {
      let line = rawLine;
      const lower = line.toLowerCase();
      const hasBodyText = bodyLines.length > 0;

      if (isPostBodyBoundary(line, hasBodyText)) break;
      if (!hasBodyText) {
        if (normalizedHandle && (lower === normalizedHandle || lower === `@${normalizedHandle}`)) continue;
        if (normalizedName && lower === normalizedName) continue;
        if (/^@?[a-z0-9._]{2,40}$/.test(lower)) continue;
        if (/^\d+\s*(?:s|m|h|d|w|mo|y)$/.test(lower)) continue;
      }

      if (normalizedHandle) {
        line = line.replace(new RegExp(`^@?${normalizedHandle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "");
      }
      if (normalizedName) {
        line = line.replace(new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "");
      }
      line = line.replace(/^@?[a-z0-9._]{2,40}\s+\d+\s*(?:s|m|h|d|w|mo|y)\s+/i, "");
      line = line.replace(/^\d+\s*(?:s|m|h|d|w|mo|y)\s+/i, "");
      line = clean(line);

      if (!line || isNoiseLine(line)) continue;
      bodyLines.push(line);
    }

    return bodyLines.join("\n").trim();
  }

  function parseJsonLdPost() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent || "");
        const items = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed && parsed["@graph"])
            ? parsed["@graph"]
            : [parsed];

        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const text = clean(item.articleBody || item.text || item.description);
          if (!text) continue;

          const author = item.author || {};
          const metrics = {
            likes: 0,
            replies: 0,
            reposts: 0,
            shares: 0,
            views: null,
          };

          const stats = Array.isArray(item.interactionStatistic) ? item.interactionStatistic : [];
          for (const stat of stats) {
            const statName = clean(stat?.interactionType?.name || stat?.name).toLowerCase();
            const count = Number(stat?.userInteractionCount ?? stat?.value);
            if (!Number.isFinite(count)) continue;
            if (statName.includes("like")) metrics.likes = Math.max(metrics.likes, Math.floor(count));
            else if (statName.includes("comment") || statName.includes("reply")) metrics.replies = Math.max(metrics.replies, Math.floor(count));
            else if (statName.includes("repost")) metrics.reposts = Math.max(metrics.reposts, Math.floor(count));
            else if (statName.includes("share")) metrics.shares = Math.max(metrics.shares, Math.floor(count));
            else if (statName.includes("view")) metrics.views = Math.floor(count);
          }

          return {
            text,
            authorHandle: clean(author.alternateName || author.identifier).replace(/^@/, "") || null,
            authorDisplayName: clean(author.name) || null,
            postedAt: clean(item.datePublished) || null,
            metrics,
          };
        }
      } catch {}
    }
    return null;
  }

  function findCurrentPostElement() {
    const currentPostMatch = location.href.match(/\/post\/([^/?#]+)/i);
    const currentPostId = currentPostMatch ? currentPostMatch[1] : "";
    const candidates = Array.from(document.querySelectorAll("article, [role='article']"))
      .filter((el) => el instanceof HTMLElement && clean(el.innerText).length > 20);

    if (currentPostId) {
      const matched = candidates.find((candidate) => (
        Array.from(candidate.querySelectorAll('a[href*="/post/"]'))
          .some((link) => clean(link.getAttribute("href")).includes(currentPostId))
      ));
      if (matched) return matched;
    }

    return candidates[0] || document.body;
  }

  function findAuthorHandle(postEl) {
    const authorAnchor = postEl.querySelector('a[href^="/@"], a[href*="/@"]');
    const href = authorAnchor ? clean(authorAnchor.getAttribute("href")) : "";
    const match = href.match(/\/@([^/?#]+)/);
    return match ? match[1] : null;
  }

  function normalizePostedAt(value) {
    const raw = clean(value);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }

  function findPostedAt(postEl) {
    const selectors = [
      "time[datetime]",
      "[datetime]",
      "meta[property='article:published_time']",
      "meta[name='article:published_time']",
    ];
    for (const selector of selectors) {
      const node = postEl.querySelector(selector) || document.querySelector(selector);
      if (!node) continue;
      const parsed = normalizePostedAt(node.getAttribute("datetime") || node.getAttribute("content"));
      if (parsed) return parsed;
    }
    return null;
  }

  function extractMetricsFromDom(postEl) {
    const metrics = {
      likes: 0,
      replies: 0,
      reposts: 0,
      shares: 0,
      views: null,
    };

    const hintedText = Array.from(postEl.querySelectorAll("[aria-label], [title]"))
      .map((node) => `${node.getAttribute("aria-label") || ""}\n${node.getAttribute("title") || ""}`)
      .join("\n");
    const pageText = `${hintedText}\n${clean(postEl.innerText)}\n${clean(document.body.innerText)}`;

    const actionRowMetrics = extractActionRowMetrics(postEl);
    metrics.likes = actionRowMetrics.likes ?? metrics.likes;
    metrics.replies = actionRowMetrics.replies ?? metrics.replies;
    metrics.reposts = actionRowMetrics.reposts ?? metrics.reposts;
    metrics.shares = actionRowMetrics.shares ?? metrics.shares;

    metrics.likes = parseMetricText(pageText, "like") ?? metrics.likes;
    metrics.replies = parseMetricText(pageText, "reply") ?? metrics.replies;
    metrics.reposts = parseMetricText(pageText, "repost") ?? metrics.reposts;
    metrics.shares = parseMetricText(pageText, "share") ?? metrics.shares;
    metrics.views = parseMetricText(pageText, "view");

    const lines = clean(postEl.innerText).split("\n").map(clean).filter(Boolean);
    const bodyLines = clean(document.body.innerText).split("\n").map(clean).filter(Boolean);
    const scopedLines = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower === "top" || lower.startsWith("top ")) break;
      if (lower.startsWith("view activity")) break;
      scopedLines.push(line);
    }
    const metricTokens = [];
    for (let index = 0; index < scopedLines.length - 1; index += 1) {
      const label = scopedLines[index].toLowerCase();
      const value = parseCompactNumber(scopedLines[index + 1]);
      if (!Number.isFinite(value)) continue;
      if (/^likes?$/.test(label)) metrics.likes = value;
      if (/^(replies|reply)$/.test(label)) metrics.replies = value;
      if (/^reposts?$/.test(label)) metrics.reposts = value;
      if (/^shares?$/.test(label)) metrics.shares = value;
      if (/^views?$/.test(label)) metrics.views = value;
    }

    for (const line of scopedLines) {
      if (line.includes("/") || line.includes(":")) continue;
      const tokens = line.match(/\d+(?:[.,]\d+)?\s*[kmb]?/gi) || [];
      const parsedTokens = tokens
        .map((token) => parseCompactNumber(token))
        .filter((value) => Number.isFinite(value));
      if (parsedTokens.length >= 4) {
        metricTokens.push(...parsedTokens.slice(-4));
        break;
      }
    }

    if (!metricTokens.length) {
      const standaloneNumbers = lines
        .filter((line) => /^\d+(?:[.,]\d+)?\s*[kmb]?$/i.test(line))
        .map((line) => parseCompactNumber(line))
        .filter((value) => Number.isFinite(value));
      if (standaloneNumbers.length >= 4) {
        metricTokens.push(...standaloneNumbers.slice(-4));
      }
    }

    if (!metricTokens.length) {
      const scopedBodyLines = [];
      for (const line of bodyLines) {
        const lower = line.toLowerCase();
        if (lower === "top" || lower.startsWith("top ")) break;
        if (lower.startsWith("view activity")) break;
        scopedBodyLines.push(line);
      }
      for (const line of scopedBodyLines) {
        if (line.includes("/") || line.includes(":")) continue;
        const tokens = line.match(/\d+(?:[.,]\d+)?\s*[kmb]?/gi) || [];
        const parsedTokens = tokens
          .map((token) => parseCompactNumber(token))
          .filter((value) => Number.isFinite(value));
        if (parsedTokens.length >= 4) {
          metricTokens.push(...parsedTokens.slice(-4));
          break;
        }
      }
      if (!metricTokens.length) {
        const standaloneBodyNumbers = scopedBodyLines
          .filter((line) => /^\d+(?:[.,]\d+)?\s*[kmb]?$/i.test(line))
          .map((line) => parseCompactNumber(line))
          .filter((value) => Number.isFinite(value));
        if (standaloneBodyNumbers.length >= 4) {
          metricTokens.push(...standaloneBodyNumbers.slice(-4));
        }
      }
    }

    if (metricTokens.length >= 4 && metrics.likes === 0 && metrics.replies === 0 && metrics.reposts === 0 && metrics.shares === 0) {
      metrics.likes = metricTokens[0] ?? 0;
      metrics.replies = metricTokens[1] ?? 0;
      metrics.reposts = metricTokens[2] ?? 0;
      metrics.shares = metricTokens[3] ?? 0;
    }

    return metrics;
  }

  function hasAnyEngagement(metrics) {
    return Boolean(
      metrics
      && (
        metrics.likes > 0
        || metrics.replies > 0
        || metrics.reposts > 0
        || metrics.shares > 0
        || (typeof metrics.views === "number" && metrics.views > 0)
      )
    );
  }

  function mergeMetrics(primary, fallback) {
    return {
      likes: primary?.likes || fallback.likes || 0,
      replies: primary?.replies || fallback.replies || 0,
      reposts: primary?.reposts || fallback.reposts || 0,
      shares: primary?.shares || fallback.shares || 0,
      views: primary?.views ?? fallback.views ?? null,
    };
  }

  function extractPayload() {
    if (!/\/post\/[^/?#]+/i.test(location.href)) {
      throw new Error("Open the specific Threads post first, then tap the Lensically bookmarklet.");
    }

    const postEl = findCurrentPostElement();
    const jsonLd = parseJsonLdPost();
    const authorHandle = jsonLd?.authorHandle || findAuthorHandle(postEl);
    const authorDisplayName = jsonLd?.authorDisplayName || null;
    const metaDescription = clean(document.querySelector('meta[property="og:description"]')?.getAttribute("content"));
    const domBodyText = extractPostBodyTextFromDom(postEl, authorHandle, authorDisplayName);
    const domBodyLineCount = domBodyText ? domBodyText.split("\n").filter(Boolean).length : 0;
    const rawText = jsonLd?.text || (domBodyLineCount > 1 ? domBodyText : metaDescription || domBodyText || clean(postEl.innerText));
    const postText = cleanPostText(rawText, authorHandle, authorDisplayName);
    const postIdMatch = location.href.match(/\/post\/([^/?#]+)/i);
    const domMetrics = extractMetricsFromDom(postEl);
    const metrics = mergeMetrics(jsonLd?.metrics, domMetrics);
    const postedAt = jsonLd?.postedAt || findPostedAt(postEl);

    if (!postText) {
      throw new Error("Could not find text for this post.");
    }

    return {
      platform: "threads",
      source_url: location.href,
      post_id: postIdMatch ? postIdMatch[1] : null,
      author_handle: authorHandle,
      author_display_name: authorDisplayName,
      post_text: postText,
      likes: metrics.likes,
      replies: metrics.replies,
      reposts: metrics.reposts,
      shares: metrics.shares,
      views: metrics.views,
      posted_at: postedAt,
      capture_confidence: "high",
      raw_payload: {
        mode: "ios_safari_single_post",
        extractor_version: SCRIPT_VERSION,
        metric_debug: {
          article_lines: clean(postEl.innerText).split("\n").map(clean).filter(Boolean).slice(0, 40),
          body_lines: clean(document.body.innerText).split("\n").map(clean).filter(Boolean).slice(0, 60),
          aria_samples: Array.from(postEl.querySelectorAll("[aria-label], [title]"))
            .map((node) => clean(node.getAttribute("aria-label") || node.getAttribute("title")))
            .filter(Boolean)
            .slice(0, 40),
          role_button_samples: Array.from(postEl.querySelectorAll("button, [role='button']"))
            .map((node) => clean(`${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""} ${node.textContent || ""}`))
            .filter(Boolean)
            .slice(0, 40),
        },
      },
    };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function extractPayloadWithMetricRetry() {
    let bestPayload = extractPayload();
    if (hasAnyEngagement(bestPayload)) {
      return bestPayload;
    }

    for (const delay of [700, 1200, 1800]) {
      await wait(delay);
      const nextPayload = extractPayload();
      if (hasAnyEngagement(nextPayload)) {
        return nextPayload;
      }
      bestPayload = nextPayload;
    }

    return bestPayload;
  }

  try {
    extractPayloadWithMetricRetry().then((payload) => {
      location.href = `${TARGET_URL}#${encodeURIComponent(JSON.stringify(payload))}`;
    }).catch((error) => {
      alert(error && error.message ? error.message : "Could not save this post.");
    });
  } catch (error) {
    alert(error && error.message ? error.message : "Could not save this post.");
  }
})();
