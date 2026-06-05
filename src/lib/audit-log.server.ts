import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Hard cap on the serialized size (in characters) of `audit_log.details`.
 *
 * Audit entries are written from many call sites and accidentally including
 * something huge (base64 image blobs, full file contents, large API payloads)
 * has previously made the audit list time out when PostgREST tries to
 * serialize hundreds of rows. This cap is enforced here so it can't happen
 * regardless of which caller forgets to trim.
 */
const MAX_DETAILS_CHARS = 1000;
const MAX_STRING_CHARS_DEFAULT = 200;
const MAX_STRING_CHARS_TIGHT = 80;

function scrubValue(value: unknown, maxStr: number): unknown {
  if (typeof value === "string") {
    // data: URLs are almost always base64 blobs we never want in audit details.
    if (value.startsWith("data:")) return `[data url omitted, ${value.length} chars]`;
    if (value.length > maxStr) {
      return `${value.slice(0, maxStr)}…[truncated ${value.length - maxStr} chars]`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, maxStr));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(v, maxStr);
    }
    return out;
  }
  return value;
}

function capDetails(details: unknown): unknown {
  if (details == null) return null;
  let scrubbed = scrubValue(details, MAX_STRING_CHARS_DEFAULT);
  let serialized = JSON.stringify(scrubbed);
  if (serialized.length <= MAX_DETAILS_CHARS) return scrubbed;

  scrubbed = scrubValue(scrubbed, MAX_STRING_CHARS_TIGHT);
  serialized = JSON.stringify(scrubbed);
  if (serialized.length <= MAX_DETAILS_CHARS) return scrubbed;

  return {
    truncated: true,
    original_size: serialized.length,
    max_size: MAX_DETAILS_CHARS,
    note: `audit details exceeded ${MAX_DETAILS_CHARS} chars and were dropped`,
  };
}

export interface AuditLogRow {
  claim_id?: string | null;
  actor_user_id?: string | null;
  actor_role?: string | null;
  action: string;
  details?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
}

/**
 * The ONLY supported way to write to `public.audit_log`. Scrubs base64
 * data-URLs, truncates long strings, and enforces a hard size cap on the
 * serialized `details` payload.
 */
export async function insertAuditLog(row: AuditLogRow) {
  const capped = capDetails(row.details);
  const { error } = await supabaseAdmin.from("audit_log").insert({
    claim_id: row.claim_id ?? null,
    actor_user_id: row.actor_user_id ?? null,
    actor_role: row.actor_role ?? null,
    action: row.action,
    details: capped as never,
    ip_address: row.ip_address ?? null,
    user_agent: row.user_agent ?? null,
  });
  if (error) throw new Error(error.message);
}
