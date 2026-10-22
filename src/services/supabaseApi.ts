import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminSnapshot, Allocation, AuditEntry, Evaluation, EventResult, LedgerEntry, LeaderRow, PitchEvent, Profile, Round, Snapshot, Team, TeamStake,
} from '../lib/types'
import { ApiError, type Api, type SessionUser } from './api'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

export const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

let client: SupabaseClient | null = null
const sb = () => (client ??= createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string))

/** Strip Postgres error noise: our functions raise "code: message". */
function fail(error: { message: string } | null): asserts error is null {
  if (!error) return
  const m = error.message
  const code = /^([a-z_]+):/.exec(m)?.[1] ?? 'error'
  throw new ApiError(code, m.replace(/^[a-z_]+:\s*/, ''))
}
function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  fail(r.error)
  return r.data as T
}

const toEvent = (r: Row): PitchEvent => ({
  id: r.id, title: r.title, description: r.description, venue: r.venue, startsAt: r.starts_at, status: r.status,
  investDeadline: r.invest_deadline, settings: r.settings, winnerTeamId: r.winner_team_id, isDemo: r.is_demo,
})
const toTeam = (r: Row): Team => ({
  id: r.id, eventId: r.event_id, name: r.name, tagline: r.tagline, description: r.description, initials: r.initials || r.name.slice(0, 2).toUpperCase(),
  color: r.color, logoUrl: r.logo_url, pitchTitle: r.pitch_title, pitchSlot: r.pitch_slot ?? '', stage: r.stage, status: r.status, isDemo: r.is_demo,
})
const toRound = (r: Row): Round => ({
  id: r.id, eventId: r.event_id, number: r.number, kind: r.kind, name: r.name, status: r.status, scoreVisible: r.score_visible, criteria: r.criteria,
})
const toEval = (r: Row): Evaluation => ({
  id: r.id, eventId: r.event_id, teamId: r.team_id, roundNumber: r.round_number, judgeId: r.judge_id, source: r.source, scores: r.scores,
  total: Number(r.total), note: r.note, updatedAt: r.updated_at, isDemo: r.is_demo,
})
const toEntry = (r: Row): LedgerEntry => ({
  id: r.id, userId: r.user_id, eventId: r.event_id, kind: r.kind, amount: r.amount, balanceAfter: r.balance_after, ref: r.ref, note: r.note, createdAt: r.created_at,
})
const toProfile = (r: Row): Profile => ({ id: r.id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at })

async function currentProfile(): Promise<SessionUser | null> {
  const { data } = await sb().auth.getUser()
  if (!data.user) return null
  const { data: p } = await sb().from('profiles').select('*').eq('id', data.user.id).maybeSingle()
  if (!p) return { id: data.user.id, email: data.user.email ?? '', name: data.user.email ?? '', role: 'participant' }
  return { id: p.id, email: p.email, name: p.name, role: p.role }
}

export const supabaseApi: Api = {
  mode: 'supabase',
  getSession: currentProfile,
  onAuthChange(cb) {
    const { data } = sb().auth.onAuthStateChange(() => cb())
    return () => data.subscription.unsubscribe()
  },
  async signIn(email, password) { fail((await sb().auth.signInWithPassword({ email, password })).error) },
  async signUp(name, email, password) {
    const r = await sb().auth.signUp({ email, password, options: { data: { name } } })
    fail(r.error)
    // The database trigger creates the profile and the one-time grant; confirmation may be required first.
    return { needsConfirmation: !r.data.session }
  },
  async signOut() { await sb().auth.signOut() },

  async load() {
    const me = await currentProfile()
    if (!me) throw new ApiError('unauthenticated', 'Please sign in')
    const c = sb()
    const [ev, tm, rd, evals, entries, allocs, stakes, lb, res] = await Promise.all([
      c.from('events').select('*').order('starts_at', { ascending: false }),
      c.from('teams').select('*').order('pitch_slot'),
      c.from('rounds').select('*').order('number'),
      c.from('evaluations').select('*'),
      c.from('wallet_entries').select('*').eq('user_id', me.id).order('created_at', { ascending: false }),
      c.from('allocations').select('*').eq('user_id', me.id),
      c.rpc('team_stakes'),
      c.rpc('leaderboard'),
      c.from('results').select('*'),
    ])
    const snap: Snapshot = {
      events: must<Row[]>(ev).map(toEvent),
      teams: must<Row[]>(tm).map(toTeam),
      rounds: must<Row[]>(rd).map(toRound),
      evaluations: must<Row[]>(evals).map(toEval),
      myEntries: must<Row[]>(entries).map(toEntry),
      myAllocations: must<Row[]>(allocs).map((a): Allocation => ({ eventId: a.event_id, userId: a.user_id, teamId: a.team_id, amount: a.amount })),
      stakes: must<Row[]>(stakes).map((s): TeamStake => ({ eventId: s.event_id, teamId: s.team_id, total: Number(s.total), backers: Number(s.backers) })),
      leaderboard: must<Row[]>(lb).map((l): LeaderRow => ({ eventId: l.event_id, userId: l.user_id, name: l.name, total: Number(l.total), net: Number(l.net), isYou: l.user_id === me.id })),
      results: must<Row[]>(res).map((r): EventResult => ({
        eventId: r.event_id, winnerTeamId: r.winner_team_id, pool: r.pool, paidOut: r.paid_out, refunded: r.refunded, confirmedBy: r.confirmed_by, settledAt: r.settled_at,
      })),
      serverTime: new Date().toISOString(),
    }
    return snap
  },
  subscribe(cb) {
    const ch = sb().channel('arena')
    for (const table of ['events', 'teams', 'rounds', 'evaluations', 'results', 'allocations', 'wallet_entries'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => cb())
    ch.subscribe()
    return () => { void sb().removeChannel(ch) }
  },

  async allocate(eventId, amounts) { fail((await sb().rpc('allocate_coins', { p_event: eventId, p_amounts: amounts })).error) },

  async loadAdmin() {
    const c = sb()
    const [u, e, a] = await Promise.all([
      c.from('profiles').select('*').order('created_at'),
      c.from('wallet_entries').select('*').order('created_at', { ascending: false }).limit(500),
      c.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300),
    ])
    const out: AdminSnapshot = {
      users: must<Row[]>(u).map(toProfile),
      entries: must<Row[]>(e).map(toEntry),
      audit: must<Row[]>(a).map((r): AuditEntry => ({ id: String(r.id), actorId: r.actor_id, action: r.action, subject: r.subject, detail: r.detail, createdAt: r.created_at })),
    }
    return out
  },
  async saveEvent(e) {
    const body: Row = {
      title: e.title, description: e.description ?? '', venue: e.venue ?? '',
      ...(e.startsAt ? { starts_at: e.startsAt } : {}), ...(e.settings ? { settings: e.settings } : {}),
    }
    if (e.id) { fail((await sb().from('events').update(body).eq('id', e.id)).error); return e.id }
    const start = e.startsAt ?? new Date(Date.now() + 7 * 864e5).toISOString()
    const row = must<Row>(await sb().from('events').insert({ ...body, starts_at: start, status: 'draft', invest_deadline: e.investDeadline ?? new Date(new Date(start).getTime() + 6 * 36e5).toISOString() }).select().single())
    const crit = (keys: [string, string][]) => keys.map(([key, label]) => ({ key, label, max: 10 }))
    const r1 = crit([['problem', 'Problem clarity'], ['market', 'Market size'], ['innovation', 'Innovation'], ['feasibility', 'Feasibility'], ['financials', 'Financial logic']])
    const r2 = crit([['delivery', 'Pitch delivery'], ['qa', 'Q&A handling'], ['model', 'Business model'], ['team', 'Team strength'], ['demo', 'Demo / traction']])
    fail((await sb().from('rounds').insert([
      { event_id: row.id, number: 1, kind: 'ai', name: 'AI evaluation', criteria: r1 },
      { event_id: row.id, number: 2, kind: 'live', name: 'Live panel', criteria: r2 },
      { event_id: row.id, number: 3, kind: 'audience', name: 'Audience investment', criteria: [] },
    ])).error)
    return row.id as string
  },
  async archiveEvent(id) { fail((await sb().rpc('archive_event', { p_event: id })).error) },
  async saveTeam(t) {
    const body: Row = {
      name: t.name, tagline: t.tagline ?? '', description: t.description ?? '', initials: (t.initials || t.name.slice(0, 2)).toUpperCase(),
      color: t.color ?? '#3b82f6', pitch_title: t.pitchTitle ?? '', stage: t.stage ?? '', ...(t.status ? { status: t.status } : {}), ...(t.pitchSlot ? { pitch_slot: t.pitchSlot } : {}),
    }
    if (t.id) { fail((await sb().from('teams').update(body).eq('id', t.id)).error); return t.id }
    return must<Row>(await sb().from('teams').insert({ ...body, event_id: t.eventId }).select().single()).id as string
  },
  async removeTeam(id) { fail((await sb().from('teams').delete().eq('id', id)).error) },
  async uploadLogo(teamId, file) {
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${teamId}/${Date.now()}.${ext}`
    fail((await sb().storage.from('team-logos').upload(path, file, { upsert: true, contentType: file.type })).error)
    const url = sb().storage.from('team-logos').getPublicUrl(path).data.publicUrl
    fail((await sb().from('teams').update({ logo_url: url }).eq('id', teamId)).error)
    return url
  },
  async saveRound(id, patch) {
    const body: Row = {}
    if (patch.status) body.status = patch.status
    if (patch.scoreVisible !== undefined) body.score_visible = patch.scoreVisible
    if (patch.criteria) body.criteria = patch.criteria
    if (patch.name) body.name = patch.name
    fail((await sb().from('rounds').update(body).eq('id', id)).error)
  },
  async submitEvaluation(s) {
    fail((await sb().rpc('submit_evaluation', { p_event: s.eventId, p_team: s.teamId, p_round: s.roundNumber, p_scores: s.scores, p_note: s.note ?? '', p_source: s.source })).error)
  },
  async correctEvaluation(id, scores, reason) { fail((await sb().rpc('correct_evaluation', { p_eval: id, p_scores: scores, p_reason: reason })).error) },
  async openInvesting(eventId, deadline) { fail((await sb().rpc('open_investing', { p_event: eventId, p_deadline: deadline })).error) },
  async closeInvesting(eventId) { fail((await sb().rpc('close_investing', { p_event: eventId })).error) },
  async settle(eventId, winner) { fail((await sb().rpc('settle_event', { p_event: eventId, p_winner: winner })).error) },
  async setRole(userId, role) { fail((await sb().rpc('admin_set_role', { p_user: userId, p_role: role })).error) },
}
