import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type AppRole } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, ScanEye } from "lucide-react";

const roleLabels: Record<AppRole, string> = {
  agent: "Claims Agent",
  adjuster: "Senior Adjuster",
  superadmin: "Superadmin",
};

function navFor(roles: AppRole[]) {
  const items: { to: string; label: string }[] = [{ to: "/", label: "Claims" }];
  if (roles.includes("superadmin")) {
    items.push({ to: "/admin/generate", label: "Generate claim" });
  }
  items.push({ to: "/audit", label: "Audit log" });
  return items;
}

export function AppHeader() {
  const router = useRouter();
  const { data: me } = useMe();

  if (!me) {
    return (
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">
          <Link to="/auth" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <ScanEye className="h-4 w-4" />
            </span>
            ClaimLens
          </Link>
        </div>
      </header>
    );
  }

  const roles = me.roles;
  const primary = roles[0] ?? "agent";
  const display = me.profile?.display_name || me.email || "User";
  const initials = display.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const color = me.profile?.avatar_color ?? "#3b82f6";

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
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
          {navFor(roles).map((item) => (
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
                <span
                  className="grid h-6 w-6 place-items-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </span>
                <span className="text-left">
                  <span className="block text-xs leading-none">{display}</span>
                  <span className="block text-[10px] leading-none text-muted-foreground mt-0.5">
                    {roleLabels[primary as AppRole]}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-xs text-muted-foreground">{me.email}</div>
                <div className="mt-1 text-xs">Roles: {roles.join(", ") || "none"}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut} className="gap-2">
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
