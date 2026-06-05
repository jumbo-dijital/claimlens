import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useMe } from "@/lib/use-me";
import {
  ClaimDetailsForm,
  emptyClaimDetails,
  type ClaimDetailsValues,
} from "@/components/claim-details-form";
import { createClaim } from "@/lib/claim-actions.functions";
import { generateSyntheticClaimDetails } from "@/lib/generate-claim-details.functions";

export const Route = createFileRoute("/_authenticated/claims/new")({
  head: () => ({ meta: [{ title: "New claim — ClaimLens" }] }),
  component: NewClaimPage,
});

function NewClaimPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const create = useServerFn(createClaim);
  const generate = useServerFn(generateSyntheticClaimDetails);
  const isSuperadmin = me?.roles.includes("superadmin") ?? false;
  const [aiSeed, setAiSeed] = useState<ClaimDetailsValues | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [demoUsed, setDemoUsed] = useState(false);

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const d = await generate();
      setAiSeed({
        policyholder_name: d.policyholder_name,
        policy_number: `POL-${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
        vehicle_make: d.vehicle_make,
        vehicle_model: d.vehicle_model,
        vehicle_year: d.vehicle_year,
        vehicle_class: d.vehicle_class,
        damage_severity: d.damage_severity,
        paint_color: d.paint_color,
        impact_area: d.impact_area,
        incident_description: d.incident_description,
      });
      setDemoUsed(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New claim</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the claim details, then save to proceed to uploading damage photos.
        </p>
      </div>
      <ClaimDetailsForm
        initial={emptyClaimDetails()}
        valuesOverride={aiSeed}
        saveLabel="Create claim"
        alwaysEnableSave
        headerExtra={
          isSuperadmin ? (
            <Button
              variant="outline"
              size="sm"
              onClick={runGenerate}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Demo: Generate claim</>
              )}
            </Button>
          ) : null
        }
        onSave={async (values) => {
          const res = await create({
            data: { ...values, demoGenerated: demoUsed },
          });
          toast.success("Claim created");
          router.navigate({ to: "/claims/$id", params: { id: res.claimId } });
        }}
      />
    </div>
  );
}
