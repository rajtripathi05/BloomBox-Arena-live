-- Row Level Security. Clients get SELECT on what they may see; every coin/state change goes through
-- SECURITY DEFINER functions in 0003. Roles live in profiles.role and can only change via admin_set_role().

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'judge')) $$;

alter table profiles enable row level security;
alter table events enable row level security;
alter table teams enable row level security;
alter table rounds enable row level security;
alter table evaluations enable row level security;
alter table wallet_accounts enable row level security;
alter table wallet_entries enable row level security;
alter table allocations enable row level security;
alter table results enable row level security;
alter table audit_logs enable row level security;

-- Start from nothing, then grant narrowly.
revoke all on all tables in schema public from anon, authenticated;
grant select on profiles, events, teams, rounds, evaluations, wallet_accounts, wallet_entries, allocations, results, audit_logs to authenticated;
grant select on events, teams, rounds, results to anon; -- public landing page; RLS still limits to non-draft
grant update (name) on profiles to authenticated;           -- role/email are NOT updatable by clients
grant insert on events, teams to authenticated;
grant update (title, description, venue, starts_at, settings) on events to authenticated; -- status/deadline/winner via RPC only
grant update (name, tagline, description, initials, color, logo_url, pitch_title, pitch_slot, stage, status) on teams to authenticated;
grant delete on teams to authenticated;
grant update (name, score_visible, criteria, status) on rounds to authenticated;

create policy profiles_self_read on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy profiles_self_name on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy events_read on events for select to anon, authenticated using (status <> 'draft' or is_staff());
create policy events_insert on events for insert to authenticated with check (is_admin() and status = 'draft');
create policy events_update on events for update to authenticated using (is_admin()) with check (is_admin());

create policy teams_read on teams for select to anon, authenticated
  using (exists (select 1 from events e where e.id = event_id and (e.status <> 'draft' or is_staff())));
create policy teams_write on teams for insert to authenticated with check (is_admin());
create policy teams_update on teams for update to authenticated using (is_admin()) with check (is_admin());
create policy teams_delete on teams for delete to authenticated using (is_admin());

create policy rounds_read on rounds for select to anon, authenticated
  using (exists (select 1 from events e where e.id = event_id and (e.status <> 'draft' or is_staff())));
create policy rounds_update on rounds for update to authenticated using (is_admin()) with check (is_admin());

-- Scores are visible to staff always, to everyone else only once the round's score_visible flag is on.
create policy evaluations_read on evaluations for select to authenticated using (
  is_staff() or exists (select 1 from rounds r where r.event_id = evaluations.event_id and r.number = evaluations.round_number and r.score_visible)
);

create policy wallet_accounts_read on wallet_accounts for select to authenticated using (user_id = auth.uid());
create policy wallet_entries_read on wallet_entries for select to authenticated using (user_id = auth.uid() or is_admin());
create policy allocations_read on allocations for select to authenticated using (user_id = auth.uid());
create policy results_read on results for select to anon, authenticated
  using (exists (select 1 from events e where e.id = event_id and e.status <> 'draft'));
create policy audit_read on audit_logs for select to authenticated using (is_admin());

-- Freeze team edits once investing has closed, and audit admin table edits.
create or replace function guard_team_change() returns trigger language plpgsql security definer set search_path = public as $$
declare st event_status;
begin
  select status into st from events where id = coalesce(new.event_id, old.event_id);
  if st in ('locked', 'settled') then raise exception 'teams_frozen: teams cannot change after investing closes'; end if;
  return coalesce(new, old);
end $$;
create trigger teams_guard before insert or update or delete on teams for each row execute function guard_team_change();

create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (actor_id, action, subject, detail)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), coalesce(to_jsonb(new) ->> 'name', to_jsonb(new) ->> 'title', to_jsonb(old) ->> 'name', to_jsonb(old) ->> 'title', ''), '');
  return coalesce(new, old);
end $$;
create trigger events_audit after insert or update on events for each row execute function audit_row();
create trigger teams_audit after insert or update or delete on teams for each row execute function audit_row();
create trigger rounds_audit after update on rounds for each row execute function audit_row();

-- Realtime only publishes rows the subscriber can SELECT under RLS; the client treats it as a hint to refetch.
alter publication supabase_realtime add table events, teams, rounds, evaluations, results, allocations, wallet_entries;

-- Team logos: public read, admin write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-logos', 'team-logos', true, 524288, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;
create policy team_logos_read on storage.objects for select using (bucket_id = 'team-logos');
create policy team_logos_admin_write on storage.objects for insert to authenticated with check (bucket_id = 'team-logos' and is_admin());
create policy team_logos_admin_update on storage.objects for update to authenticated using (bucket_id = 'team-logos' and is_admin());
create policy team_logos_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'team-logos' and is_admin());
