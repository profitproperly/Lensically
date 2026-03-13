import { Resend } from "resend";
import { logEmailEvent } from "../auth/operationalLog.js";

const VERIFIED_EMAIL_FROM = "Lensically <support@lensically.com>";
const NON_DELIVERABLE_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
]);

function shouldSkipNonDeliverableRecipient(to) {
  if (typeof to !== "string") {
    return false;
  }
  const normalized = to.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex === -1 || atIndex >= normalized.length - 1) {
    return false;
  }
  const domain = normalized.slice(atIndex + 1);
  return NON_DELIVERABLE_EMAIL_DOMAINS.has(domain);
}

function isLocalEmailDeliveryEnvironment(env) {
  const appUrl = String(env.APP_URL || env.WEB_APP_URL || "").toLowerCase();
  return appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
}

function isEmailDeliveryDisabled(env) {
  const nodeEnv = String(env.NODE_ENV || "").trim().toLowerCase();
  const disableEmail = String(env.DISABLE_EMAIL || "").trim().toLowerCase();
  return nodeEnv === "test" || disableEmail === "true";
}

export async function sendEmail(env, to, subject, html) {
  if (isEmailDeliveryDisabled(env)) {
    logEmailEvent("delivery_skipped", {
      provider: "resend",
      template: subject,
      reason: "email_delivery_disabled",
    });
    return null;
  }

  if (shouldSkipNonDeliverableRecipient(to)) {
    logEmailEvent("delivery_skipped", {
      provider: "resend",
      template: subject,
      reason: "non_deliverable_recipient",
    });
    return null;
  }

  if (isLocalEmailDeliveryEnvironment(env)) {
    logEmailEvent("delivery_skipped", {
      provider: "resend",
      template: subject,
      reason: "local_environment",
    }, "error");
    return null;
  }

  if (!env.RESEND_API_KEY) {
    logEmailEvent("delivery_skipped", {
      provider: "resend",
      template: subject,
      reason: "missing_resend_api_key",
    }, "error");
    return null;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  logEmailEvent("delivery_attempted", {
    provider: "resend",
    template: subject,
  });

  const { data, error } = await resend.emails.send({
    from: VERIFIED_EMAIL_FROM,
    to: to,
    subject: subject,
    html: html
  });

  if (error) {
    logEmailEvent("delivery_failed", {
      provider: "resend",
      template: subject,
      reason: error instanceof Error ? error.message : String(error),
    }, "error");
    throw error;
  }

  logEmailEvent("delivery_succeeded", {
    provider: "resend",
    template: subject,
    provider_message_id: typeof data?.id === "string" ? "present" : "absent",
  });

  return data;
}
