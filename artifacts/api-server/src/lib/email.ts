import { Resend } from "resend";
import type { Commit } from "@workspace/db";

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

export interface ReminderDigestItem {
  commit: Commit;
  who: string;
}

export interface ReminderDigest {
  overdue: ReminderDigestItem[];
  dueToday: ReminderDigestItem[];
  dueTomorrow: ReminderDigestItem[];
}

export function isReminderDigestEmpty(digest: ReminderDigest): boolean {
  return digest.overdue.length === 0 && digest.dueToday.length === 0 && digest.dueTomorrow.length === 0;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Steward's actual brand palette (index.css :root vars), reused here so the
// one branded transactional email matches the app rather than inventing a
// second identity. Table-based layout with every style inlined per element
// — email clients (especially Outlook's Word rendering engine) strip <style>
// blocks and don't reliably support flexbox/grid/gradients, so this
// deliberately avoids all three in favor of what actually survives across
// clients.
const BRAND = {
  ink: "#0C0E07",
  walnutDark: "#5A3A20",
  brassBright: "#D8AA3E",
  parchmentBright: "#EEE4C4",
  parchmentDim: "#9C9272",
  overdueRed: "#C87060",
};
const EMAIL_FONT = "'Calibri','Segoe UI','Gill Sans MT','Helvetica Neue',Arial,sans-serif";

function reminderSectionHtml(title: string, items: ReminderDigestItem[], accentColor: string): string {
  if (items.length === 0) return "";
  const rows = items.map(({ commit, who }) => `
    <tr><td style="padding:0 0 10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border-left:3px solid ${accentColor};padding:2px 0 2px 12px;font-family:${EMAIL_FONT};font-size:14px;line-height:1.5;color:${BRAND.parchmentBright};">
          <span style="color:${BRAND.parchmentDim};">To ${escapeHtml(who)}:</span> ${escapeHtml(commit.text)}
        </td>
      </tr></table>
    </td></tr>`).join("");
  return `
    <tr><td style="padding:0 0 6px;">
      <span style="font-family:${EMAIL_FONT};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${accentColor};">${title}</span>
    </td></tr>
    ${rows}
    <tr><td style="padding:0 0 14px;line-height:1px;font-size:1px;">&nbsp;</td></tr>`;
}

// #75 — one daily digest email per user, grouped Overdue first (most
// urgent), then Due Today, then Due Tomorrow. Each commitment is reminded
// at most once per section (see commits.remindedDueAt/remindedOverdueAt) —
// the caller decides which commits to include, this just formats and sends.
export async function sendReminderDigest(email: string, digest: ReminderDigest): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(`RESEND_API_KEY not configured; skipping reminder digest to ${email}`);
    return;
  }

  const appUrl = process.env.PUBLIC_URL?.replace(/\/+$/, "");
  const ctaRow = appUrl ? `
    <tr><td align="center" style="padding:24px 0 4px;">
      <a href="${appUrl}" style="display:inline-block;background:${BRAND.brassBright};color:${BRAND.ink};font-family:${EMAIL_FONT};font-size:15px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:24px;">Open Steward</a>
    </td></tr>` : "";

  const sections = [
    reminderSectionHtml("Overdue", digest.overdue, BRAND.overdueRed),
    reminderSectionHtml("Due Today", digest.dueToday, BRAND.brassBright),
    reminderSectionHtml("Due Tomorrow", digest.dueTomorrow, BRAND.parchmentDim),
  ].join("");

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFEAE0;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${BRAND.ink};border-radius:14px;">
<tr><td style="background:${BRAND.walnutDark};padding:24px 28px 20px;border-radius:14px 14px 0 0;">
  <span style="font-family:${EMAIL_FONT};font-size:26px;font-weight:400;color:${BRAND.parchmentBright};">Steward</span><span style="font-family:${EMAIL_FONT};font-size:26px;color:${BRAND.brassBright};">.</span>
</td></tr>
<tr><td style="height:3px;background:${BRAND.brassBright};line-height:3px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:24px 28px 4px;">
  <span style="font-family:${EMAIL_FONT};font-size:15px;color:${BRAND.parchmentBright};">Here&rsquo;s what needs your attention today.</span>
</td></tr>
<tr><td style="padding:16px 28px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${sections}</table>
</td></tr>
${ctaRow}
<tr><td style="padding:22px 28px 26px;border-top:1px solid #3A2C18;">
  <span style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${BRAND.parchmentDim};">You&rsquo;re getting this because you have open commitments in Steward. Manage reminder settings anytime from Profile &rarr; Commitment Reminders in the app.</span>
</td></tr>
</table>
</td></tr>
</table>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your Steward commitments",
    html,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY not configured; cannot send sign-in code");
    }
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

// #93 — verifies a newly-added reminder email before it can be made active,
// same dev/production fallback behavior as sendLoginCode (this also gates
// an account setting change, not just a convenience notification).
export async function sendReminderEmailVerificationCode(email: string, code: string): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY not configured; cannot send verification code");
    }
    console.warn(`RESEND_API_KEY not configured; reminder-email verification code for ${email} is ${code}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Your Steward verification code: ${code}`,
    html: `<p>To receive Steward commitment reminders at this address, enter this code:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;">${code}</p><p>This code expires in 10 minutes.</p>`,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
