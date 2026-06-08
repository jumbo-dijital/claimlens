# ClaimLens

> **The claims assessment co-pilot** — assess every car-insurance damage claim consistently and fairly within minutes, with AI drafting and a human deciding.

ClaimLens turns a claim's details and the policyholder's damage photos into a structured, costed repair assessment in minutes — then puts an Assessor in control to review, edit, and approve it. It is a **proof-of-concept** for AI-assisted claims assessment with human accountability built in.

### Why it exists

| Problem | What ClaimLens does about it |
| --- | --- |
| **Cost** — manual assessment takes days, driving up operational cost per claim | Produces a first-pass AI estimate in minutes so Assessors review rather than build from scratch |
| **Accuracy** — human estimates are inconsistently over- and under-estimated | Generates consistent, evidence-backed line items with confidence scores and rationale |
| **Trust** — slow, inappropriate assessments harm customer retention | Faster, explainable assessments with a full audit trail and a human decision on every claim |

**Vision:** every claim assessed consistently and fairly within minutes. Over time the AI earns increasing autonomy on proven, low-risk cases — always with a human-review path.

---

## 🤖 Managed by Lovable

> [!IMPORTANT]
> **This repository is primarily managed by [Lovable](https://lovable.dev).**
>
> The application is built and edited through Lovable, and **commits are merged from Lovable whenever it makes changes to the app**. As a result:
>
> - Lovable is the source of truth for most application code.
> - Expect automated commits authored by Lovable to land on the main branch.
> - When making manual changes, coordinate with the Lovable workflow to avoid conflicts — changes made outside of Lovable may be overwritten or need to be reconciled on the next Lovable sync.
> - Project metadata lives in [`.lovable/`](.lovable/) (see [`.lovable/plan.md`](.lovable/plan.md) for the product/build plan).

---

## 👥 Who uses it

The app uses **real authentication** (Supabase email/password) with role-based access. Each signed-in user has one or more roles, and the UI adapts to the role.

| Role | App role | What they do |
| --- | --- | --- |
| 🔍 **Assessor** | `agent` | Reviews the claim and damage photos, edits/accepts/overrides the AI-generated line items (with a rationale), and submits the assessment for approval |
| 🧑‍⚖️ **Adjuster** | `adjuster` | Reviews submitted assessments and **approves**, **rejects**, or **returns to assessors** for changes |
| 🛠️ **Superadmin** | `superadmin` | Generates **synthetic claims** (details + AI-generated damage images) so the system can be built and evaluated without real customer data |

> Seeded demo accounts exist per role (e.g. `agent@claimlens.demo`, `adjuster@claimlens.demo`, `admin@claimlens.demo`). Sign in at `/auth`.

---

## ✨ Key features (P0)

These are the smallest increment that delivers an AI estimate with human accountability:

1. **Claim workflow & review workspace** — a single surface showing the claim, the policyholder's photos, and the AI assessment, where the Assessor reviews and decides each claim.
2. **AI damage assessment** — turns claim details + photos into structured findings (location, severity, suggested repair, confidence, rationale) with a costed estimate.
3. **Review & override** — the Assessor edits, accepts, or rejects any line, recording a reason; **nothing is submitted without a human decision**.
4. **Audit log / trail** — every AI output and human action is logged for compliance, disputes, and model evaluation.
5. **Synthetic claim creation** (superadmin only) — realistic test claims (details + damage images) for building and evaluation without real PII.

### Workflow

1. **Create** — A synthetic claim is generated (superadmin) with details and damage photos; the claim enters the queue as **New**.
2. **AI assessment** — The Assessor runs AI analysis; the model returns costed, confidence-scored line items and the claim moves to **In Review**.
3. **Review & override** — The Assessor edits/accepts/rejects line items (overrides require a logged rationale), then **submits for approval** (**Submitted**).
4. **Adjudicate** — The Adjuster **approves**, **rejects**, or **returns to assessors** with comments.
5. **Audit** — Every AI run, edit, comment, and decision is recorded in the audit trail.

> Status flow: `new → in_review → submitted → approved / rejected` (an Adjuster can return a claim to `in_review`).

### Roadmap (P1 → P2)

- **P1** — Confidence-based routing (auto-handle high-confidence claims, route the rest to review/escalation) and an Adjuster escalation queue.
- **P2** — Real repair-cost grounding (RAG), fraud / anomaly flags, proprietary models, and video assessment.

---

## 🧠 AI integration

For the P0 pipeline, a **single model call** drafts the assessment:

- When AI analysis runs on a claim, ClaimLens sends the claim details and damage photos to **Google Gemini 3 Flash** (`google/gemini-3-flash-preview`) via the Lovable AI Gateway, instructing it to act as an experienced auto-damage assessor.
- For each piece of damage the model returns **location, severity, suggested repair, a confidence score, and a rationale** (validated against a Zod schema).
- Each suggested repair is looked up in a **mock repair-cost catalogue** to attach part cost, labour hours, and hourly rate. _(Real repair-cost data is a deferred P2 item.)_
- The assessment is **saved and versioned**, so re-runs are tracked, and the claim is **always routed to a person for review — nothing is approved automatically**.
- Synthetic damage images are generated with Gemini image models (e.g. `google/gemini-3.1-flash-image-preview`), streamed to the superadmin UI.

**Human ↔ AI:** the AI drafts; the human decides. Every claim passes through a person (human-in-the-loop). Later, confidence-based routing will let the AI auto-handle easy cases under human supervision (human-over-the-loop), while high-value, low-confidence, and disputed claims always go to a person.

---

## 🛡️ Responsible AI

Because this system makes decisions that affect policyholders, the design accounts for:

- **Human review path** — every claim is reviewable by a person; no fully-autonomous decisions in P0/P1 (aligns with **GDPR Article 22** for significant automated decisions).
- **Fairness** — estimates must not skew by postcode, vehicle age/value, or name (income/ethnicity proxies).
- **Data privacy** — claim photos are heavy PII (faces, plates, locations); minimise, redact, and retention-limit. The audit log scrubs base64 image data and caps payload size.
- **Incentive integrity** — the cost-reduction goal targets waste and rework, **never** shaving policyholder payouts.
- **Fraud handling** — fraud signals route to human investigation under a presumption of good faith; never auto-deny.
- **Transparency & auditability** — disclose AI use, keep per-line rationale explainable, and maintain the audit trail for disputes and regulators.

---

## 🧱 Tech stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19, file-based routing via TanStack Router, server functions)
- **Build tooling:** [Vite](https://vite.dev/)
- **UI:** [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives, Lucide icons)
- **Server state / forms:** [TanStack Query](https://tanstack.com/query) + [React Hook Form](https://react-hook-form.com/) (validated with [Zod](https://zod.dev/))
- **Backend / data / auth:** [Lovable Cloud](https://lovable.dev) (Supabase — Postgres, storage, JWT auth, row-level security)
- **AI:** Lovable AI Gateway via the [Vercel AI SDK](https://sdk.vercel.ai/)
  - Vision damage analysis with structured (schema-validated) output
  - Synthetic damage-image generation via Gemini image models
- **Package manager / runtime:** [Bun](https://bun.sh/)

---

## 🔐 Security model (at a glance)

- **Authentication:** Supabase JWT. Authenticated routes live under `_authenticated/` and redirect to `/auth` when signed out.
- **Authorization:** every server function is wrapped in `requireRole(...)` middleware, which validates the JWT and checks the caller's roles in the `user_roles` table. Identity is derived from the verified token, never from client input.
- **Database:** Row-Level Security is enabled on all tables — `anon` has no access, authenticated users are **read-only**, and all writes go through server functions using a server-only service-role client.
- **Audit:** every mutation is logged with the verified actor, role, action, and (size-capped, PII-scrubbed) details.

See [`SECURITY.md`](SECURITY.md) for details.

---

## 📁 Project structure

```
src/
├── routes/                              # File-based routes (TanStack Start)
│   ├── __root.tsx                       # App shell
│   ├── auth.tsx                         # Sign-in page
│   ├── _authenticated/                  # Auth-guarded routes (redirect to /auth if signed out)
│   │   ├── route.tsx                    # Auth guard layout
│   │   ├── index.tsx                    # Role-filtered claims queue
│   │   ├── claims.new.tsx               # Create claim (superadmin)
│   │   ├── claims.$id.tsx               # Claim workspace (photos + AI assessment + review/edit/submit)
│   │   ├── claims.$id.review.tsx        # Adjuster review & decision
│   │   └── audit.tsx                    # System-wide audit log
│   └── api/generate-damage-image.ts     # Streaming synthetic image generation (superadmin)
├── components/                          # App components + shadcn/ui (components/ui)
├── integrations/supabase/               # Browser & server (service-role) clients, generated types, auth middleware
├── lib/                                 # Server functions (*.functions.ts), AI helpers, auth/roles, audit, utils
└── styles.css                           # Tailwind entry

supabase/
├── migrations/                          # Database schema & RLS policies
└── config.toml

.lovable/                                # Lovable project metadata & build plan
```

### Data model (high level)

`claims`, `claim_images`, `ai_assessments`, `assessment_line_items` (the costed line items), `reviews`, `audit_log`, `repair_catalog` (mock cost lookup), plus `user_roles` and `profiles` for auth. See [`supabase/migrations/`](supabase/migrations/) for the full schema and RLS policies.

---

## 🚀 Getting started

> Most development happens in Lovable. The steps below are for running the app locally.

### Prerequisites

- [Bun](https://bun.sh/) (this repo uses `bun.lock`)
- Node.js 22+ (for tooling compatibility)
- A Supabase / Lovable Cloud project and a Lovable AI Gateway key

### Install & run

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev
```

### Available scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start the Vite dev server |
| `bun run build` | Production build |
| `bun run build:dev` | Development-mode build |
| `bun run preview` | Preview the production build |
| `bun run lint` | Run ESLint |
| `bun run format` | Format with Prettier |

### Environment variables

> [!NOTE]
> The `.env` file in this repository is **not for secrets**. It only contains publicly publishable configuration values (e.g., Supabase URL and publishable key). Real secrets such as `SUPABASE_SERVICE_ROLE_KEY` and `LOVABLE_API_KEY` are stored in Lovable Cloud's secret store and injected at runtime — they should never be committed to version control.

Create a `.env` file (see existing variable names) with at least:

| Variable | Scope | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Public (client) | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public (client) | Supabase anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Public (client) | Supabase project ID |
| `SUPABASE_URL` | Server | Supabase project URL (SSR) |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Supabase anon/publishable key (SSR) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server secret** | Service-role key — **never expose to the client** |
| `LOVABLE_API_KEY` | **Server secret** | Lovable AI Gateway key for vision analysis & image generation |

> [!WARNING]
> Variables prefixed with `VITE_` are **bundled into the browser build** and are public by design. Only the Supabase anon/publishable key belongs there. Keep `SUPABASE_SERVICE_ROLE_KEY` and `LOVABLE_API_KEY` **server-side only** (read via `process.env` inside server functions/handlers — see [`src/lib/config.server.ts`](src/lib/config.server.ts)).

---

## 📌 Scope

This is a proof-of-concept. **Out of scope (per PRD non-goals):**

- Improvements to the repair, full claim-intake, or policyholder-facing experiences
- Fully-autonomous claim decisions with no human-review path
- Real repair-shop / downstream system integration

---

## 📄 License

Proprietary — internal proof-of-concept. All rights reserved unless stated otherwise.
