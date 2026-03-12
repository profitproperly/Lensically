import { sanitizeForLog } from "./logSanitizer.js";

function inferEventType(event, details = {}, fallback = "operational") {
  if (typeof details.event_type === "string" && details.event_type.trim()) {
    return details.event_type.trim();
  }

  const normalizedEvent = String(event || "").toLowerCase();
  if (
    normalizedEvent.includes("failed")
    || normalizedEvent.includes("error")
    || normalizedEvent.includes("exception")
    || normalizedEvent.includes("rejected")
  ) {
    return "failure";
  }

  if (
    normalizedEvent.includes("succeeded")
    || normalizedEvent.includes("completed")
    || normalizedEvent.includes("processed")
    || normalizedEvent.includes("validated")
  ) {
    return "success";
  }

  if (
    normalizedEvent.includes("started")
    || normalizedEvent.includes("attempt")
    || normalizedEvent.includes("received")
  ) {
    return "attempt";
  }

  return fallback;
}

function emit(level, payload) {
  const entry = sanitizeForLog({
    ts: new Date().toISOString(),
    ...payload,
  });

  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

export function logAuthEvent(event, details = {}) {
  emit("log", {
    category: "auth",
    event,
    event_type: inferEventType(event, details, "auth_operation"),
    ...details,
  });
}

export function logEmailEvent(event, details = {}, level = "log") {
  emit(level, {
    category: "email",
    event,
    event_type: inferEventType(event, details, "email_operation"),
    ...details,
  });
}

export function logAccountDeletionEvent(event, details = {}, level = "log") {
  emit(level, {
    category: "account_deletion",
    event,
    event_type: inferEventType(event, details, "account_lifecycle"),
    ...details,
  });
}

export function logWorkerOperationalEvent(event, details = {}, level = "log") {
  emit(level, {
    category: "worker",
    event,
    event_type: inferEventType(event, details, "worker_operation"),
    ...details,
  });
}
