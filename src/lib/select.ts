import { roundAverage } from './engine'
import type { PitchEvent, Snapshot, Team } from './types'

export interface TeamRow {
  team: Team
  r1: number | null
  r2: number | null
  stake: number
  backers: number
  /** Stake as a percentage of the event's most-backed team (0-100). */
  r3: number
  composite: number | null
}

export function teamRows(s: Snapshot, ev: PitchEvent): TeamRow[] {
  const teams = s.teams.filter((t) => t.eventId === ev.id && t.status !== 'withdrawn')
  const stakes = s.stakes.filter((x) => x.eventId === ev.id)
  const max = Math.max(1, ...stakes.map((x) => x.total))
  const w = ev.settings.weights
  return teams
    .map((team) => {
      const st = stakes.find((x) => x.teamId === team.id)
      const r1 = roundAverage(s.evaluations, ev.id, team.id, 1)
      const r2 = roundAverage(s.evaluations, ev.id, team.id, 2)
      const r3 = Math.round(((st?.total ?? 0) / max) * 1000) / 10
      const parts: [number | null, number][] = [[r1, w.r1], [r2, w.r2], [(st?.total ?? 0) > 0 ? r3 : null, w.r3]]
      const used = parts.filter(([v]) => v !== null)
      const wsum = used.reduce((a, [, wt]) => a + wt, 0)
      const composite = used.length && wsum ? Math.round((used.reduce((a, [v, wt]) => a + (v as number) * wt, 0) / wsum) * 10) / 10 : null
      return { team, r1, r2, stake: st?.total ?? 0, backers: st?.backers ?? 0, r3, composite }
    })
    .sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1) || b.stake - a.stake)
}

export const isActive = (e: PitchEvent) => e.status === 'live' || e.status === 'investing' || e.status === 'locked'
export const featuredEvent = (s: Snapshot) =>
  s.events.find((e) => e.status === 'investing') ?? s.events.find(isActive) ?? s.events.find((e) => e.status === 'upcoming') ?? s.events.find((e) => e.status === 'settled') ?? null

export const statusLabel: Record<PitchEvent['status'], string> = {
  draft: 'Draft', upcoming: 'Upcoming', live: 'Live', investing: 'Investing open', locked: 'Locked', settled: 'Results in', archived: 'Archived',
}
