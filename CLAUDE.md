# PORKY'S INVENTORY TRACKER V2 — Project Manager

> This file is the central coordination hub for all Claude Code agents working on this project.
> It defines the architecture, conventions, team roles, and rules of engagement.

---

## Project Overview

**Porky's Inventory Tracker V2** is a real-time, multi-device bar/restaurant inventory management system built as a PWA. It handles beverage inventory, table operations, staff management, BOH-to-FOH disbursements, waste tracking, EOD reporting, and analytics.

**Live Stack:**
- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript 5
- **Styling:** Tailwind CSS 3.4 with custom brand theme
- **State:** Zustand 4.5 (4 stores: auth, inventory, table, boh)
- **Database:** Supabase (PostgreSQL) with Realtime subscriptions
- **Storage:** Supabase Storage (staff-photos, product-images buckets)
- **Charts:** Recharts
- **Export:** xlsx
- **Auth:** PIN-based (bcryptjs hashed), role-routed (foh/boh/admin)
- **Deployment:** Vercel
- **Package Manager:** npm

---

## Repository Structure

```
/
├── src/
│   ├── app/                    # Next.js pages & views
│   │   ├── page.tsx            # Root router (login → role-based view)
│   │   ├── layout.tsx          # Root layout, metadata, PWA
│   │   ├── globals.css         # Global styles
│   │   ├── foh-view.tsx        # Front-of-house staff view
│   │   ├── boh-view.tsx        # Back-of-house staff view
│   │   ├── admin-view.tsx      # Admin dashboard (multi-tab)
│   │   ├── eod-view.tsx        # End-of-day reporting
│   │   └── analytics-view.tsx  # Multi-day analytics & charts
│   │
│   ├── stores/                 # Zustand state management
│   │   ├── auth-store.ts       # Staff auth, login/logout, CRUD
│   │   ├── inventory-store.ts  # Products, daily inventory, waste
│   │   ├── table-store.ts      # Tables, orders, activity log
│   │   └── boh-store.ts        # BOH cart & disbursements
│   │
│   ├── components/
│   │   ├── ui/                 # Reusable primitives (button, modal, badge, skeleton, etc.)
│   │   ├── auth/               # PIN pad, staff setup, message modal
│   │   ├── inventory/          # Waste modal
│   │   ├── orders/             # Product card, sale confirm modal
│   │   └── tables/             # Table card, table detail modal
│   │
│   ├── hooks/                  # Custom hooks
│   │   ├── use-realtime.ts     # Supabase Realtime subscriptions
│   │   ├── use-currency.ts     # COP/USD toggle with exchange rate
│   │   └── use-restock-alerts.ts
│   │
│   ├── lib/                    # Utilities & config
│   │   ├── supabase.ts         # Supabase client singleton
│   │   ├── constants.ts        # Categories, exchange rate config
│   │   └── utils.ts            # Date, currency, inventory helpers
│   │
│   └── types/
│       └── index.ts            # All TypeScript interfaces
│
├── supabase/
│   └── migration.sql           # Full database schema (11 tables + view)
│
├── public/                     # PWA manifest, icons
├── tailwind.config.ts          # Custom brand theme & animations
├── next.config.mjs             # Image CDN allowlist
├── tsconfig.json               # Path alias @/* → ./src/*
└── package.json                # Dependencies & scripts
```

---

## Database Tables (Supabase / PostgreSQL)

| Table | Purpose |
|---|---|
| `staff_profiles` | Staff with role (foh/boh/admin), PIN hash, photo |
| `categories` | Product categories (Liquor, Beer, Fountain) |
| `products` | Inventory items with pricing, par levels, box config |
| `inventory_daily` | Daily snapshots (opening, sold, wasted, restocked, closing) |
| `tables` | Restaurant tables (date-scoped, guest count, open/close) |
| `orders` | Items sold per table |
| `boh_disbursements` | BOH→FOH handoffs (tracking only, not inventory-affecting) |
| `waste_log` | Spoilage/breakage with reason & value |
| `eod_reports` | End-of-day summaries with cash reconciliation |
| `staff_messages` | End-of-shift notes from staff |
| `activity_log` | Audit trail |
| `v_restock_alerts` | View: products below par level |

**Realtime-enabled:** tables, orders, inventory_daily, boh_disbursements, staff_messages, waste_log

---

## Key Design Decisions

1. **BOH does NOT affect inventory** — only FOH sales reduce stock. BOH disbursements are tracked for accountability only.
2. **PIN auth, no traditional user auth** — PINs are bcrypt-hashed. Role-based routing after login.
3. **Daily inventory snapshots** — each product gets a date-scoped row (UNIQUE on product_id + date). `closing_stock` is a PostgreSQL `GENERATED ALWAYS AS` column.
4. **Soft deletes** — products/staff set `is_active=false`, never hard-deleted.
5. **Permissive RLS** — current MVP uses anon access. Needs tightening for production.
6. **Currency toggle** — live COP/USD exchange rate from exchangerate-api, 1-hour cache, hardcoded fallback.

---

## Development Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
```

**Environment Variables Required:**
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

---

## Git & Workflow

- **Remote:** `git@github.com:pue-llo/porkys-inventory-tracker-v2.git` (SSH)
- **Default branch:** `main`
- **Commit style:** Descriptive, prefixed by scope (e.g., `feat: ...`, `fix: ...`, `refactor: ...`)
- **All commits** must include: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## Agent Team

This project is built by a coordinated team of Claude Code agents. Each agent has a defined role, scope, and set of responsibilities. **No agent should work outside its lane without coordination.**

### 1. FRONT-END AGENT (`frontend`)

**Scope:** Everything the user sees and interacts with.

**Owns:**
- `src/app/` — all views (page.tsx, foh-view, boh-view, admin-view, eod-view, analytics-view)
- `src/components/` — all UI components
- `src/hooks/` — custom React hooks
- `globals.css`, `tailwind.config.ts`
- `public/` — PWA assets, manifest, icons

**Responsibilities:**
- Build and maintain all React components and views
- Implement responsive layouts and Tailwind styling
- Manage client-side hooks (realtime, currency, alerts)
- Handle PWA functionality (install prompts, offline detection)
- Ensure accessible, mobile-first UX
- Wire up Zustand store actions to UI interactions

**Rules:**
- Never modify database schema or migration files
- Never modify Supabase client config or store logic directly — request changes from the back-end agent
- Always use existing UI primitives from `src/components/ui/` before creating new ones
- Follow the existing Tailwind brand theme (blue primary, custom animations)
- Use the `@/*` path alias for all imports

---

### 2. BACK-END AGENT (`backend`)

**Scope:** Data layer, business logic, and server-side concerns.

**Owns:**
- `src/stores/` — all Zustand stores (auth, inventory, table, boh)
- `src/lib/` — Supabase client, constants, utilities
- `src/types/` — TypeScript interfaces
- `supabase/` — database schema & migrations
- `next.config.mjs`, `tsconfig.json`, `package.json`

**Responsibilities:**
- Design and evolve the database schema (migrations)
- Implement and maintain Zustand store logic (state, actions, computed values)
- Manage Supabase queries, realtime subscriptions, and storage operations
- Define and maintain TypeScript types/interfaces
- Handle business logic (inventory calculations, EOD aggregation, profit formulas)
- Manage dependencies and project configuration

**Rules:**
- Never modify React components or views directly — provide store APIs for the front-end agent to consume
- All database changes must be reflected in `supabase/migration.sql`
- All new data shapes must have corresponding types in `src/types/index.ts`
- Maintain backward compatibility when changing store interfaces
- Document any new store actions or computed properties

---

### 3. DEBUG AGENT (`debug`)

**Scope:** Quality assurance, bug investigation, and issue resolution.

**Owns:**
- No files exclusively — has read access to everything
- Temporary debugging branches/patches

**Responsibilities:**
- Investigate and diagnose reported bugs across the full stack
- Trace data flow from UI → store → Supabase and back
- Identify race conditions, stale state, and realtime sync issues
- Verify fixes don't introduce regressions
- Review agent PRs for correctness and edge cases
- Audit security concerns (especially around permissive RLS, PIN handling)
- Performance profiling (unnecessary re-renders, heavy queries)

**Rules:**
- Always identify root cause before proposing a fix
- Fixes should be minimal and targeted — no drive-by refactors
- Coordinate with the owning agent (frontend/backend) before applying patches to their files
- Document findings: what broke, why, and how it was fixed
- Flag any security issues immediately

---

## Agent Coordination Protocol

1. **Single source of truth:** This CLAUDE.md file. All agents must read it before starting work.
2. **Ownership boundaries:** Respect the file ownership listed above. If you need a change in another agent's territory, describe what you need and let that agent implement it.
3. **Branching:** Each agent works on a feature branch (`feat/<agent>/<description>`) and opens a PR to `main`.
4. **Conflicts:** If two agents need to modify the same file, the debug agent mediates.
5. **Communication:** Agents communicate through commit messages, PR descriptions, and updates to this file's "Current Sprint" section below.

---

## Current Sprint

> Update this section as work progresses. Each agent logs their current task.

| Agent | Status | Current Task |
|---|---|---|
| `frontend` | idle | — |
| `backend` | idle | — |
| `debug` | idle | — |

---

## Backlog / Future Enhancements

- [ ] Tighten Supabase RLS policies (replace permissive anon access)
- [ ] PDF invoice/receipt generation
- [ ] Push notifications for restock alerts
- [ ] Historical inventory trending charts
- [ ] Supplier management module
- [ ] Loyalty/rewards system
- [ ] Mobile-specific UX refinements
- [ ] Test suite (unit + integration)
- [ ] CI/CD pipeline setup
