-- Server-authoritative operations. The browser never computes a balance and never writes ledger rows.
-- Same rules as src/lib/engine.ts (which powers the offline demo and the unit tests).

create or replace function assert_admin() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden: council admin only' using errcode = '42501'; end if;
end $$;

create or replace function log_audit(p_action text, p_subject text, p_detail text default '') returns void
language sql security definer set search_path = public as
$$ insert into audit_logs (actor_id, action, subject, detail) values (auth.uid(), p_action, p_subject, p_detail) $$;

-- Internal ledger writer. Row-locks the wallet, enforces balance >= 0, and is idempotent on (user_id, ref).
create or replace function post_entry(p_user uuid, p_kind entry_kind, p_amount int, p_ref text, p_event uuid, p_note text)
returns boolean language plpgsql security definer set search_path = public as $$
declare bal int; inserted int;
begin
  insert into wallet_accounts (user_id, balance) values (p_user, 0) on conflict do nothing;
  select balance into bal from wallet_accounts where user_id = p_user for update;
  if bal + p_amount < 0 then raise exception 'insufficient_funds: balance cannot go negative'; end if;
  insert into wallet_entries (user_id, event_id, kind, amount, balance_after, ref, note)
  values (p_user, p_event, p_kind, p_amount, bal + p_amount, p_ref, p_note)
  on conflict (user_id, ref) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return false; end if;
  update wallet_accounts set balance = bal + p_amount, updated_at = now() where user_id = p_user;
  return true;
end $$;
revoke all on function post_entry(uuid, entry_kind, int, text, uuid, text) from public, anon, authenticated;

-- New auth user => profile + one-time 1,000 BLC grant. Re-running is a no-op thanks to unique (user_id, ref).
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  perform post_entry(new.id, 'grant', 1000, 'grant:welcome', null, 'Welcome grant');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Explicit, idempotent initialiser for accounts created before the trigger existed.
create or replace function init_wallet() returns int language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  perform post_entry(auth.uid(), 'grant', 1000, 'grant:welcome', null, 'Welcome grant');
  return (select balance from wallet_accounts where user_id = auth.uid());
end $$;

create or replace function allocate_coins(p_event uuid, p_amounts jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); ev events%rowtype; bal int; old_total int; new_total int := 0; delta int; seq int; k text; v numeric;
begin
  if me is null then raise exception 'unauthenticated'; end if;
  select * into ev from events where id = p_event for share;
  if not found then raise exception 'unknown_event'; end if;
  if ev.status <> 'investing' then raise exception 'investing_closed: investing is not open'; end if;
  if now() >= ev.invest_deadline then raise exception 'deadline_passed: the investment deadline has passed'; end if;

  select balance into bal from wallet_accounts where user_id = me for update; -- serialises concurrent calls per user
  if bal is null then raise exception 'no_wallet'; end if;
  select coalesce(sum(amount), 0) into old_total from allocations where event_id = p_event and user_id = me;

  for k, v in select key, value::numeric from jsonb_each_text(p_amounts) loop
    if v <> trunc(v) or v < 0 then raise exception 'invalid_amount: whole, non-negative coins only'; end if;
    if not exists (select 1 from teams where id = k::uuid and event_id = p_event and status <> 'withdrawn') then
      raise exception 'unknown_team: team is not part of this event';
    end if;
    new_total := new_total + v::int;
  end loop;

  delta := new_total - old_total;
  if delta > bal then raise exception 'insufficient_funds: not enough coins'; end if;

  delete from allocations where event_id = p_event and user_id = me;
  insert into allocations (event_id, user_id, team_id, amount)
  select p_event, me, key::uuid, value::int from jsonb_each_text(p_amounts) where value::int > 0;

  if delta <> 0 then
    select count(*) into seq from wallet_entries where user_id = me and event_id = p_event and kind = 'invest';
    perform post_entry(me, 'invest', -delta, 'invest:' || p_event || ':' || seq, p_event,
      case when delta > 0 then 'Coins committed' else 'Coins released from allocation' end);
  end if;
end $$;

create or replace function open_investing(p_event uuid, p_deadline timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare ev events%rowtype;
begin
  perform assert_admin();
  select * into ev from events where id = p_event for update;
  if not found then raise exception 'unknown_event'; end if;
  if ev.status in ('settled', 'archived') then raise exception 'bad_state: event is finished'; end if;
  if p_deadline <= now() then raise exception 'deadline_passed: deadline must be in the future'; end if;
  update events set status = 'investing', invest_deadline = p_deadline, updated_at = now() where id = p_event;
  perform log_audit('investing.open', ev.title, 'deadline ' || p_deadline);
end $$;

create or replace function close_investing(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ev events%rowtype; u record; bal int; expired int := 0;
begin
  perform assert_admin();
  select * into ev from events where id = p_event for update;
  if not found then raise exception 'unknown_event'; end if;
  if ev.status <> 'investing' then raise exception 'bad_state: investing is not open'; end if;
  update events set status = 'locked', updated_at = now() where id = p_event;
  if coalesce((ev.settings ->> 'expireUnspent')::boolean, true) then
    for u in select a.user_id, a.balance from wallet_accounts a join profiles p on p.id = a.user_id where p.role = 'participant' and a.balance > 0 loop
      if post_entry(u.user_id, 'expire', -u.balance, 'expire:' || p_event, p_event, 'Unspent coins expired') then expired := expired + u.balance; end if;
    end loop;
  end if;
  perform log_audit('investing.close', ev.title, 'expired ' || expired || ' BLC');
end $$;

-- Provisional demo rule "prorata-pool": pool = all coins allocated in the event; backers of the winner split it
-- pro-rata (largest remainder, whole coins). No backers => refund every allocation. Replace this function to change the rule.
create or replace function settle_event(p_event uuid, p_winner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  ev events%rowtype; pool int; win_stake int; paid int := 0; refunded boolean; r record; left_over int; i int := 0; n int;
begin
  perform assert_admin();
  select * into ev from events where id = p_event for update; -- serialises settlement
  if not found then raise exception 'unknown_event'; end if;
  if ev.status = 'settled' or exists (select 1 from results where event_id = p_event) then raise exception 'already_settled'; end if;
  if ev.status <> 'locked' then raise exception 'bad_state: close investing before settling'; end if;
  if not exists (select 1 from teams where id = p_winner and event_id = p_event) then raise exception 'unknown_team'; end if;

  select coalesce(sum(amount), 0) into pool from allocations where event_id = p_event;
  select coalesce(sum(amount), 0) into win_stake from allocations where event_id = p_event and team_id = p_winner;
  refunded := win_stake = 0;

  if refunded then
    for r in select user_id, sum(amount)::int as amt from allocations where event_id = p_event group by user_id loop
      perform post_entry(r.user_id, 'refund', r.amt, 'settle:' || p_event, p_event, 'No backers of the winner: allocation refunded');
      paid := paid + r.amt;
    end loop;
  else
    create temp table _payout on commit drop as
      select user_id, sum(amount)::int as stake, floor(pool::numeric * sum(amount) / win_stake)::int as pay,
             (pool::numeric * sum(amount) / win_stake) - floor(pool::numeric * sum(amount) / win_stake) as frac
      from allocations where event_id = p_event and team_id = p_winner group by user_id;
    select pool - sum(pay) into left_over from _payout;
    select count(*) into n from _payout;
    for r in select user_id from _payout order by frac desc, user_id loop
      exit when i >= left_over;
      update _payout set pay = pay + 1 where user_id = r.user_id; i := i + 1;
    end loop;
    for r in select user_id, pay from _payout loop
      perform post_entry(r.user_id, 'payout', r.pay, 'settle:' || p_event, p_event, 'Share of the winners'' pool');
      paid := paid + r.pay;
    end loop;
  end if;

  update events set status = 'settled', winner_team_id = p_winner, updated_at = now() where id = p_event;
  insert into results (event_id, winner_team_id, pool, paid_out, refunded, confirmed_by) values (p_event, p_winner, pool, paid, refunded, auth.uid());
  perform log_audit('event.settle', ev.title, 'winner ' || p_winner || ', pool ' || pool || ', ' || case when refunded then 'refunded ' else 'paid ' end || paid);
end $$;

create or replace function admin_set_role(p_user uuid, p_role app_role) returns void
language plpgsql security definer set search_path = public as $$
declare old app_role; nm text;
begin
  perform assert_admin();
  if p_user = auth.uid() then raise exception 'forbidden: you cannot change your own role'; end if;
  select role, name into old, nm from profiles where id = p_user for update;
  if not found then raise exception 'not_found'; end if;
  update profiles set role = p_role where id = p_user;
  perform log_audit('role.change', nm, old || ' -> ' || p_role);
end $$;

create or replace function archive_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  update events set status = 'archived', updated_at = now() where id = p_event;
  perform log_audit('event.archive', p_event::text);
end $$;

-- Score entry. 'manual'/'import' (AI-round and bulk entry) are admin-only; 'live' is for judges and admins.
create or replace function submit_evaluation(p_event uuid, p_team uuid, p_round int, p_scores jsonb, p_note text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
declare rd rounds%rowtype; ev events%rowtype; c jsonb; got numeric; total_max numeric := 0; total_got numeric := 0; jid uuid;
begin
  if not is_staff() then raise exception 'forbidden: judges and admins only' using errcode = '42501'; end if;
  if p_source <> 'live' and not is_admin() then raise exception 'forbidden: only admins enter AI-round scores' using errcode = '42501'; end if;
  select * into ev from events where id = p_event;
  if not found or ev.status = 'settled' then raise exception 'bad_state: scores are locked; use correct_evaluation'; end if;
  if not exists (select 1 from teams where id = p_team and event_id = p_event) then raise exception 'unknown_team'; end if;
  select * into rd from rounds where event_id = p_event and number = p_round;
  if not found then raise exception 'not_found: round'; end if;

  for c in select * from jsonb_array_elements(rd.criteria) loop
    got := (p_scores ->> (c ->> 'key'))::numeric;
    if got is null or got < 0 or got > (c ->> 'max')::numeric then raise exception 'invalid_score: % must be 0-%', c ->> 'label', c ->> 'max'; end if;
    total_max := total_max + (c ->> 'max')::numeric; total_got := total_got + got;
  end loop;
  if total_max = 0 then raise exception 'invalid_score: round has no criteria'; end if;

  jid := case when p_round = 2 then auth.uid() else null end;
  insert into evaluations (event_id, team_id, round_number, judge_id, source, scores, total, note)
  values (p_event, p_team, p_round, jid, p_source, p_scores, round(total_got / total_max * 100, 1), coalesce(p_note, ''))
  on conflict (team_id, round_number, coalesce(judge_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set scores = excluded.scores, total = excluded.total, note = excluded.note, source = excluded.source, is_demo = false, updated_at = now();
  perform log_audit('score.submit', p_team::text, 'R' || p_round || ' ' || round(total_got / total_max * 100, 1));
end $$;

create or replace function correct_evaluation(p_eval uuid, p_scores jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare e evaluations%rowtype; rd rounds%rowtype; c jsonb; got numeric; tm numeric := 0; tg numeric := 0;
begin
  perform assert_admin();
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select * into e from evaluations where id = p_eval for update;
  if not found then raise exception 'not_found'; end if;
  select * into rd from rounds where event_id = e.event_id and number = e.round_number;
  for c in select * from jsonb_array_elements(rd.criteria) loop
    got := (p_scores ->> (c ->> 'key'))::numeric;
    if got is null or got < 0 or got > (c ->> 'max')::numeric then raise exception 'invalid_score'; end if;
    tm := tm + (c ->> 'max')::numeric; tg := tg + got;
  end loop;
  update evaluations set scores = p_scores, total = round(tg / tm * 100, 1), updated_at = now() where id = p_eval;
  perform log_audit('score.correct', e.team_id::text, e.total || ' -> ' || round(tg / tm * 100, 1) || ': ' || p_reason);
end $$;

-- Read helpers (aggregates only; no other user's allocations or balances are exposed).
create or replace function team_stakes() returns table (event_id uuid, team_id uuid, total bigint, backers bigint)
language sql stable security definer set search_path = public as $$
  select t.event_id, t.id, coalesce(sum(a.amount), 0), count(distinct a.user_id)
  from teams t join events e on e.id = t.event_id and (e.status <> 'draft' or is_staff())
  left join allocations a on a.team_id = t.id group by t.event_id, t.id
$$;

create or replace function leaderboard() returns table (event_id uuid, user_id uuid, name text, total bigint, net bigint)
language sql stable security definer set search_path = public as $$
  with open_commit as (
    select a.user_id, sum(a.amount) amt from allocations a join events e on e.id = a.event_id and e.status <> 'settled' group by a.user_id
  )
  select null::uuid, p.id, p.name, coalesce(w.balance, 0) + coalesce(o.amt, 0), coalesce(w.balance, 0) + coalesce(o.amt, 0) - 1000
  from profiles p left join wallet_accounts w on w.user_id = p.id left join open_commit o on o.user_id = p.id where p.role = 'participant'
  union all
  select l.event_id, p.id, p.name, coalesce((select sum(amount) from allocations a where a.event_id = l.event_id and a.user_id = p.id), 0), sum(l.amount)
  from wallet_entries l join profiles p on p.id = l.user_id where l.event_id is not null and l.kind <> 'expire' and p.role = 'participant'
  group by l.event_id, p.id, p.name
$$;

revoke all on function allocate_coins(uuid, jsonb), open_investing(uuid, timestamptz), close_investing(uuid), settle_event(uuid, uuid),
  admin_set_role(uuid, app_role), archive_event(uuid), submit_evaluation(uuid, uuid, int, jsonb, text, text), correct_evaluation(uuid, jsonb, text),
  init_wallet(), team_stakes(), leaderboard(), log_audit(text, text, text), assert_admin() from public, anon;
grant execute on function allocate_coins(uuid, jsonb), open_investing(uuid, timestamptz), close_investing(uuid), settle_event(uuid, uuid),
  admin_set_role(uuid, app_role), archive_event(uuid), submit_evaluation(uuid, uuid, int, jsonb, text, text), correct_evaluation(uuid, jsonb, text),
  init_wallet(), team_stakes(), leaderboard() to authenticated;
