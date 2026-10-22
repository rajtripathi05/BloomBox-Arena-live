/**
 * Pure business rules for BloomBox Coins. The demo backend runs these directly;
 * the SQL functions in supabase/migrations/0003_functions.sql implement the same rules
 * on the server and are the only authority in production.
 */
import type {
  Allocation, AuditEntry, EntryKind, Evaluation, EventResult, LedgerEntry, PitchEvent,
  Profile, Round, Team,
} from './types'

export const STARTING_COINS = 1000

export interface DB {
  profiles: Profile[]
  events: PitchEvent[]
  teams: Team[]
  rounds: Round[]
  evaluations: Evaluation[]
  allocations: Allocation[]
  entries: LedgerEntry[]
  results: EventResult[]
  audit: AuditEntry[]
}

export type ErrorCode =
  | 'invalid_amount' | 'insufficient_funds' | 'investing_closed' | 'deadline_passed'
  | 'unknown_team' | 'forbidden' | 'bad_state' | 'already_settled' | 'unknown_event'

export class EngineError extends Error {
  code: ErrorCode
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

let counter = 0
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const balanceOf = (db: DB, userId: string) =>
  db.entries.filter((e) => e.userId === userId).reduce((s, e) => s + e.amount, 0)

export const committedTo = (db: DB, eventId: string, userId: string) =>
  db.allocations.filter((a) => a.eventId === eventId && a.userId === userId).reduce((s, a) => s + a.amount, 0)

export function addAudit(db: DB, actorId: string | null, action: string, subject: string, detail = '', now = new Date()) {
  db.audit.unshift({ id: uid('aud'), actorId, action, subject, detail, createdAt: now.toISOString() })
}

/** Append a ledger line. Returns false (no-op) if `ref` already exists for the user. */
export function postEntry(
  db: DB, userId: string, kind: EntryKind, amount: number, ref: string,
  opts: { eventId?: string | null; note?: string; now?: Date } = {},
): boolean {
  if (db.entries.some((e) => e.userId === userId && e.ref === ref)) return false
  const balanceAfter = balanceOf(db, userId) + amount
  if (balanceAfter < 0) throw new EngineError('insufficient_funds', 'Balance cannot go negative')
  db.entries.push({
    id: uid('led'), userId, eventId: opts.eventId ?? null, kind, amount, balanceAfter, ref,
    note: opts.note ?? '', createdAt: (opts.now ?? new Date()).toISOString(),
  })
  return true
}

/** One-time grant. Calling it again is a no-op, never a second grant. */
export function initWallet(db: DB, userId: string, now = new Date()): boolean {
  return postEntry(db, userId, 'grant', STARTING_COINS, 'grant:welcome', { note: 'Welcome grant', now })
}

export function setAllocations(
  db: DB,
  p: { eventId: string; userId: string; amounts: Record<string, number>; now?: Date },
) {
  const now = p.now ?? new Date()
  const ev = db.events.find((e) => e.id === p.eventId)
  if (!ev) throw new EngineError('unknown_event', 'Event not found')
  if (ev.status !== 'investing') throw new EngineError('investing_closed', 'Investing is not open for this event')
  if (now.getTime() >= new Date(ev.investDeadline).getTime())
    throw new EngineError('deadline_passed', 'The investment deadline has passed')

  const teamIds = new Set(db.teams.filter((t) => t.eventId === ev.id && t.status !== 'withdrawn').map((t) => t.id))
  let total = 0
  const next: Allocation[] = []
  for (const [teamId, amount] of Object.entries(p.amounts)) {
    if (!Number.isInteger(amount) || amount < 0) throw new EngineError('invalid_amount', 'Amounts must be whole, non-negative coins')
    if (!teamIds.has(teamId)) throw new EngineError('unknown_team', 'Team is not part of this event')
    total += amount
    if (amount > 0) next.push({ eventId: ev.id, userId: p.userId, teamId, amount })
  }
  const old = committedTo(db, ev.id, p.userId)
  const delta = total - old
  if (delta > balanceOf(db, p.userId)) throw new EngineError('insufficient_funds', 'Not enough coins for this allocation')

  if (delta !== 0) {
    const seq = db.entries.filter((e) => e.userId === p.userId && e.eventId === ev.id && e.kind === 'invest').length
    postEntry(db, p.userId, 'invest', -delta, `invest:${ev.id}:${seq}`, {
      eventId: ev.id, now, note: delta > 0 ? 'Coins committed' : 'Coins released from allocation',
    })
  }
  db.allocations = db.allocations.filter((a) => !(a.eventId === ev.id && a.userId === p.userId)).concat(next)
}

function requireAdmin(db: DB, actorId: string) {
  if (db.profiles.find((u) => u.id === actorId)?.role !== 'admin') throw new EngineError('forbidden', 'Council admin only')
}

export function openInvesting(db: DB, eventId: string, actorId: string, deadline: string, now = new Date()) {
  requireAdmin(db, actorId)
  const ev = db.events.find((e) => e.id === eventId)
  if (!ev) throw new EngineError('unknown_event', 'Event not found')
  if (ev.status === 'settled' || ev.status === 'archived') throw new EngineError('bad_state', 'Event is already finished')
  if (new Date(deadline).getTime() <= now.getTime()) throw new EngineError('deadline_passed', 'Deadline must be in the future')
  ev.status = 'investing'
  ev.investDeadline = deadline
  addAudit(db, actorId, 'investing.open', ev.title, `deadline ${deadline}`, now)
}

/** Locks investing and (per settings) expires every participant's unspent coins. */
export function closeInvesting(db: DB, eventId: string, actorId: string, now = new Date()) {
  requireAdmin(db, actorId)
  const ev = db.events.find((e) => e.id === eventId)
  if (!ev) throw new EngineError('unknown_event', 'Event not found')
  if (ev.status !== 'investing') throw new EngineError('bad_state', 'Investing is not open')
  ev.status = 'locked'
  let expired = 0
  if (ev.settings.expireUnspent) {
    for (const u of db.profiles.filter((p) => p.role === 'participant')) {
      const bal = balanceOf(db, u.id)
      if (bal > 0 && postEntry(db, u.id, 'expire', -bal, `expire:${ev.id}`, { eventId: ev.id, now, note: 'Unspent coins expired' })) expired += bal
    }
  }
  addAudit(db, actorId, 'investing.close', ev.title, `expired ${expired} BLC`, now)
}

/**
 * Provisional demo rule `prorata-pool`: the pool is every coin allocated in the event.
 * Backers of the winner split it pro-rata (largest-remainder rounding, whole coins).
 * If nobody backed the winner, all allocations are refunded.
 */
export function settlementPlan(allocs: Allocation[], winnerTeamId: string) {
  const pool = allocs.reduce((s, a) => s + a.amount, 0)
  const winners = new Map<string, number>()
  for (const a of allocs) if (a.teamId === winnerTeamId) winners.set(a.userId, (winners.get(a.userId) ?? 0) + a.amount)
  const winStake = [...winners.values()].reduce((s, v) => s + v, 0)
  if (winStake === 0) {
    const refunds = new Map<string, number>()
    for (const a of allocs) refunds.set(a.userId, (refunds.get(a.userId) ?? 0) + a.amount)
    return { pool, refunded: true, payouts: refunds }
  }
  const exact = [...winners].map(([userId, stake]) => ({ userId, share: (pool * stake) / winStake }))
  const payouts = new Map(exact.map((x) => [x.userId, Math.floor(x.share)]))
  let left = pool - [...payouts.values()].reduce((s, v) => s + v, 0)
  const order = [...exact].sort((a, b) => (b.share % 1) - (a.share % 1) || a.userId.localeCompare(b.userId))
  for (let i = 0; left > 0; i = (i + 1) % order.length, left--) payouts.set(order[i].userId, payouts.get(order[i].userId)! + 1)
  return { pool, refunded: false, payouts }
}

export function settle(db: DB, eventId: string, winnerTeamId: string, actorId: string, now = new Date()) {
  requireAdmin(db, actorId)
  const ev = db.events.find((e) => e.id === eventId)
  if (!ev) throw new EngineError('unknown_event', 'Event not found')
  if (db.results.some((r) => r.eventId === eventId) || ev.status === 'settled')
    throw new EngineError('already_settled', 'This event has already been settled')
  if (ev.status !== 'locked') throw new EngineError('bad_state', 'Close investing before settling')
  if (!db.teams.some((t) => t.id === winnerTeamId && t.eventId === eventId)) throw new EngineError('unknown_team', 'Winner must be a team in this event')

  const plan = settlementPlan(db.allocations.filter((a) => a.eventId === eventId), winnerTeamId)
  for (const [userId, amount] of plan.payouts) {
    postEntry(db, userId, plan.refunded ? 'refund' : 'payout', amount, `settle:${eventId}`, {
      eventId, now, note: plan.refunded ? 'No backers of the winner: allocation refunded' : 'Share of the winners’ pool',
    })
  }
  const paid = [...plan.payouts.values()].reduce((s, v) => s + v, 0)
  ev.status = 'settled'
  ev.winnerTeamId = winnerTeamId
  db.results.push({ eventId, winnerTeamId, pool: plan.pool, paidOut: paid, refunded: plan.refunded, confirmedBy: actorId, settledAt: now.toISOString() })
  addAudit(db, actorId, 'event.settle', ev.title, `winner ${winnerTeamId}, pool ${plan.pool}, ${plan.refunded ? 'refunded' : 'paid'} ${paid}`, now)
}

export function normaliseScore(scores: Record<string, number>, criteria: { key: string; max: number }[]): number {
  const max = criteria.reduce((s, c) => s + c.max, 0)
  if (!max) return 0
  const got = criteria.reduce((s, c) => s + Math.min(Math.max(scores[c.key] ?? 0, 0), c.max), 0)
  return Math.round((got / max) * 1000) / 10
}

export function roundAverage(evals: Evaluation[], eventId: string, teamId: string, n: 1 | 2): number | null {
  const xs = evals.filter((e) => e.eventId === eventId && e.teamId === teamId && e.roundNumber === n)
  return xs.length ? Math.round((xs.reduce((s, e) => s + e.total, 0) / xs.length) * 10) / 10 : null
}
