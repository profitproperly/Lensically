(function () {
  const SCRIPT_VERSION = "0.2.0";
  const BUTTON_CLASS = "lensically-mobile-save-button";
  const STYLE_ID = "lensically-mobile-save-style";
  const TARGET_URL = "https://app.lensically.com/mobile-save";

  function clean(value) {
    return String(value || "").trim();
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
    return false;
  }

  function cleanPostText(rawText, authorHandle) {
    const lines = clean(rawText)
      .split("\n")
      .map(clean)
      .filter((line) => !isNoiseLine(line));
    const filtered = lines.filter((line) => {
      if (!authorHandle) return true;
      const lower = line.toLowerCase();
      return lower !== authorHandle.toLowerCase() && lower !== `@${authorHandle.toLowerCase()}`;
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

  function extractPayload(postEl) {
    const onSinglePostPage = /\/post\/[^/?#]+/i.test(location.href);
    const jsonLd = onSinglePostPage ? parseJsonLdPost() : null;
    const authorHandle = findAuthorHandle(postEl) || jsonLd?.authorHandle || null;
    const sourceUrl = findPostUrl(postEl);
    const postIdMatch = sourceUrl.match(/\/post\/([^/?#]+)/i);
    const postText = jsonLd?.text || cleanPostText(postEl.innerText, authorHandle);

    if (!postText) {
      throw new Error("Could not find text for this post.");
    }

    return {
      platform: "threads",
      source_url: sourceUrl,
      post_id: postIdMatch ? postIdMatch[1] : null,
      author_handle: authorHandle,
      post_text: postText,
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
