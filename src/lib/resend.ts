import { Resend } from "resend";

export interface SendEmailInput {
  to: string;
  subject: string;
  // Exactly one of these — plain text (Notices) or HTML (Reports' formatted
  // tables). Resend accepts either.
  text?: string;
  html?: string;
}

export interface SendEmailResult {
  id: string;
}

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
  return new Resend(apiKey);
}

function getFromAddress(): string {
  // Defaults to Resend's own sandbox sender, which only delivers to the
  // account owner's verified email — fine for initial testing, but real
  // recipients need RESEND_FROM_ADDRESS set to an address on a verified
  // sending domain.
  return process.env.RESEND_FROM_ADDRESS || "onboarding@resend.dev";
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!input.text && !input.html) throw new Error("sendEmail needs either text or html.");
  const resend = getClient();
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: input.to,
    subject: input.subject,
    ...(input.html ? { html: input.html } : { text: input.text! }),
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Resend returned no data.");
  return { id: data.id };
}

// Back-compat alias — Notices' send flow already calls this name.
export const sendNoticeEmail = sendEmail;
