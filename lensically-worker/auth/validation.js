const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MAX_LENGTH = 256;
const CONFIRMATION_TEXT_MAX_LENGTH = 32;
const UUID_V4ISH_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export async function readJsonObject(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: json({ success: false, error: "Invalid JSON body" }, 400),
    };
  }

  if (!isPlainObject(body)) {
    return {
      ok: false,
      response: json({ success: false, error: "JSON body must be an object" }, 400),
    };
  }

  return {
    ok: true,
    body,
  };
}

export function rejectUnexpectedFields(body, allowedFields) {
  const allowed = new Set(allowedFields);
  const unexpectedField = Object.keys(body).find((key) => !allowed.has(key));
  if (!unexpectedField) {
    return null;
  }

  return json({
    success: false,
    error: "Request contains unsupported fields.",
  }, 400);
}

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateEmail(email, requiredMessage = "Email is required") {
  if (!email) {
    return requiredMessage;
  }

  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(email)) {
    return "Invalid email address.";
  }

  return null;
}

export function validatePassword(password, requiredMessage = "Password is required") {
  if (!password) {
    return requiredMessage;
  }

  if (typeof password !== "string" || password.length > PASSWORD_MAX_LENGTH) {
    return "Invalid password.";
  }

  return null;
}

export function validateUuidLike(value, fieldLabel) {
  if (!value) {
    return `${fieldLabel} is required`;
  }

  if (!UUID_V4ISH_REGEX.test(value)) {
    return `Invalid ${fieldLabel.toLowerCase()}`;
  }

  return null;
}

export function validateConfirmationText(value, expectedValue) {
  if (typeof value !== "string") {
    return `Type ${expectedValue} to confirm account deletion.`;
  }

  if (value.length > CONFIRMATION_TEXT_MAX_LENGTH) {
    return "Invalid confirmation text.";
  }

  if (value.trim().toUpperCase() !== expectedValue) {
    return `Type ${expectedValue} to confirm account deletion.`;
  }

  return null;
}
