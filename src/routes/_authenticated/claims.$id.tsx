import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { type ReactNode, useEffect, useState } from "react";
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
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { Sparkles, Send, Trash2, Pencil, Save, Loader2, Plus, ThumbsUp, ThumbsDown, Upload, Info, Reply, MessageSquare } from "lucide-react";
import { analyzeClaim } from "@/lib/ai/analyze-claim.functions";
import {
  editLineItem,
  submitForApproval,
  updateClaim,
  deleteClaim,
  replaceClaimImages,
  addClaimImages,
  deleteClaimImage,
  updateAssessmentSummary,
  addLineItem,
  setAssessmentFeedback,
  estimateLineItemCost,
  returnToAssessors,
  addClaimComment,
} from "@/lib/claim-actions.functions";
import { ClaimDetailsForm } from "@/components/claim-details-form";
import { ClaimProgressStepper } from "@/components/claim-progress-stepper";
import { generateSyntheticScene } from "@/lib/generate-claim-details.functions";

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
  const addImages = useServerFn(addClaimImages);
  const removeImage = useServerFn(deleteClaimImage);
  const updateSummary = useServerFn(updateAssessmentSummary);
  const addItem = useServerFn(addLineItem);
  const setFeedback = useServerFn(setAssessmentFeedback);
  const returnClaim = useServerFn(returnToAssessors);
  const queryClient = useQueryClient();
  const refreshActivity = () =>
    queryClient.invalidateQueries({ queryKey: ["claim-audit", id] });
  const [analyzing, setAnalyzing] = useState(false);
  const [editing, setEditing] = useState<LineItem | null>(null);
  const [adding, setAdding] = useState(false);

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
      refreshActivity();
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
    refreshActivity();
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
            claim.status === "submitted" && (
              <>
                <Button asChild variant="secondary">
                  <Link to="/claims/$id/review" params={{ id }}>Review</Link>
                </Button>
                <ReturnToAssessorsButton
                  onConfirm={async (comment) => {
                    await returnClaim({ data: { claimId: id, comment } });
                    toast.success("Returned to assessors");
                    await refetchClaim();
                    refreshActivity();
                  }}
                />
              </>
            )}
          {assessment && claim.status !== "submitted" && claim.status !== "approved" && claim.status !== "rejected" && (
            <Button onClick={onSubmit}>
              <Send className="mr-2 h-4 w-4" />
              Submit for approval
            </Button>
          )}
          {isSuperadmin && (
            <DeleteClaimButton
              onDelete={async () => {
                await del({ data: { claimId: id } });
                toast.success("Claim deleted");
                router.navigate({ to: "/" });
              }}
            />
          )}
        </div>
      </div>

      <ClaimProgressStepper status={claim.status} />

      <ClaimDetailsForm
        initial={{
          policyholder_name: claim.policyholder_name ?? "",
          policy_number: claim.policy_number ?? "",
          vehicle_make: claim.vehicle_make ?? "",
          vehicle_model: claim.vehicle_model ?? "",
          vehicle_year: claim.vehicle_year ?? "",
          vehicle_class: (claim.vehicle_class as "standard" | "premium" | "") ?? "",
          damage_severity: (claim.damage_severity as "minor" | "moderate" | "severe" | "") ?? "",
          paint_color: claim.paint_color ?? "",
          impact_area: claim.impact_area ?? "",
          incident_description: claim.incident_description ?? "",
        }}
        onSave={async (patch) => {
          await update({ data: { claimId: id, patch } });
          await refetchClaim();
          refreshActivity();
          toast.success("Claim updated");
        }}
      />



      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Damage photos ({images.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ImagePanel
              claim={claim}
              images={images}
              isSuperadmin={isSuperadmin}
              onReplace={async (imgs) => {
                await replaceImages({ data: { claimId: id, images: imgs } });
                await refetchImages();
                refreshActivity();
              }}
              onUpload={async (imgs) => {
                await addImages({ data: { claimId: id, images: imgs } });
                await refetchImages();
                refreshActivity();
              }}
              onDelete={async (claimImageId) => {
                await removeImage({ data: { claimImageId } });
                await refetchImages();
                refreshActivity();
              }}
              onUpdateClaim={async (patch) => {
                await update({ data: { claimId: id, patch } });
                await refetchClaim();
                refreshActivity();
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Claim assessment</CardTitle>
              <div className="flex items-center gap-2">
                {assessment?.overall_confidence != null && (
                  <span className="text-xs text-muted-foreground">
                    Initial AI assessment confidence {(Number(assessment.overall_confidence) * 100).toFixed(0)}%
                  </span>
                )}
                {assessment && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant={(assessment as { feedback?: string | null }).feedback === "up" ? "default" : "ghost"}
                      className="h-7 w-7"
                      aria-label="Thumbs up on initial AI assessment"
                      onClick={async () => {
                        const current = (assessment as { feedback?: string | null }).feedback ?? null;
                        const next = current === "up" ? null : "up";
                        await setFeedback({ data: { assessmentId: assessment.id, feedback: next } });
                        await refetchAssessment();
                        refreshActivity();
                      }}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant={(assessment as { feedback?: string | null }).feedback === "down" ? "default" : "ghost"}
                      className="h-7 w-7"
                      aria-label="Thumbs down on initial AI assessment"
                      onClick={async () => {
                        const current = (assessment as { feedback?: string | null }).feedback ?? null;
                        const next = current === "down" ? null : "down";
                        await setFeedback({ data: { assessmentId: assessment.id, feedback: next } });
                        await refetchAssessment();
                        refreshActivity();
                      }}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {assessment && (
              <SummaryEditor
                key={assessment.id}
                initial={assessment.summary ?? ""}
                onSave={async (summary) => {
                  await updateSummary({ data: { assessmentId: assessment.id, summary } });
                  await refetchAssessment();
                  refreshActivity();
                  toast.success("Summary updated");
                }}
              />
            )}
          </CardHeader>
          <CardContent>
            {!assessment ? (
              <div className="space-y-3">
                {images.length === 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 shrink-0" />
                    Add damage photos before starting the assessment
                  </div>
                )}
                <Button onClick={runAnalysis} disabled={analyzing || images.length === 0}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {analyzing ? "Analyzing…" : "Run AI analysis"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {lineItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No findings yet.</p>
                )}
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
                          refreshActivity();
                          toast.success("Line item removed");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Add line item
                  </Button>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Estimated total</div>
                    <div className="text-lg font-semibold">{formatCurrency(total)}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {assessment && claim.status !== "submitted" && claim.status !== "approved" && claim.status !== "rejected" && (
          <Button onClick={onSubmit}>
            <Send className="mr-2 h-4 w-4" />
            Submit for approval
          </Button>
        )}
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
            refreshActivity();
            toast.success("Line item updated");
          }}
        />
      )}
      {adding && assessment && (
        <AddLineItemDialog
          claimId={id}
          onClose={() => setAdding(false)}
          onSave={async (fields, rationale) => {
            await addItem({ data: { assessmentId: assessment.id, fields, rationale } });
            setAdding(false);
            refetchItems();
            refreshActivity();
            toast.success("Line item added");
          }}
        />
      )}

      <AuditTimeline claimId={id} />
    </div>
  );
}

interface ClaimRow {
  id: string;
  policyholder_name: string;
  policy_number: string | null;
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


interface ClaimImageRow {
  id: string;
  url: string;
  angle: string;
  prompt: string | null;
  ai_generated: boolean;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Could not read file"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

function ImagePanel({
  claim,
  images,
  isSuperadmin,
  onReplace,
  onUpload,
  onDelete,
  onUpdateClaim,
}: {
  claim: ClaimRow;
  images: ClaimImageRow[];
  isSuperadmin: boolean;
  onReplace: (imgs: { url: string; angle: string; prompt: string }[]) => Promise<void>;
  onUpload: (imgs: { url: string; angle: string }[]) => Promise<void>;
  onDelete: (claimImageId: string) => Promise<void>;
  onUpdateClaim: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [previews, setPreviews] = useState<{ angle: string; url: string; final: boolean; prompt: string }[]>([]);
  const [shownPrompt, setShownPrompt] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<{ url: string; angle: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; angle: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const angleCount = claim.image_angle_count ?? 4;
  const hasUploaded = images.some((i) => i.ai_generated === false);
  const canGenerate = isSuperadmin && !hasUploaded;

  const run = async () => {
    if (!claim.paint_color || !claim.scene || !claim.impact_area) {
      toast.error("Set paint color, scene, and impact area before generating.");
      return;
    }
    setGenerating(true);
    const angles = ANGLES.slice(0, angleCount);
    // Seed all placeholder tiles up-front so the user sees n loading boxes immediately.
    setPreviews(
      angles.map((angle) => ({ angle, url: "", final: false, prompt: buildDamagePrompt(angle, claim) })),
    );
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const finals = await Promise.all(
        angles.map(async (angle, i) => {
          const prompt = buildDamagePrompt(angle, claim);
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
          return { url: finalUrl, angle, prompt };
        }),
      );
      await onReplace(finals);
      setPreviews([]);
      toast.success("Images saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image generation failed");
      setPreviews([]);
    } finally {
      setGenerating(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).slice(0, 12);
    setUploading(true);
    try {
      const payload: { url: string; angle: string }[] = [];
      for (const f of selected) {
        if (!f.type.startsWith("image/")) {
          toast.error(`Skipped ${f.name}: not an image`);
          continue;
        }
        if (f.size > MAX_UPLOAD_BYTES) {
          toast.error(`Skipped ${f.name}: over 10 MB`);
          continue;
        }
        const url = await readFileAsDataUrl(f);
        const baseName = f.name.replace(/\.[^.]+$/, "").slice(0, 50) || "uploaded";
        payload.push({ url, angle: baseName });
      }
      if (payload.length === 0) return;
      await onUpload(payload);
      toast.success(`Uploaded ${payload.length} photo${payload.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const live = previews.length > 0;
  const list = live
    ? previews.map((p, i) => ({
        key: `live-${i}`,
        imageId: null as string | null,
        url: p.url,
        angle: p.angle,
        prompt: p.prompt,
        loading: !p.url,
        blur: p.url && !p.final,
      }))
    : images.map((img) => ({
        key: img.id,
        imageId: img.id,
        url: img.url,
        angle: img.angle,
        prompt: img.prompt ?? "",
        loading: false,
        blur: false,
      }));

  const uploadInputId = `upload-${claim.id}`;

  const uploadButton = (
    <>
      <input
        id={uploadInputId}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        asChild
        disabled={uploading || generating}
      >
        <label htmlFor={uploadInputId} className="cursor-pointer">
          {uploading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Upload photos</>
          )}
        </label>
      </Button>
    </>
  );

  return (
    <div className="space-y-3">
      {list.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {list.map((p) => (
            <div key={p.key} className="overflow-hidden rounded-md border border-border">
              {p.loading ? (
                <div className="grid aspect-square w-full place-items-center bg-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="relative">
                  {p.imageId ? (
                    <button
                      type="button"
                      onClick={() => setLightbox({ url: p.url, angle: p.angle })}
                      className="block w-full cursor-zoom-in"
                      aria-label={`View ${p.angle} full size`}
                    >
                      <img
                        src={p.url}
                        alt={p.angle}
                        className="aspect-square w-full object-cover"
                      />
                    </button>
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
                  {p.imageId && (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-2 h-7 w-7 bg-background/80 backdrop-blur hover:bg-background"
                      aria-label={`Delete ${p.angle}`}
                      disabled={deletingId === p.imageId}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete({ id: p.imageId!, angle: p.angle });
                      }}
                    >
                      {deletingId === p.imageId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
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
      )}
      {!live && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {uploadButton}
          {canGenerate && images.length === 0 && (
            <Button
              variant="outline"
              onClick={() => setGenDialogOpen(true)}
              disabled={generating}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Demo: Generate photos
            </Button>
          )}
          {canGenerate && images.length > 0 && (
            <Button variant="outline" onClick={() => setGenDialogOpen(true)} disabled={generating}>
              {generating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Regenerating…</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Demo: Regenerate</>
              )}
            </Button>
          )}
        </div>
      )}
      {canGenerate && (
        <GenerateImagesDialog
          open={genDialogOpen}
          onOpenChange={setGenDialogOpen}
          claim={claim}
          onUpdateClaim={onUpdateClaim}
          onGenerate={() => {
            setGenDialogOpen(false);
            void run();
          }}
        />
      )}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="capitalize">{lightbox?.angle ?? "Photo"}</DialogTitle>
          </DialogHeader>
          {lightbox && (
            <img
              src={lightbox.url}
              alt={lightbox.angle}
              className="mx-auto max-h-[80vh] w-auto object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the {confirmDelete?.angle} photo from this claim. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                const target = confirmDelete;
                setDeletingId(target.id);
                setConfirmDelete(null);
                try {
                  await onDelete(target.id);
                  toast.success("Photo deleted");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Delete failed");
                } finally {
                  setDeletingId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GenerateImagesDialog({
  open,
  onOpenChange,
  claim,
  onUpdateClaim,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  claim: ClaimRow;
  onUpdateClaim: (patch: Record<string, unknown>) => Promise<void>;
  onGenerate: () => void;
}) {
  const imageModel = (claim.image_model as ImageModel) ?? "google/gemini-3.1-flash-image-preview";
  const angleCount = claim.image_angle_count ?? 4;
  const genScene = useServerFn(generateSyntheticScene);
  const [sceneLoading, setSceneLoading] = useState(false);
  const hasScene = !!claim.scene && claim.scene.trim().length > 0;

  // Auto-prefill the scene with an AI suggestion the first time the dialog opens
  // for a claim that has no scene yet.
  useEffect(() => {
    if (!open || hasScene || sceneLoading) return;
    let cancelled = false;
    setSceneLoading(true);
    (async () => {
      try {
        const { scene } = await genScene({
          data: {
            vehicle_year: claim.vehicle_year,
            vehicle_make: claim.vehicle_make,
            vehicle_model: claim.vehicle_model,
            impact_area: claim.impact_area ?? undefined,
            damage_severity:
              (claim.damage_severity as "minor" | "moderate" | "severe" | null) ?? undefined,
          },
        });
        if (!cancelled && scene) {
          await onUpdateClaim({ scene });
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not suggest a scene");
        }
      } finally {
        if (!cancelled) setSceneLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate damage images</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Scene / setting</Label>
              {sceneLoading && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Suggesting…
                </span>
              )}
            </div>
            <Textarea
              value={claim.scene ?? ""}
              onChange={(e) => onUpdateClaim({ scene: e.target.value })}
              placeholder={sceneLoading ? "Generating a suggestion…" : "e.g. suburban driveway, sunny afternoon"}
              rows={3}
              disabled={sceneLoading}
            />
          </div>
          <div>
            <Label className="text-xs">Image model</Label>
            <Select value={imageModel} onValueChange={(v) => onUpdateClaim({ image_model: v })}>
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
            <Select
              value={String(angleCount)}
              onValueChange={(v) => onUpdateClaim({ image_angle_count: Number(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onGenerate}>
            <Sparkles className="mr-2 h-4 w-4" /> Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function SummaryEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (summary: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initial;
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="Assessment summary…"
        className="text-sm"
      />
      {dirty && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setValue(initial)} disabled={saving}>
            Reset
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(value);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Save failed");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Save summary
          </Button>
        </div>
      )}
    </div>
  );
}

interface NewLineItemFields {
  damage_type: string;
  location: string;
  severity: "minor" | "moderate" | "severe";
  suggested_repair: string;
  part_cost: number;
  labour_hours: number;
  labour_cost: number;
}

function AddLineItemDialog({
  claimId,
  onClose,
  onSave,
}: {
  claimId: string;
  onClose: () => void;
  onSave: (fields: NewLineItemFields, rationale: string) => void;
}) {
  const [repair, setRepair] = useState("");
  const [damageType, setDamageType] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState<"minor" | "moderate" | "severe">("moderate");
  const [estimate, setEstimate] = useState<{ part_cost: number; labour_hours: number } | null>(null);
  const [partCost, setPartCost] = useState("0");
  const [hours, setHours] = useState("0");
  const [rationale, setRationale] = useState("");
  const [estimating, setEstimating] = useState(false);
  const estimateFn = useServerFn(estimateLineItemCost);

  const canEstimate =
    repair.trim().length > 0 &&
    damageType.trim().length > 0 &&
    location.trim().length > 0 &&
    !estimating;

  const valid =
    repair.trim().length > 0 &&
    damageType.trim().length > 0 &&
    location.trim().length > 0 &&
    rationale.trim().length >= 3 &&
    estimate !== null;

  const lookUpEstimate = async () => {
    setEstimating(true);
    try {
      const result = await estimateFn({
        data: {
          claimId,
          suggested_repair: repair.trim(),
          damage_type: damageType.trim(),
          location: location.trim(),
          severity,
        },
      });
      setEstimate({ part_cost: result.part_cost, labour_hours: result.labour_hours });
      setPartCost(String(result.part_cost));
      setHours(String(result.labour_hours));
      if (result.rationale) toast.success(`AI estimate: ${result.rationale}`);
      else toast.success("AI estimate ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Estimate failed");
    } finally {
      setEstimating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add line item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Repair description</Label>
            <Input value={repair} onChange={(e) => setRepair(e.target.value)} placeholder="e.g. Replace front bumper" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Damage type</Label>
              <Input value={damageType} onChange={(e) => setDamageType(e.target.value)} placeholder="dent, scratch, crack…" />
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="front bumper" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as "minor" | "moderate" | "severe")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rationale (required)</Label>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why are you adding this line item?"
            />
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={lookUpEstimate}
              disabled={!canEstimate}
            >
              {estimating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Looking up…</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> {estimate ? "Re-run estimate" : "Look up estimate"}</>
              )}
            </Button>
          </div>
          {estimate && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Part cost ($ USD)</Label>
                <Input value={partCost} onChange={(e) => setPartCost(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Labour hours</Label>
                <Input value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => {
              const hoursNum = parseFloat(hours) || 0;
              const partNum = parseFloat(partCost) || 0;
              onSave(
                {
                  damage_type: damageType.trim(),
                  location: location.trim(),
                  severity,
                  suggested_repair: repair.trim(),
                  part_cost: partNum,
                  labour_hours: hoursNum,
                  labour_cost: hoursNum * 95,
                },
                rationale,
              );
            }}
          >
            Add line item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Audit timeline ----------

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  actor_role: string | null;
  actor_user_id: string | null;
  details: unknown;
  profiles?: { display_name?: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  claim_created: "Claim created",
  claim_created_synthetic: "Claim created",
  claim_updated: "Claim details edited",
  claim_deleted: "Claim deleted",
  claim_images_replaced: "Damage photos replaced",
  claim_images_uploaded: "Damage photos uploaded",
  claim_image_deleted: "Damage photo deleted",
  line_item_added: "Line item added",
  line_item_edited: "Line item edited",
  line_item_removed: "Line item removed",
  assessment_summary_edited: "Assessment summary edited",
  submitted_for_approval: "Submitted for approval",
  review_approve: "Review: approved",
  review_reject: "Review: rejected",
  returned_to_assessors: "Returned to assessors",
  ai_analysis_completed: "AI analysis completed",
  comment: "Comment",
};

const FIELD_LABELS: Record<string, string> = {
  policyholder_name: "Policyholder",
  policy_number: "Policy number",
  vehicle_make: "Vehicle make",
  vehicle_model: "Vehicle model",
  vehicle_year: "Vehicle year",
  vehicle_class: "Vehicle class",
  incident_description: "Incident description",
  paint_color: "Paint color",
  scene: "Scene",
  impact_area: "Impact area",
  damage_severity: "Damage severity",
  image_model: "Image model",
  image_angle_count: "Image angle count",
  suggested_repair: "Suggested repair",
  part_cost: "Part cost",
  labour_hours: "Labour hours",
  labour_cost: "Labour cost",
  severity: "Severity",
  summary: "Summary",
  images: "Images",
};

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field.endsWith("_cost") && typeof value === "number") return formatCurrency(value);
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  return JSON.stringify(value);
}

function FieldDiff({
  field,
  from,
  to,
}: {
  field: string;
  from: unknown;
  to: unknown;
}) {
  const label = FIELD_LABELS[field] ?? field;
  const fromStr = formatValue(field, from);
  const toStr = formatValue(field, to);
  const isLong = fromStr.length > 80 || toStr.length > 80;
  const [expanded, setExpanded] = useState(false);

  if (field === "images" && Array.isArray(from) && Array.isArray(to)) {
    const fromAngles = (from as Array<{ angle: string }>).map((i) => i.angle);
    const toAngles = (to as Array<{ angle: string }>).map((i) => i.angle);
    const added = toAngles.filter((a) => !fromAngles.includes(a));
    const removed = fromAngles.filter((a) => !toAngles.includes(a));
    return (
      <div className="text-xs">
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-muted-foreground">{from.length}</span>
        <span className="mx-1">→</span>
        <span>{to.length}</span>
        {(added.length > 0 || removed.length > 0) && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {added.length > 0 && <span>+ {added.join(", ")} </span>}
            {removed.length > 0 && <span>− {removed.join(", ")}</span>}
          </div>
        )}
      </div>
    );
  }

  const truncate = (s: string) => (s.length > 80 ? s.slice(0, 80) + "…" : s);

  return (
    <div className="text-xs">
      <span className="font-medium">{label}:</span>{" "}
      <span className="text-muted-foreground line-through">
        {expanded || !isLong ? fromStr : truncate(fromStr)}
      </span>
      <span className="mx-1">→</span>
      <span>{expanded || !isLong ? toStr : truncate(toStr)}</span>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-2 text-[11px] text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show full"}
        </button>
      )}
    </div>
  );
}

function AuditRowItem({ row }: { row: AuditRow }) {
  const [showJson, setShowJson] = useState(false);
  const details = (row.details ?? {}) as Record<string, unknown>;
  const changes = details.changes as
    | Record<string, { from: unknown; to: unknown }>
    | undefined;
  const rationale = typeof details.rationale === "string" ? details.rationale : null;
  const comment = typeof details.comment === "string" ? details.comment : null;
  const commentText =
    row.action === "comment" && typeof details.text === "string" ? details.text : null;
  const label = ACTION_LABELS[row.action] ?? row.action;

  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3 text-sm">
      <div className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</div>
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            {row.profiles?.display_name ?? "—"}
            {row.actor_role ? ` (${row.actor_role})` : ""}
          </span>
        </div>
        {commentText && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
            {commentText}
          </div>
        )}
        {changes && Object.keys(changes).length > 0 && (
          <div className="space-y-0.5">
            {Object.entries(changes).map(([field, diff]) => (
              <FieldDiff key={field} field={field} from={diff.from} to={diff.to} />
            ))}
          </div>
        )}
        {rationale && (
          <div className="text-xs italic text-muted-foreground">"{rationale}"</div>
        )}
        {comment && !commentText && (
          <div className="text-xs italic text-muted-foreground">"{comment}"</div>
        )}
        {row.details && row.action !== "comment" ? (
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            {showJson ? "Hide raw details" : "Show raw details"}
          </button>
        ) : null}
        {showJson && (
          <pre className="mt-1 overflow-x-auto rounded bg-muted/60 p-2 text-[11px]">
            {JSON.stringify(row.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function AuditTimeline({ claimId }: { claimId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["claim-audit", claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, created_at, action, actor_role, actor_user_id, details")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);

      const auditRows = (data ?? []) as AuditRow[];
      const actorIds = Array.from(
        new Set(auditRows.map((row) => row.actor_user_id).filter(Boolean) as string[]),
      );

      if (actorIds.length === 0) return auditRows;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", actorIds);
      const profileById = new Map(
        (profiles ?? []).map((profile) => [profile.id, { display_name: profile.display_name ?? undefined }]),
      );

      return auditRows.map((row) => ({
        ...row,
        profiles: row.actor_user_id ? (profileById.get(row.actor_user_id) ?? null) : null,
      }));
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Activity history</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <CommentComposer claimId={claimId} />
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <AuditRowItem key={r.id} row={r} />
          ))}
          {rows.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No activity yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CommentComposer({ claimId }: { claimId: string }) {
  const addComment = useServerFn(addClaimComment);
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      await addComment({ data: { claimId, text: trimmed } });
      setText("");
      queryClient.invalidateQueries({ queryKey: ["claim-audit", claimId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post comment");
    } finally {
      setPosting(false);
    }
  };
  return (
    <div className="border-b border-border px-5 py-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment…"
        rows={2}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={submit} disabled={posting || text.trim().length === 0}>
          <MessageSquare className="mr-2 h-4 w-4" />
          {posting ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </div>
  );
}

function ReturnToAssessorsButton({
  onConfirm,
}: {
  onConfirm: (comment: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Reply className="mr-2 h-4 w-4" />
        Return to assessors
      </Button>
      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return to assessors</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Comment (optional)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What needs another look?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onConfirm(comment);
                  setOpen(false);
                  setComment("");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not return claim");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
            >
              {submitting ? "Returning…" : "Return claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteClaimButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} disabled={deleting}>
        <Trash2 className="mr-2 h-4 w-4" /> Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
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
    </>
  );
}
