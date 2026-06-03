import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { Sparkles, Send, Trash2, Pencil, RefreshCw } from "lucide-react";
import { analyzeClaim } from "@/lib/ai/analyze-claim.functions";
import { editLineItem, submitForApproval } from "@/lib/claim-actions.functions";

export const Route = createFileRoute("/_authenticated/claims/$id")({
  head: () => ({ meta: [{ title: "Claim — ClaimLens" }] }),
  component: ClaimDetail,
});

interface LineItem {
  id: string;
  damage_type: string;
  location: string;
  severity: string;
  suggested_repair: string;
  part_cost: number;
  labour_hours: number;
  labour_cost: number;
  confidence: number | null;
  source: string;
  rationale: string | null;
  is_deleted: boolean;
}

function ClaimDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data: me } = useMe();
  const analyze = useServerFn(analyzeClaim);
  const submit = useServerFn(submitForApproval);
  const edit = useServerFn(editLineItem);
  const [analyzing, setAnalyzing] = useState(false);
  const [editing, setEditing] = useState<LineItem | null>(null);

  const { data: claim, refetch: refetchClaim } = useQuery({
    queryKey: ["claim", id],
    queryFn: async () => {
      const { data } = await supabase.from("claims").select("*").eq("id", id).single();
      return data;
    },
  });
  const { data: images = [] } = useQuery({
    queryKey: ["claim-images", id],
    queryFn: async () => {
      const { data } = await supabase.from("claim_images").select("*").eq("claim_id", id);
      return data ?? [];
    },
  });
  const { data: assessment, refetch: refetchAssessment } = useQuery({
    queryKey: ["claim-assessment", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_assessments")
        .select("*")
        .eq("claim_id", id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const { data: lineItems = [], refetch: refetchItems } = useQuery({
    queryKey: ["line-items", assessment?.id],
    queryFn: async () => {
      if (!assessment?.id) return [];
      const { data } = await supabase
        .from("assessment_line_items")
        .select("*")
        .eq("assessment_id", assessment.id)
        .eq("is_deleted", false);
      return (data ?? []) as LineItem[];
    },
    enabled: !!assessment?.id,
  });

  if (!claim) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const total = lineItems.reduce((s, i) => s + Number(i.part_cost) + Number(i.labour_cost), 0);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await analyze({ data: { claimId: id } });
      toast.success("AI analysis complete");
      await Promise.all([refetchClaim(), refetchAssessment(), refetchItems()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const onSubmit = async () => {
    await submit({ data: { claimId: id } });
    toast.success("Submitted for senior adjuster approval");
    router.invalidate();
    refetchClaim();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{claim.claim_number}</h1>
            <StatusBadge status={claim.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {claim.policyholder_name} · {claim.vehicle_year} {claim.vehicle_make} {claim.vehicle_model} · Incident {formatDate(claim.incident_date)}
          </p>
        </div>
        <div className="flex gap-2">
          {(me?.roles.includes("adjuster") || me?.roles.includes("superadmin")) &&
            (claim.status === "submitted" || claim.status === "changes_requested") && (
              <Button asChild variant="secondary">
                <Link to="/claims/$id/review" params={{ id }}>Review</Link>
              </Button>
            )}
          <Button variant="outline" onClick={runAnalysis} disabled={analyzing || images.length === 0}>
            {assessment ? <RefreshCw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {analyzing ? "Analyzing…" : assessment ? "Re-run AI analysis" : "Run AI analysis"}
          </Button>
          {assessment && claim.status !== "submitted" && claim.status !== "approved" && (
            <Button onClick={onSubmit}>
              <Send className="mr-2 h-4 w-4" />
              Submit for approval
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Damage photos ({images.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {images.map((img) => (
                <div key={img.id} className="overflow-hidden rounded-md border border-border">
                  <img src={img.url} alt={img.angle} className="aspect-square w-full object-cover" />
                  <div className="px-2 py-1 text-xs text-muted-foreground capitalize">{img.angle}</div>
                </div>
              ))}
              {images.length === 0 && (
                <p className="col-span-2 text-sm text-muted-foreground">No images attached.</p>
              )}
            </div>
            {claim.incident_description && (
              <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Policyholder note</div>
                <div className="mt-1">{claim.incident_description}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">AI assessment</CardTitle>
              {assessment?.overall_confidence != null && (
                <span className="text-xs text-muted-foreground">
                  Overall confidence {(Number(assessment.overall_confidence) * 100).toFixed(0)}%
                </span>
              )}
            </div>
            {assessment?.summary && (
              <p className="text-sm text-muted-foreground">{assessment.summary}</p>
            )}
          </CardHeader>
          <CardContent>
            {!assessment ? (
              <p className="text-sm text-muted-foreground">
                No assessment yet. Click "Run AI analysis" to process the photos.
              </p>
            ) : lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No findings.</p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((li) => (
                  <div
                    key={li.id}
                    className="grid grid-cols-[1fr_auto_auto] items-start gap-3 rounded-md border border-border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{li.suggested_repair}</span>
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                          {li.damage_type}
                        </span>
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                          {li.severity}
                        </span>
                        {li.source === "agent" && (
                          <span className="rounded-sm bg-warning/20 px-1.5 py-0.5 text-[10px] uppercase text-warning-foreground">
                            edited
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{li.location}</div>
                      {li.rationale && (
                        <div className="mt-1 text-xs italic text-muted-foreground">"{li.rationale}"</div>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <div>{formatCurrency(Number(li.part_cost) + Number(li.labour_cost))}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(Number(li.part_cost))} parts · {li.labour_hours}h
                      </div>
                      {li.confidence != null && (
                        <div className="text-xs text-muted-foreground">
                          {(Number(li.confidence) * 100).toFixed(0)}% conf.
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(li)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          const rationale = window.prompt("Why is this line item being removed?");
                          if (!rationale || rationale.trim().length < 3) return;
                          await edit({
                            data: {
                              lineItemId: li.id,
                              patch: { is_deleted: true },
                              rationale,
                            },
                          });
                          refetchItems();
                          toast.success("Line item removed");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm font-medium">Estimated total</span>
                  <span className="text-lg font-semibold">{formatCurrency(total)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {editing && (
        <EditDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch, rationale) => {
            await edit({
              data: { lineItemId: editing.id, patch, rationale },
            });
            setEditing(null);
            refetchItems();
            toast.success("Line item updated");
          }}
        />
      )}
    </div>
  );
}

function EditDialog({
  item,
  onClose,
  onSave,
}: {
  item: LineItem;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>, rationale: string) => void;
}) {
  const [repair, setRepair] = useState(item.suggested_repair);
  const [partCost, setPartCost] = useState(String(item.part_cost));
  const [hours, setHours] = useState(String(item.labour_hours));
  const [rationale, setRationale] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit line item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Repair</label>
            <Input value={repair} onChange={(e) => setRepair(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Part cost</label>
              <Input value={partCost} onChange={(e) => setPartCost(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Labour hours</label>
              <Input value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Rationale (required)</label>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why are you overriding the AI suggestion?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={rationale.trim().length < 3}
            onClick={() => {
              const hoursNum = parseFloat(hours) || 0;
              onSave(
                {
                  suggested_repair: repair,
                  part_cost: parseFloat(partCost) || 0,
                  labour_hours: hoursNum,
                  labour_cost: hoursNum * 95,
                },
                rationale,
              );
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
