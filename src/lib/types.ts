export type Role = 'participant' | 'judge' | 'admin'
export type EventStatus = 'draft' | 'upcoming' | 'live' | 'investing' | 'locked' | 'settled' | 'archived'
export type RoundKind = 'ai' | 'live' | 'audience'
export type EvalSource = 'manual' | 'import' | 'live'
export type EntryKind = 'grant' | 'invest' | 'refund' | 'payout' | 'expire' | 'adjust'

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
  /** true for fictional seed users */
  isDemo?: boolean
}

export interface EventSettings {
  /** Unspent coins expire when investing closes. */
  expireUnspent: boolean
  /** Settlement rule id; see lib/settlement.ts. */
  payoutRule: 'prorata-pool'
  /** Weights used for the composite leaderboard (sum need not be 1). */
  weights: { r1: number; r2: number; r3: number }
}

export interface PitchEvent {
  id: string
  title: string
  description: string
  venue: string
  startsAt: string
  status: EventStatus
  investDeadline: string
  settings: EventSettings
  winnerTeamId: string | null
  isDemo?: boolean
}

export interface Team {
  id: string
  eventId: string
  name: string
  tagline: string
  description: string
  initials: string
  color: string
  logoUrl: string | null
  pitchTitle: string
  pitchSlot: string
  stage: string
  status: 'registered' | 'shortlisted' | 'pitched' | 'withdrawn'
  isDemo?: boolean
}

export interface Criterion { key: string; label: string; max: number }

export interface Round {
  id: string
  eventId: string
  number: 1 | 2 | 3
  kind: RoundKind
  name: string
  status: 'pending' | 'active' | 'complete'
  scoreVisible: boolean
  criteria: Criterion[]
}

export interface Evaluation {
  id: string
  eventId: string
  teamId: string
  roundNumber: 1 | 2
  judgeId: string | null
  source: EvalSource
  scores: Record<string, number>
  /** 0-100 normalised total */
  total: number
  note: string
  updatedAt: string
  /** true when seeded rather than produced by a real AI model or judge */
  isDemo?: boolean
}

export interface Allocation { eventId: string; userId: string; teamId: string; amount: number }

export interface LedgerEntry {
  id: string
  userId: string
  eventId: string | null
  kind: EntryKind
  amount: number
  balanceAfter: number
  /** Idempotency key, unique per user. */
  ref: string
  note: string
  createdAt: string
}

export interface EventResult {
  eventId: string
  winnerTeamId: string
  pool: number
  paidOut: number
  refunded: boolean
  confirmedBy: string
  settledAt: string
}

export interface AuditEntry {
  id: string
  actorId: string | null
  action: string
  subject: string
  detail: string
  createdAt: string
}

export interface TeamStake { eventId: string; teamId: string; total: number; backers: number }
export interface LeaderRow { eventId: string | null; userId: string; name: string; total: number; net: number; isYou?: boolean }

/** Everything the UI needs, already filtered to what the viewer may see. */
export interface Snapshot {
  events: PitchEvent[]
  teams: Team[]
  rounds: Round[]
  evaluations: Evaluation[]
  myEntries: LedgerEntry[]
  myAllocations: Allocation[]
  stakes: TeamStake[]
  leaderboard: LeaderRow[]
  results: EventResult[]
  serverTime: string
}

export interface AdminSnapshot {
  users: Profile[]
  entries: LedgerEntry[]
  audit: AuditEntry[]
}
