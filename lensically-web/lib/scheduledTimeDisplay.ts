export type ClockFormatPreference = "12h" | "24h";

export function normalizeIanaTimezone(rawValue: string | null | undefined): string | null {
  const candidate = rawValue?.trim();
  if (!candidate) {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return null;
  }
}

export function resolveTimezonePreference(rawTimezone: string | null | undefined): string {
  return normalizeIanaTimezone(rawTimezone) ?? "UTC";
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

function toTimezoneLocationLabel(timezone: string): string {
  const segments = timezone.split("/");
  const citySegment = segments[segments.length - 1] || timezone;
  return citySegment.replace(/_/g, " ");
}

function getTimezoneLongName(timezone: string): string | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longGeneric",
      hour: "numeric",
      minute: "numeric",
    });
    const part = formatter.formatToParts(new Date()).find((candidate) => candidate.type === "timeZoneName");
    const name = part?.value?.trim() ?? "";
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export function formatTimezoneLabel(rawTimezone: string | null | undefined): string {
  const timezone = normalizeIanaTimezone(rawTimezone) ?? "UTC";
  const location = toTimezoneLocationLabel(timezone);
  const timezoneLongName = getTimezoneLongName(timezone);
  return timezoneLongName ? `${location} (${timezoneLongName})` : location;
}
