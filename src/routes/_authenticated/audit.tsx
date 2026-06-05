import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
});

function AuditLogRow({ log }: { log: AuditRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="grid grid-cols-[180px_220px_180px_minmax(0,1fr)] items-start gap-4 px-5 py-3 text-sm">
      <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
      <span className="font-mono text-xs break-words">{log.action}</span>
      <span className="text-xs break-words">
        {log.profiles?.display_name ?? "—"} <span className="text-muted-foreground">({log.actor_role})</span>
      </span>
      <div className="min-w-0 text-xs">
        {log.claim_id ? (
          <Link to="/claims/$id" params={{ id: log.claim_id }} className="font-mono hover:underline">
            {log.claims?.claim_number ?? log.claim_id.slice(0, 8)}
          </Link>
        ) : (
          "—"
        )}
        {log.details ? (
          <div className="mt-1">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Show details
                </>
              )}
            </button>
            {expanded ? (
              <pre className="mt-1 whitespace-pre-wrap break-words text-muted-foreground bg-muted/50 rounded px-2 py-1.5 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            ) : (
              <div className="text-muted-foreground mt-0.5 truncate">
                {JSON.stringify(log.details)}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  actor_role: string | null;
  actor_user_id: string | null;
  details: unknown;
  claim_id: string | null;
  claims?: { claim_number?: string } | null;
  profiles?: { display_name?: string } | null;
}

function AuditPage() {
  const { data: logs = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as AuditRow[];

      const actorIds = Array.from(
        new Set(rows.map((r) => r.actor_user_id).filter(Boolean) as string[]),
      );
      const claimIds = Array.from(
        new Set(rows.map((r) => r.claim_id).filter(Boolean) as string[]),
      );

      const [profilesRes, claimsRes] = await Promise.all([
        actorIds.length
          ? supabase.from("profiles").select("id, display_name").in("id", actorIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
        claimIds.length
          ? supabase.from("claims").select("id, claim_number").in("id", claimIds)
          : Promise.resolve({ data: [] as { id: string; claim_number: string | null }[] }),
      ]);

      const profileById = new Map(
        (profilesRes.data ?? []).map((p) => [p.id, { display_name: p.display_name ?? undefined }]),
      );
      const claimById = new Map(
        (claimsRes.data ?? []).map((c) => [c.id, { claim_number: c.claim_number ?? undefined }]),
      );

      return rows.map((r) => ({
        ...r,
        profiles: r.actor_user_id ? (profileById.get(r.actor_user_id) ?? null) : null,
        claims: r.claim_id ? (claimById.get(r.claim_id) ?? null) : null,
      }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chronological record of AI decisions, manual edits, and approvals.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{logs.length} events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {logs.map((l) => (
              <AuditLogRow key={l.id} log={l} />
            ))}
            {logs.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No events yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
