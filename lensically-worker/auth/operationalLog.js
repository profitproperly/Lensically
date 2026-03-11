import { sanitizeForLog } from "./logSanitizer.js";

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
    ...details,
  });
}

export function logEmailEvent(event, details = {}, level = "log") {
  emit(level, {
    category: "email",
    event,
    ...details,
  });
}

export function logAccountDeletionEvent(event, details = {}, level = "log") {
  emit(level, {
    category: "account_deletion",
    event,
    ...details,
  });
}
