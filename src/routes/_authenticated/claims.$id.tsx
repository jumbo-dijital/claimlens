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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { Sparkles, Send, Trash2, Pencil, RefreshCw, Save, Loader2 } from "lucide-react";
import { analyzeClaim } from "@/lib/ai/analyze-claim.functions";
import {
  editLineItem,
  submitForApproval,
  updateClaim,
  deleteClaim,
  replaceClaimImages,
} from "@/lib/claim-actions.functions";
import { streamImage } from "@/lib/stream-image";
import { buildDamagePrompt, ANGLES } from "@/lib/claim-image-prompt";

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

type ImageModel =
  | "google/gemini-3.1-flash-image-preview"
  | "google/gemini-2.5-flash-image"
  | "google/gemini-3-pro-image-preview";

function ClaimDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data: me } = useMe();
  const analyze = useServerFn(analyzeClaim);
  const submit = useServerFn(submitForApproval);
  const edit = useServerFn(editLineItem);
  const update = useServerFn(updateClaim);
  const del = useServerFn(deleteClaim);
  const replaceImages = useServerFn(replaceClaimImages);
  const [analyzing, setAnalyzing] = useState(false);
  const [editing, setEditing] = useState<LineItem | null>(null);

  const { data: claim, refetch: refetchClaim } = useQuery({
    queryKey: ["claim", id],
    queryFn: async () => {
      const { data } = await supabase.from("claims").select("*").eq("id", id).single();
      return data;
    },
  });
  const { data: images = [], refetch: refetchImages } = useQuery({
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

  const isSuperadmin = me?.roles.includes("superadmin") ?? false;
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
          {(me?.roles.includes("adjuster") || isSuperadmin) &&
            (claim.status === "submitted" || claim.status === "changes_requested") && (
              <Button asChild variant="secondary">
                <Link to="/claims/$id/review" params={{ id }}>Review</Link>
              </Button>
            )}
          {assessment && claim.status !== "submitted" && claim.status !== "approved" && (
            <Button onClick={onSubmit}>
              <Send className="mr-2 h-4 w-4" />
              Submit for approval
            </Button>
          )}
        </div>
      </div>

      {isSuperadmin && (
        <ClaimEditCard
          claim={claim}
          onSave={async (patch) => {
            await update({ data: { claimId: id, patch } });
            await refetchClaim();
            toast.success("Claim updated");
          }}
          onDelete={async () => {
            await del({ data: { claimId: id } });
            toast.success("Claim deleted");
            router.navigate({ to: "/" });
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Damage photos ({images.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isSuperadmin ? (
              <ImagePanel
                claim={claim}
                images={images}
                onReplace={async (imgs) => {
                  await replaceImages({ data: { claimId: id, images: imgs } });
                  await refetchImages();
                }}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="overflow-hidden rounded-md border border-border">
                    <img src={img.url} alt={img.angle} className="aspect-square w-full object-cover" />
                    <div className="px-2 py-1 text-xs capitalize text-muted-foreground">{img.angle}</div>
                  </div>
                ))}
                {images.length === 0 && (
                  <p className="col-span-2 text-sm text-muted-foreground">No images attached.</p>
                )}
              </div>
            )}
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
              <Button variant="outline" onClick={runAnalysis} disabled={analyzing || images.length === 0}>
                <Sparkles className="mr-2 h-4 w-4" />
                {analyzing ? "Analyzing…" : "Run AI analysis"}
              </Button>
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

interface ClaimRow {
  id: string;
  policyholder_name: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_class: string | null;
  incident_description: string | null;
  paint_color: string | null;
  scene: string | null;
  impact_area: string | null;
  damage_severity: string | null;
  image_model: string | null;
  image_angle_count: number | null;
}

function ClaimEditCard({
  claim,
  onSave,
  onDelete,
}: {
  claim: ClaimRow;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    policyholder_name: claim.policyholder_name ?? "",
    vehicle_make: claim.vehicle_make ?? "",
    vehicle_model: claim.vehicle_model ?? "",
    vehicle_year: claim.vehicle_year ?? 2020,
    vehicle_class: (claim.vehicle_class as "standard" | "premium") ?? "standard",
    incident_description: claim.incident_description ?? "",
    paint_color: claim.paint_color ?? "",
    scene: claim.scene ?? "",
    impact_area: claim.impact_area ?? "",
    damage_severity: (claim.damage_severity as "minor" | "moderate" | "severe") ?? "moderate",
    image_model: (claim.image_model as ImageModel) ?? "google/gemini-3.1-flash-image-preview",
    image_angle_count: claim.image_angle_count ?? 4,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Claim details (editable)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Policyholder name</Label>
            <Input value={form.policyholder_name} onChange={(e) => set("policyholder_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Make</Label>
              <Input value={form.vehicle_make} onChange={(e) => set("vehicle_make", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Input value={form.vehicle_model} onChange={(e) => set("vehicle_model", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={form.vehicle_year}
                onChange={(e) => set("vehicle_year", Number(e.target.value) || form.vehicle_year)}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div>
            <Label className="text-xs">Vehicle class</Label>
            <Select value={form.vehicle_class} onValueChange={(v) => set("vehicle_class", v as "standard" | "premium")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Damage severity</Label>
            <Select value={form.damage_severity} onValueChange={(v) => set("damage_severity", v as "minor" | "moderate" | "severe")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Image model</Label>
            <Select value={form.image_model} onValueChange={(v) => set("image_model", v as ImageModel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google/gemini-3.1-flash-image-preview">Nano Banana 2 (fast)</SelectItem>
                <SelectItem value="google/gemini-2.5-flash-image">Nano Banana</SelectItem>
                <SelectItem value="google/gemini-3-pro-image-preview">Gemini 3 Pro Image (HQ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs"># of angles</Label>
            <Select value={String(form.image_angle_count)} onValueChange={(v) => set("image_angle_count", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <Label className="text-xs">Paint color</Label>
            <Input value={form.paint_color} onChange={(e) => set("paint_color", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Scene / setting</Label>
            <Input value={form.scene} onChange={(e) => set("scene", e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Impact area</Label>
          <Input value={form.impact_area} onChange={(e) => set("impact_area", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Incident description</Label>
          <Textarea
            value={form.incident_description}
            onChange={(e) => set("incident_description", e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(form);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Save failed");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this claim?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the claim and all its images, assessments, line items, and reviews. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Delete failed");
                    setDeleting(false);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

interface ClaimImageRow {
  id: string;
  url: string;
  angle: string;
  prompt: string | null;
}

function ImagePanel({
  claim,
  images,
  onReplace,
}: {
  claim: ClaimRow;
  images: ClaimImageRow[];
  onReplace: (imgs: { url: string; angle: string; prompt: string }[]) => Promise<void>;
}) {
  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<{ angle: string; url: string; final: boolean; prompt: string }[]>([]);
  const [shownPrompt, setShownPrompt] = useState<Record<string, boolean>>({});

  const run = async () => {
    if (!claim.paint_color || !claim.scene || !claim.impact_area) {
      toast.error("Set paint color, scene, and impact area before generating.");
      return;
    }
    setGenerating(true);
    setPreviews([]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const angleCount = claim.image_angle_count ?? 4;
      const angles = ANGLES.slice(0, angleCount);
      const finals: { url: string; angle: string; prompt: string }[] = [];
      for (let i = 0; i < angles.length; i++) {
        const angle = angles[i];
        const prompt = buildDamagePrompt(angle, claim);
        setPreviews((p) => [...p, { angle, url: "", final: false, prompt }]);
        const finalUrl = await streamImage(
          "/api/generate-damage-image",
          { prompt, model: claim.image_model ?? "google/gemini-3.1-flash-image-preview" },
          (dataUrl, isFinal) => {
            setPreviews((p) =>
              p.map((x, idx) => (idx === i ? { ...x, url: dataUrl, final: isFinal } : x)),
            );
          },
          { Authorization: `Bearer ${token}` },
        );
        finals.push({ url: finalUrl, angle, prompt });
      }
      await onReplace(finals);
      setPreviews([]);
      toast.success("Images saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const live = previews.length > 0;
  const list = live
    ? previews.map((p, i) => ({
        key: `live-${i}`,
        url: p.url,
        angle: p.angle,
        prompt: p.prompt,
        loading: !p.url,
        blur: p.url && !p.final,
      }))
    : images.map((img) => ({
        key: img.id,
        url: img.url,
        angle: img.angle,
        prompt: img.prompt ?? "",
        loading: false,
        blur: false,
      }));

  return (
    <div className="space-y-3">
      {list.length === 0 && !generating ? (
        <div className="grid place-items-center py-8">
          <Button
            size="lg"
            onClick={run}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Sparkles className="mr-2 h-5 w-5" /> Generate images
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {list.map((p) => (
              <div key={p.key} className="overflow-hidden rounded-md border border-border">
                {p.loading ? (
                  <div className="grid aspect-square w-full place-items-center bg-muted">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <img
                    src={p.url}
                    alt={p.angle}
                    className={
                      "aspect-square w-full object-cover transition-[filter] duration-300 " +
                      (p.blur ? "blur-md" : "blur-0")
                    }
                  />
                )}
                <div className="flex items-center justify-between px-2 py-1 text-xs capitalize text-muted-foreground">
                  <span>{p.angle}</span>
                  {p.prompt && (
                    <button
                      type="button"
                      className="text-[10px] uppercase tracking-wide underline-offset-2 hover:underline"
                      onClick={() => setShownPrompt((s) => ({ ...s, [p.key]: !s[p.key] }))}
                    >
                      {shownPrompt[p.key] ? "Hide prompt" : "Show prompt"}
                    </button>
                  )}
                </div>
                {shownPrompt[p.key] && p.prompt && (
                  <div className="border-t border-border bg-muted/40 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                    {p.prompt}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!live && (
            <Button variant="outline" onClick={run} disabled={generating}>
              {generating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Regenerating…</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Regenerate</>
              )}
            </Button>
          )}
        </>
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
