(function () {
  const SCRIPT_VERSION = "0.3.0";
  const BUTTON_CLASS = "lensically-mobile-save-button";
  const STYLE_ID = "lensically-mobile-save-style";
  const TARGET_URL = "https://app.lensically.com/mobile-save";

  function clean(value) {
    return String(value || "").trim();
  }

  function parseCompactNumber(raw) {
    const value = clean(raw).toLowerCase().replace(/,/g, "");
    const match = value.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
    if (!match) return null;
    const base = Number(match[1]);
    if (!Number.isFinite(base)) return null;
    const suffix = match[2] || "";
    const scale = suffix === "k" ? 1000 : suffix === "m" ? 1000000 : suffix === "b" ? 1000000000 : 1;
    return Math.floor(base * scale);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${BUTTON_CLASS} {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 2147483647;
        border: 0;
        border-radius: 999px;
        background: #0f172a;
        color: #ffffff;
        padding: 8px 11px;
        font: 700 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.25);
      }
    `;
    document.documentElement.appendChild(style);
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
          const text = clean(item && (item.articleBody || item.text || item.description));
          if (!text) continue;
          const author = item.author || {};
          return {
            text,
            authorHandle: clean(author.alternateName || author.identifier).replace(/^@/, "") || null,
          };
        }
      } catch {}
    }
    return null;
  }

  function isNoiseLine(line) {
    const value = clean(line).toLowerCase();
    if (!value) return true;
    if (value === "follow" || value === "more" || value === "top" || value === "view activity") return true;
    if (value.includes("post is shared to fediverse")) return true;
    if (/^\d+\s*(s|m|h|d|w|mo|y)$/.test(value)) return true;
    if (/^\d+([.,]\d+)?\s*[kmb]?$/.test(value)) return true;
    if (/^(like|reply|repost|share)\s*\d/.test(value)) return true;
    if (/^(likes?|replies|reply|reposts?|shares?|views?)$/i.test(value)) return true;
    return false;
  }

  function cleanPostText(rawText, authorHandle) {
    const normalizedAuthor = clean(authorHandle).toLowerCase().replace(/^@/, "");
    const lines = clean(rawText)
      .split("\n")
      .map(clean)
      .map((line) => {
        let next = line;
        if (normalizedAuthor) {
          next = next.replace(new RegExp(`^@?${normalizedAuthor}\\s+`, "i"), "");
        }
        next = next.replace(/^@?[a-z0-9._]{2,40}\s+\d+\s*(?:s|m|h|d|w|mo|y)\s+/i, "");
        next = next.replace(/^\d+\s*(?:s|m|h|d|w|mo|y)\s+/i, "");
        return clean(next);
      })
      .filter((line) => !isNoiseLine(line));
    const filtered = lines.filter((line, index) => {
      const lower = line.toLowerCase();
      if (normalizedAuthor && (lower === normalizedAuthor || lower === `@${normalizedAuthor}`)) return false;
      if (index < 3 && /^@?[a-z0-9._]{2,40}$/i.test(line)) return false;
      return true;
    });
    return filtered.join("\n").trim();
  }

  function findAuthorHandle(postEl) {
    const authorAnchor = postEl.querySelector('a[href^="/@"], a[href*="/@"]');
    const href = authorAnchor ? String(authorAnchor.getAttribute("href") || "") : "";
    const match = href.match(/\/@([^/?#]+)/);
    return match ? match[1] : null;
  }

  function findPostUrl(postEl) {
    const links = Array.from(postEl.querySelectorAll('a[href*="/post/"]'));
    const samePage = links.find((link) => {
      const href = String(link.getAttribute("href") || "");
      return href && location.href.includes(href.replace(/^https?:\/\/[^/]+/i, ""));
    });
    const chosen = samePage || links[0] || null;
    if (!chosen) return location.href;
    try {
      return new URL(String(chosen.getAttribute("href") || ""), location.origin).href;
    } catch {
      return location.href;
    }
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
      const parsed = parseCompactNumber(match[1].replace(/\s+/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function extractMetrics(postEl) {
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
    const visibleText = clean(postEl.innerText);
    const combinedText = `${hintedText}\n${visibleText}`;

    metrics.likes = parseMetricText(combinedText, "like") ?? metrics.likes;
    metrics.replies = parseMetricText(combinedText, "reply") ?? metrics.replies;
    metrics.reposts = parseMetricText(combinedText, "repost") ?? metrics.reposts;
    metrics.shares = parseMetricText(combinedText, "share") ?? metrics.shares;
    metrics.views = parseMetricText(combinedText, "view");

    const lines = visibleText.split("\n").map(clean).filter(Boolean);
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

  function extractPayload(postEl) {
    const onSinglePostPage = /\/post\/[^/?#]+/i.test(location.href);
    const jsonLd = onSinglePostPage ? parseJsonLdPost() : null;
    const authorHandle = findAuthorHandle(postEl) || jsonLd?.authorHandle || null;
    const sourceUrl = findPostUrl(postEl);
    const postIdMatch = sourceUrl.match(/\/post\/([^/?#]+)/i);
    const postText = jsonLd?.text || cleanPostText(postEl.innerText, authorHandle);
    const metrics = extractMetrics(postEl);

    if (!postText) {
      throw new Error("Could not find text for this post.");
    }

    return {
      platform: "threads",
      source_url: sourceUrl,
      post_id: postIdMatch ? postIdMatch[1] : null,
      author_handle: authorHandle,
      post_text: postText,
      likes: metrics.likes,
      replies: metrics.replies,
      reposts: metrics.reposts,
      shares: metrics.shares,
      views: metrics.views,
      capture_confidence: onSinglePostPage ? "high" : "medium",
      raw_payload: {
        mode: "ios_safari_overlay",
        extractor_version: SCRIPT_VERSION,
      },
    };
  }

  function savePost(postEl) {
    try {
      const payload = extractPayload(postEl);
      location.href = `${TARGET_URL}#${encodeURIComponent(JSON.stringify(payload))}`;
    } catch (error) {
      alert(error && error.message ? error.message : "Could not save this post.");
    }
  }

  function getPostElements() {
    const candidates = Array.from(document.querySelectorAll("article, [role='article'], [data-pressable-container='true']"));
    return candidates.filter((el) => el instanceof HTMLElement && clean(el.innerText).length > 20);
  }

  function injectButtons() {
    ensureStyle();
    let count = 0;
    for (const postEl of getPostElements()) {
      if (postEl.querySelector(`:scope > .${BUTTON_CLASS}`)) continue;
      if (getComputedStyle(postEl).position === "static") {
        postEl.style.position = "relative";
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = BUTTON_CLASS;
      button.textContent = "Save";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        savePost(postEl);
      });
      postEl.appendChild(button);
      count += 1;
    }
    if (!count) {
      alert("No Threads posts found. Open a post or scroll the feed, then tap the bookmark again.");
    }
  }

  injectButtons();
})();
