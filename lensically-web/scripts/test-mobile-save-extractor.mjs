import assert from "node:assert/strict";

function clean(value) {
  return String(value || "").trim();
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

function extractPostBodyTextFromInnerText(innerText, authorHandle, authorDisplayName) {
  const normalizedHandle = clean(authorHandle).toLowerCase().replace(/^@/, "");
  const normalizedName = clean(authorDisplayName).toLowerCase();
  const bodyLines = [];
  const rawLines = clean(innerText).split("\n").map(clean).filter(Boolean);

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

assert.equal(
  extractPostBodyTextFromInnerText(
    [
      "julietemirella",
      "@julietemirella",
      "2d",
      "A lot of anxiety disappears",
      "when your finances are in order.",
      "Like",
      "Reply",
      "Repost",
      "Share",
      "Top",
      "somebody else's comment",
    ].join("\n"),
    "julietemirella",
    null,
  ),
  "A lot of anxiety disappears\nwhen your finances are in order.",
);

assert.equal(
  extractPostBodyTextFromInnerText(
    [
      "profitproperly 13h First line",
      "  indented second line",
      "third line",
      "1,600",
      "Likes",
      "39",
      "Replies",
      "Top",
    ].join("\n"),
    "profitproperly",
    null,
  ),
  "First line\nindented second line\nthird line",
);

console.log("mobile save extractor fixtures passed");
