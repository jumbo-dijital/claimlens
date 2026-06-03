import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PersonaRole = "agent" | "adjuster" | "superadmin";

export interface Persona {
  id: string;
  role: PersonaRole;
  name: string;
  email: string;
  avatar_color: string;
}

interface PersonaState {
  currentPersonaId: string | null;
  setPersonaId: (id: string) => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      currentPersonaId: null,
      setPersonaId: (id) => set({ currentPersonaId: id }),
    }),
    { name: "claimlens-persona" },
  ),
);
