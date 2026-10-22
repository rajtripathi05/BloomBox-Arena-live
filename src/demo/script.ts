/**
 * Deterministic script for the timed interactive demo. Everything here is fictional and pure:
 * no network, no Supabase, no AI provider, no storage. State is derived from (preset, elapsed ms)
 * plus the visitor's in-memory allocation, so the same moment always renders the same numbers.
 */

export type Preset = 2 | 3 | 4
export type StepId = 'welcome' | 'teams' | 'ai' | 'judging' | 'invest' | 'market' | 'wallet' | 'winner' | 'council'
export type Role = 'participant' | 'judge' | 'council'

export const STEPS: { id: StepId; label: string }[] = [
  { id: 'welcome', label: 'Welcome' }, { id: 'teams', label: 'Teams' }, { id: 'ai', label: 'AI round' },
  { id: 'judging', label: 'Live judging' }, { id: 'invest', label: 'Invest' }, { id: 'market', label: 'Market' },
  { id: 'wallet', label: 'Wallet' }, { id: 'winner', label: 'Winner' }, { id: 'council', label: 'Council' },
]

/** Seconds per step. Each row sums exactly to the preset length; longer presets spend the extra time on teams, scoring and council. */
const DURATIONS: Record<Preset, number[]> = {
  2: [8, 14, 12, 14, 24, 14, 12, 12, 10],
  3: [12, 24, 20, 22, 30, 18, 16, 18, 20],
  4: [14, 34, 26, 30, 36, 22, 20, 22, 36],
}

export const PRESETS: { min: Preset; title: string; d: string }[] = [
  { min: 2, title: 'Quick showcase', d: 'The full participant journey with a compact council preview.' },
  { min: 3, title: 'Standard guided demo', d: 'More time on team profiles, scoring and the market.' },
  { min: 4, title: 'Expanded showcase', d: 'Deep dives into teams, judging and council tools.' },
]

export interface Slot { id: StepId; label: string; start: number; end: number }
export function schedule(preset: Preset): Slot[] {
  let t = 0
  return STEPS.map((s, i) => { const start = t; t += DURATIONS[preset][i] * 1000; return { ...s, start, end: t } })
}
export const totalMs = (preset: Preset) => preset * 60_000

/** Current step index and progress (0..1) within it. Past the end, stays on the last step at p = 1. */
export function locate(sched: Slot[], elapsed: number) {
  const i = sched.findIndex((s) => elapsed < s.end)
  if (i === -1) return { idx: sched.length - 1, p: 1 }
  const s = sched[i]
  return { idx: i, p: (elapsed - s.start) / (s.end - s.start) }
}
const stepIndex = (id: StepId) => STEPS.findIndex((s) => s.id === id)

export interface DemoTeam {
  id: string; name: string; initials: string; color: string; tagline: string; description: string; sector: string
  founders: string; ask: string; strengths: string[]
  ai: { problem: number; market: number; product: number; team: number }
  judges: [number, number, number]
  /** Final simulated crowd stake, and the exponent of its growth curve (<1 early surge, >1 late surge). */
  crowd: number; curve: number
}

export const JUDGES = ['Prof. A. Mehta', 'R. Kapoor · angel investor', 'S. Iyer · founder']
export const EVENT = { title: 'Founders Cup 2026', venue: 'Demo Auditorium', attendees: 412 }
export const START_BALANCE = 1000

export const TEAMS: DemoTeam[] = [
  { id: 'volt', name: 'VoltNest', initials: 'VN', color: '#22c55e', tagline: 'Battery swapping for e-rickshaws', sector: 'Mobility',
    description: 'Neighbourhood swap stations that get e-rickshaw drivers back on the road in 90 seconds instead of a 4-hour charge.',
    founders: 'Aarav S. · Nisha P.', ask: 'Pilot with 3 depots', strengths: ['Hardware prototype', 'Clear unit economics'],
    ai: { problem: 86, market: 84, product: 80, team: 78 }, judges: [84, 86, 81], crowd: 9200, curve: 0.8 },
  { id: 'medi', name: 'MediMesh', initials: 'MM', color: '#38bdf8', tagline: 'Telemedicine kiosks for rural clinics', sector: 'Health',
    description: 'Solar-powered kiosks that connect village patients to city doctors, with offline triage and e-prescriptions.',
    founders: 'Kavya R. · Dev M. · Ira T.', ask: '40 more kiosks', strengths: ['Live pilot data', 'Strong team', 'Social impact'],
    ai: { problem: 92, market: 86, product: 87, team: 88 }, judges: [90, 87, 92], crowd: 11800, curve: 1.8 },
  { id: 'shelf', name: 'Shelfie', initials: 'SH', color: '#f97316', tagline: 'Shelf analytics for kirana stores', sector: 'Retail AI',
    description: 'A phone photo of a shelf becomes a restock list and demand forecast for small neighbourhood stores.',
    founders: 'Rohan K. · Meera J.', ask: 'Distribution partner', strengths: ['Viral demo', 'Low cost to serve'],
    ai: { problem: 78, market: 80, product: 76, team: 70 }, judges: [80, 78, 83], crowd: 7400, curve: 0.45 },
  { id: 'tiffin', name: 'Tiffinly', initials: 'TF', color: '#e879f9', tagline: 'Zero-waste tiffin subscriptions', sector: 'Food',
    description: 'Home cooks deliver steel-tiffin meals to offices; the containers come back, so there is no packaging waste.',
    founders: 'Sana A. · Yash V.', ask: 'Kitchen expansion', strengths: ['Repeat customers', 'Sustainability'],
    ai: { problem: 72, market: 70, product: 74, team: 68 }, judges: [74, 79, 72], crowd: 5200, curve: 0.7 },
  { id: 'aqua', name: 'AquaSense', initials: 'AS', color: '#a78bfa', tagline: 'IoT leak sensors for housing societies', sector: 'IoT',
    description: 'Clip-on sensors that spot leaks and overflowing tanks, cutting a society\'s water bill by up to a fifth.',
    founders: 'Neel D. · Tara G.', ask: 'Society pilots', strengths: ['Measurable savings', 'Easy install'],
    ai: { problem: 80, market: 76, product: 82, team: 78 }, judges: [77, 75, 80], crowd: 4300, curve: 1.2 },
  { id: 'byte', name: 'ByteBazaar', initials: 'BB', color: '#facc15', tagline: 'Campus marketplace for students', sector: 'Marketplace',
    description: 'Buy, sell and rent textbooks, lab coats and gadgets inside a verified campus community.',
    founders: 'Kabir N.', ask: 'Two more campuses', strengths: ['Fast traction', 'Solo founder hustle'],
    ai: { problem: 64, market: 62, product: 68, team: 60 }, judges: [66, 70, 62], crowd: 2100, curve: 0.5 },
]
export const WINNER_ID = 'medi'
export const teamById = (id: string) => TEAMS.find((t) => t.id === id)!

export const aiTotal = (t: DemoTeam) => Math.round((t.ai.problem + t.ai.market + t.ai.product + t.ai.team) / 4 * 10) / 10
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export interface Moment { idx: number; p: number }

/** How far along (0..1) a team's AI result is revealed. */
export function aiReveal(m: Moment, teamIdx: number) {
  const ai = stepIndex('ai')
  if (m.idx < ai) return 0
  if (m.idx > ai) return 1
  const n = TEAMS.length, start = teamIdx / (n + 0.5), end = (teamIdx + 1) / (n + 0.5)
  return Math.max(0, Math.min(1, (m.p - start) / (end - start)))
}

/** Judge scores revealed so far for a team, one judge at a time. */
export function judgeScores(m: Moment, teamIdx: number): number[] {
  const j = stepIndex('judging'), t = TEAMS[teamIdx]
  if (m.idx < j) return []
  if (m.idx > j) return [...t.judges]
  const slots = TEAMS.length * 3 + 1
  return t.judges.filter((_, k) => m.p >= (teamIdx * 3 + k + 1) / slots)
}
export const onStage = (m: Moment) => Math.min(TEAMS.length - 1, Math.floor(m.p * TEAMS.length))

/** Market progress: the pool fills to 60% while investing is open, then to 100% as it closes. */
export function marketProgress(m: Moment) {
  const inv = stepIndex('invest'), mk = stepIndex('market')
  if (m.idx < inv) return 0
  if (m.idx === inv) return 0.6 * m.p
  if (m.idx === mk) return 0.6 + 0.4 * Math.min(1, m.p / 0.8)
  return 1
}
export const crowdStake = (t: DemoTeam, mp: number) => Math.round(t.crowd * Math.pow(mp, t.curve))

export type Alloc = Record<string, number>
export interface Row { team: DemoTeam; ai: number | null; judge: number | null; stake: number; audience: number | null; composite: number | null }

/** Leaderboard at a moment. Composite averages whatever rounds are known: AI 40%, judges 40%, audience 20%. */
export function board(m: Moment, alloc: Alloc = {}): Row[] {
  const mp = marketProgress(m)
  const userIn = m.idx >= stepIndex('invest')
  const stakes = TEAMS.map((t) => crowdStake(t, mp) + (userIn ? alloc[t.id] ?? 0 : 0))
  const max = Math.max(1, ...stakes)
  const rows = TEAMS.map((team, i): Row => {
    const ai = aiReveal(m, i) >= 1 ? aiTotal(team) : null
    const js = judgeScores(m, i)
    const judge = js.length ? Math.round(avg(js) * 10) / 10 : null
    const audience = mp > 0 ? Math.round((stakes[i] / max) * 1000) / 10 : null
    const parts: [number | null, number][] = [[ai, 0.4], [judge, 0.4], [audience, 0.2]]
    const known = parts.filter((x): x is [number, number] => x[0] !== null)
    const w = known.reduce((a, [, k]) => a + k, 0)
    const composite = w ? Math.round((known.reduce((a, [v, k]) => a + v * k, 0) / w) * 10) / 10 : null
    return { team, ai, judge, stake: stakes[i], audience, composite }
  })
  return rows.sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1) || TEAMS.indexOf(a.team) - TEAMS.indexOf(b.team))
}

export const allocated = (a: Alloc) => Object.values(a).reduce((x, y) => x + (y || 0), 0)

/** Allocation the demo applies if the visitor never confirms one, so an unattended run still completes. */
export const SUGGESTED: Alloc = { volt: 300, medi: 300, shelf: 200 }

export function validate(a: Alloc, balance = START_BALANCE): string | null {
  if (Object.values(a).some((v) => !Number.isInteger(v) || v < 0)) return 'Amounts must be whole, non-negative numbers.'
  if (allocated(a) > balance) return `That is ${allocated(a) - balance} BLC more than you have.`
  return null
}

/** Simulated pro-rata settlement: the whole pool is shared by stakes on the winner. */
export function settlement(alloc: Alloc) {
  const final = board({ idx: STEPS.length - 1, p: 1 }, alloc)
  const winner = final[0].team
  const pool = final.reduce((a, r) => a + r.stake, 0)
  const winnerPool = final[0].stake
  const mine = alloc[winner.id] ?? 0
  const returned = winnerPool ? Math.floor((mine / winnerPool) * pool) : 0
  const balance = START_BALANCE - allocated(alloc) + returned
  return { winner, pool, winnerPool, returned, balance, net: balance - START_BALANCE, final }
}

/** Potential return per team if it won, from the pools at a given moment. */
export function projected(m: Moment, alloc: Alloc) {
  const rows = board(m, alloc)
  const pool = rows.reduce((a, r) => a + r.stake, 0)
  return rows.filter((r) => alloc[r.team.id]).map((r) => ({ team: r.team, stake: alloc[r.team.id], ifWins: Math.floor((alloc[r.team.id] / r.stake) * pool) }))
}

const FEED: { step: StepId; at: number; text: string }[] = [
  { step: 'welcome', at: 0.05, text: `Doors open: ${EVENT.attendees} attendees checked in` },
  { step: 'welcome', at: 0.55, text: 'Six startups confirmed for the Founders Cup' },
  { step: 'teams', at: 0.2, text: 'VoltNest rolls its swap-station prototype on stage' },
  { step: 'teams', at: 0.6, text: 'MediMesh shares data from 12 village kiosks' },
  { step: 'ai', at: 0.03, text: 'AI rubric evaluation started' },
  { step: 'ai', at: 0.97, text: 'Round 1 complete: MediMesh tops the AI rubric' },
  ...TEAMS.map((t, i) => ({ step: 'judging' as const, at: (i * 3 + 0.5) / (TEAMS.length * 3 + 1), text: `${t.name} is on stage` })),
  { step: 'judging', at: 0.98, text: 'Round 2 closed: all judge scores in' },
  { step: 'invest', at: 0.03, text: 'Audience market is open. 1,000 BLC each' },
  { step: 'invest', at: 0.4, text: 'Shelfie is trending with first-years' },
  { step: 'invest', at: 0.85, text: 'Market closes soon' },
  { step: 'market', at: 0.3, text: 'Late surge of coins into MediMesh' },
  { step: 'market', at: 0.8, text: 'Market closed. Pools are locked' },
  { step: 'wallet', at: 0.2, text: 'Council is preparing the settlement' },
  { step: 'winner', at: 0.1, text: 'And the Founders Cup goes to…' },
  { step: 'winner', at: 0.35, text: 'MediMesh wins the Founders Cup 2026' },
  { step: 'council', at: 0.05, text: 'Council console preview (demo only)' },
]

/** Feed items that have happened by this moment, newest first. */
export function feed(m: Moment, limit = 6) {
  const out = FEED.filter((f) => { const s = stepIndex(f.step); return s < m.idx || (s === m.idx && f.at <= m.p) })
  return out.reverse().slice(0, limit)
}
