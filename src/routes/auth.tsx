import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanEye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { notifySignin } from "@/lib/notify-signin.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — ClaimLens" }] }),
  component: AuthPage,
});


function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    // Fire-and-forget sign-in notification (don't block sign-in on email queue).
    notifySignin().catch((e) => console.error("notifySignin failed", e));
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
        </CardContent>
      </Card>
    </div>
  );
}
