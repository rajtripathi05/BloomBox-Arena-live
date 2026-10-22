import type { AdminSnapshot, Criterion, EvalSource, PitchEvent, Profile, Role, Snapshot, Team } from '../lib/types'

export interface SessionUser { id: string; email: string; name: string; role: Role }
export type Mode = 'demo' | 'supabase'

export interface ScoreInput {
  eventId: string
  teamId: string
  roundNumber: 1 | 2
  scores: Record<string, number>
  note?: string
  source: EvalSource
}

/**
 * Service boundary. Components only talk to this interface; the demo and Supabase
 * implementations are selected once at startup in services/index.ts and never mixed.
 */
export interface Api {
  mode: Mode
  getSession(): Promise<SessionUser | null>
  onAuthChange(cb: () => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  load(): Promise<Snapshot>
  /** Subscribe to server-side changes. Callbacks only trigger a re-fetch; they never carry authority. */
  subscribe(cb: () => void): () => void

  allocate(eventId: string, amounts: Record<string, number>): Promise<void>

  loadAdmin(): Promise<AdminSnapshot>
  saveEvent(e: Partial<PitchEvent> & { title: string }): Promise<string>
  archiveEvent(eventId: string): Promise<void>
  saveTeam(t: Partial<Team> & { eventId: string; name: string }): Promise<string>
  removeTeam(teamId: string): Promise<void>
  uploadLogo(teamId: string, file: File): Promise<string>
  saveRound(roundId: string, patch: { status?: 'pending' | 'active' | 'complete'; scoreVisible?: boolean; criteria?: Criterion[]; name?: string }): Promise<void>
  submitEvaluation(s: ScoreInput): Promise<void>
  correctEvaluation(evaluationId: string, scores: Record<string, number>, reason: string): Promise<void>
  openInvesting(eventId: string, deadlineIso: string): Promise<void>
  closeInvesting(eventId: string): Promise<void>
  settle(eventId: string, winnerTeamId: string): Promise<void>
  setRole(userId: string, role: Role): Promise<void>
  resetDemo?(): Promise<void>
  demoLogin?(role: Role): Promise<void>
  listProfiles?(): Promise<Profile[]>
}

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
