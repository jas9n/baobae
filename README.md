# Baobae

Baobae is a mobile-first live voting app for a bachelor-style event. Audience members sign in with Google and get one vote per round, while production runs the event from a separate admin dashboard that can open elimination or revival phases, choose who appears on the ballot, and watch live totals update.

## Stack

- Next.js App Router
- React 19
- Supabase Auth + Postgres
- Custom CSS for a Pop-Mart-inspired mobile UI

## What is included

- `/` audience voting experience
- `/admin` production dashboard
- Google OAuth viewer flow
- One-vote-per-user-per-phase enforcement
- Admin controls for:
  - closed, elimination, and revival states
  - per-contestant ballot visibility
  - per-contestant eliminated status
  - live vote totals
  - round reset
- Supabase SQL schema and seed data

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BAOBAE_ADMIN_PASSWORD`
- `BAOBAE_ADMIN_EMAILS`
- `BAOBAE_COOKIE_SECRET`

## Supabase setup

1. Create a Supabase project.
2. Enable Google Auth in Supabase Auth and add your local/dev callback URLs.
3. Run [`supabase/schema.sql`](/Users/Jason/Documents/baobae/supabase/schema.sql).
4. Run [`supabase/seed.sql`](/Users/Jason/Documents/baobae/supabase/seed.sql).
5. Add contestant headshots later by filling `avatar_url` values in the `contestants` table.

## Local development

```bash
npm install
npm run dev
```

Then open:

- Audience view: [http://localhost:3000](http://localhost:3000)
- Admin view: [http://localhost:3000/admin](http://localhost:3000/admin)

## Data model

- `app_state`: single live record for the current phase and round
- `contestants`: roster, display order, eliminated state, and whether someone is on the active ballot
- `votes`: one row per viewer vote
- `vote_totals`: aggregate view used by the admin dashboard

The `votes` table uses a unique constraint on `(phase_number, mode, voter_id)` so one Google account cannot vote twice in the same active phase.

## Notes

- The admin dashboard accepts either an allowlisted Google account or the master password.
- The round reset does not delete historical vote rows. Instead, it increments `phase_number`, which cleanly starts a fresh round while preserving past data.
- Live results are fetched continuously by the dashboard so production can monitor the vote as it happens.
