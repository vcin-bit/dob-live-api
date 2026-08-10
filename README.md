# DOBLive API

Node/Express API for the DOBLive security ops platform. Deployed on Render, backed by Supabase (Postgres) and Clerk auth.

## Database migrations

All schema changes must be written as a SQL file in `supabase/migrations/` and applied via the Supabase MCP tool or CLI using that file as the source. Do not apply DDL ad hoc through the Supabase dashboard, a query editor, or any other route that bypasses the migration record.

Filename format: `{version}_{name}.sql` where `version` is a 14-digit UTC timestamp (`YYYYMMDDHHmmss`).

The migration history in `supabase/migrations/` must stay in sync with `supabase_migrations.schema_migrations` in the database. There are currently 44 applied migrations, from `20260416191847_fix_migration_constraints` to `20260810133200_create_overheads_module`.

## Stack

- **API**: Node.js + Express, deployed on Render
- **Database**: Supabase (Postgres 17), project `bxesqjzkuredqzvepomn`
- **Auth**: Clerk
- **Frontend**: React + Vite in `app/` — see `app/README.md`

## Development

```bash
npm install
npm run dev
```

See `CLAUDE.md` for coding rules, test commands, and known issues.
