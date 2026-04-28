import fs from "node:fs/promises";

const BASE_URL = "https://api.lensically.com";
const APP_USER_ID = "workspace-owner";
const ACCOUNT_ID = "manifest-mental";
const AUTOMATION_ID = "manifest-mental-tomorrow-planner";
const TIMEZONE = "America/New_York";
const MEMORY_PATH = "C:/Users/brian/.codex/automations/manifest-mental-tomorrow-planner/memory.md";
const THREADS_USER_ID = "35758578720393972";
const SLOT_START_HOUR = 7;
const SLOT_END_HOUR = 23;
const SLOT_TIMES = Array.from(
  { length: SLOT_END_HOUR - SLOT_START_HOUR + 1 },
  (_, index) => `${String(SLOT_START_HOUR + index).padStart(2, "0")}:00`,
);

const TOPIC_CONFIG = {
  money: {
    openings: [
      "Money is finding you through",
      "You are stepping into",
      "Your income is opening through",
      "Wealth is moving toward you through",
    ],
    middles: [
      "doors that feel aligned and immediate",
      "channels that feel natural and steady",
      "opportunities that pay well and arrive cleanly",
      "support that turns into real payment",
    ],
    closings: [
      "right on time",
      "with ease and momentum",
      "without delay or confusion",
      "as part of your new normal",
    ],
  },
  love: {
    openings: [
      "You are receiving",
      "Love is meeting you with",
      "Your heart is opening to",
      "You are being chosen for",
    ],
    middles: [
      "secure love that feels clear and expressed",
      "affection that feels safe, steady, and mutual",
      "commitment that feels calm and lasting",
      "care that feels honest, warm, and consistent",
    ],
    closings: [
      "in a way that feels natural",
      "with no mixed signals attached",
      "at the exact depth you asked for",
      "as something you no longer have to question",
    ],
  },
  visibility: {
    openings: [
      "The right people are noticing",
      "Your name is reaching",
      "You are becoming visible to",
      "Attention is moving toward",
    ],
    middles: [
      "rooms that can actually move your life forward",
      "people who respect your value",
      "audiences that want what you carry",
      "opportunities that match your presence",
    ],
    closings: [
      "with real momentum behind it",
      "and it is opening the right doors",
      "in a way that feels earned and natural",
      "without you forcing anything",
    ],
  },
  success: {
    openings: [
      "Success is looking like",
      "You are moving into",
      "Your next chapter is built on",
      "Winning is becoming",
    ],
    middles: [
      "results that repeat themselves",
      "progress that feels obvious and stable",
      "momentum that keeps compounding",
      "proof that your standards are working",
    ],
    closings: [
      "day after day",
      "in ways people can clearly see",
      "as your new baseline",
      "without second guessing yourself",
    ],
  },
  opportunity: {
    openings: [
      "The next opportunity is arriving through",
      "Your next opening is coming through",
      "You are being matched with",
      "Fresh movement is entering through",
    ],
    middles: [
      "people who can say yes quickly",
      "doors that already have your name on them",
      "timing that finally works in your favor",
      "connections that feel aligned and easy",
    ],
    closings: [
      "and it is landing cleanly",
      "with no wasted effort around it",
      "faster than you expected",
      "because the path is ready now",
    ],
  },
  support: {
    openings: [
      "You are surrounded by",
      "Support is showing up through",
      "The right people are offering",
      "Life is sending you",
    ],
    middles: [
      "people who truly mean what they say",
      "backing that makes the next move easier",
      "help that feels sincere and well-timed",
      "support that actually lightens the load",
    ],
    closings: [
      "right when it matters most",
      "and it is changing the pace of everything",
      "in ways that feel deeply reassuring",
      "without you having to chase it",
    ],
  },
  peace: {
    openings: [
      "Your peace is becoming",
      "You are settling into",
      "Calm is leading you into",
      "Peace is making room for",
    ],
    middles: [
      "a life that feels lighter and clearer",
      "days that feel softer and more secure",
      "stability that protects your energy",
      "clarity that keeps you grounded and open",
    ],
    closings: [
      "at the same time",
      "without slowing your growth",
      "and it feels better every day",
      "as the new emotional standard",
    ],
  },
  power: {
    openings: [
      "You are standing in",
      "Personal power is turning into",
      "Your standard is creating",
      "Confidence is bringing you",
    ],
    middles: [
      "treatment that finally matches your value",
      "respect that feels immediate and clear",
      "results that reflect who you became",
      "responses that honor your presence",
    ],
    closings: [
      "with no extra explanation needed",
      "because your energy is undeniable now",
      "in every room that matters",
      "and it keeps getting stronger",
    ],
  },
  glowup: {
    openings: [
      "Your glow-up is showing through",
      "You are becoming known for",
      "This version of you is attracting",
      "Your evolution is drawing in",
    ],
    middles: [
      "beauty, ease, and attention all at once",
      "better treatment and better outcomes",
      "rooms that match your upgraded energy",
      "the kind of response your old self wanted",
    ],
    closings: [
      "and people can feel it",
      "without you having to explain it",
      "everywhere you go",
      "as part of your new identity",
    ],
  },
  luxury: {
    openings: [
      "Luxury feels natural when",
      "You are moving into",
      "High standards are bringing you",
      "Your life is making room for",
    ],
    middles: [
      "your standard stays high and calm",
      "better options, better timing, and better treatment",
      "ease that looks expensive and feels peaceful",
      "more beauty, softness, and premium support",
    ],
    closings: [
      "at the same time",
      "as part of daily life",
      "without apology",
      "because you are available for it now",
    ],
  },
  overflow: {
    openings: [
      "Overflow is reaching you through",
      "You are entering",
      "Life is opening you to",
      "Abundance is showing up as",
    ],
    middles: [
      "more than enough support, money, and movement",
      "fullness that keeps multiplying",
      "expansion that feels generous and real",
      "extra room in every area that matters",
    ],
    closings: [
      "and you are ready for it",
      "without having to force it",
      "in ways that feel deeply satisfying",
      "as the pace continues to rise",
    ],
  },
  expansion: {
    openings: [
      "Everything is expanding into",
      "Your world is opening to",
      "You are growing into",
      "The next season is stretching into",
    ],
    middles: [
      "more visibility, more ease, and more possibility",
      "bigger rooms and better outcomes",
      "a life that looks richer and calmer",
      "the version of success you were ready for",
    ],
    closings: [
      "all at once",
      "with clean momentum behind it",
      "without the old limits attached",
      "and it feels aligned now",
    ],
  },
};

const TOPIC_ROTATION = [
  "money",
  "love",
  "visibility",
  "success",
  "opportunity",
  "support",
  "peace",
  "power",
  "glowup",
  "luxury",
  "overflow",
  "expansion",
];

function getDatePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parts.find((part) => part.type === "year")?.value ?? "0000",
    month: parts.find((part) => part.type === "month")?.value ?? "00",
    day: parts.find((part) => part.type === "day")?.value ?? "00",
  };
}

function getIsoDateInTimeZone(date, timeZone) {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDaysToIsoDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return getIsoDateInTimeZone(utcDate, "UTC");
}

function getLocalDateAndTimeParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { response, data };
}

function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function jaccardSimilarity(left, right) {
  const leftSet = new Set(tokenize(left));
  const rightSet = new Set(tokenize(right));
  if (!leftSet.size || !rightSet.size) {
    return 0;
  }
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function containsWeakPattern(text) {
  const normalized = normalizeText(text);
  const weakPhrases = [
    "peace of mind",
    "make time for yourself",
    "be patient",
    "trust the process",
  ];
  return weakPhrases.some((phrase) => normalized.includes(phrase));
}

function detectTopic(text) {
  const normalized = normalizeText(text);
  if (/(money|wealth|income|paid|payment|abundance)/.test(normalized)) return "money";
  if (/(love|heart|chosen|commitment|affection|relationship)/.test(normalized)) return "love";
  if (/(notice|visible|seen|audience|name|rooms)/.test(normalized)) return "visibility";
  if (/(success|winning|results|chapter|momentum)/.test(normalized)) return "success";
  if (/(opportunity|opening|door|connection|timing)/.test(normalized)) return "opportunity";
  if (/(support|help|backing)/.test(normalized)) return "support";
  if (/(peace|calm|clarity|stable)/.test(normalized)) return "peace";
  if (/(power|respect|standard|confidence|value)/.test(normalized)) return "power";
  if (/(glow|beauty|upgrade|evolution)/.test(normalized)) return "glowup";
  if (/(luxury|premium|expensive|softness)/.test(normalized)) return "luxury";
  if (/(overflow|enough|abundance|fullness)/.test(normalized)) return "overflow";
  return "expansion";
}

function buildPostFromTopic(topic, slotIndex, variantIndex) {
  const config = TOPIC_CONFIG[topic];
  const opening = config.openings[(slotIndex + variantIndex) % config.openings.length];
  const middle = config.middles[(slotIndex + variantIndex * 2) % config.middles.length];
  const closing = config.closings[(slotIndex + variantIndex * 3) % config.closings.length];
  return `${opening} ${middle} ${closing}`.replace(/\s+/g, " ").trim();
}

function scoreCandidate(text) {
  const normalized = normalizeText(text);
  let score = 0;
  const payoffTerms = [
    "money",
    "love",
    "success",
    "luxury",
    "support",
    "overflow",
    "chosen",
    "visible",
    "opportunity",
    "peace",
    "power",
  ];
  for (const term of payoffTerms) {
    if (normalized.includes(term)) {
      score += 2;
    }
  }
  if (/you are|your /.test(normalized)) score += 2;
  if (text.length >= 45 && text.length <= 110) score += 3;
  if (containsWeakPattern(text)) score -= 10;
  if (/\bi\b|\bmy\b|\bme\b|\bi'm\b|\bi’ve\b/.test(normalized)) score -= 10;
  return score;
}

function chooseTopicsForSlots(slotCount, recentPosts) {
  const topicCounts = new Map();
  for (const post of recentPosts.slice(0, 12)) {
    const topic = detectTopic(post.text);
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  }

  const topics = [];
  let lastTopic = "";
  let streak = 0;

  for (let index = 0; index < slotCount; index += 1) {
    const ordered = [...TOPIC_ROTATION].sort((left, right) => {
      const leftCount = topicCounts.get(left) ?? 0;
      const rightCount = topicCounts.get(right) ?? 0;
      return leftCount - rightCount;
    });

    let chosen = ordered.find((topic) => !(topic === lastTopic && streak >= 2)) ?? ordered[0];
    topics.push(chosen);
    topicCounts.set(chosen, (topicCounts.get(chosen) ?? 0) + 1);
    if (chosen === lastTopic) {
      streak += 1;
    } else {
      lastTopic = chosen;
      streak = 1;
    }
  }

  return topics;
}

function generatePostsForSlots(missingSlots, recentArchive, topArchive) {
  const referenceTexts = [...recentArchive, ...topArchive].map((post) => post.text ?? "");
  const recentPosts = recentArchive.slice(0, 24);
  const chosenTopics = chooseTopicsForSlots(missingSlots.length, recentPosts);
  const generated = [];

  for (let index = 0; index < missingSlots.length; index += 1) {
    const slot = missingSlots[index];
    const topic = chosenTopics[index];
    let bestCandidate = "";
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let variantIndex = 0; variantIndex < 10; variantIndex += 1) {
      const candidate = buildPostFromTopic(topic, index, variantIndex);
      const similarityToArchive = Math.max(
        0,
        ...referenceTexts.map((text) => jaccardSimilarity(candidate, text)),
      );
      const similarityToChosen = Math.max(
        0,
        ...generated.map((item) => jaccardSimilarity(candidate, item.text)),
      );
      if (similarityToArchive >= 0.72 || similarityToChosen >= 0.72) {
        continue;
      }

      const score = scoreCandidate(candidate) - (similarityToArchive * 8) - (similarityToChosen * 10);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate) {
      bestCandidate = buildPostFromTopic(topic, index, 0);
    }

    generated.push({ slot, text: bestCandidate, topic });
  }

  return generated;
}

async function readMemory() {
  try {
    return await fs.readFile(MEMORY_PATH, "utf8");
  } catch {
    return null;
  }
}

async function writeMemory(summary) {
  const lines = [
    "# Manifest Mental Tomorrow Planner Memory",
    "",
    `Last run: ${new Date().toISOString()}`,
    "",
    ...summary,
    "",
  ];
  await fs.writeFile(MEMORY_PATH, lines.join("\n"), "utf8");
}

function formatStatusBlock(result) {
  return [
    `STATUS: ${result.status}`,
    `RUN_DATE_ET: ${result.runDate}`,
    `TARGET_DATE_ET: ${result.targetDate}`,
    `DAILY_LOCK: ${result.dailyLock}`,
    `SLOTS_FILLED_ALREADY: ${result.filledAlready}`,
    `SLOTS_MISSING: ${result.slotsMissing}`,
    `POSTS_QUEUED: ${result.postsQueued}`,
    `QUEUED_SLOTS: ${result.queuedSlots.length ? result.queuedSlots.join(", ") : "NONE"}`,
    `SKIPPED_SLOTS: ${result.skippedSlots.length ? result.skippedSlots.join(", ") : "NONE"}`,
    `ERROR_STEP: ${result.errorStep}`,
    `ERROR_DETAIL: ${result.errorDetail}`,
    "",
    `::inbox-item{title="Tomorrow scheduler ${result.status.toLowerCase().replace(/_/g, " ")}" summary="${result.inboxSummary}"}`,
  ].join("\n");
}

async function main() {
  const now = new Date();
  const runDate = getIsoDateInTimeZone(now, TIMEZONE);
  const targetDate = addDaysToIsoDate(runDate, 1);
  const memory = await readMemory();
  const memoryNote = memory ? "memory read ok" : "memory read unavailable";

  const baseResult = {
    status: "FAILURE",
    runDate,
    targetDate,
    dailyLock: "SKIPPED",
    filledAlready: 0,
    slotsMissing: 0,
    postsQueued: 0,
    queuedSlots: [],
    skippedSlots: [],
    errorStep: "NONE",
    errorDetail: "NONE",
    inboxSummary: "",
  };

  try {
    const { response: lockResponse, data: lockData } = await fetchJson(`${BASE_URL}/api/automation/claim-daily-run`, {
      method: "POST",
      body: JSON.stringify({
        automation_id: AUTOMATION_ID,
        account_id: ACCOUNT_ID,
        timezone: TIMEZONE,
        source: "scheduled",
      }),
    });

    if (!lockResponse.ok) {
      throw new Error(`claim-daily-run HTTP ${lockResponse.status}`);
    }

    if (!lockData?.acquired) {
      const result = {
        ...baseResult,
        status: "SKIPPED_ALREADY_RAN",
        inboxSummary: "Daily run already claimed today",
      };
      await writeMemory([
        `- ${memoryNote}`,
        `- Run date ET: ${runDate}`,
        `- Target date ET: ${targetDate}`,
        "- Daily lock: already claimed",
      ]);
      console.log(formatStatusBlock(result));
      return;
    }

    baseResult.dailyLock = "ACQUIRED";

    const { response: scheduleResponse, data: scheduleData } = await fetchJson(
      `${BASE_URL}/api/threads/schedule?app_user_id=${encodeURIComponent(APP_USER_ID)}`,
    );
    if (!scheduleResponse.ok) {
      throw new Error(`schedule GET HTTP ${scheduleResponse.status}`);
    }

    const scheduledPosts = Array.isArray(scheduleData?.scheduled_posts) ? scheduleData.scheduled_posts : [];
    const filledSlots = scheduledPosts
      .filter((post) => {
        const local = getLocalDateAndTimeParts(new Date(post.scheduled_time_utc), TIMEZONE);
        return local.date === targetDate;
      })
      .map((post) => getLocalDateAndTimeParts(new Date(post.scheduled_time_utc), TIMEZONE).time);

    const occupied = new Set(filledSlots);
    const missingSlots = SLOT_TIMES.filter((slot) => !occupied.has(slot));
    baseResult.filledAlready = filledSlots.length;
    baseResult.slotsMissing = missingSlots.length;

    if (missingSlots.length === 0) {
      await fetchJson(`${BASE_URL}/api/automation/complete-daily-run`, {
        method: "POST",
        body: JSON.stringify({
          automation_id: AUTOMATION_ID,
          account_id: ACCOUNT_ID,
          run_date: runDate,
          success: true,
          result: "skipped_already_filled",
        }),
      });
      const result = {
        ...baseResult,
        status: "SKIPPED_ALREADY_FILLED",
        inboxSummary: "Tomorrow is already fully scheduled",
      };
      await writeMemory([
        `- ${memoryNote}`,
        `- Run date ET: ${runDate}`,
        `- Target date ET: ${targetDate}`,
        "- Daily lock: acquired",
        `- Slots already filled: ${filledSlots.length}`,
      ]);
      console.log(formatStatusBlock(result));
      return;
    }

    const [{ response: recentResponse, data: recentData }, { response: topResponse, data: topData }] = await Promise.all([
      fetchJson(`${BASE_URL}/api/threads/posts/archive?app_user_id=${encodeURIComponent(APP_USER_ID)}&order=recent&limit=60&page=1`),
      fetchJson(`${BASE_URL}/api/threads/posts/archive?app_user_id=${encodeURIComponent(APP_USER_ID)}&order=top&limit=60&page=1`),
    ]);

    if (!recentResponse.ok) {
      throw new Error(`recent archive HTTP ${recentResponse.status}`);
    }
    if (!topResponse.ok) {
      throw new Error(`top archive HTTP ${topResponse.status}`);
    }

    const recentArchive = Array.isArray(recentData?.posts) ? recentData.posts : [];
    const topArchive = Array.isArray(topData?.posts) ? topData.posts : [];
    const plannedPosts = generatePostsForSlots(missingSlots, recentArchive, topArchive);

    const queuedSlots = [];
    const skippedSlots = [];

    for (let index = 0; index < plannedPosts.length; index += 1) {
      const item = plannedPosts[index];
      const { response: createResponse, data: createData } = await fetchJson(`${BASE_URL}/api/threads/schedule`, {
        method: "POST",
        body: JSON.stringify({
          app_user_id: APP_USER_ID,
          threads_user_id: THREADS_USER_ID,
          text: item.text,
          date: targetDate,
          time: item.slot,
          timezone: TIMEZONE,
        }),
      });

      if (!createResponse.ok || createData?.success === false) {
        const reason = `schedule_failed_${createResponse.status || "unknown"}`;
        skippedSlots.push(`${item.slot}:${reason}`);
        if (skippedSlots.length >= 2 && skippedSlots.every((entry) => entry.endsWith(reason))) {
          throw new Error(`shared schedule failure ${reason}`);
        }
        continue;
      }

      queuedSlots.push(item.slot);
    }

    const finalSchedule = await fetchJson(
      `${BASE_URL}/api/threads/schedule?app_user_id=${encodeURIComponent(APP_USER_ID)}`,
    );
    if (!finalSchedule.response.ok) {
      throw new Error(`schedule verification HTTP ${finalSchedule.response.status}`);
    }

    const status = queuedSlots.length === missingSlots.length
      ? "SUCCESS"
      : queuedSlots.length > 0
        ? "PARTIAL_FAILURE"
        : "FAILURE";

    const result = {
      ...baseResult,
      status,
      postsQueued: queuedSlots.length,
      queuedSlots,
      skippedSlots,
      errorStep: status === "SUCCESS" ? "NONE" : queuedSlots.length > 0 ? "QUEUE_PARTIAL" : "QUEUE_EMPTY",
      errorDetail: status === "SUCCESS"
        ? "NONE"
        : skippedSlots.length
          ? skippedSlots.join("; ")
          : "No slots were queued",
      inboxSummary: status === "SUCCESS"
        ? `Queued ${queuedSlots.length} posts for ${targetDate}`
        : queuedSlots.length > 0
          ? `Queued ${queuedSlots.length} posts; some slots failed`
          : "No posts were queued",
    };

    await fetchJson(`${BASE_URL}/api/automation/complete-daily-run`, {
      method: "POST",
      body: JSON.stringify({
        automation_id: AUTOMATION_ID,
        account_id: ACCOUNT_ID,
        run_date: runDate,
        success: status === "SUCCESS" || status === "SKIPPED_ALREADY_FILLED",
        result: status.toLowerCase(),
      }),
    });

    await writeMemory([
      `- ${memoryNote}`,
      `- Run date ET: ${runDate}`,
      `- Target date ET: ${targetDate}`,
      "- Daily lock: acquired",
      `- Slots filled already: ${filledSlots.length}`,
      `- Missing slots attempted: ${missingSlots.join(", ") || "none"}`,
      `- Posts queued: ${queuedSlots.length}`,
      `- Queued slots: ${queuedSlots.join(", ") || "none"}`,
      `- Skipped slots: ${skippedSlots.join(", ") || "none"}`,
    ]);

    console.log(formatStatusBlock(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await fetchJson(`${BASE_URL}/api/automation/complete-daily-run`, {
      method: "POST",
      body: JSON.stringify({
        automation_id: AUTOMATION_ID,
        account_id: ACCOUNT_ID,
        run_date: runDate,
        success: false,
        result: "failure",
      }),
    }).catch(() => null);
    const result = {
      ...baseResult,
      status: "FAILURE",
      errorStep: "PLANNER_RUNTIME",
      errorDetail: message,
      inboxSummary: `Planner failed: ${message}`,
    };
    await writeMemory([
      `- ${memoryNote}`,
      `- Run date ET: ${runDate}`,
      `- Target date ET: ${targetDate}`,
      `- Failure: ${message}`,
    ]);
    console.log(formatStatusBlock(result));
  }
}

await main();
