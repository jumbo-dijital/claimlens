import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanEye, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — ClaimLens" }] }),
  component: AuthPage,
});

const DEMO_ACCOUNTS = [
  { email: "agent@claimlens.demo", role: "Claims Agent" },
  { email: "adjuster@claimlens.demo", role: "Senior Adjuster" },
  { email: "admin@claimlens.demo", role: "Superadmin" },
];

function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("agent@claimlens.demo");
  const [password, setPassword] = useState("ClaimLens2026!");
  const [submitting, setSubmitting] = useState(false);

  // If already signed in, bounce to home
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.navigate({ to: "/" });
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    router.navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="mb-6 flex items-center gap-2 font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
          <ScanEye className="h-5 w-5" />
        </span>
        <span className="text-xl tracking-tight">ClaimLens</span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">
            Demo back-office for AI-assisted auto-damage claims.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
            </div>
            <div>
              <Label>Password</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
          <div className="mt-6 rounded-md border border-border bg-muted/40 p-3 text-xs">
            <p className="mb-2 font-medium">Demo accounts (password: <code className="font-mono">ClaimLens2026!</code>)</p>
            <ul className="space-y-1">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setEmail(a.email)}
                    className="font-mono text-foreground hover:underline"
                  >
                    {a.email}
                  </button>
                  <span className="text-muted-foreground">{a.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
