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
        .select("*, claims(claim_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as AuditRow[];
      const actorIds = Array.from(
        new Set(rows.map((r) => r.actor_user_id).filter(Boolean) as string[]),
      );
      if (actorIds.length === 0) return rows;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", actorIds);
      const byId = new Map(
        (profiles ?? []).map((p) => [p.id, { display_name: p.display_name ?? undefined }]),
      );
      return rows.map((r) => ({
        ...r,
        profiles: r.actor_user_id ? (byId.get(r.actor_user_id) ?? null) : null,
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
