# ClaimLens

> **The claims assessment co-pilot** — an AI-powered platform that streamlines the manual review, damage assessment, and estimate generation steps in car insurance claims.

ClaimLens helps claims agents turn policyholder-supplied vehicle damage photos into fast, consistent, evidence-backed repair estimates — with a human always in the loop. It is a **proof-of-concept** built to demonstrate how AI can reduce assessment time, improve estimate consistency, and lower operational cost per claim.

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

## ✨ What it does

ClaimLens supports three personas, selectable via a user switcher in the top-right (no real authentication — this is a prototype):

| Persona | Who | What they do |
| --- | --- | --- |
| 👩‍💼 **Claims Agent** | _Sarah_ | Reviews claims and damage photos, reviews/edits AI-generated estimates, submits for approval |
| 🧑‍⚖️ **Senior Adjuster** | _Tom_ | Reviews submitted assessments — approve, reject, or send back for changes |
| 🛠️ **Superadmin** | — | Generates synthetic claims, including AI-generated damage images, to populate the demo |

### Core workflow

1. **Review images** — Agent selects a claim and views policyholder damage photos, organised by angle, with quality flags for low-res or missing shots.
2. **AI assessment** — AI analyses the images and returns detected damage types, suggested parts/labour, per-line-item cost estimates, and confidence levels.
3. **Human-in-the-loop edits** — Agent accepts or overrides AI suggestions; overrides require a rationale note that is logged for audit.
4. **Submit for approval** — One-click submission moves the case to a supervisor summary view.
5. **Supervisor review** — Senior adjuster approves, rejects, or sends back with comments.
6. **Estimate export** — On approval, generate or export an itemised estimate for downstream processing.
7. **Audit trail** — Every AI run, human edit, and approval is logged for compliance and analytics.

---

## 🧱 Tech stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19, file-based routing via TanStack Router)
- **Build tooling:** [Vite](https://vite.dev/)
- **UI:** [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives, Lucide icons)
- **State / data:** [Zustand](https://zustand-demo.pmnd.rs/) (persona switcher), [TanStack Query](https://tanstack.com/query)
- **Backend / data:** [Lovable Cloud](https://lovable.dev) (Supabase — Postgres, storage, auth)
- **AI:** Lovable AI Gateway
  - Vision damage analysis via the Vercel AI SDK with structured output
  - Synthetic damage image generation via Gemini image models
- **Package manager / runtime:** [Bun](https://bun.sh/)

---

## 📁 Project structure

```
src/
├── routes/                  # File-based routes (TanStack Start)
│   ├── __root.tsx           # App shell
│   ├── index.tsx            # Claims queue
│   ├── claims.$id.tsx       # Claim workspace (images + AI assessment + edit/submit)
│   ├── claims.$id.review.tsx# Supervisor review view
│   ├── admin.generate.tsx   # Superadmin synthetic claim generator
│   ├── audit.tsx            # Audit trail / activity log
│   └── api/                 # Server route handlers (e.g. streaming image generation)
├── components/              # UI components (shadcn/ui under components/ui)
├── integrations/supabase/   # Supabase client(s) + generated types
├── lib/                     # Server functions, AI helpers, stores, utilities
└── styles.css               # Tailwind entry

supabase/
├── migrations/              # Database schema
└── config.toml

.lovable/                    # Lovable project metadata & build plan
```

### Data model (high level)

`claims`, `claim_images`, `ai_assessments`, `assessment_line_items`, `reviews`, `audit_log`, `personas`, and `repair_catalog`. See [`supabase/migrations/`](supabase/migrations/) for the full schema and [`.lovable/plan.md`](.lovable/plan.md) for descriptions.

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

This is a proof-of-concept. **Out of scope:**

- Real authentication / SSO (personas are switched manually)
- Policyholder-facing claim submission
- Repair shop / downstream system integration
- Fully automating claims without human review

---

## 📄 License

Proprietary — internal proof-of-concept. All rights reserved unless stated otherwise.
