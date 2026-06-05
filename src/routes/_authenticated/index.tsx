import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, FileQuestion, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Claims queue — ClaimLens" },
      { name: "description", content: "AI-powered car insurance claims assessment co-pilot." },
    ],
  }),
  component: ClaimsQueuePage,
});

interface ClaimRow {
  id: string;
  claim_number: string;
  policyholder_name: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  incident_date: string;
  status: string;
  created_at: string;
}

function ClaimsQueuePage() {
  const { data: me } = useMe();
  const role = me?.roles.includes("superadmin")
    ? "superadmin"
    : me?.roles.includes("adjuster")
      ? "adjuster"
      : "agent";

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["claims", role],
    queryFn: async () => {
      let q = supabase.from("claims").select("*").order("created_at", { ascending: false });
      if (role === "adjuster") {
        q = q.in("status", ["submitted", "approved", "rejected", "changes_requested"]);
      } else if (role === "agent") {
        q = q.in("status", ["new", "ai_processing", "in_review", "changes_requested", "submitted"]);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ClaimRow[];
    },
    enabled: !!me,
  });

  const title =
    role === "adjuster" ? "Review queue" : role === "superadmin" ? "All claims" : "My claims";
  const subtitle =
    role === "adjuster"
      ? "Assessments awaiting your approval"
      : role === "superadmin"
        ? "All claims across the system"
        : "Claims assigned to you for AI-assisted review";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {role === "superadmin" && (
          <Button asChild>
            <Link to="/admin/generate">
              <ScanEye className="mr-2 h-4 w-4" />
              Generate synthetic claim
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading ? "Loading…" : `${claims.length} claim${claims.length === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {claims.length === 0 && !isLoading ? (
            <div className="grid place-items-center py-16 text-center">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No claims in this queue</p>
              {role === "superadmin" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Use the generate claim flow to seed synthetic claims.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-[140px_1fr_180px_120px_140px_40px] gap-4 px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Claim #</span>
                <span>Policyholder & vehicle</span>
                <span>Incident</span>
                <span>Created</span>
                <span>Status</span>
                <span></span>
              </div>
              {claims.map((c) => (
                <Link
                  key={c.id}
                  to="/claims/$id"
                  params={{ id: c.id }}
                  className="grid grid-cols-[140px_1fr_180px_120px_140px_40px] items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="font-mono text-xs">{c.claim_number}</span>
                  <span>
                    <span className="block font-medium">{c.policyholder_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.vehicle_year} {c.vehicle_make} {c.vehicle_model}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(c.incident_date)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                  <StatusBadge status={c.status} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
