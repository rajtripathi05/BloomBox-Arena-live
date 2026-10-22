# Project status

## Done
- Participant app: landing, auth, home, events, event/team detail, 3-round view, investing (edit until deadline, confirm), wallet + ledger, leaderboards, results/winner reveal, projector display mode.
- Admin/judge console: events, teams + logo upload, rounds/criteria/visibility, manual + CSV score entry, live judge scoring, score corrections, open/close investing, settlement, roles, ledger + audit.
- Rules engine (`src/lib/engine.ts`) with unit tests; demo backend with seeded fictional data.
- Supabase schema, RLS, RPCs, storage bucket, optional seed.
- PWA manifest, icons, service worker, update prompt, offline guard on coin mutations; lazy 3D with 2D fallback.
- Premium home page (Enter Arena / Try Interactive Demo / Install App, mode badge, simulated live preview, feature tour), 3D arena scene with 2D fallback.
- Timed interactive demo at `/demo` (2/3/4 min, 9 steps, pause/seek/restart/exit, role views), isolated from services.
- PWA install button with native prompt + platform fallbacks.
- Vitest (19 passing) and Playwright (34 passing, mobile + desktop) against demo mode, including timed demo completion (fake clock), install states and offline route load.

## Outstanding (needs real setup)
- Supabase path is **untested against a live project**: SQL was not executed (no Postgres/credentials here) and `supabaseApi.ts` has not been exercised. Run the migrations and smoke-test before relying on it.
- First admin must be promoted manually (see README).
- No real AI provider (by design). Settlement rule is provisional; council should confirm it.
- No automatic deadline lock job: investing is rejected after the deadline by the server, but `close_investing` (expiry of unspent coins) is run by an admin. Optionally schedule with pg_cron.
- No deployment performed.
