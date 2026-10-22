import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ClipboardList, Layers, ShieldCheck, Tv, Users } from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom'
import { BloomLogo, TeamLogo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Badge, Card, Empty, Field, Input, Select, Textarea } from '@/components/ui/card'
import { PageTitle, Spinner } from '@/components/widgets'
import { api } from '@/services'
import type { AdminSnapshot, Evaluation, PitchEvent, Role, Round, Team } from '@/lib/types'
import { cn, fmtDate, fmtNum } from '@/lib/utils'
import { statusLabel, teamRows } from '@/lib/select'
import { parseScoreCsv } from '@/services/aiProvider'
import { useApp } from '@/state/AppProvider'

const toLocal = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const fromLocal = (v: string) => new Date(v).toISOString()

function useAdminData() {
  const [data, setData] = useState<AdminSnapshot | null>(null)
  const { snap } = useApp()
  const reload = useCallback(() => { api.loadAdmin().then(setData).catch(() => setData(null)) }, [])
  useEffect(reload, [reload, snap])
  return data
}

export function AdminLayout() {
  const { isStaff, isAdmin, loading, session } = useApp()
  if (loading && session === undefined) return <Spinner />
  if (!isStaff) return <Navigate to="/app" replace />
  const tabs = [{ to: '/admin', end: true, label: 'Events', icon: Layers }, ...(isAdmin ? [{ to: '/admin/users', end: false, label: 'People', icon: Users }, { to: '/admin/ledger', end: false, label: 'Ledger & audit', icon: ClipboardList }] : [])]
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-16">
      <header className="safe-t flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3"><BloomLogo h={34} /><div><p className="font-display font-bold leading-tight">{isAdmin ? 'Council console' : 'Judge console'}</p><p className="text-xs text-mute">Permissions are enforced on the server</p></div></div>
        <Button asChild variant="ghost" size="sm"><Link to="/app">Exit</Link></Button>
      </header>
      <nav className="mb-5 flex gap-1 overflow-x-auto" aria-label="Admin">
        {tabs.map((t) => <NavLink key={t.label} to={t.to} end={t.end} className={({ isActive }) => cn('flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium text-mute', isActive && 'bg-bloom/15 text-white ring-1 ring-bloom/40')}><t.icon size={16} />{t.label}</NavLink>)}
      </nav>
      <Outlet />
    </div>
  )
}

export function AdminEvents() {
  const { snap, run, isAdmin } = useApp()
  const [open, setOpen] = useState(false)
  if (!snap) return <Spinner />
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const title = String(f.get('title')).trim()
    if (title.length < 3) return
    const id = await run(() => api.saveEvent({ title, venue: String(f.get('venue')), description: String(f.get('description')), startsAt: fromLocal(String(f.get('startsAt'))) }), 'Event created as draft')
    if (id) setOpen(false)
  }
  return (
    <div className="space-y-4">
      <PageTitle title="Events" right={isAdmin && <Button onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : 'New event'}</Button>} />
      {open && (
        <Card><form onSubmit={create} className="grid gap-3 md:grid-cols-2">
          <Field label="Title"><Input name="title" required minLength={3} /></Field>
          <Field label="Starts"><Input name="startsAt" type="datetime-local" required defaultValue={toLocal(new Date(Date.now() + 7 * 864e5).toISOString())} /></Field>
          <Field label="Venue"><Input name="venue" /></Field>
          <Field label="Description"><Input name="description" /></Field>
          <div className="md:col-span-2"><Button type="submit">Create draft event</Button></div>
        </form></Card>
      )}
      {snap.events.length === 0 ? <Empty title="No events" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {snap.events.map((e) => (
            <Link key={e.id} to={`/admin/events/${e.id}`}><Card className="transition hover:ring-bloom/60"><div className="flex justify-between gap-2"><h3 className="font-display font-bold">{e.title}</h3><Badge tone={e.status === 'investing' ? 'gold' : e.status === 'settled' ? 'green' : 'blue'}>{statusLabel[e.status]}</Badge></div><p className="mt-1 text-xs text-mute">{fmtDate(e.startsAt)} · {snap.teams.filter((t) => t.eventId === e.id).length} teams{e.isDemo && ' · demo'}</p></Card></Link>
          ))}
        </div>
      )}
    </div>
  )
}

type Tab = 'overview' | 'teams' | 'scores' | 'settle'

export function AdminEvent() {
  const { eventId } = useParams()
  const { snap, isAdmin } = useApp()
  const [tab, setTab] = useState<Tab>(isAdmin ? 'overview' : 'scores')
  if (!snap) return <Spinner />
  const ev = snap.events.find((e) => e.id === eventId)
  if (!ev) return <Empty title="Event not found" />
  const tabs: [Tab, string][] = isAdmin ? [['overview', 'Overview'], ['teams', 'Teams'], ['scores', 'Rounds & scores'], ['settle', 'Investing & settlement']] : [['scores', 'Live scoring']]
  return (
    <div className="space-y-4">
      <PageTitle title={ev.title} sub={`${fmtDate(ev.startsAt)} · ${ev.venue}`} right={<Badge tone={ev.status === 'investing' ? 'gold' : 'blue'}>{statusLabel[ev.status]}</Badge>} />
      <div role="tablist" className="flex gap-1 overflow-x-auto">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('min-h-10 shrink-0 rounded-xl px-3 text-sm font-medium', tab === k ? 'bg-bloom text-white' : 'bg-panel text-mute ring-1 ring-line')}>{l}</button>)}</div>
      {tab === 'overview' && <Overview ev={ev} />}
      {tab === 'teams' && <TeamsTab ev={ev} />}
      {tab === 'scores' && <ScoresTab ev={ev} />}
      {tab === 'settle' && <SettleTab ev={ev} />}
    </div>
  )
}

function Overview({ ev }: { ev: PitchEvent }) {
  const { snap, run } = useApp()
  const rows = teamRows(snap!, ev)
  const pool = rows.reduce((a, r) => a + r.stake, 0)
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await run(() => api.saveEvent({
      id: ev.id, title: String(f.get('title')), venue: String(f.get('venue')), description: String(f.get('description')), startsAt: fromLocal(String(f.get('startsAt'))),
      settings: { ...ev.settings, expireUnspent: f.get('expire') === 'on', weights: { r1: Number(f.get('w1')), r2: Number(f.get('w2')), r3: Number(f.get('w3')) } },
    }), 'Event saved')
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <Card><p className="num text-2xl font-bold">{rows.length}</p><p className="text-xs text-mute">teams</p></Card>
        <Card><p className="num text-2xl font-bold text-coin">{fmtNum(pool)}</p><p className="text-xs text-mute">BLC in pool</p></Card>
        <Card><p className="num text-2xl font-bold">{fmtNum(rows.reduce((a, r) => a + r.backers, 0))}</p><p className="text-xs text-mute">stakes placed</p></Card>
      </div>
      <Card><form key={ev.id + ev.title} onSubmit={save} className="grid gap-3 md:grid-cols-2">
        <Field label="Title"><Input name="title" defaultValue={ev.title} required /></Field>
        <Field label="Starts"><Input name="startsAt" type="datetime-local" defaultValue={toLocal(ev.startsAt)} required /></Field>
        <Field label="Venue"><Input name="venue" defaultValue={ev.venue} /></Field>
        <Field label="Description"><Input name="description" defaultValue={ev.description} /></Field>
        <Field label="Composite weights (R1 / R2 / R3)" hint="Relative weights; they need not sum to 1.">
          <div className="grid grid-cols-3 gap-2">{(['r1', 'r2', 'r3'] as const).map((k, i) => <Input key={k} name={`w${i + 1}`} type="number" step="0.05" min="0" defaultValue={ev.settings.weights[k]} />)}</div>
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" name="expire" defaultChecked={ev.settings.expireUnspent} className="size-5" />Expire unspent coins when investing closes</label>
        <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit">Save changes</Button><Button asChild variant="ghost"><Link to={`/display/${ev.id}`}><Tv size={16} />Projector display</Link></Button>
          {ev.status === 'draft' && <Button type="button" variant="ghost" onClick={() => run(() => api.saveEvent({ id: ev.id, title: ev.title }).then(() => api.openInvesting(ev.id, new Date(Date.now() + 864e5).toISOString())), 'Published and investing opened (24h)')}>Publish & open investing</Button>}
          {ev.status !== 'archived' && ev.status !== 'investing' && ev.status !== 'locked' && <Button type="button" variant="danger" onClick={() => confirm('Archive this event?') && run(() => api.archiveEvent(ev.id), 'Event archived')}>Archive</Button>}</div>
      </form></Card>
    </div>
  )
}

function TeamsTab({ ev }: { ev: PitchEvent }) {
  const { snap, run } = useApp()
  const teams = snap!.teams.filter((t) => t.eventId === ev.id)
  const [editing, setEditing] = useState<Team | 'new' | null>(null)
  const frozen = ev.status === 'locked' || ev.status === 'settled'
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const existing = editing !== 'new' ? editing : null
    const id = await run(() => api.saveTeam({
      id: existing?.id, eventId: ev.id, name: String(f.get('name')).trim(), tagline: String(f.get('tagline')), description: String(f.get('description')),
      pitchTitle: String(f.get('pitchTitle')), stage: String(f.get('stage')), color: String(f.get('color')), initials: String(f.get('initials')).toUpperCase() || undefined,
      status: String(f.get('status')) as Team['status'],
    }), 'Team saved')
    const file = (f.get('logo') as File | null)
    if (id && file && file.size > 0) await run(() => api.uploadLogo(id, file), 'Logo uploaded')
    if (id) setEditing(null)
  }
  return (
    <div className="space-y-3">
      {frozen && <p className="rounded-xl bg-coin/10 px-3 py-2 text-sm text-coin">Teams are frozen because investing has closed.</p>}
      {!frozen && <Button onClick={() => setEditing('new')}>Add team</Button>}
      {editing && (
        <Card><form key={editing === 'new' ? 'new' : editing.id} onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><Input name="name" required defaultValue={editing === 'new' ? '' : editing.name} /></Field>
          <Field label="Tagline"><Input name="tagline" defaultValue={editing === 'new' ? '' : editing.tagline} /></Field>
          <Field label="Pitch title"><Input name="pitchTitle" defaultValue={editing === 'new' ? '' : editing.pitchTitle} /></Field>
          <Field label="Stage"><Input name="stage" placeholder="Idea / MVP / Pilot" defaultValue={editing === 'new' ? '' : editing.stage} /></Field>
          <Field label="Initials (fallback logo)"><Input name="initials" maxLength={3} defaultValue={editing === 'new' ? '' : editing.initials} /></Field>
          <Field label="Colour"><Input name="color" type="color" className="p-1" defaultValue={editing === 'new' ? '#3b82f6' : editing.color} /></Field>
          <Field label="Status"><Select name="status" defaultValue={editing === 'new' ? 'registered' : editing.status}>{['registered', 'shortlisted', 'pitched', 'withdrawn'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Logo (PNG/JPG/WebP)"><Input name="logo" type="file" accept="image/png,image/jpeg,image/webp" /></Field>
          <div className="md:col-span-2"><Field label="Description"><Textarea name="description" rows={3} defaultValue={editing === 'new' ? '' : editing.description} /></Field></div>
          <div className="flex gap-2 md:col-span-2"><Button type="submit">Save team</Button><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
        </form></Card>
      )}
      {teams.length === 0 ? <Empty title="No teams yet" /> : teams.map((t) => (
        <Card key={t.id} className="flex items-center gap-3"><TeamLogo team={t} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{t.name}</p><p className="truncate text-xs text-mute">{t.tagline} · {t.status}</p></div>
          {!frozen && <><Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Edit</Button><Button size="sm" variant="danger" onClick={() => confirm(`Remove ${t.name}?`) && run(() => api.removeTeam(t.id), 'Team removed')}>Remove</Button></>}
        </Card>
      ))}
    </div>
  )
}

function ScoresTab({ ev }: { ev: PitchEvent }) {
  const { snap, run, isAdmin } = useApp()
  const [n, setN] = useState<1 | 2>(isAdmin ? 1 : 2)
  const rounds = snap!.rounds.filter((r) => r.eventId === ev.id)
  const round = rounds.find((r) => r.number === n)
  const teams = snap!.teams.filter((t) => t.eventId === ev.id && t.status !== 'withdrawn')
  const evals = snap!.evaluations.filter((x) => x.eventId === ev.id && x.roundNumber === n)
  const [teamId, setTeamId] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [csv, setCsv] = useState('')
  const [fix, setFix] = useState<{ ev: Evaluation; scores: Record<string, number>; reason: string } | null>(null)
  if (!round) return <Empty title="Round not configured" />
  const source = n === 2 ? 'live' : 'manual'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!teamId) return
    await run(() => api.submitEvaluation({ eventId: ev.id, teamId, roundNumber: n, scores, note, source }), 'Score saved')
  }
  async function importCsv() {
    const { rows, errors } = parseScoreCsv(csv, round!.criteria, teams)
    if (errors.length) { alert(errors.slice(0, 6).join('\n')); return }
    for (const r of rows) await run(() => api.submitEvaluation({ eventId: ev.id, teamId: r.teamId, roundNumber: 1, scores: r.scores, note: 'Imported by council from CSV', source: 'import' }))
    setCsv('')
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-2">{([1, 2] as const).map((k) => <Button key={k} variant={n === k ? 'primary' : 'ghost'} size="sm" disabled={!isAdmin && k === 1} onClick={() => { setN(k); setTeamId(''); setScores({}) }}>R{k} · {k === 1 ? 'AI' : 'Live'}</Button>)}</div>
      {isAdmin && <RoundConfig round={round} />}
      <Card>
        <h3 className="font-display font-bold">{n === 1 ? 'Enter AI-round score (manual)' : 'Enter live judge score'}</h3>
        {n === 1 && <p className="mt-1 text-xs text-mute">No AI provider is connected. These are human-entered or imported numbers and are stored as “{source}”, never as AI output.</p>}
        <form onSubmit={submit} className="mt-3 space-y-3">
          <Field label="Team"><Select value={teamId} onChange={(e) => { setTeamId(e.target.value); const prev = evals.find((x) => x.teamId === e.target.value && (n === 1 || x.judgeId !== null)); setScores(prev?.scores ?? {}) }} required><option value="">Select a team…</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <div className="grid gap-3 md:grid-cols-2">{round.criteria.map((c) => (
            <Field key={c.key} label={`${c.label} (0–${c.max})`}><Input type="number" min={0} max={c.max} step="0.5" required value={scores[c.key] ?? ''} onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))} /></Field>))}</div>
          <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <Button type="submit" disabled={!teamId}>Save score</Button>
        </form>
      </Card>
      {isAdmin && n === 1 && (
        <Card><h3 className="font-display font-bold">Import scores (CSV)</h3><p className="mt-1 text-xs text-mute">Header: team,{round.criteria.map((c) => c.key).join(',')}</p>
          <Textarea rows={4} className="mt-2 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={`team,${round.criteria.map((c) => c.key).join(',')}\nAgriLoop,8,7,9,6,7`} />
          <Button className="mt-2" variant="ghost" disabled={!csv.trim()} onClick={importCsv}>Import</Button></Card>
      )}
      <section>
        <h3 className="font-display mb-2 font-bold">Recorded scores</h3>
        {evals.length === 0 ? <Empty title="Nothing recorded yet" /> : <Card className="p-0"><ul className="divide-y divide-line">{evals.map((x) => {
          const t = teams.find((y) => y.id === x.teamId)
          return (
            <li key={x.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{t?.name}</span><span className="flex items-center gap-2"><Badge>{x.source}{x.isDemo ? ' · demo' : ''}</Badge><span className="num font-bold">{x.total.toFixed(1)}</span>{isAdmin && <Button size="sm" variant="ghost" onClick={() => setFix({ ev: x, scores: x.scores, reason: '' })}>Correct</Button>}</span></div>
              {fix?.ev.id === x.id && (
                <div className="space-y-2 rounded-xl bg-ink p-3">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">{round.criteria.map((c) => <Input key={c.key} aria-label={c.label} type="number" min={0} max={c.max} step="0.5" value={fix.scores[c.key] ?? ''} onChange={(e) => setFix({ ...fix, scores: { ...fix.scores, [c.key]: Number(e.target.value) } })} />)}</div>
                  <Input placeholder="Reason for correction (logged)" value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} />
                  <div className="flex gap-2"><Button size="sm" onClick={async () => { await run(() => api.correctEvaluation(x.id, fix.scores, fix.reason), 'Correction logged'); setFix(null) }}>Apply correction</Button><Button size="sm" variant="ghost" onClick={() => setFix(null)}>Cancel</Button></div>
                </div>)}
            </li>)
        })}</ul></Card>}
      </section>
    </div>
  )
}

function RoundConfig({ round }: { round: Round }) {
  const { run } = useApp()
  const [criteria, setCriteria] = useState(round.criteria)
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Field label="Round status"><Select value={round.status} onChange={(e) => run(() => api.saveRound(round.id, { status: e.target.value as Round['status'] }), 'Round updated')}><option value="pending">Pending</option><option value="active">Active</option><option value="complete">Complete</option></Select></Field>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" className="size-5" checked={round.scoreVisible} onChange={(e) => run(() => api.saveRound(round.id, { scoreVisible: e.target.checked }), e.target.checked ? 'Scores now visible to participants' : 'Scores hidden from participants')} />Show scores to participants</label>
      </div>
      <details><summary className="cursor-pointer text-sm font-medium text-bloom">Evaluation criteria ({criteria.length})</summary>
        <div className="mt-2 space-y-2">{criteria.map((c, i) => (
          <div key={c.key} className="flex gap-2"><Input aria-label="Label" value={c.label} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /><Input aria-label="Max" type="number" className="w-24" min={1} value={c.max} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) } : x)))} /></div>))}
          <Button size="sm" variant="ghost" onClick={() => run(() => api.saveRound(round.id, { criteria }), 'Criteria saved')}>Save criteria</Button>
          <p className="text-[11px] text-mute">Changing criteria after scoring does not recompute existing totals; re-enter or correct scores.</p></div></details>
    </Card>
  )
}

function SettleTab({ ev }: { ev: PitchEvent }) {
  const { snap, run } = useApp()
  const rows = teamRows(snap!, ev)
  const [deadline, setDeadline] = useState(toLocal(ev.investDeadline))
  const [winner, setWinner] = useState('')
  const [ok, setOk] = useState(false)
  const res = snap!.results.find((r) => r.eventId === ev.id)
  const pool = rows.reduce((a, r) => a + r.stake, 0)
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="font-display font-bold">Investment window</h3>
        <p className="text-sm text-mute">Status: <b className="text-white">{statusLabel[ev.status]}</b> · closes {fmtDate(ev.investDeadline)}. After the deadline the server rejects all changes.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Deadline"><Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <Button disabled={ev.status === 'settled' || ev.status === 'archived' || ev.status === 'locked'} onClick={() => run(() => api.openInvesting(ev.id, fromLocal(deadline)), ev.status === 'investing' ? 'Deadline updated' : 'Investing opened')}>{ev.status === 'investing' ? 'Update deadline' : 'Open investing'}</Button>
          <Button variant="danger" disabled={ev.status !== 'investing'} onClick={() => confirm(`Lock investing${ev.settings.expireUnspent ? ' and expire all unspent coins' : ''}? This cannot be undone.`) && run(() => api.closeInvesting(ev.id), 'Investing closed and event locked')}>Close & lock</Button>
        </div>
      </Card>
      <Card className="space-y-3">
        <h3 className="font-display font-bold">Declare winner & settle</h3>
        {res ? <p className="text-sm text-win">Settled. Winner: {rows.find((r) => r.team.id === res.winnerTeamId)?.team.name}. Pool {fmtNum(res.pool)} BLC, {res.refunded ? 'refunded' : 'paid out'} {fmtNum(res.paidOut)} BLC.</p> : ev.status !== 'locked' ? <p className="text-sm text-mute">Close investing first. Settlement is available only for locked events.</p> : (
          <>
            <p className="text-xs text-mute">Provisional demo rule: the pool ({fmtNum(pool)} BLC, all coins allocated) is shared pro-rata by backers of the winner. If nobody backed the winner, every allocation is refunded.</p>
            <Field label="Winner"><Select value={winner} onChange={(e) => setWinner(e.target.value)}><option value="">Select…</option>{rows.map((r) => <option key={r.team.id} value={r.team.id}>{r.team.name} · composite {r.composite?.toFixed(1) ?? '–'} · {fmtNum(r.stake)} BLC</option>)}</Select></Field>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-5" checked={ok} onChange={(e) => setOk(e.target.checked)} />I confirm the results and authorise settlement. This runs once and cannot be reversed.</label>
            <Button variant="coin" disabled={!winner || !ok} onClick={() => run(() => api.settle(ev.id, winner), 'Event settled')}><ShieldCheck size={16} />Settle event</Button>
          </>
        )}
      </Card>
    </div>
  )
}

export function AdminUsers() {
  const data = useAdminData()
  const { session, run } = useApp()
  if (!data) return <Spinner />
  return (
    <div className="space-y-3">
      <PageTitle title="People & roles" sub="Roles are changed only through a server-side, audited function. You cannot change your own." />
      <Card className="p-0"><ul className="divide-y divide-line">{data.users.map((u) => (
        <li key={u.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{u.name}{u.isDemo && <span className="ml-2 text-xs text-mute">demo</span>}</p><p className="truncate text-xs text-mute">{u.email}</p></div>
          <Select aria-label={`Role for ${u.name}`} className="w-36" disabled={u.id === session?.id} value={u.role} onChange={(e) => run(() => api.setRole(u.id, e.target.value as Role), 'Role updated')}><option value="participant">Participant</option><option value="judge">Judge</option><option value="admin">Council admin</option></Select></li>))}</ul></Card>
    </div>
  )
}

export function AdminLedger() {
  const data = useAdminData()
  const [tab, setTab] = useState<'tx' | 'audit'>('tx')
  if (!data) return <Spinner />
  const name = (id: string | null) => data.users.find((u) => u.id === id)?.name ?? '—'
  return (
    <div className="space-y-3">
      <PageTitle title="Ledger & audit" />
      <div className="flex gap-2"><Button size="sm" variant={tab === 'tx' ? 'primary' : 'ghost'} onClick={() => setTab('tx')}>Transactions ({data.entries.length})</Button><Button size="sm" variant={tab === 'audit' ? 'primary' : 'ghost'} onClick={() => setTab('audit')}>Audit log ({data.audit.length})</Button></div>
      <Card className="max-h-[60vh] overflow-auto p-0"><ul className="divide-y divide-line text-sm">
        {tab === 'tx' ? [...data.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300).map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><span className="min-w-0 truncate"><b>{name(e.userId)}</b> <span className="text-mute">· {e.kind} · {e.note} · {fmtDate(e.createdAt)}</span></span><span className={`num font-bold ${e.amount > 0 ? 'text-win' : 'text-loss'}`}>{e.amount > 0 ? '+' : ''}{fmtNum(e.amount)}</span></li>
        )) : data.audit.map((a) => (
          <li key={a.id} className="px-4 py-2.5"><p><b>{a.action}</b> <span className="text-mute">· {a.subject}</span></p><p className="text-xs text-mute">{name(a.actorId)} · {fmtDate(a.createdAt)}{a.detail && ` · ${a.detail}`}</p></li>))}
      </ul></Card>
    </div>
  )
}
