import { Resend } from "resend";

export async function sendEmail(env, to, subject, html) {
  const resend = new Resend(env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: `Lensically <${env.EMAIL_FROM}>`,
    to: to,
    subject: subject,
    html: html
  });

  if (error) {
    console.error("Email error:", error);
    throw error;
  }

  return data;
}
