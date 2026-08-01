# Database Tracking

This project tracks Supabase database changes in two ways:

1. Snapshots (full schema + roles)
2. Supabase migrations (when CLI project is linked)

## Prerequisites

- Supabase CLI installed
- `SUPABASE_DB_URL` set in your shell

Example (PowerShell):

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres:<password>@<host>:5432/postgres"
```

## Export snapshots

Run:

```powershell
npm run db:snapshot
```

This generates:

- `database/snapshots/schema-YYYYMMDD-HHMMSS.sql`
- `database/snapshots/roles-YYYYMMDD-HHMMSS.sql`
- `database/schema.latest.sql`
- `database/roles.latest.sql`

## Migration pull (optional but recommended)

If you initialized and linked Supabase CLI (`supabase init` + `supabase link`), the snapshot script also runs:

```bash
supabase db pull
```

This creates timestamped migration files under `supabase/migrations/`.

## Recommended workflow

1. Make DB changes in Supabase.
2. Run `npm run db:snapshot`.
3. Review diffs in `database/` and `supabase/migrations/`.
4. Commit all generated SQL files together with app code changes.

## DigiLab synchronization

The integration state is defined by:

```text
database/migrations/20260731000000_create_tournament_digilab_sync.sql
```

This migration must be applied before the verification Edge Function starts persisting matches. It does not store the DigiLab API key; that credential belongs to **Edge Functions → Secrets** as `DIGILAB_API_KEY`.

After applying it, verify that:

- `public.tournament_digilab_sync` exists;
- RLS is enabled;
- `service_role` can insert and update rows;
- `anon` and `authenticated` cannot write;
- public clients can select only the six status/link columns granted by the migration.

Operational details are documented in `docs/features/digilab-integration.md`.

## Admin authentication

The DigiStats Admin allowlist is defined by:

```text
database/migrations/20260731010000_create_admin_users.sql
```

Before running it, create and confirm these users under **Supabase → Authentication → Users**:

```text
braga@admin.digistats.local
fujisawa@admin.digistats.local
fonseca@admin.digistats.local
fortes@admin.digistats.local
lopes@admin.digistats.local
```

The migration finds those identities in `auth.users` and adds them idempotently to `public.admin_users`. It never creates or stores passwords. If an Auth user is created after the migration, rerun only the migration's final `insert into public.admin_users ...` statement.

Authenticated users can read only their own membership row. The service role validates the same allowlist inside the DigiLab Edge Functions; anonymous users cannot read or write it.

Additional DigiLab/Admin migrations:

- `20260731020000_create_digilab_player_sync_and_import.sql`: persistent player mapping and transactional reverse import.
- `20260731030000_allow_admin_store_writes.sql`: allows only authenticated allowlisted admins to create, rename and delete stores.
- `20260731040000_add_digilab_deck_sync.sql`: persistent deck mapping and idempotent backfill of decks and points for an existing DigiLab link.
- `20260731050000_create_deck_families_and_digilab_catalog.sql`: two-level family/archetype model, mirrored DigiLab catalog and family statistics view.
