-- BloomBox Pitch Arena: schema. Virtual coins only; no real-money concepts exist in this database.
create extension if not exists pgcrypto;

create type app_role as enum ('participant', 'judge', 'admin');
create type event_status as enum ('draft', 'upcoming', 'live', 'investing', 'locked', 'settled', 'archived');
create type entry_kind as enum ('grant', 'invest', 'refund', 'payout', 'expire', 'adjust');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  email text not null,
  role app_role not null default 'participant',
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  venue text not null default '',
  starts_at timestamptz not null,
  status event_status not null default 'draft',
  invest_deadline timestamptz not null,
  settings jsonb not null default '{"expireUnspent":true,"payoutRule":"prorata-pool","weights":{"r1":0.3,"r2":0.4,"r3":0.3}}',
  winner_team_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (invest_deadline >= starts_at)
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  tagline text not null default '',
  description text not null default '',
  initials text not null default '',
  color text not null default '#3b82f6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text,
  pitch_title text not null default '',
  pitch_slot timestamptz,
  stage text not null default '',
  status text not null default 'registered' check (status in ('registered', 'shortlisted', 'pitched', 'withdrawn')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);
alter table events add constraint events_winner_fk foreign key (winner_team_id) references teams (id) deferrable initially deferred;

create table rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  number smallint not null check (number between 1 and 3),
  kind text not null check (kind in ('ai', 'live', 'audience')),
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'complete')),
  score_visible boolean not null default false,
  criteria jsonb not null default '[]',
  unique (event_id, number)
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  round_number smallint not null check (round_number in (1, 2)),
  judge_id uuid references profiles (id),
  source text not null check (source in ('manual', 'import', 'live')),
  scores jsonb not null,
  total numeric(5, 1) not null check (total between 0 and 100),
  note text not null default '',
  is_demo boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index evaluations_one_per_judge
  on evaluations (team_id, round_number, coalesce(judge_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table wallet_accounts (
  user_id uuid primary key references profiles (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  event_id uuid references events (id),
  kind entry_kind not null,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  ref text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, ref) -- idempotency: one welcome grant, one payout per event, etc.
);
create index wallet_entries_user_idx on wallet_entries (user_id, created_at desc);

create table allocations (
  event_id uuid not null references events (id),
  user_id uuid not null references profiles (id),
  team_id uuid not null references teams (id) on delete restrict,
  amount integer not null check (amount > 0),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id, team_id)
);
create index allocations_team_idx on allocations (team_id);

create table results (
  event_id uuid primary key references events (id),
  winner_team_id uuid not null references teams (id),
  pool integer not null,
  paid_out integer not null,
  refunded boolean not null,
  confirmed_by uuid not null references profiles (id),
  settled_at timestamptz not null default now()
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  subject text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs (created_at desc);
create index teams_event_idx on teams (event_id);
create index evaluations_event_idx on evaluations (event_id);
