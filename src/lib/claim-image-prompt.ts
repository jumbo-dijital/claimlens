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
  // IMPORTANT: "left" and "right" are defined from the perspective of an occupant
  // sitting inside the vehicle facing forward (the driving direction). This is the
  // automotive industry convention. The viewer's left/right when looking at the
  // front of the car is the OPPOSITE of the vehicle's left/right — do not confuse
  // the two. We give the model explicit landmarks (where the front of the car
  // points in the frame) so the two side photos cannot be mirrored duplicates.
  const angleDesc = (() => {
    switch (angle) {
      case "front":
        return "Camera positioned directly in front of the vehicle, showing the entire front fascia (hood, grille, headlights, front bumper, windshield). The front of the car is fully visible; the rear is NOT visible.";
      case "rear":
        return "Camera positioned directly behind the vehicle, showing the entire rear (trunk lid, tail lights, rear bumper, rear windshield, license plate). The rear of the car is fully visible; the front is NOT visible.";
      case "left side":
        return "Side profile shot of the vehicle's LEFT side (the side where the driver sits in a left-hand-drive car — i.e. the side an occupant facing forward calls 'left'). Camera is perpendicular to that side. CRITICAL: the front of the car (hood, grille, headlights) must point toward the RIGHT edge of the photo, and the rear (trunk, tail lights) must point toward the LEFT edge of the photo. Show the full left profile from front wheel to rear wheel. Do NOT show the right side of the vehicle, and do NOT horizontally mirror a right-side photo.";
      case "right side":
        return "Side profile shot of the vehicle's RIGHT side (the side opposite the driver in a left-hand-drive car — i.e. the side an occupant facing forward calls 'right'). Camera is perpendicular to that side. CRITICAL: the front of the car (hood, grille, headlights) must point toward the LEFT edge of the photo, and the rear (trunk, tail lights) must point toward the RIGHT edge of the photo. Show the full right profile from front wheel to rear wheel. Do NOT show the left side of the vehicle, and do NOT horizontally mirror a left-side photo.";
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
    : `This angle shows an UNDAMAGED side of the vehicle — bodywork is pristine, no dents, no scratches, no paint damage. The collision damage is on the ${claim.impact_area} (the opposite physical side / area of the car) and is NOT visible from this angle.`;

  return `Photorealistic insurance claim smartphone photograph. Subject: the SAME specific ${claim.vehicle_year} ${claim.vehicle_make} ${claim.vehicle_model} (${claim.vehicle_class ?? "standard"} class) sedan, painted in ${claim.paint_color} (exact same paint tone, finish, and reflectivity in every photo of this set). Setting: ${claim.scene} — identical location, identical lighting, identical weather, identical time of day, as if all photos were taken within 30 seconds of each other from the same spot, only the camera angle changed. ${angleDesc} ${damageClause} Slightly amateur handheld smartphone photo quality, natural perspective, no people, no other vehicles in foreground, no text overlays, no watermarks, no logos beyond factory vehicle badging.`;
}

export const ANGLES = ["front", "rear", "left side", "right side"] as const;
