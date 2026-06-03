import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePersonaStore } from "@/lib/persona-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency } from "@/lib/format";
import { reviewClaim } from "@/lib/claim-actions.functions";

export const Route = createFileRoute("/_authenticated/claims/$id/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { currentPersonaId } = usePersonaStore();
  const review = useServerFn(reviewClaim);
  const [comment, setComment] = useState("");

  const { data: claim } = useQuery({
    queryKey: ["claim", id],
    queryFn: async () => (await supabase.from("claims").select("*").eq("id", id).single()).data,
  });
  const { data: assessment } = useQuery({
    queryKey: ["claim-assessment", id],
    queryFn: async () =>
      (
        await supabase
          .from("ai_assessments")
          .select("*")
          .eq("claim_id", id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["line-items", assessment?.id],
    queryFn: async () => {
      if (!assessment?.id) return [];
      return (
        (await supabase
          .from("assessment_line_items")
          .select("*")
          .eq("assessment_id", assessment.id)
          .eq("is_deleted", false)).data ?? []
      );
    },
    enabled: !!assessment?.id,
  });

  if (!claim) return <p className="text-sm">Loading…</p>;
  const total = items.reduce(
    (s, i) => s + Number(i.part_cost) + Number(i.labour_cost),
    0,
  );

  const act = async (decision: "approve" | "reject" | "changes") => {
    await review({ data: { claimId: id, personaId: currentPersonaId, decision, comment } });
    toast.success(`Claim ${decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "sent back"}`);
    router.invalidate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/claims/$id" params={{ id }} className="text-xs text-muted-foreground hover:underline">
            ← Back to claim
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Senior adjuster review</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {claim.claim_number} · {claim.policyholder_name} <StatusBadge status={claim.status} />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final assessment ({items.length} line items)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((li) => (
            <div key={li.id} className="flex items-center justify-between border-b border-border py-2 text-sm">
              <div>
                <div className="font-medium">{li.suggested_repair}</div>
                <div className="text-xs text-muted-foreground">
                  {li.location} · {li.severity}
                  {li.source === "agent" && <span className="ml-1 text-warning-foreground">(agent edit)</span>}
                </div>
              </div>
              <div className="text-right">
                <div>{formatCurrency(Number(li.part_cost) + Number(li.labour_cost))}</div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (optional for approve, recommended for changes/reject)…"
          />
          <div className="flex gap-2">
            <Button onClick={() => act("approve")}>Approve</Button>
            <Button variant="outline" onClick={() => act("changes")}>
              Request changes
            </Button>
            <Button variant="destructive" onClick={() => act("reject")}>
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
