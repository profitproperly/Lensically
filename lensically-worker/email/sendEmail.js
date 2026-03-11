import { Resend } from "resend";
import { logEmailEvent } from "../auth/operationalLog.js";

const VERIFIED_EMAIL_FROM = "Lensically <support@lensically.com>";

export async function sendEmail(env, to, subject, html) {
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
