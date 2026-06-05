import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";

export interface ClaimDetailsValues {
  policyholder_name: string;
  policy_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_class: "standard" | "premium";
  damage_severity: "minor" | "moderate" | "severe";
  paint_color: string;
  impact_area: string;
  incident_description: string;
}

export function emptyClaimDetails(): ClaimDetailsValues {
  return {
    policyholder_name: "",
    policy_number: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: new Date().getFullYear(),
    vehicle_class: "standard",
    damage_severity: "moderate",
    paint_color: "",
    impact_area: "",
    incident_description: "",
  };
}

interface Props {
  initial: ClaimDetailsValues;
  saveLabel?: string;
  onSave: (values: ClaimDetailsValues) => Promise<void>;
  headerExtra?: ReactNode;
  title?: string;
  valuesOverride?: ClaimDetailsValues;
  /** When true, Save remains enabled even when the form has not been edited (e.g. for new claim creation). */
  alwaysEnableSave?: boolean;
}

export function ClaimDetailsForm({
  initial,
  saveLabel = "Save",
  onSave,
  headerExtra,
  title = "Claim details",
  valuesOverride,
  alwaysEnableSave = false,
}: Props) {
  const [form, setForm] = useState<ClaimDetailsValues>(initial);
  const [baseline, setBaseline] = useState<ClaimDetailsValues>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (valuesOverride) {
      setForm(valuesOverride);
      setBaseline(valuesOverride);
    }
  }, [valuesOverride]);

  const set = <K extends keyof ClaimDetailsValues>(k: K, v: ClaimDetailsValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isDirty = useMemo(
    () => (Object.keys(form) as (keyof ClaimDetailsValues)[]).some((k) => form[k] !== baseline[k]),
    [form, baseline],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {headerExtra}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Policyholder name</Label>
            <Input value={form.policyholder_name} onChange={(e) => set("policyholder_name", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Policy number</Label>
            <Input value={form.policy_number} onChange={(e) => set("policy_number", e.target.value)} />
          </div>
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
        <div className="grid grid-cols-2 gap-2">
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
        </div>
        <div>
          <Label className="text-xs">Paint color</Label>
          <Input value={form.paint_color} onChange={(e) => set("paint_color", e.target.value)} />
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
                setBaseline(form);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Save failed");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || (!alwaysEnableSave && !isDirty)}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saveLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
