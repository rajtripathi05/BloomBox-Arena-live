import { describe, expect, it } from 'vitest'
import {
  balanceOf, closeInvesting, committedTo, EngineError, initWallet, setAllocations, settle, settlementPlan,
  type DB,
} from '../src/lib/engine'

const now = new Date('2026-11-01T10:00:00Z')
const later = '2026-11-01T12:00:00Z'

function makeDb(): DB {
  const settings = { expireUnspent: true, payoutRule: 'prorata-pool' as const, weights: { r1: 1, r2: 1, r3: 1 } }
  const base = { createdAt: now.toISOString() }
  return {
    profiles: [
      { id: 'a', name: 'A', email: 'a@x', role: 'participant', ...base },
      { id: 'b', name: 'B', email: 'b@x', role: 'participant', ...base },
      { id: 'c', name: 'C', email: 'c@x', role: 'participant', ...base },
      { id: 'adm', name: 'Admin', email: 'adm@x', role: 'admin', ...base },
    ],
    events: [{ id: 'e', title: 'E', description: '', venue: '', startsAt: later, status: 'investing', investDeadline: later, settings, winnerTeamId: null }],
    teams: ['t1', 't2'].map((id) => ({
      id, eventId: 'e', name: id, tagline: '', description: '', initials: id, color: '#fff', logoUrl: null,
      pitchTitle: '', pitchSlot: '', stage: '', status: 'pitched' as const,
    })),
    rounds: [], evaluations: [], allocations: [], entries: [], results: [], audit: [],
  }
}

describe('wallet', () => {
  it('grants 1000 BLC exactly once', () => {
    const db = makeDb()
    expect(initWallet(db, 'a', now)).toBe(true)
    expect(initWallet(db, 'a', now)).toBe(false)
    expect(initWallet(db, 'a', now)).toBe(false)
    expect(balanceOf(db, 'a')).toBe(1000)
    expect(db.entries).toHaveLength(1)
  })
})

describe('allocation', () => {
  it('moves coins to commitments and supports reallocation', () => {
    const db = makeDb(); initWallet(db, 'a', now)
    setAllocations(db, { eventId: 'e', userId: 'a', amounts: { t1: 600, t2: 100 }, now })
    expect(balanceOf(db, 'a')).toBe(300)
    setAllocations(db, { eventId: 'e', userId: 'a', amounts: { t1: 200, t2: 500 }, now })
    expect(balanceOf(db, 'a')).toBe(300)
    expect(committedTo(db, 'e', 'a')).toBe(700)
    setAllocations(db, { eventId: 'e', userId: 'a', amounts: { t1: 0, t2: 0 }, now })
    expect(balanceOf(db, 'a')).toBe(1000)
  })

  it('rejects overspending, fractions, negatives and foreign teams', () => {
    const db = makeDb(); initWallet(db, 'a', now)
    const code = (amounts: Record<string, number>) => {
      try { setAllocations(db, { eventId: 'e', userId: 'a', amounts, now }) } catch (e) { return (e as EngineError).code }
    }
    expect(code({ t1: 1001 })).toBe('insufficient_funds')
    expect(code({ t1: 600, t2: 600 })).toBe('insufficient_funds')
    expect(code({ t1: 1.5 })).toBe('invalid_amount')
    expect(code({ t1: -5 })).toBe('invalid_amount')
    expect(code({ zzz: 5 })).toBe('unknown_team')
    expect(balanceOf(db, 'a')).toBe(1000)
  })

  it('enforces the deadline and event status', () => {
    const db = makeDb(); initWallet(db, 'a', now)
    expect(() => setAllocations(db, { eventId: 'e', userId: 'a', amounts: { t1: 10 }, now: new Date(later) })).toThrow(/deadline/)
    db.events[0].status = 'locked'
    expect(() => setAllocations(db, { eventId: 'e', userId: 'a', amounts: { t1: 10 }, now })).toThrow(/not open/)
  })
})

describe('settlement', () => {
  function seeded() {
    const db = makeDb()
    for (const u of ['a', 'b', 'c']) initWallet(db, u, now)
    setAllocations(db, { eventId: 'e', userId: 'a', amounts: { t1: 300, t2: 100 }, now })
    setAllocations(db, { eventId: 'e', userId: 'b', amounts: { t1: 100 }, now })
    setAllocations(db, { eventId: 'e', userId: 'c', amounts: { t2: 500 }, now })
    closeInvesting(db, 'e', 'adm', now)
    return db
  }

  it('expires unspent coins when investing closes', () => {
    const db = seeded()
    expect(balanceOf(db, 'a')).toBe(0)
    expect(balanceOf(db, 'b')).toBe(0)
    expect(db.entries.some((e) => e.kind === 'expire')).toBe(true)
  })

  it('pays the pool pro-rata to winner backers and never double-settles', () => {
    const db = seeded()
    settle(db, 'e', 't1', 'adm', now)
    const pool = 1000
    expect(balanceOf(db, 'a')).toBe(750) // 300/400 of pool
    expect(balanceOf(db, 'b')).toBe(250)
    expect(balanceOf(db, 'c')).toBe(0)
    expect(balanceOf(db, 'a') + balanceOf(db, 'b') + balanceOf(db, 'c')).toBe(pool)
    expect(() => settle(db, 'e', 't1', 'adm', now)).toThrow(/already/)
    expect(balanceOf(db, 'a')).toBe(750)
  })

  it('refunds allocations when nobody backed the winner', () => {
    const db = seeded()
    db.allocations = db.allocations.filter((a) => a.teamId !== 't1')
    settle(db, 'e', 't1', 'adm', now)
    expect(db.results[0].refunded).toBe(true)
    expect(balanceOf(db, 'a')).toBe(100)
    expect(balanceOf(db, 'c')).toBe(500)
  })

  it('only council admins can settle, and rounding never loses coins', () => {
    const db = seeded()
    expect(() => settle(db, 'e', 't1', 'a', now)).toThrow(/admin/i)
    const plan = settlementPlan(
      [{ eventId: 'e', userId: 'x', teamId: 'w', amount: 1 }, { eventId: 'e', userId: 'y', teamId: 'w', amount: 1 }, { eventId: 'e', userId: 'z', teamId: 'w', amount: 1 }, { eventId: 'e', userId: 'q', teamId: 'l', amount: 1 }],
      'w',
    )
    expect([...plan.payouts.values()].reduce((s, v) => s + v, 0)).toBe(plan.pool)
  })
})
