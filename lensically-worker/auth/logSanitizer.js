const REDACTED = "[REDACTED]";

const SENSITIVE_KEY_PATTERN = /(^|[_-])(password|password_hash|token|access_token|refresh_token|authorization|cookie|secret|client_secret|session|email|user_id|app_user_id|threads_user_id|platform_user_id|provider_user_id|confirmation_code)([_-]|$)/i;
const PRIVATE_TEXT_KEY_PATTERN = /(^|[_-])(text|body|html|content)([_-]|$)/i;
const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "token",
  "refresh_token",
  "authorization",
  "code",
  "state",
  "signed_request",
  "confirmation_code",
]);

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function sanitizeUrlLikeString(value) {
  try {
    const url = new URL(value);
    for (const key of SENSITIVE_QUERY_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, REDACTED);
      }
    }
    return url.toString();
  } catch {
    return value
      .replace(/(Bearer\s+)[^\s"]+/gi, `$1${REDACTED}`)
      .replace(/((?:access_)?token=)[^&\s"]+/gi, `$1${REDACTED}`)
      .replace(/(refresh_token=)[^&\s"]+/gi, `$1${REDACTED}`)
      .replace(/(confirmation_code=)[^&\s"]+/gi, `$1${REDACTED}`)
      .replace(/(code=)[^&\s"]+/gi, `$1${REDACTED}`)
      .replace(/(state=)[^&\s"]+/gi, `$1${REDACTED}`)
      .replace(/(signed_request=)[^&\s"]+/gi, `$1${REDACTED}`);
  }
}

function sanitizeString(value, keyHint = "") {
  if (SENSITIVE_KEY_PATTERN.test(keyHint) || PRIVATE_TEXT_KEY_PATTERN.test(keyHint)) {
    return REDACTED;
  }

  return sanitizeUrlLikeString(value);
}

export function sanitizeForLog(value, keyHint = "") {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value, keyHint);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForLog(entry, keyHint));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message, "error_message"),
    };
  }

  if (isPlainObject(value)) {
    const sanitizedEntries = Object.entries(value).map(([key, entryValue]) => {
      if (SENSITIVE_KEY_PATTERN.test(key) || PRIVATE_TEXT_KEY_PATTERN.test(key)) {
        return [key, REDACTED];
      }

      return [key, sanitizeForLog(entryValue, key)];
    });
    return Object.fromEntries(sanitizedEntries);
  }

  return sanitizeString(String(value), keyHint);
}

export function sanitizeLogMessage(message) {
  return typeof message === "string" ? sanitizeString(message) : sanitizeForLog(message);
}
