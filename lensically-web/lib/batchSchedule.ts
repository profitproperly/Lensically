export type ParsedBatchPost = {
  index: number;
  text: string;
  isEmpty: boolean;
};

function padTwoDigits(value: number): string {
  return value.toString().padStart(2, "0");
}

export function getCurrentDateTimeForTimezone(
  timezone: string,
  now: Date,
): { currentDate: string; currentTime: string } {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;

    if (!year || !month || !day || !hour || !minute) {
      throw new Error("Missing date time parts");
    }

    return {
      currentDate: `${year}-${month}-${day}`,
      currentTime: `${hour}:${minute}`,
    };
  } catch {
    return {
      currentDate: `${now.getFullYear()}-${padTwoDigits(now.getMonth() + 1)}-${padTwoDigits(now.getDate())}`,
      currentTime: `${padTwoDigits(now.getHours())}:${padTwoDigits(now.getMinutes())}`,
    };
  }
}

export function addDaysToIsoDate(date: string, days: number): string | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !Number.isInteger(days)) {
    return null;
  }

  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${shifted.getUTCFullYear()}-${padTwoDigits(shifted.getUTCMonth() + 1)}-${padTwoDigits(shifted.getUTCDate())}`;
}

export function getTomorrowDateForTimezone(timezone: string, now = new Date()): string {
  const { currentDate } = getCurrentDateTimeForTimezone(timezone, now);
  return addDaysToIsoDate(currentDate, 1) ?? currentDate;
}

export function parseHourMinute(value: string): { hour: number; minute: number } | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

export function formatPickerTime(value: string, clockFormat: "12h" | "24h"): string {
  const parsed = parseHourMinute(value);
  if (!parsed) {
    return value;
  }
  if (clockFormat === "24h") {
    return `${padTwoDigits(parsed.hour)}:${padTwoDigits(parsed.minute)}`;
  }
  const hour12 = parsed.hour % 12 || 12;
  const period = parsed.hour >= 12 ? "PM" : "AM";
  return `${hour12}:${padTwoDigits(parsed.minute)} ${period}`;
}

export function normalizeTimeValue(value: string): string {
  const parsed = parseHourMinute(value);
  if (!parsed) {
    return "";
  }
  return `${padTwoDigits(parsed.hour)}:${padTwoDigits(parsed.minute)}`;
}

export function getLocalDateTimeParts(
  utcIso: string,
  timezone: string,
): { date: string; time: string } | null {
  const parsedMs = Date.parse(utcIso);
  if (!Number.isFinite(parsedMs)) {
    return null;
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(new Date(parsedMs));
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (!year || !month || !day || !hour || !minute) {
      return null;
    }
    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  } catch {
    return null;
  }
}

export function parseNumberedBatchPosts(input: string): ParsedBatchPost[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const posts: ParsedBatchPost[] = [];
  let currentLines: string[] | null = null;

  const pushCurrent = () => {
    if (!currentLines) {
      return;
    }
    const text = currentLines.join("\n").trim();
    posts.push({
      index: posts.length + 1,
      text,
      isEmpty: text.length === 0,
    });
    currentLines = null;
  };

  for (const line of lines) {
    const markerMatch = line.match(/^\s*\d+[.)]\s?(.*)$/);
    if (markerMatch) {
      pushCurrent();
      currentLines = [markerMatch[1] ?? ""];
      continue;
    }

    if (!currentLines) {
      continue;
    }

    currentLines.push(line);
  }

  pushCurrent();
  return posts;
}
