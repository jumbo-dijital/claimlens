import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { flushSync } from "react-dom";
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
import { Eraser, Sparkles, Loader2 } from "lucide-react";
import { streamImage } from "@/lib/stream-image";
import { createSyntheticClaim } from "@/lib/claim-actions.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/generate")({
  component: GeneratePage,
});

const ANGLES = ["front", "rear", "driver side", "passenger side"];
type VehicleClass = "standard" | "premium";
type DamageSeverity = "minor" | "moderate" | "severe";

function GeneratePage() {
  const router = useRouter();
  const createClaim = useServerFn(createSyntheticClaim);

  const [policyholder, setPolicyholder] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [vehicleClass, setVehicleClass] = useState<VehicleClass | undefined>();
  const [severity, setSeverity] = useState<DamageSeverity | undefined>();
  const [imgModel, setImgModel] = useState<string | undefined>();
  const [count, setCount] = useState<string | undefined>();
  const [paintColor, setPaintColor] = useState("");
  const [scene, setScene] = useState("");
  const [impactArea, setImpactArea] = useState("");
  const [description, setDescription] = useState("");

  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<{ angle: string; url: string; final: boolean }[]>([]);

  const angleDescription = (angle: string) => {
    switch (angle) {
      case "front":
        return "Camera positioned directly in front of the vehicle, showing the entire front fascia (hood, grille, headlights, front bumper, windshield). The front of the car is fully visible; the rear is NOT visible.";
      case "rear":
        return "Camera positioned directly behind the vehicle, showing the entire rear (trunk lid, tail lights, rear bumper, rear windshield, license plate). The rear of the car is fully visible; the front is NOT visible.";
      case "driver side":
        return "Camera positioned perpendicular to the driver-side (left) of the vehicle, showing the full left profile from front wheel to rear wheel.";
      case "passenger side":
        return "Camera positioned perpendicular to the passenger-side (right) of the vehicle, showing the full right profile from front wheel to rear wheel.";
      default:
        return `Camera angle: ${angle} view of the vehicle.`;
    }
  };

  const buildPrompt = (angle: string) => {
    const ia = impactArea.toLowerCase();
    const isDamagedAngle =
      (angle === "rear" && /rear|trunk|tail|back/.test(ia)) ||
      (angle === "front" && /front|hood|grille|bonnet/.test(ia)) ||
      (angle === "driver side" && /driver|left/.test(ia)) ||
      (angle === "passenger side" && /passenger|right/.test(ia));
    const damageClause = isDamagedAngle
      ? `Visible ${severity} collision damage concentrated on the ${impactArea} (matching the incident: ${description}). Damage is ONLY on the ${impactArea} — every other panel is pristine and undamaged.`
      : `This angle shows an UNDAMAGED side of the vehicle — bodywork is pristine, no dents, no scratches, no paint damage. The collision damage is on the ${impactArea} and is NOT visible from this angle.`;
    return `Photorealistic insurance claim smartphone photograph. Subject: the SAME specific ${year} ${make} ${model} (${vehicleClass} class) sedan, painted in ${paintColor} (exact same paint tone, finish, and reflectivity in every photo of this set). Setting: ${scene} — identical location, identical lighting, identical weather, identical time of day, as if all photos were taken within 30 seconds of each other from the same spot, only the camera angle changed. ${angleDescription(angle)} ${damageClause} Slightly amateur handheld smartphone photo quality, natural perspective, no people, no other vehicles in foreground, no text overlays, no watermarks, no logos beyond factory vehicle badging.`;
  };

  const resetForm = () => {
    setPolicyholder("");
    setMake("");
    setModel("");
    setYear("");
    setVehicleClass(undefined);
    setSeverity(undefined);
    setImgModel(undefined);
    setCount(undefined);
    setPaintColor("");
    setScene("");
    setImpactArea("");
    setDescription("");
    setPreviews([]);
  };

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
      resetForm();
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
            <Label className="text-xs">Paint color</Label>
            <Input value={paintColor} onChange={(e) => setPaintColor(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Scene / setting</Label>
            <Input value={scene} onChange={(e) => setScene(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Impact area</Label>
            <Input
              value={impactArea}
              onChange={(e) => setImpactArea(e.target.value)}
              placeholder="e.g. rear bumper and trunk lid"
            />
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
