import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
});

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
      const { data } = await supabase
        .from("audit_log")
        .select("*, profiles:actor_user_id(display_name), claims(claim_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as unknown as AuditRow[];
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
              <div key={l.id} className="grid grid-cols-[180px_220px_180px_1fr] items-start gap-4 px-5 py-3 text-sm">
                <span className="text-xs text-muted-foreground">{formatDateTime(l.created_at)}</span>
                <span className="font-mono text-xs">{l.action}</span>
                <span className="text-xs">
                  {l.profiles?.display_name ?? "—"} <span className="text-muted-foreground">({l.actor_role})</span>
                </span>
                <span className="text-xs">
                  {l.claim_id ? (
                    <Link to="/claims/$id" params={{ id: l.claim_id }} className="font-mono hover:underline">
                      {l.claims?.claim_number ?? l.claim_id.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {l.details ? (
                    <div className="text-muted-foreground mt-0.5 truncate">
                      {JSON.stringify(l.details).slice(0, 120)}
                    </div>
                  ) : null}
                </span>
              </div>
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
