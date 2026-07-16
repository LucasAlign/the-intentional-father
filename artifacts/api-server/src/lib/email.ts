import { Resend } from "resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "admin@lucasalign.com";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendApprovalEmail(email: string): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(`RESEND_API_KEY not configured; skipping approval email to ${email}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "You're approved for Steward",
    html: `<p>Good news — your access to Steward has been approved.</p><p>Sign in whenever you're ready to get started.</p>`,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
