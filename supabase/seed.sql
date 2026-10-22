-- OPTIONAL demonstration content. Every row is flagged is_demo = true; delete with:
--   delete from events where is_demo;   (cascades to teams, rounds, evaluations)
-- No fake users are created here (auth users must be created through Supabase Auth).
-- Scores below are entered by hand as sample data. They did NOT come from an AI model.
do $$
declare ev uuid := gen_random_uuid(); t uuid; names text[] := array['AgriLoop','PaniPure','CampusCart','NeuroNote','VoltVelo','ThriftTwist'];
  taglines text[] := array['Soil sensors for small farms','Community water filtration','Peer-to-peer campus resale','Lecture notes that study back','Battery-swap e-bikes','Upcycled fashion drops'];
  colors text[] := array['#3b82f6','#22c55e','#f59e0b','#a855f7','#ef4444','#14b8a6']; i int;
begin
  insert into events (id, title, description, venue, starts_at, status, invest_deadline, is_demo)
  values (ev, 'BloomBox Pitch Arena (sample)', 'Sample event with fictional startups.', 'KJSCE Seminar Hall, Mumbai', now() + interval '1 day', 'upcoming', now() + interval '2 days', true);
  insert into rounds (event_id, number, kind, name, criteria) values
    (ev, 1, 'ai', 'AI evaluation', '[{"key":"problem","label":"Problem clarity","max":10},{"key":"market","label":"Market size","max":10},{"key":"innovation","label":"Innovation","max":10},{"key":"feasibility","label":"Feasibility","max":10},{"key":"financials","label":"Financial logic","max":10}]'),
    (ev, 2, 'live', 'Live panel', '[{"key":"delivery","label":"Pitch delivery","max":10},{"key":"qa","label":"Q&A handling","max":10},{"key":"model","label":"Business model","max":10},{"key":"team","label":"Team strength","max":10},{"key":"demo","label":"Demo / traction","max":10}]'),
    (ev, 3, 'audience', 'Audience investment', '[]');
  for i in 1..6 loop
    insert into teams (event_id, name, tagline, initials, color, status, is_demo) values (ev, names[i], taglines[i], upper(left(names[i], 2)), colors[i], 'registered', true);
  end loop;
end $$;
