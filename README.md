# Inventory Tracker V2

Real-time bar inventory management built with Next.js, Supabase, and Zustand.

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USER/inventory-tracker-v2.git
cd inventory-tracker-v2
npm install
```

### 2. Create Supabase Project
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Name: `inventory-tracker-v2`
4. Region: closest to you (us-east-1 for Colombia)
5. Save your **Project URL** and **anon key** (Settings → API)

### 3. Run Database Migration
1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the entire contents of `supabase/migration.sql`
3. Paste and click **Run**

### 4. Create Storage Buckets
In Supabase dashboard → Storage:
1. Create bucket `staff-photos` (Public, 2MB limit)
2. Create bucket `product-images` (Public, 2MB limit)

### 5. Configure Environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials:
# NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 6. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 7. Deploy to Vercel
1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

## Architecture

```
src/
├── app/           → Next.js pages (page.tsx = main router)
├── components/    → Reusable UI components
├── stores/        → Zustand state management
├── hooks/         → Custom React hooks (realtime, currency)
├── lib/           → Utilities, Supabase client, constants
└── types/         → TypeScript type definitions
```

## Key Files
- `supabase/migration.sql` — Full database schema (11 tables + views)
- `src/stores/auth-store.ts` — PIN-based authentication
- `src/stores/inventory-store.ts` — Product CRUD + daily inventory
- `src/stores/table-store.ts` — Table management + orders
- `src/stores/boh-store.ts` — BOH cart + FOH handoff
- `src/hooks/use-realtime.ts` — Multi-device sync via Supabase Realtime

## Roles
- **Admin** → Full inventory CRUD, staff management, EOD reports with BOH disbursement data, analytics, waste tracking, Excel export
- **FOH** → Product ordering, table management, activity log, currency toggle (COP/USD)
- **BOH** → Cart-based disbursement to FOH staff (no stock visibility — only FOH affects inventory numbers)

## Features
- **PIN-based login** with role-based routing (Admin / FOH / BOH)
- **Real-time sync** across devices via Supabase Realtime
- **End-of-shift notes** — staff can leave messages for the owner from the login screen
- **BOH disbursement tracking** — BOH logs items handed to FOH; data flows into Admin EOD reports
- **EOD reports** — daily sales, waste, cash reconciliation, top sellers, staff performance, BOH disbursements (by product & by FOH staff)
- **Excel export** — full inventory, waste log, BOH disbursements, tables, and EOD summary sheets
- **PWA support** — installable on mobile with offline banner
- **Currency toggle** — COP/USD with live exchange rate
