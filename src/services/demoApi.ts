import {
  addAudit, balanceOf, closeInvesting, committedTo, EngineError, initWallet, normaliseScore, openInvesting,
  setAllocations, settle, uid, type DB,
} from '../lib/engine'
import type { AdminSnapshot, LeaderRow, Role, Snapshot } from '../lib/types'
import { ApiError, type Api, type SessionUser } from './api'
import { DEMO_USERS, seedDb } from './seed'

const DB_KEY = 'bloombox.demo.db.v1'
const SESSION_KEY = 'bloombox.demo.session.v1'
const listeners = new Set<() => void>()

function readDb(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch { /* fall through to a fresh seed */ }
  const db = seedDb()
  writeDb(db, false)
  return db
}
function writeDb(db: DB, notify = true) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)) } catch { /* storage unavailable: demo state is in-memory only */ }
  if (notify) listeners.forEach((l) => l())
}
const sessionId = () => { try { return localStorage.getItem(SESSION_KEY) } catch { return null } }

/** Run a mutation on a copy; commit only if it succeeds so failures never leave partial state. */
function tx<T>(fn: (db: DB, me: SessionUser) => T): T {
  const me = currentUser(readDb())
  if (!me) throw new ApiError('unauthenticated', 'Please sign in')
  const db = structuredClone(readDb())
  try {
    const out = fn(db, me)
    writeDb(db)
    return out
  } catch (e) {
    if (e instanceof EngineError) throw new ApiError(e.code, e.message)
    throw e
  }
}
function currentUser(db: DB): SessionUser | null {
  const id = sessionId()
  const p = db.profiles.find((x) => x.id === id)
  return p ? { id: p.id, email: p.email, name: p.name, role: p.role } : null
}
function needAdmin(me: SessionUser) { if (me.role !== 'admin') throw new ApiError('forbidden', 'Council admin only') }
function needStaff(me: SessionUser) { if (me.role === 'participant') throw new ApiError('forbidden', 'Judges and admins only') }

const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120))

function leaderboard(db: DB, meId: string): LeaderRow[] {
  const rows: LeaderRow[] = []
  const people = db.profiles.filter((p) => p.role === 'participant')
  for (const p of people) {
    const open = db.allocations.filter((a) => a.userId === p.id && db.events.find((e) => e.id === a.eventId)?.status !== 'settled').reduce((s, a) => s + a.amount, 0)
    const total = balanceOf(db, p.id) + open
    rows.push({ eventId: null, userId: p.id, name: p.name, total, net: total - 1000, isYou: p.id === meId })
    for (const ev of db.events) {
      const mine = db.entries.filter((e) => e.userId === p.id && e.eventId === ev.id && e.kind !== 'expire')
      if (!mine.length) continue
      const net = mine.reduce((s, e) => s + e.amount, 0)
      rows.push({ eventId: ev.id, userId: p.id, name: p.name, total: committedTo(db, ev.id, p.id), net, isYou: p.id === meId })
    }
  }
  return rows
}

export const demoApi: Api = {
  mode: 'demo',
  async getSession() { return currentUser(readDb()) },
  onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },

  async signIn(email) {
    const db = readDb()
    const p = db.profiles.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!p) throw new ApiError('no_user', 'No demo account with that email. Use a demo account button or register.')
    localStorage.setItem(SESSION_KEY, p.id)
    listeners.forEach((l) => l())
  },
  async signUp(name, email) {
    const db = structuredClone(readDb())
    const e = email.trim().toLowerCase()
    if (db.profiles.some((x) => x.email.toLowerCase() === e)) throw new ApiError('duplicate', 'That email is already registered')
    const id = uid('u')
    db.profiles.push({ id, name: name.trim(), email: e, role: 'participant', createdAt: new Date().toISOString() })
    initWallet(db, id)
    writeDb(db, false)
    localStorage.setItem(SESSION_KEY, id)
    listeners.forEach((l) => l())
    return { needsConfirmation: false }
  },
  async signOut() { localStorage.removeItem(SESSION_KEY); listeners.forEach((l) => l()) },
  async demoLogin(role) {
    localStorage.setItem(SESSION_KEY, DEMO_USERS[role].id)
    listeners.forEach((l) => l())
  },
  async resetDemo() {
    localStorage.removeItem(DB_KEY)
    localStorage.removeItem(SESSION_KEY)
    readDb()
    listeners.forEach((l) => l())
  },

  async load() {
    const db = readDb()
    const me = currentUser(db)
    if (!me) throw new ApiError('unauthenticated', 'Please sign in')
    const staff = me.role !== 'participant'
    const events = db.events.filter((e) => staff || e.status !== 'draft')
    const visible = new Set(events.map((e) => e.id))
    const rounds = db.rounds.filter((r) => visible.has(r.eventId))
    const shown = new Set(rounds.filter((r) => r.scoreVisible).map((r) => `${r.eventId}:${r.number}`))
    const stakes = events.flatMap((e) => db.teams.filter((t) => t.eventId === e.id).map((t) => {
      const al = db.allocations.filter((a) => a.teamId === t.id)
      return { eventId: e.id, teamId: t.id, total: al.reduce((s, a) => s + a.amount, 0), backers: new Set(al.map((a) => a.userId)).size }
    }))
    const snap: Snapshot = {
      events, rounds,
      teams: db.teams.filter((t) => visible.has(t.eventId)),
      evaluations: db.evaluations.filter((x) => visible.has(x.eventId) && (staff || shown.has(`${x.eventId}:${x.roundNumber}`))),
      myEntries: db.entries.filter((e) => e.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      myAllocations: db.allocations.filter((a) => a.userId === me.id),
      stakes, leaderboard: leaderboard(db, me.id),
      results: db.results.filter((r) => visible.has(r.eventId)),
      serverTime: new Date().toISOString(),
    }
    return delay(snap)
  },
  subscribe(cb) {
    listeners.add(cb)
    const onStorage = (e: StorageEvent) => { if (e.key === DB_KEY) cb() }
    window.addEventListener('storage', onStorage)
    return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage) }
  },

  async allocate(eventId, amounts) { tx((db, me) => setAllocations(db, { eventId, userId: me.id, amounts })) },

  async loadAdmin() {
    const db = readDb()
    const me = currentUser(db)
    if (!me || me.role === 'participant') throw new ApiError('forbidden', 'Staff only')
    const out: AdminSnapshot = { users: db.profiles, entries: me.role === 'admin' ? db.entries : [], audit: me.role === 'admin' ? db.audit : [] }
    return delay(out)
  },
  async saveEvent(e) {
    return tx((db, me) => {
      needAdmin(me)
      const existing = e.id ? db.events.find((x) => x.id === e.id) : undefined
      if (existing) { Object.assign(existing, e); addAudit(db, me.id, 'event.update', existing.title); return existing.id }
      const id = uid('evt')
      const start = e.startsAt ?? new Date(Date.now() + 7 * 864e5).toISOString()
      db.events.push({
        id, title: e.title, description: e.description ?? '', venue: e.venue ?? '', startsAt: start, status: e.status ?? 'draft',
        investDeadline: e.investDeadline ?? new Date(new Date(start).getTime() + 6 * 36e5).toISOString(),
        settings: e.settings ?? { expireUnspent: true, payoutRule: 'prorata-pool', weights: { r1: 0.3, r2: 0.4, r3: 0.3 } }, winnerTeamId: null,
      })
      for (const n of [1, 2, 3] as const) db.rounds.push({
        id: `${id}_r${n}`, eventId: id, number: n, kind: (['ai', 'live', 'audience'] as const)[n - 1], name: ['AI evaluation', 'Live panel', 'Audience investment'][n - 1],
        status: 'pending', scoreVisible: false, criteria: n === 3 ? [] : (n === 1 ? DEFAULT_R1 : DEFAULT_R2),
      })
      addAudit(db, me.id, 'event.create', e.title)
      return id
    })
  },
  async archiveEvent(id) {
    tx((db, me) => { needAdmin(me); const ev = db.events.find((x) => x.id === id); if (!ev) throw new ApiError('unknown_event', 'Event not found'); ev.status = 'archived'; addAudit(db, me.id, 'event.archive', ev.title) })
  },
  async saveTeam(t) {
    return tx((db, me) => {
      needAdmin(me)
      const ev = db.events.find((x) => x.id === t.eventId)
      if (!ev) throw new ApiError('unknown_event', 'Event not found')
      if (ev.status === 'locked' || ev.status === 'settled') throw new ApiError('bad_state', 'Teams are frozen once investing has closed')
      const existing = t.id ? db.teams.find((x) => x.id === t.id) : undefined
      if (existing) { Object.assign(existing, t); addAudit(db, me.id, 'team.update', existing.name); return existing.id }
      const id = uid('team')
      db.teams.push({
        id, eventId: t.eventId, name: t.name, tagline: t.tagline ?? '', description: t.description ?? '', initials: t.name.slice(0, 2).toUpperCase(),
        color: t.color ?? '#3b82f6', logoUrl: t.logoUrl ?? null, pitchTitle: t.pitchTitle ?? '', pitchSlot: t.pitchSlot ?? ev.startsAt, stage: t.stage ?? '', status: 'registered',
      })
      addAudit(db, me.id, 'team.create', t.name)
      return id
    })
  },
  async removeTeam(id) {
    tx((db, me) => {
      needAdmin(me)
      const t = db.teams.find((x) => x.id === id)
      if (!t) return
      if (db.allocations.some((a) => a.teamId === id)) throw new ApiError('bad_state', 'Team has investments; mark it withdrawn instead')
      db.teams = db.teams.filter((x) => x.id !== id)
      db.evaluations = db.evaluations.filter((x) => x.teamId !== id)
      addAudit(db, me.id, 'team.remove', t.name)
    })
  },
  async uploadLogo(teamId, file) {
    if (file.size > 400_000) throw new ApiError('too_large', 'Logo must be under 400 KB in demo mode')
    const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file) })
    tx((db, me) => { needAdmin(me); const t = db.teams.find((x) => x.id === teamId); if (t) { t.logoUrl = url; addAudit(db, me.id, 'team.logo', t.name) } })
    return url
  },
  async saveRound(roundId, patch) {
    tx((db, me) => {
      needAdmin(me)
      const r = db.rounds.find((x) => x.id === roundId)
      if (!r) throw new ApiError('not_found', 'Round not found')
      Object.assign(r, patch)
      addAudit(db, me.id, 'round.update', `Round ${r.number}`, JSON.stringify(patch))
    })
  },
  async submitEvaluation(s) {
    tx((db, me) => {
      needStaff(me)
      if (s.source !== 'live' && me.role !== 'admin') throw new ApiError('forbidden', 'Only admins can enter or import AI-round scores')
      const ev = db.events.find((e) => e.id === s.eventId)
      if (!ev || ev.status === 'settled') throw new ApiError('bad_state', 'Scores are locked for settled events; use a correction')
      const round = db.rounds.find((r) => r.eventId === s.eventId && r.number === s.roundNumber)
      if (!round) throw new ApiError('not_found', 'Round not found')
      for (const c of round.criteria) {
        const v = s.scores[c.key]
        if (v === undefined || Number.isNaN(v) || v < 0 || v > c.max) throw new ApiError('invalid_score', `${c.label} must be between 0 and ${c.max}`)
      }
      const judgeId = s.roundNumber === 2 ? me.id : null
      const prev = db.evaluations.find((e) => e.teamId === s.teamId && e.roundNumber === s.roundNumber && e.judgeId === judgeId)
      const total = normaliseScore(s.scores, round.criteria)
      if (prev) { Object.assign(prev, { scores: s.scores, total, note: s.note ?? '', source: s.source, updatedAt: new Date().toISOString(), isDemo: false }); addAudit(db, me.id, 'score.update', s.teamId, `R${s.roundNumber} ${total}`) }
      else { db.evaluations.push({ id: uid('ev'), eventId: s.eventId, teamId: s.teamId, roundNumber: s.roundNumber, judgeId, source: s.source, scores: s.scores, total, note: s.note ?? '', updatedAt: new Date().toISOString() }); addAudit(db, me.id, 'score.create', s.teamId, `R${s.roundNumber} ${total}`) }
    })
  },
  async correctEvaluation(id, scores, reason) {
    tx((db, me) => {
      needAdmin(me)
      if (reason.trim().length < 5) throw new ApiError('reason_required', 'Give a reason for the correction')
      const e = db.evaluations.find((x) => x.id === id)
      const round = e && db.rounds.find((r) => r.eventId === e.eventId && r.number === e.roundNumber)
      if (!e || !round) throw new ApiError('not_found', 'Evaluation not found')
      const before = e.total
      e.scores = scores; e.total = normaliseScore(scores, round.criteria); e.updatedAt = new Date().toISOString()
      addAudit(db, me.id, 'score.correct', e.teamId, `${before} → ${e.total}: ${reason}`)
    })
  },
  async openInvesting(eventId, deadline) { tx((db, me) => openInvesting(db, eventId, me.id, deadline)) },
  async closeInvesting(eventId) { tx((db, me) => closeInvesting(db, eventId, me.id)) },
  async settle(eventId, winner) { tx((db, me) => settle(db, eventId, winner, me.id)) },
  async setRole(userId, role: Role) {
    tx((db, me) => {
      needAdmin(me)
      if (userId === me.id) throw new ApiError('forbidden', 'You cannot change your own role')
      const p = db.profiles.find((x) => x.id === userId)
      if (!p) throw new ApiError('not_found', 'User not found')
      addAudit(db, me.id, 'role.change', p.name, `${p.role} → ${role}`)
      p.role = role
    })
  },
}

const DEFAULT_R1 = [
  { key: 'problem', label: 'Problem clarity', max: 10 }, { key: 'market', label: 'Market size', max: 10 }, { key: 'innovation', label: 'Innovation', max: 10 },
  { key: 'feasibility', label: 'Feasibility', max: 10 }, { key: 'financials', label: 'Financial logic', max: 10 },
]
const DEFAULT_R2 = [
  { key: 'delivery', label: 'Pitch delivery', max: 10 }, { key: 'qa', label: 'Q&A handling', max: 10 }, { key: 'model', label: 'Business model', max: 10 },
  { key: 'team', label: 'Team strength', max: 10 }, { key: 'demo', label: 'Demo / traction', max: 10 },
]
