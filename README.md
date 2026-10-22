# BloomBox Pitch Arena

Mobile-first PWA for BloomBox, the E-Cell of K. J. Somaiya College of Engineering. A **virtual prediction game**: BloomBox Coins (BLC) have no cash value and cannot be bought, withdrawn or transferred.

Stack: React 19, TypeScript, Vite, Tailwind v4 (shadcn-style components using cva/Radix Slot), React Router, Supabase (Auth, Postgres, RLS, Realtime, Storage), vite-plugin-pwa, Motion, React Three Fiber + Drei (lazy, optional).

## Run locally (demo mode, no credentials)

```
npm install
npm run dev
```

With no `.env`, the app runs in clearly labelled **DEMO MODE** with fictional data in localStorage. On `/auth` use "Continue as participant / judge / council admin". "Reset demo data" is on the Profile page.

### Modes
- **Interactive demo** (`/demo`, "Try Interactive Demo" on the home page): a timed, scripted fictional event (2, 3 or 4 minutes) with participant, judge or council view. Engine: `src/demo/script.ts` (deterministic, pure). It never imports `src/services`, never calls Supabase or an AI provider, and keeps all state in memory; `tests/demo.test.ts` enforces this.
- **Demo sandbox** (no `.env`): the existing local sandbox, labelled `DEMO PREVIEW`. "Enter Arena" explains that connected mode is unavailable instead of pretending to connect.
- **Connected** (`.env` set): labelled `LIVE / SUPABASE`, or `SUPABASE UNREACHABLE` on a load error. It never falls back to demo data.

## Commands

| | |
|---|---|
| `npm run dev` | dev server |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm test` | vitest (wallet grant, allocation, deadline, settlement) |
| `npm run e2e` | Playwright smoke tests (mobile + desktop; builds and previews) |
| `npm run build` | production build + service worker |
| `npm run icons` | regenerate PWA icons from the BloomBox logo |

## Supabase setup (production mode)

1. Create a Supabase project. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable key only; never the service-role key).
2. Apply `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql` in order (SQL editor, or `supabase db push`). 0002 also creates the public `team-logos` storage bucket with admin-only writes and adds tables to the realtime publication.
3. Optional: run `supabase/seed.sql` for a sample event (all rows flagged `is_demo`).
4. Auth: enable email sign-in. Decide whether to require email confirmation (the app handles both).
5. **First admin**: register normally in the app, then in the SQL editor (service context) run
   `update profiles set role = 'admin' where email = 'you@example.com';`
   After that, admins promote judges and others from **Admin → People**, which calls the audited `admin_set_role` function. Clients cannot write `profiles.role` (column grants + RLS).
6. When `VITE_SUPABASE_*` are set the app never falls back to demo data.

## Security model

- Coins move only through `SECURITY DEFINER` functions (`allocate_coins`, `close_investing`, `settle_event`, ...). Clients have SELECT on their own wallet rows and nothing else on money tables.
- Wallet: `unique (user_id, ref)` makes the 1,000 BLC welcome grant and per-event payouts idempotent; balances cannot go negative; per-user row lock serialises concurrent allocations; deadline uses the database clock.
- Scores: visible to participants only when a round's `score_visible` is on. AI-round entry is admin-only. Corrections require a reason and are audited.
- Realtime is only a hint to refetch; RLS still decides what is returned.

## Settlement rule (provisional demo rule)

Pool = all BLC allocated in the event. Backers of the council-confirmed winner split it pro-rata (whole coins, largest-remainder). If nobody backed the winner, every allocation is refunded. Runs once per event. Implemented in `settle_event` (SQL) and `src/lib/engine.ts` (demo/tests); change the rule by replacing those.

## AI round

No AI provider is connected. Admins enter scores or import CSV (`team,criterion,...`); they are stored as `manual`/`import` and never presented as AI output. `src/services/aiProvider.ts` is the boundary for a future server-side integration.

## PWA

`npm run build && npm run preview`, open in Chrome and use "Install App" on the home page, sidebar or Profile. It uses `beforeinstallprompt` when the browser offers it and shows platform instructions otherwise (iOS: Share → Add to Home Screen). There is no APK. Updates show an in-app "Update" prompt. Only the app shell is cached; Supabase requests are never cached, and coin changes are disabled offline.

## Deploy (Vercel or Netlify)

Build command `npm run build`, output `dist`, set the two `VITE_SUPABASE_*` env vars, and add an SPA rewrite to `/index.html` (Netlify: `/* /index.html 200`; Vercel: rewrite `/(.*)` to `/`). Add the deployed URL to Supabase Auth redirect URLs.

## Branding

Original logos are preserved in the project root and copied to `public/brand/`. Reference repos (shadcn/ui, vite-plugin-pwa, react-three-fiber, drei, and Supabase's react-user-management example) were cloned shallowly to `../bloombox-reference-repos` for reference only; no source was copied.
