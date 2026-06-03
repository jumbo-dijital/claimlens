export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const statusLabel: Record<string, string> = {
  new: "New",
  ai_processing: "AI Processing",
  in_review: "In Review",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes Requested",
};

export const statusTone: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  ai_processing: "bg-info/15 text-info",
  in_review: "bg-primary/15 text-primary",
  submitted: "bg-warning/20 text-warning-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  changes_requested: "bg-warning/20 text-warning-foreground",
};
