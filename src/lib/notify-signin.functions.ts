import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SENDER_DOMAIN = "notify.jonathanburton.org";
const FROM_ADDRESS = `ClaimLens <alerts@${SENDER_DOMAIN}>`;

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

export const notifySignin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const recipient = process.env.SIGNIN_NOTIFY_RECIPIENT;
    if (!recipient) {
      console.error("[notifySignin] SIGNIN_NOTIFY_RECIPIENT not configured");
      return { ok: false, reason: "not_configured" as const };
    }

    const request = getRequest();
    const headers = request?.headers;
    const userAgent = headers?.get("user-agent") ?? "unknown";
    const ip =
      headers?.get("cf-connecting-ip") ??
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headers?.get("x-real-ip") ??
      "unknown";

    const email = (context.claims.email as string | undefined) ?? "unknown";
    const userId = context.userId;
    const timestamp = new Date().toISOString();

    const subject = `ClaimLens sign-in: ${email}`;
    const text = [
      `A user signed in to ClaimLens.`,
      ``,
      `User email: ${email}`,
      `IP address: ${ip}`,
      `Timestamp:  ${timestamp}`,
      `User agent: ${userAgent}`,
      `User ID:    ${userId}`,
    ].join("\n");

    const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#ffffff;color:#0f172a;padding:24px;">
<h2 style="margin:0 0 16px;font-size:18px;">ClaimLens sign-in</h2>
<table cellpadding="6" style="border-collapse:collapse;font-size:14px;">
<tr><td style="color:#64748b;">User email</td><td><strong>${esc(email)}</strong></td></tr>
<tr><td style="color:#64748b;">IP address</td><td>${esc(ip)}</td></tr>
<tr><td style="color:#64748b;">Timestamp</td><td>${esc(timestamp)}</td></tr>
<tr><td style="color:#64748b;">User agent</td><td>${esc(userAgent)}</td></tr>
<tr><td style="color:#64748b;">User ID</td><td><code>${esc(userId)}</code></td></tr>
</table>
</body></html>`;

    const messageId = `signin-${userId}-${Date.now()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: recipient,
        from: FROM_ADDRESS,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "signin_notification",
        idempotency_key: messageId,
        message_id: messageId,
        queued_at: timestamp,
      },
    });

    if (error) {
      console.error("[notifySignin] enqueue failed", error);
      return { ok: false, reason: "enqueue_failed" as const };
    }

    return { ok: true };
  });
