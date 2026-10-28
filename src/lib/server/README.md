# Hono API

The API is implemented in `src/lib/server/` and mounted by the catch-all
Next.js Route Handler at `src/app/api/[[...route]]/route.ts`. API URLs keep
the `/api` prefix, for example `/api/v1/me` and `/api/auth/session`.

## Layout

- `app.ts` assembles middleware and mounts the API modules.
- `modules/` contains route handlers and domain-specific services.
- `middleware/` contains authentication and role checks.
- `lib/` contains shared request, response, database, and storage helpers.
- `scripts/` contains database checks and maintenance commands.

Shared business rules used by both the API and database seed scripts live in
`src/lib/domain/`. Prisma schema, migrations, and seed code remain under
`prisma/`.

## Configuration

Set these variables in the root `.env` file or deployment environment:

- `DATABASE_URL` — PostgreSQL connection string.
- `AUTH_SECRET` — secret used to sign and encrypt authentication tokens.
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` — required for Google sign-in.

`CORS_ORIGINS` is an optional comma-separated list for browser clients hosted
on a different origin. The default permits the local mobile web development
origin only. Configure the production origin explicitly.

## Commands

- `pnpm typecheck` checks application, API, and seed TypeScript.
- `pnpm lint` runs ESLint.
- `pnpm build` generates Prisma Client and builds the Next.js app.
- `pnpm server:cek-closing` and `pnpm server:cek-siklus` run read-only checks.
- `pnpm server:backfill-golongan`, `pnpm server:backfill-jam-catat`,
  `pnpm server:generate-urut-catat`, and
  `pnpm server:perbaiki-jenis-pemutusan` preview their proposed changes by
  default; pass `--terapkan` only when you intend to write to the database.

Some maintenance scripts also need their source CSV files under
`prisma/data/`. That directory is intentionally excluded from Git because it
contains customer data; copy authorized source files into the local project
when running those scripts.
