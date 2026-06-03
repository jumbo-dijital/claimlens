import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePersonaStore, type Persona } from "@/lib/persona-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, ScanEye } from "lucide-react";

const roleLabels: Record<string, string> = {
  agent: "Claims Agent",
  adjuster: "Senior Adjuster",
  superadmin: "Superadmin",
};

export function AppHeader() {
  const router = useRouter();
  const { currentPersonaId, setPersonaId } = usePersonaStore();

  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .order("role");
      if (error) throw error;
      return data as Persona[];
    },
  });

  // Default to first agent on first load
  useEffect(() => {
    if (!currentPersonaId && personas.length > 0) {
      const agent = personas.find((p) => p.role === "agent") ?? personas[0];
      setPersonaId(agent.id);
    }
  }, [personas, currentPersonaId, setPersonaId]);

  const current = personas.find((p) => p.id === currentPersonaId);

  const navFor = (role?: string) => {
    if (role === "superadmin") {
      return [
        { to: "/", label: "All claims" },
        { to: "/admin/generate", label: "Generate claim" },
        { to: "/audit", label: "Audit log" },
      ];
    }
    if (role === "adjuster") {
      return [
        { to: "/", label: "Review queue" },
        { to: "/audit", label: "Audit log" },
      ];
    }
    return [
      { to: "/", label: "My claims" },
      { to: "/audit", label: "Audit log" },
    ];
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <ScanEye className="h-4 w-4" />
          </span>
          ClaimLens
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {navFor(current?.role).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
              activeOptions={{ exact: true }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {current ? (
                  <>
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: current.avatar_color }}
                    >
                      {current.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                    <span className="text-left">
                      <span className="block text-xs leading-none">{current.name}</span>
                      <span className="block text-[10px] leading-none text-muted-foreground mt-0.5">
                        {roleLabels[current.role]}
                      </span>
                    </span>
                  </>
                ) : (
                  "Choose persona"
                )}
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Switch persona (demo)</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {personas.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => {
                    setPersonaId(p.id);
                    router.invalidate();
                  }}
                  className="gap-2"
                >
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: p.avatar_color }}
                  >
                    {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                  <span>
                    <span className="block text-sm">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{roleLabels[p.role]}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
