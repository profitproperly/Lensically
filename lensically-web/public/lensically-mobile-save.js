(function () {
  const SCRIPT_VERSION = "0.8.0";
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

    metrics.likes = parseMetricText(pageText, "like") ?? metrics.likes;
    metrics.replies = parseMetricText(pageText, "reply") ?? metrics.replies;
    metrics.reposts = parseMetricText(pageText, "repost") ?? metrics.reposts;
    metrics.shares = parseMetricText(pageText, "share") ?? metrics.shares;
    metrics.views = parseMetricText(pageText, "view");

    const lines = clean(postEl.innerText).split("\n").map(clean).filter(Boolean);
    for (let index = 0; index < lines.length - 1; index += 1) {
      const label = lines[index].toLowerCase();
      const value = parseCompactNumber(lines[index + 1]);
      if (!Number.isFinite(value)) continue;
      if (/^likes?$/.test(label)) metrics.likes = value;
      if (/^(replies|reply)$/.test(label)) metrics.replies = value;
      if (/^reposts?$/.test(label)) metrics.reposts = value;
      if (/^shares?$/.test(label)) metrics.shares = value;
      if (/^views?$/.test(label)) metrics.views = value;
    }

    return metrics;
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
    const rawText = jsonLd?.text || clean(postEl.innerText);
    const postText = cleanPostText(rawText, authorHandle, authorDisplayName);
    const postIdMatch = location.href.match(/\/post\/([^/?#]+)/i);
    const domMetrics = extractMetricsFromDom(postEl);
    const metrics = mergeMetrics(jsonLd?.metrics, domMetrics);

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
      posted_at: jsonLd?.postedAt || null,
      capture_confidence: "high",
      raw_payload: {
        mode: "ios_safari_single_post",
        extractor_version: SCRIPT_VERSION,
      },
    };
  }

  try {
    const payload = extractPayload();
    location.href = `${TARGET_URL}#${encodeURIComponent(JSON.stringify(payload))}`;
  } catch (error) {
    alert(error && error.message ? error.message : "Could not save this post.");
  }
})();
