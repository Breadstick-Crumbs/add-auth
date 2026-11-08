// Swap the body for your email provider (Resend, Postmark, SES, SMTP...).
// Without one configured it logs the link, which is enough for local dev.
export async function sendResetEmail(to: string, token: string): Promise<void> {
  const base = process.env.APP_URL ?? 'http://localhost:3000';
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  console.warn(`[auth] password reset for ${to}: ${link}`);
}
