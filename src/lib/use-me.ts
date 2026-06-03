import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/me.functions";

export type AppRole = "agent" | "adjuster" | "superadmin";

export interface Me {
  userId: string;
  email: string | null;
  roles: AppRole[];
  profile: { display_name: string; avatar_color: string } | null;
}

export function useMe() {
  const fn = useServerFn(getMe);
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: () => fn() as Promise<Me | null>,
    staleTime: 60_000,
  });
}
