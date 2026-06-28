import assert from "node:assert/strict";

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

function extractCompactNumberTokens(text) {
  const tokens = [];
  const pattern = /(?:^|[^a-z0-9])(\d+(?:[.,]\d+)?\s*[kmb]?)(?![a-z0-9])/gi;
  let match;
  while ((match = pattern.exec(clean(text))) !== null) {
    const parsed = parseCompactNumber(match[1]);
    if (Number.isFinite(parsed)) tokens.push(parsed);
  }
  return tokens;
}

function isNoiseLine(line) {
  const value = clean(line).toLowerCase();
  if (!value) return true;
  if (value === "follow" || value === "more" || value === "top" || value === "view activity") return true;
  if (value === "/" || value === "thread") return true;
  if (/^\d+\s*\/\s*\d+$/.test(value)) return true;
  if (/^\/\s*\d+$/.test(value)) return true;
  if (/^(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})(?:,?\s*(?:at\s*)?\d{1,2}:\d{2}\s*(?:am|pm)?)?$/i.test(value)) return true;
  if (/^(?:\d+(?:[.,]\d+)?\s*[kmb]?|\+)\+?\s+likes?$/.test(value)) return true;
  if (value.includes("post is shared to fediverse")) return true;
  if (/^\d+\s*(s|m|h|d|w|mo|y)$/.test(value)) return true;
  if (/^\d+(?:[.,]\d+)?\s*[kmb]?$/.test(value)) return true;
  if (/^(like|reply|repost|share)$/i.test(value)) return true;
  if (/^(likes?|replies|reply|reposts?|shares?|views?)$/i.test(value)) return true;
  if (/^(like|reply|repost|share)\s*\d/i.test(value)) return true;
  return false;
}

function isPostBodyBoundary(line, hasBodyText) {
  const value = clean(line).toLowerCase();
  if (!value) return false;
  if (value === "top" || value.startsWith("top ")) return true;
  if (value === "view activity" || value.startsWith("view activity")) return true;
  if (hasBodyText && /^(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})(?:,?\s*(?:at\s*)?\d{1,2}:\d{2}\s*(?:am|pm)?)?$/i.test(value)) return true;
  if (/^(?:\d+(?:[.,]\d+)?\s*[kmb]?|\+)\+?\s+likes?$/.test(value)) return hasBodyText;
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
    line = line.replace(/^\/\s*\d+\s+/i, "");
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

assert.equal(
  extractPostBodyTextFromInnerText(
    [
      "zara_olivio",
      "@zara_olivio",
      "1d",
      "1/2",
      "I would love to be a content creator.",
      "/",
      "2",
      "Unfortunately, I don't want y'all knowing where I shop.",
      "Like",
      "Reply",
    ].join("\n"),
    "zara_olivio",
    null,
  ),
  "I would love to be a content creator.\nUnfortunately, I don't want y'all knowing where I shop.",
);

assert.equal(
  extractPostBodyTextFromInnerText(
    [
      "beesrecipes1",
      "@beesrecipes1",
      "5h",
      "04/21/26",
      "Juicy Steak with Creamy Garlic Sauce Ingredients",
      "1/2 cup heavy cream",
      "1/4 cup parmesan",
      "Like",
      "Reply",
    ].join("\n"),
    "beesrecipes1",
    null,
  ),
  "Juicy Steak with Creamy Garlic Sauce Ingredients\n1/2 cup heavy cream\n1/4 cup parmesan",
);

assert.equal(
  extractPostBodyTextFromInnerText(
    [
      "zara_olivio",
      "@zara_olivio",
      "1d",
      "I would love to be a content creator.",
      "Unfortunately, I don't want y'all knowing where I shop.",
      "Jun 20, 2026, 10:00 PM",
      "Like",
      "Reply",
    ].join("\n"),
    "zara_olivio",
    null,
  ),
  "I would love to be a content creator.\nUnfortunately, I don't want y'all knowing where I shop.",
);

assert.equal(
  extractPostBodyTextFromInnerText(
    [
      "paarriss.x",
      "@paarriss.x",
      "12h",
      "in survival mode so long that i can’t remember half my life lol",
      "+ Likes",
      "Like",
      "Reply",
    ].join("\n"),
    "paarriss.x",
    null,
  ),
  "in survival mode so long that i can’t remember half my life lol",
);

assert.equal(
  extractPostBodyTextFromInnerText(
    [
      "kennad0ll",
      "22h",
      "stay in the gym and eat well. don’t let yourself go. life is a long journey & your body is the vehicle.",
      "Share",
      "259",
      "3",
      "31",
      "Top",
    ].join("\n"),
    "kennad0ll",
    null,
  ),
  "stay in the gym and eat well. don’t let yourself go. life is a long journey & your body is the vehicle.",
);

assert.deepEqual(
  extractCompactNumberTokens("kennad0ll 22h stay in the gym 259 3 31 Share"),
  [259, 3, 31],
);

console.log("mobile save extractor fixtures passed");
