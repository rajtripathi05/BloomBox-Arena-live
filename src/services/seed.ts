/** Fictional demonstration data. Everything here is flagged isDemo and never reaches Supabase. */
import {
  addAudit, balanceOf, closeInvesting, initWallet, normaliseScore, setAllocations, settle, uid, type DB,
} from '../lib/engine'
import type { Criterion, EventSettings, Evaluation, Round, Team } from '../lib/types'

export const DEMO_USERS = {
  participant: { id: 'u_demo_participant', name: 'Aarav Demo', email: 'participant@demo.bloombox', role: 'participant' as const },
  judge: { id: 'u_demo_judge', name: 'Dr. Meera Judge', email: 'judge@demo.bloombox', role: 'judge' as const },
  admin: { id: 'u_demo_admin', name: 'Council Admin', email: 'admin@demo.bloombox', role: 'admin' as const },
}

const R1: Criterion[] = [
  { key: 'problem', label: 'Problem clarity', max: 10 },
  { key: 'market', label: 'Market size', max: 10 },
  { key: 'innovation', label: 'Innovation', max: 10 },
  { key: 'feasibility', label: 'Feasibility', max: 10 },
  { key: 'financials', label: 'Financial logic', max: 10 },
]
const R2: Criterion[] = [
  { key: 'delivery', label: 'Pitch delivery', max: 10 },
  { key: 'qa', label: 'Q&A handling', max: 10 },
  { key: 'model', label: 'Business model', max: 10 },
  { key: 'team', label: 'Team strength', max: 10 },
  { key: 'demo', label: 'Demo / traction', max: 10 },
]
export const defaultCriteria = { r1: R1, r2: R2 }

const PEOPLE = ['Ishaan Rao', 'Diya Shah', 'Kabir Nair', 'Anaya Iyer', 'Vihaan Joshi', 'Myra Kulkarni', 'Reyansh Gupta', 'Saanvi Patil', 'Arjun Mehta', 'Kiara Desai', 'Rohan Sawant', 'Tara Menon']
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6']

const LIVE_TEAMS: Pick<Team, 'name' | 'tagline' | 'description' | 'pitchTitle' | 'stage'>[] = [
  { name: 'AgriLoop', tagline: 'Soil sensors for small farms', description: 'Low-cost soil moisture and nutrient probes that text farmers when to water or fertilise, cutting input costs.', pitchTitle: 'Precision farming for ₹1,500', stage: 'Prototype' },
  { name: 'PaniPure', tagline: 'Community water filtration', description: 'Pay-per-litre filtration kiosks for housing societies with live water-quality reporting.', pitchTitle: 'Clean water, metered', stage: 'Pilot' },
  { name: 'CampusCart', tagline: 'Peer-to-peer campus resale', description: 'A verified student marketplace for textbooks, lab kits and hostel essentials.', pitchTitle: 'Resale, but trusted', stage: 'MVP' },
  { name: 'NeuroNote', tagline: 'Lecture notes that study back', description: 'Turns recorded lectures into summaries and spaced-repetition flashcards.', pitchTitle: 'Study smarter, not longer', stage: 'MVP' },
  { name: 'VoltVelo', tagline: 'Battery-swap e-bikes', description: 'Swap-and-go battery stations near metro exits for last-mile commuters.', pitchTitle: 'Last mile, zero wait', stage: 'Idea' },
  { name: 'ThriftTwist', tagline: 'Upcycled fashion drops', description: 'Student designers upcycle textile waste into limited weekly drops.', pitchTitle: 'Waste into wardrobe', stage: 'Pilot' },
]
const PAST_TEAMS: typeof LIVE_TEAMS = [
  { name: 'MediMate', tagline: 'Medicine reminders for elders', description: 'Voice-first reminders and refill alerts for senior citizens.', pitchTitle: 'Never miss a dose', stage: 'Pilot' },
  { name: 'LedgerLite', tagline: 'Bookkeeping for street vendors', description: 'Speech-based daily ledger and UPI reconciliation.', pitchTitle: 'Books by voice', stage: 'MVP' },
  { name: 'SolarShade', tagline: 'Rooftop solar for hostels', description: 'Shared rooftop solar financed by hostel savings.', pitchTitle: 'Hostel power, on the roof', stage: 'Idea' },
  { name: 'GigGuard', tagline: 'Insurance for gig workers', description: 'Micro-insurance priced per ride.', pitchTitle: 'Cover by the kilometre', stage: 'Prototype' },
]

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

function mkTeams(eventId: string, src: typeof LIVE_TEAMS, slotStart: Date): Team[] {
  return src.map((t, i) => ({
    ...t, id: `${eventId}_t${i + 1}`, eventId, initials: t.name.slice(0, 2).toUpperCase(), color: COLORS[i % COLORS.length],
    logoUrl: null, pitchSlot: new Date(slotStart.getTime() + i * 12 * 60000).toISOString(), status: 'pitched', isDemo: true,
  }))
}

function mkRounds(eventId: string, s: [Round['status'], Round['status'], Round['status']], vis: [boolean, boolean, boolean]): Round[] {
  const kinds: Round['kind'][] = ['ai', 'live', 'audience']
  const names = ['AI evaluation', 'Live panel', 'Audience investment']
  return ([1, 2, 3] as const).map((n, i) => ({
    id: `${eventId}_r${n}`, eventId, number: n, kind: kinds[i], name: names[i], status: s[i], scoreVisible: vis[i],
    criteria: n === 1 ? R1 : n === 2 ? R2 : [],
  }))
}

function mkEval(eventId: string, team: Team, n: 1 | 2, judgeId: string | null, salt: string, boost: number, now: Date): Evaluation {
  const crit = n === 1 ? R1 : R2
  const scores: Record<string, number> = {}
  crit.forEach((c) => { scores[c.key] = Math.max(3, Math.min(10, 5 + ((hash(team.id + c.key + salt) % 5)) + boost)) })
  return {
    id: uid('ev'), eventId, teamId: team.id, roundNumber: n, judgeId, source: n === 1 ? 'manual' : 'live',
    scores, total: normaliseScore(scores, crit), note: n === 1 ? 'Demo score entered manually. Not produced by an AI model.' : 'Demo judge score.',
    updatedAt: now.toISOString(), isDemo: true,
  }
}

export function seedDb(now = new Date()): DB {
  const H = 3600_000
  const settings = (expireUnspent: boolean): EventSettings => ({ expireUnspent, payoutRule: 'prorata-pool', weights: { r1: 0.3, r2: 0.4, r3: 0.3 } })
  const db: DB = { profiles: [], events: [], teams: [], rounds: [], evaluations: [], allocations: [], entries: [], results: [], audit: [] }
  const joined = new Date(now.getTime() - 40 * 24 * H).toISOString()

  for (const u of Object.values(DEMO_USERS)) db.profiles.push({ ...u, createdAt: joined, isDemo: true })
  PEOPLE.forEach((name, i) => db.profiles.push({
    id: `u_demo_p${i + 1}`, name, email: `${name.split(' ')[0].toLowerCase()}@demo.bloombox`, role: 'participant', createdAt: joined, isDemo: true,
  }))
  const participants = db.profiles.filter((p) => p.role === 'participant')
  participants.forEach((p) => initWallet(db, p.id, new Date(joined)))

  // Past, settled event
  const past = new Date(now.getTime() - 30 * 24 * H)
  const pastEv = {
    id: 'evt_monsoon25', title: 'Monsoon Pitch Night', description: 'Our previous demo pitch night, fully settled.',
    venue: 'Somaiya Auditorium', startsAt: past.toISOString(), status: 'investing' as const,
    investDeadline: new Date(past.getTime() + 3 * H).toISOString(), settings: settings(false), winnerTeamId: null, isDemo: true,
  }
  db.events.push(pastEv)
  const pastTeams = mkTeams(pastEv.id, PAST_TEAMS, past)
  db.teams.push(...pastTeams)
  db.rounds.push(...mkRounds(pastEv.id, ['complete', 'complete', 'complete'], [true, true, true]))
  pastTeams.forEach((t, i) => {
    db.evaluations.push(mkEval(pastEv.id, t, 1, null, 'p1', i === 1 ? 2 : 0, past), mkEval(pastEv.id, t, 2, DEMO_USERS.judge.id, 'p2', i === 1 ? 2 : 0, past))
  })
  const during = new Date(past.getTime() + H)
  participants.forEach((p, i) => {
    const stake = 200 + (i % 4) * 100
    const t = pastTeams[(i * 7 + (i % 3)) % 4]
    const t2 = pastTeams[(i + 1) % 4]
    setAllocations(db, { eventId: pastEv.id, userId: p.id, amounts: { [t.id]: stake, ...(i % 3 === 0 ? { [t2.id]: 100 } : {}) }, now: during })
  })
  closeInvesting(db, pastEv.id, DEMO_USERS.admin.id, new Date(past.getTime() + 4 * H))
  settle(db, pastEv.id, pastTeams[1].id, DEMO_USERS.admin.id, new Date(past.getTime() + 5 * H))

  // Live event (investing now)
  const live = {
    id: 'evt_arena26', title: 'BloomBox Pitch Arena 2026', description: 'Six student startups, three rounds, one virtual prediction game. Back the team you believe in with BloomBox Coins.',
    venue: 'KJSCE Seminar Hall, Vidyavihar, Mumbai', startsAt: new Date(now.getTime() - H).toISOString(), status: 'investing' as const,
    investDeadline: new Date(now.getTime() + 2 * 24 * H).toISOString(), settings: settings(true), winnerTeamId: null, isDemo: true,
  }
  db.events.push(live)
  const liveTeams = mkTeams(live.id, LIVE_TEAMS, new Date(now.getTime() - H))
  db.teams.push(...liveTeams)
  db.rounds.push(...mkRounds(live.id, ['complete', 'active', 'active'], [true, false, false]))
  liveTeams.forEach((t, i) => db.evaluations.push(mkEval(live.id, t, 1, null, 'a1', i === 0 ? 2 : i === 3 ? 1 : 0, now)))
  liveTeams.slice(0, 3).forEach((t, i) => db.evaluations.push(mkEval(live.id, t, 2, DEMO_USERS.judge.id, 'a2', i === 1 ? 2 : 0, now)))
  participants.forEach((p, i) => {
    if (p.id === DEMO_USERS.participant.id) return
    const bal = balanceOf(db, p.id)
    const a = Math.min(bal, 120 + (i % 3) * 60)
    if (a <= 0) return
    setAllocations(db, { eventId: live.id, userId: p.id, amounts: { [liveTeams[(i * 5) % 6].id]: a }, now: new Date(now.getTime() - 30 * 60000) })
  })

  // Upcoming event
  const up = {
    id: 'evt_spring27', title: 'BloomBox Spring Sprint', description: 'A fast five-team sprint for first-year founders.',
    venue: 'KJSCE Innovation Lab', startsAt: new Date(now.getTime() + 45 * 24 * H).toISOString(), status: 'upcoming' as const,
    investDeadline: new Date(now.getTime() + 45 * 24 * H + 4 * H).toISOString(), settings: settings(true), winnerTeamId: null, isDemo: true,
  }
  db.events.push(up)
  db.teams.push(...mkTeams(up.id, PAST_TEAMS.map((t, i) => ({ ...t, name: ['Bloomly', 'RailRoute', 'ChaiChain', 'FitForge'][i] })), new Date(up.startsAt)).map((t) => ({ ...t, status: 'registered' as const })))
  db.rounds.push(...mkRounds(up.id, ['pending', 'pending', 'pending'], [false, false, false]))

  addAudit(db, DEMO_USERS.admin.id, 'demo.seed', 'Demo data', 'Fictional demonstration data created', now)
  return db
}
