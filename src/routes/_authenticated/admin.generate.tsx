import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, RefreshCw, ArrowRight, Eraser } from "lucide-react";
import { createSyntheticClaim } from "@/lib/claim-actions.functions";
import { generateSyntheticClaimDetails } from "@/lib/generate-claim-details.functions";
import { claimDraftStore, useClaimDraft, type ClaimDraft } from "@/lib/use-claim-draft";

export const Route = createFileRoute("/_authenticated/admin/generate")({
  component: GeneratePage,
});

function GeneratePage() {
  const router = useRouter();
  const generateDetails = useServerFn(generateSyntheticClaimDetails);
  const createClaim = useServerFn(createSyntheticClaim);
  const draft = useClaimDraft();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const d = await generateDetails();
      claimDraftStore.set({
        ...d,
        image_model: "google/gemini-3.1-flash-image-preview",
        image_angle_count: 4,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await createClaim({
        data: {
          policyholder_name: draft.policyholder_name,
          vehicle_make: draft.vehicle_make,
          vehicle_model: draft.vehicle_model,
          vehicle_year: draft.vehicle_year,
          vehicle_class: draft.vehicle_class,
          incident_description: draft.incident_description,
          paint_color: draft.paint_color,
          scene: draft.scene,
          impact_area: draft.impact_area,
          damage_severity: draft.damage_severity,
          image_model: draft.image_model as ClaimDraft["image_model"],
          image_angle_count: draft.image_angle_count,
          images: [],
        },
      });
      claimDraftStore.set(null);
      toast.success("Claim saved");
      router.navigate({ to: "/claims/$id", params: { id: res.claimId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Synthesize a fully-fabricated demo claim with AI. You'll review and tweak
              the details before saving.
            </p>
            <Button
              size="lg"
              onClick={runGenerate}
              disabled={generating}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {generating ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="mr-2 h-5 w-5" /> Generate claim details</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const patch = (p: Partial<ClaimDraft>) => claimDraftStore.patch(p);

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Synthetic claim (unsaved)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Review and edit before saving. Nothing is written to the database until you
            click "Save and proceed to images".
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Policyholder name</Label>
            <Input
              value={draft.policyholder_name}
              onChange={(e) => patch({ policyholder_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Make</Label>
              <Input value={draft.vehicle_make} onChange={(e) => patch({ vehicle_make: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Input value={draft.vehicle_model} onChange={(e) => patch({ vehicle_model: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={draft.vehicle_year}
                onChange={(e) => patch({ vehicle_year: Number(e.target.value) || draft.vehicle_year })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Vehicle class</Label>
              <Select
                value={draft.vehicle_class}
                onValueChange={(v) => patch({ vehicle_class: v as ClaimDraft["vehicle_class"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Damage severity</Label>
              <Select
                value={draft.damage_severity}
                onValueChange={(v) => patch({ damage_severity: v as ClaimDraft["damage_severity"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Image model</Label>
              <Select value={draft.image_model} onValueChange={(v) => patch({ image_model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-3.1-flash-image-preview">Nano Banana 2 (fast)</SelectItem>
                  <SelectItem value="google/gemini-2.5-flash-image">Nano Banana</SelectItem>
                  <SelectItem value="google/gemini-3-pro-image-preview">Gemini 3 Pro Image (high quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs"># of angles</Label>
              <Select
                value={String(draft.image_angle_count)}
                onValueChange={(v) => patch({ image_angle_count: Number(v) })}
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
          <div>
            <Label className="text-xs">Paint color</Label>
            <Input value={draft.paint_color} onChange={(e) => patch({ paint_color: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Scene / setting</Label>
            <Input value={draft.scene} onChange={(e) => patch({ scene: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Impact area</Label>
            <Input value={draft.impact_area} onChange={(e) => patch({ impact_area: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Incident description</Label>
            <Textarea
              value={draft.incident_description}
              onChange={(e) => patch({ incident_description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid gap-2 pt-2 sm:grid-cols-3">
            <Button variant="outline" onClick={runGenerate} disabled={generating || saving}>
              {generating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Regenerating…</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Regenerate</>
              )}
            </Button>
            <Button
              onClick={onSave}
              disabled={saving || generating}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                <>Save and proceed to images <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => claimDraftStore.set(null)}
              disabled={saving || generating}
            >
              <Eraser className="mr-2 h-4 w-4" /> Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
