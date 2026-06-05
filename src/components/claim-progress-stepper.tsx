import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "muted" | "primary" | "success" | "destructive";

interface Step {
  key: string;
  label: string;
  state: "completed" | "current" | "upcoming" | "skipped";
  tone: Tone;
}

const HAPPY_PATH = ["new", "in_review", "submitted", "approved"] as const;

export function ClaimProgressStepper({ status }: { status: string }) {
  const isRejected = status === "rejected";
  const happyIndex = HAPPY_PATH.indexOf(status as (typeof HAPPY_PATH)[number]);

  const baseSteps: Array<{ key: string; label: string }> = [
    { key: "new", label: "New" },
    { key: "in_review", label: "In review" },
    { key: "submitted", label: "Submitted for approval" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  const steps: Step[] = baseSteps.map((s, i) => {
    // Index 0..3 are happy path; index 4 is the rejected terminal.
    if (s.key === "rejected") {
      if (isRejected) return { ...s, state: "current", tone: "destructive" };
      return { ...s, state: "upcoming", tone: "muted" };
    }
    if (s.key === "approved") {
      if (status === "approved") return { ...s, state: "current", tone: "success" };
      if (isRejected) return { ...s, state: "skipped", tone: "muted" };
      return { ...s, state: "upcoming", tone: "muted" };
    }
    if (isRejected) {
      // Pre-approval steps are all considered completed when rejected.
      return { ...s, state: "completed", tone: "primary" };
    }
    if (happyIndex < 0) {
      return { ...s, state: "upcoming", tone: "muted" };
    }
    if (i < happyIndex) return { ...s, state: "completed", tone: "primary" };
    if (i === happyIndex) return { ...s, state: "current", tone: "primary" };
    return { ...s, state: "upcoming", tone: "muted" };
  });

  return (
    <ol className="flex w-full items-start gap-2" aria-label="Claim progress">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const nextStep = steps[i + 1];
        const connectorActive =
          step.state === "completed" ||
          (step.state === "current" && nextStep?.state === "completed");
        return (
          <li key={step.key} className="flex flex-1 items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  step.state === "completed" && "border-primary bg-primary text-primary-foreground",
                  step.state === "current" &&
                    step.tone === "primary" &&
                    "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                  step.state === "current" &&
                    step.tone === "success" &&
                    "border-success bg-success text-success-foreground ring-4 ring-success/20",
                  step.state === "current" &&
                    step.tone === "destructive" &&
                    "border-destructive bg-destructive text-destructive-foreground ring-4 ring-destructive/20",
                  (step.state === "upcoming" || step.state === "skipped") &&
                    "border-border bg-background text-muted-foreground",
                )}
                aria-current={step.state === "current" ? "step" : undefined}
              >
                {step.state === "completed" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <div
                className={cn(
                  "mt-1.5 text-[11px] leading-tight",
                  step.state === "current" ? "font-medium text-foreground" : "text-muted-foreground",
                  step.state === "current" ? "block" : "hidden sm:block",
                )}
              >
                {step.label}
              </div>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "mt-4 h-0.5 flex-1 rounded-full",
                  connectorActive ? "bg-primary" : "bg-border",
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
