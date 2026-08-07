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

  const appUrl = process.env.PUBLIC_URL?.replace(/\/+$/, "");
  const signInButton = appUrl
    ? `<p><a href="${appUrl}" style="display:inline-block;background:#1E1A10;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Sign in to Steward</a></p>`
    : "";

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "You're approved for Steward",
    html: `<p>Good news — your access to Steward has been approved.</p>${signInButton}<p>If you signed up with Google or Microsoft, use "Continue with Google/Microsoft" again. If you signed up with your email, choose "Continue with Email" and we'll send you a fresh sign-in code.</p>`,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(`RESEND_API_KEY not configured; sign-in code for ${email} is ${code}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Your Steward sign-in code: ${code}`,
    html: `<p>Your Steward sign-in code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;">${code}</p><p>This code expires in 10 minutes.</p>`,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
