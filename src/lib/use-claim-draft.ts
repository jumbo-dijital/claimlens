import { useSyncExternalStore } from "react";

export interface ClaimDraft {
  policyholder_name: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_class: "standard" | "premium";
  paint_color: string;
  scene: string;
  impact_area: string;
  damage_severity: "minor" | "moderate" | "severe";
  image_model: string;
  image_angle_count: number;
  incident_description: string;
}

let current: ClaimDraft | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const claimDraftStore = {
  get: () => current,
  set: (d: ClaimDraft | null) => {
    current = d;
    emit();
  },
  patch: (patch: Partial<ClaimDraft>) => {
    if (!current) return;
    current = { ...current, ...patch };
    emit();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useClaimDraft() {
  return useSyncExternalStore(claimDraftStore.subscribe, claimDraftStore.get, () => null);
}
