# RepUp Gym

**Manage your gym. Grow your members.**

RepUp Gym is a multi-tenant gym management SaaS MVP for independent gyms and
multi-branch fitness businesses. Each organization (owner) is a fully
isolated tenant — data never crosses between gyms.

```
Organization → Gym → Branch
```

## Tech stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Charts:** Recharts

## Getting started

### 1. Create a Supabase project

Create a new project at [supabase.com](https://supabase.com), then copy your
project URL and anon key into `.env.local`:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. Run database migrations

Apply the SQL files in `supabase/migrations/` **in order**, either via the
Supabase SQL editor or the Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Migrations:

| File | Purpose |
|---|---|
| `0001_schema.sql` | Core tables, enums, indexes, constraints |
| `0002_rls.sql` | Row Level Security — tenant isolation |
| `0003_functions.sql` | `pos_checkout`, `perform_check_in`, invoice numbers |
| `0004_onboarding.sql` | Atomic org/gym/branch creation RPC |
| `0005_auth_trigger.sql` | Auto-create `profiles` row on signup |

### 3. Install & run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, register an account, and walk through
onboarding (Business → Gym → Branch → Membership Plan → Dashboard).

## Multi-tenant security model

Tenant isolation is enforced **in the database**, not just the frontend:

- `has_branch_access(branch_id)` — true if the user is an org-wide role
  (owner/admin) for that branch's organization, or explicitly assigned via
  `branch_users`.
- `is_org_wide(org_id)` — true for `owner`/`admin` roles; grants access to
  every branch under that organization.
- Every tenant-scoped table (`members`, `memberships`, `check_ins`,
  `transactions`, `equipment`, `classes`, …) has RLS policies built on these
  helpers, so a query for another organization's data returns zero rows
  regardless of what the frontend requests.

## Core end-to-end flow (implemented)

```
Register -> Onboarding (Org/Gym/Branch/Plan) -> Dashboard
  -> Add Member -> POS sale of a membership plan -> pos_checkout() RPC
     (creates transaction + items + payment, auto-activates membership)
  -> Check-in -> perform_check_in() RPC
     (validates status -> branch access -> expiration -> visit limit -> duplicate window)
  -> Dashboard updates, transaction appears in Transactions & Reports
```

Both `pos_checkout` and `perform_check_in` are Postgres functions
(`SECURITY DEFINER`, called via `supabase.rpc(...)`) so the sensitive
business logic — payment recording, membership activation, check-in
validation — runs atomically on the server, never trusting the client.

## Modules included

- Auth (login/register/forgot/reset password) + guided onboarding
- Members (list, search, filter, detail with membership/payment/check-in history)
- Membership plans (create, branch access rules) + membership lifecycle
  (activate, freeze/unfreeze, extend, cancel)
- Check-in terminal with full validation flow and denial reasons
- POS (member or walk-in, cart, discount, payment method, auto invoice numbers)
- Transactions (list + detail, tenant/branch scoped)
- Branches, Staff (invite + roles), Trainers, Classes, Equipment
- Reports (revenue trend, member growth, check-in trend, membership status mix)
- Settings (organization & gym profile)

## Deliberately out of scope for this MVP

Per product scope: the RepUp consumer app, RepUp Trainer marketplace,
RepUp Marketplace, RepUp Pass, workout tracking/exercise library, AI
recommendations, and inter-gym payment settlement. The data model
(equipment categories, member `repup_account_id`, trainer records) is
shaped so these can be layered on later without a schema rewrite.

## Notes on types

`types/database.types.ts` is hand-authored to mirror the SQL schema (rather
than generated from a live Supabase project, since none exists in this
sandbox). Once you've run the migrations against a real project, regenerate
with:

```bash
supabase gen types typescript --project-id your-project-ref > types/database.types.ts
```
