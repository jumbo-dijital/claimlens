export interface PromptClaim {
  vehicle_year: number | string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_class: string | null;
  paint_color: string | null;
  scene: string | null;
  impact_area: string | null;
  damage_severity: string | null;
  incident_description: string | null;
}

export function buildDamagePrompt(angle: string, claim: PromptClaim): string {
  const angleDesc = (() => {
    switch (angle) {
      case "front":
        return "Camera positioned directly in front of the vehicle, showing the entire front fascia (hood, grille, headlights, front bumper, windshield). The front of the car is fully visible; the rear is NOT visible.";
      case "rear":
        return "Camera positioned directly behind the vehicle, showing the entire rear (trunk lid, tail lights, rear bumper, rear windshield, license plate). The rear of the car is fully visible; the front is NOT visible.";
      case "left side":
        return "Camera positioned perpendicular to the LEFT side of the vehicle (the side on the viewer's left when looking at the front of the car), showing the full left profile from front wheel to rear wheel.";
      case "right side":
        return "Camera positioned perpendicular to the RIGHT side of the vehicle (the side on the viewer's right when looking at the front of the car), showing the full right profile from front wheel to rear wheel.";
      default:
        return `Camera angle: ${angle} view of the vehicle.`;
    }
  })();

  const ia = (claim.impact_area ?? "").toLowerCase();
  const isDamagedAngle =
    (angle === "rear" && /rear|trunk|tail|back/.test(ia)) ||
    (angle === "front" && /front|hood|grille|bonnet/.test(ia)) ||
    (angle === "left side" && /left/.test(ia)) ||
    (angle === "right side" && /right/.test(ia));

  const damageClause = isDamagedAngle
    ? `Visible ${claim.damage_severity ?? "moderate"} collision damage concentrated on the ${claim.impact_area} (matching the incident: ${claim.incident_description ?? ""}). Damage is ONLY on the ${claim.impact_area} — every other panel is pristine and undamaged.`
    : `This angle shows an UNDAMAGED side of the vehicle — bodywork is pristine, no dents, no scratches, no paint damage. The collision damage is on the ${claim.impact_area} and is NOT visible from this angle.`;

  return `Photorealistic insurance claim smartphone photograph. Subject: the SAME specific ${claim.vehicle_year} ${claim.vehicle_make} ${claim.vehicle_model} (${claim.vehicle_class ?? "standard"} class) sedan, painted in ${claim.paint_color} (exact same paint tone, finish, and reflectivity in every photo of this set). Setting: ${claim.scene} — identical location, identical lighting, identical weather, identical time of day, as if all photos were taken within 30 seconds of each other from the same spot, only the camera angle changed. ${angleDesc} ${damageClause} Slightly amateur handheld smartphone photo quality, natural perspective, no people, no other vehicles in foreground, no text overlays, no watermarks, no logos beyond factory vehicle badging.`;
}

export const ANGLES = ["front", "rear", "left side", "right side"] as const;
