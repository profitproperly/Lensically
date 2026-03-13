export type ClockFormatPreference = "12h" | "24h";

export function resolveTimezonePreference(rawTimezone: string | null | undefined): string {
  const candidate = rawTimezone?.trim();
  if (!candidate) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

export function resolveClockFormatPreference(
  rawClockFormat: string | null | undefined,
): ClockFormatPreference {
  return rawClockFormat === "24h" ? "24h" : "12h";
}

export function formatScheduledLocalTime(
  scheduledUtc: string,
  timezone: string,
  clockFormat: ClockFormatPreference,
): string | null {
  const date = new Date(scheduledUtc);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: clockFormat !== "24h",
    });
    return formatter.format(date);
  } catch {
    return null;
  }
}
