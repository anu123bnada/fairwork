# ORYQEN maintenance without paid AI tools

Needs only VS Code, Git, Node (`^22.13`, `^24`, or `>=26`), Docker Desktop (optional, local Supabase), and free tooling.

## Setup
```bash
npm ci
cp .env.example .env.local     # fill names listed in ORYQEN_DEPLOYMENT.md
npm run dev
```
Local database stack: `node scripts/run-local-development.mjs` (see `ORYQEN_LOCAL_DEVELOPMENT.md`). Migrations: `scripts/apply-local-migrations.mjs`.

## Routine
- Before any change: `npx tsc --noEmit && npm run lint`, then the targeted test file with `npx vitest run <file>`.
- Full `npx vitest run` takes about 14 minutes; run it before releases.
- New DB changes go in a new timestamped file in `supabase/migrations`; never edit an applied one.
- `AGENTS.md`: this Next.js version differs from older ones; read `node_modules/next/dist/docs/` first.

## Recovery
- Nothing is lost by branch switching: worktrees `fairwork-offer`, `-qa`, `-release`, `-ui` and tags `fairwork-architecture-v1.0.0`, `oryqen-preview-v0.1.0` preserve earlier work.
- DB backups: `scripts/backup-staging-logical.mjs`, restore steps in `ORYQEN_BACKUP_RESTORE_EXECUTION.md`.

## Known limitations
See `ORYQEN_KNOWN_LIMITATIONS.md` and `ORYQEN_22_MODULE_ACCEPTANCE.md`.
