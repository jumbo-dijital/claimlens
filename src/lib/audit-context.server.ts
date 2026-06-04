import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

/**
 * Read the requesting browser's IP and User-Agent from the current server
 * request. Both fields are best-effort: if the request context is unavailable
 * (e.g. an out-of-band invocation) or the headers are missing, the field is
 * returned as `null` so audit inserts still succeed.
 */
export function getRequestAuditContext(): {
  ip_address: string | null;
  user_agent: string | null;
} {
  let ip: string | null = null;
  let ua: string | null = null;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    ip = null;
  }
  try {
    ua = getRequestHeader("user-agent") ?? null;
  } catch {
    ua = null;
  }
  return { ip_address: ip, user_agent: ua };
}
