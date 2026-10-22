import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  allocated, board, feed, locate, schedule, settlement, START_BALANCE, STEPS, SUGGESTED, TEAMS, totalMs, validate, WINNER_ID, type Preset,
} from '../src/demo/script'

const presets: Preset[] = [2, 3, 4]

describe('demo timeline', () => {
  it.each(presets)('%i-minute schedule covers every step and ends exactly on time', (p) => {
    const s = schedule(p)
    expect(s.map((x) => x.id)).toEqual(STEPS.map((x) => x.id))
    expect(s[0].start).toBe(0)
    expect(s.at(-1)!.end).toBe(totalMs(p))
    s.forEach((x, i) => { expect(x.end).toBeGreaterThan(x.start); if (i) expect(x.start).toBe(s[i - 1].end) })
  })
  it('longer presets give teams, scoring and council more time', () => {
    const len = (p: Preset, id: string) => { const x = schedule(p).find((s) => s.id === id)!; return x.end - x.start }
    for (const id of ['teams', 'ai', 'judging', 'council']) expect(len(4, id)).toBeGreaterThan(len(2, id))
  })
  it('locate clamps past the end', () => {
    const s = schedule(2)
    expect(locate(s, 0)).toEqual({ idx: 0, p: 0 })
    expect(locate(s, totalMs(2) + 5000)).toEqual({ idx: STEPS.length - 1, p: 1 })
  })
})

describe('demo engine is deterministic', () => {
  it('same moment, same board', () => {
    const m = { idx: 5, p: 0.42 }
    expect(board(m, SUGGESTED)).toEqual(board(m, SUGGESTED))
    expect(feed(m)).toEqual(feed(m))
  })
  it('nothing is scored before the AI round', () => {
    expect(board({ idx: 0, p: 1 }).every((r) => r.composite === null && r.stake === 0)).toBe(true)
  })
})

describe('demo allocation and settlement', () => {
  it('validates the simulated balance', () => {
    expect(validate({ volt: 500, medi: 500 })).toBeNull()
    expect(validate({ volt: 1200 })).toMatch(/more than you have/)
    expect(validate({ volt: -5 })).toMatch(/non-negative/)
  })
  it('the scripted winner holds for any single-team allocation', () => {
    for (const t of TEAMS) expect(settlement({ [t.id]: START_BALANCE }).winner.id).toBe(WINNER_ID)
  })
  it('backing the winner pays out of the whole pool; other stakes expire', () => {
    const s = settlement({ medi: 400, volt: 100 })
    expect(s.returned).toBeGreaterThan(400)
    expect(s.balance).toBe(START_BALANCE - 500 + s.returned)
    expect(settlement({ byte: 300 }).balance).toBe(START_BALANCE - 300)
    expect(allocated(SUGGESTED)).toBeLessThanOrEqual(START_BALANCE)
  })
})

describe('demo isolation', () => {
  it('demo code never imports backend services, app state or the AI provider', () => {
    const files = [...readdirSync('src/demo').map((f) => join('src/demo', f)), 'src/pages/Demo.tsx']
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/from ['"]@\/(services|state)|@supabase\/|aiProvider|openrouter\.ai|\bfetch\(|localStorage\./i)
    }
  })
})
