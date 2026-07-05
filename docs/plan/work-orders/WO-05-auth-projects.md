# WO-05 — Auth + projects (with a no-account local mode)

**Phase 1 · depends on WO-03, WO-04 · branch `wo/05-auth-projects`**

## Goal
Users can sign in, group jobs into projects, and only see their own work — while the fully-local, no-Supabase setup keeps working with zero login.

## Why
Prerequisite for billing (WO-14), characters (WO-09), and teams later. The "local mode needs no account" rule is part of the trust positioning (your machine, your files, no signup wall).

## Read first
- `src/store/` (in-memory vs Supabase/pg stores), `src/config.ts` (how Supabase is detected), `src/server.ts`, WO-04's `web/` app, Supabase docs for Auth (email magic link + OAuth).

## Spec
1. **Modes**: if Supabase env is absent → `localMode`: no auth, everything owned by implicit user `local`, UI hides account chrome. If present → Supabase Auth (email magic-link minimum; Google OAuth if trivial).
2. **Schema** (Supabase migration in `supabase/`): `projects (id, owner_id, name, created_at)`, `jobs.project_id` FK, RLS: owners only. Keep parity in the in-memory store.
3. **API**: Fastify plugin verifying the Supabase JWT (`Authorization: Bearer`); `POST/GET /projects`; `POST /pipeline` accepts `projectId`; all job reads scoped to owner. In localMode the plugin injects the `local` user.
4. **Web**: sign-in screen (skipped in localMode), project switcher in the header, jobs list per project.
5. Never trust client-sent user ids; owner always derives from the verified JWT.

## Acceptance
```bash
npm run check                       # green in localMode (CI has no Supabase)
npm run smoke:auth                  # NEW: localMode → routes work with implicit user;
                                    # with SUPABASE_* set (document manual run): unauth'd request → 401,
                                    # user A cannot read user B's job (paste both results)
```
Manual browser pass: magic-link login round-trip works; jobs created appear under the active project only.

## Out of scope
Teams/seat management, roles, billing linkage (WO-14), password auth.
