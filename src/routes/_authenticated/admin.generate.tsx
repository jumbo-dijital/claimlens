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
import { Sparkles, Loader2 } from "lucide-react";
import { streamImage } from "@/lib/stream-image";
import { createSyntheticClaim } from "@/lib/claim-actions.functions";
import { usePersonaStore } from "@/lib/persona-store";

export const Route = createFileRoute("/_authenticated/admin/generate")({
  component: GeneratePage,
});

const ANGLES = ["front", "rear", "driver side", "passenger side"];

function GeneratePage() {
  const router = useRouter();
  const createClaim = useServerFn(createSyntheticClaim);

  const [policyholder, setPolicyholder] = useState("Jordan Reyes");
  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("Camry");
  const [year, setYear] = useState(2021);
  const [vehicleClass, setVehicleClass] = useState<"standard" | "premium">("standard");
  const [severity, setSeverity] = useState<"minor" | "moderate" | "severe">("moderate");
  const [imgModel, setImgModel] = useState("google/gemini-3.1-flash-image-preview");
  const [count, setCount] = useState(2);
  const [description, setDescription] = useState(
    "Rear-end collision in parking lot. Other driver backed into my vehicle.",
  );

  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<{ angle: string; url: string; final: boolean }[]>([]);

  const buildPrompt = (angle: string) =>
    `Photorealistic insurance claim photograph of a ${year} ${make} ${model} (${vehicleClass} class) showing ${severity} accident damage. Camera angle: ${angle} view of the vehicle. Damage context: ${description}. Daylight, parking lot or street scene, slightly amateur smartphone photo quality, no people in frame, no text overlays, no watermarks.`;

  const runGenerate = async () => {
    setGenerating(true);
    setPreviews([]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const angles = ANGLES.slice(0, count);
      const finalImages: { url: string; angle: string }[] = [];
      for (let i = 0; i < angles.length; i++) {
        const angle = angles[i];
        setPreviews((p) => [...p, { angle, url: "", final: false }]);
        const finalUrl = await streamImage(
          "/api/generate-damage-image",
          { prompt: buildPrompt(angle) },
          (dataUrl, isFinal) => {
            setPreviews((p) =>
              p.map((x, idx) => (idx === i ? { ...x, url: dataUrl, final: isFinal } : x)),
            );
          },
          { Authorization: `Bearer ${token}` },
        );
        finalImages.push({ url: finalUrl, angle });
      }
      toast.success("Images generated. Creating claim…");
      const res = await createClaim({
        data: {
          policyholder_name: policyholder,
          vehicle_make: make,
          vehicle_model: model,
          vehicle_year: year,
          vehicle_class: vehicleClass,
          incident_description: description,
          images: finalImages,
        },
      });
      toast.success("Claim created");
      router.navigate({ to: "/claims/$id", params: { id: res.claimId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[480px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate synthetic claim</CardTitle>
          <p className="text-xs text-muted-foreground">
            Uses Gemini image models to fabricate realistic damage photos for testing.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Policyholder name</Label>
            <Input value={policyholder} onChange={(e) => setPolicyholder(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Make</Label>
              <Input value={make} onChange={(e) => setMake(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || 2020)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Vehicle class</Label>
              <Select value={vehicleClass} onValueChange={(v) => setVehicleClass(v as "standard" | "premium")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Damage severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as "minor" | "moderate" | "severe")}>
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
              <Select value={imgModel} onValueChange={setImgModel}>
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
              <Select value={String(count)} onValueChange={(v) => setCount(parseInt(v))}>
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
            <Label className="text-xs">Incident description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={runGenerate} disabled={generating} className="w-full">
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Generate damage photos + claim</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generated images</CardTitle>
        </CardHeader>
        <CardContent>
          {previews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Previews will stream in here as the model generates.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {previews.map((p, i) => (
                <div key={i} className="overflow-hidden rounded-md border border-border">
                  {p.url ? (
                    <img
                      src={p.url}
                      alt={p.angle}
                      className={"aspect-square w-full object-cover transition-[filter] duration-300 " + (p.final ? "blur-0" : "blur-md")}
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-muted">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <div className="px-2 py-1 text-xs capitalize text-muted-foreground">{p.angle}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
