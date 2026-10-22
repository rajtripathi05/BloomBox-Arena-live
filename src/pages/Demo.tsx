import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Gavel, LogOut, Pause, Play, RotateCcw, ShieldCheck, SkipForward, Trophy, User } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BloomLogo } from '@/components/brand'
import { ModeBadge } from '@/components/ModeBadge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TeamDrawer, Ticker } from '@/demo/parts'
import { locate, PRESETS, schedule, settlement, STEPS, SUGGESTED, totalMs, type Alloc, type DemoTeam, type Preset, type Role } from '@/demo/script'
import * as S from '@/demo/stages'

/**
 * Timed interactive demo. Fully isolated: it imports only the scripted engine in src/demo and shared UI.
 * No backend, Supabase, AI provider or storage is used; all state lives in this component and is gone on exit.
 */

const fmt = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const roles: { r: Role; l: string; i: typeof User }[] = [{ r: 'participant', l: 'Participant', i: User }, { r: 'judge', l: 'Judge', i: Gavel }, { r: 'council', l: 'Council admin', i: ShieldCheck }]
const VIEWS = { welcome: S.Welcome, teams: S.Teams, ai: S.AiRound, judging: S.Judging, invest: S.Invest, market: S.Market, wallet: S.WalletStage, winner: S.Winner, council: S.Council }

/** Wall-clock timer that only advances while running and never passes `total`. Driven by Date.now deltas. */
function useClock(total: number, running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const last = useRef(0)
  useEffect(() => {
    if (!running) return
    last.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now(), d = now - last.current
      last.current = now
      setElapsed((e) => Math.min(total, e + d))
    }, 200)
    return () => clearInterval(id)
  }, [running, total])
  return [elapsed, setElapsed] as const
}

function useTabVisible() {
  const [v, setV] = useState(() => !document.hidden)
  useEffect(() => { const f = () => setV(!document.hidden); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f) }, [])
  return v
}

function Chooser({ onStart }: { onStart: (p: Preset, r: Role) => void }) {
  const [role, setRole] = useState<Role>('participant')
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <ModeBadge mode="simulated" />
        <h1 className="font-display mt-3 text-3xl font-bold tracking-tight md:text-5xl">Interactive demo</h1>
        <p className="mt-2 max-w-xl text-mute">Play through a complete fictional pitch event: AI scoring, live judging, investing your coins, the market close, your wallet and the winner reveal. Nothing you do here is saved or sent anywhere.</p>
      </motion.div>
      <h2 className="mt-7 text-xs font-bold uppercase tracking-wide text-mute">Watch as</h2>
      <div role="radiogroup" aria-label="Demo role" className="mt-2 grid grid-cols-3 gap-2">
        {roles.map(({ r, l, i: I }) => (
          <button key={r} role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={cn('flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ring-1 transition sm:flex-row sm:text-sm', role === r ? 'bg-bloom/15 ring-bloom text-white' : 'bg-panel/70 ring-line text-mute hover:text-white')}><I size={16} />{l}</button>
        ))}
      </div>
      <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-mute">Choose a length</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {PRESETS.map((p, k) => (
          <motion.button key={p.min} type="button" data-testid={`demo-${p.min}`} onClick={() => onStart(p.min, role)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * k }} whileHover={{ y: -3 }}
            className={cn('group rounded-2xl bg-gradient-to-b from-panel-2/80 to-panel p-5 text-left ring-1 ring-line transition hover:ring-bloom', p.min === 3 && 'ring-bloom/60')}>
            <p className="num text-4xl font-bold">{p.min}<span className="text-lg text-mute"> min</span></p>
            <p className="mt-1 font-semibold">{p.title}{p.min === 3 && <span className="ml-2 rounded-full bg-bloom/20 px-2 py-0.5 text-[10px] text-blue-300">Recommended</span>}</p>
            <p className="mt-1 text-xs text-mute">{p.d}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-bloom">Start <Play size={14} /></span>
          </motion.button>
        ))}
      </div>
      <Link to="/" className="mt-8 inline-flex items-center gap-1 text-sm text-mute hover:text-white"><ArrowLeft size={16} />Back to Home</Link>
    </div>
  )
}

function Player({ preset, role, onRestart, onChange }: { preset: Preset; role: Role; onRestart: () => void; onChange: () => void }) {
  const nav = useNavigate()
  const sched = useMemo(() => schedule(preset), [preset])
  const total = totalMs(preset)
  const [paused, setPaused] = useState(false)
  const visible = useTabVisible()
  const [elapsed, setElapsed] = useClock(total, !paused && visible)
  const done = elapsed >= total
  const { idx, p } = locate(sched, elapsed)
  const slot = sched[idx]
  const [alloc, setAlloc] = useState<Alloc>({})
  const [confirmed, setConfirmed] = useState(false)
  const [auto, setAuto] = useState(false)
  const [team, setTeam] = useState<DemoTeam | null>(null)

  // Market opens: lock in a suggested allocation if the visitor never confirmed one, so every run reaches a coherent outcome.
  const marketIdx = STEPS.findIndex((s) => s.id === 'market')
  useEffect(() => { if (idx >= marketIdx && !confirmed) { setAlloc(SUGGESTED); setConfirmed(true); setAuto(true) } }, [idx, marketIdx, confirmed])

  const seek = useCallback((i: number) => setElapsed(i >= sched.length ? total : sched[Math.max(0, i)].start), [sched, total, setElapsed])
  const prev = () => seek(p > 0.15 || idx === 0 ? idx : idx - 1)
  const next = () => seek(idx + 1)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, button, [role=dialog]')) return
      if (e.key === ' ') { e.preventDefault(); setPaused((x) => !x) }
      else if (e.key === 'ArrowRight') seek(idx + 1)
      else if (e.key === 'ArrowLeft') seek(p > 0.15 || idx === 0 ? idx : idx - 1)
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [idx, p, seek])

  const View = VIEWS[slot.id]
  const m = { idx, p }
  return (
    <div className="min-h-dvh pb-28">
      <header className="safe-t sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <Link to="/" aria-label="Back to Home" className="shrink-0"><BloomLogo h={28} /></Link>
          <ModeBadge mode="simulated" />
          <span className="hidden text-xs text-mute sm:inline">{preset}-min demo · {roles.find((r) => r.r === role)!.l}</span>
          <span className="num ml-auto flex items-center gap-1 text-xs text-mute" aria-label="Time elapsed and remaining"><Clock size={13} />{fmt(elapsed)} <span className="opacity-60">/ −{fmt(total - elapsed)}</span></span>
          <Button size="sm" variant="ghost" onClick={() => nav('/')} aria-label="Exit demo"><LogOut size={15} /><span className="hidden sm:inline">Exit Demo</span></Button>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 px-4 pb-2" aria-label="Demo progress">
          {sched.map((s, i) => (
            <button key={s.id} type="button" onClick={() => seek(i)} aria-label={`Go to ${s.label}`} aria-current={i === idx ? 'step' : undefined} className="group flex-1 text-left" style={{ flexGrow: s.end - s.start }}>
              <span className="block h-1.5 overflow-hidden rounded-full bg-white/10"><span className={cn('block h-full rounded-full', i < idx || done ? 'bg-win' : 'bg-bloom')} style={{ width: `${i < idx || done ? 100 : i === idx ? p * 100 : 0}%` }} /></span>
              <span className={cn('mt-1 hidden truncate text-[10px] md:block', i === idx ? 'font-semibold text-white' : 'text-mute group-hover:text-white')}>{s.label}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-3"><Ticker m={m} /></div>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {done ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg text-center">
            <Trophy className="mx-auto text-coin" size={48} />
            <h2 className="font-display mt-3 text-3xl font-bold">Event complete</h2>
            <p className="mt-2 text-mute">{settlement(alloc).winner.name} won the simulated Founders Cup. You finished with <b className="text-coin">{settlement(alloc).balance} BLC</b>. Everything was simulated and has been discarded.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={onRestart}><RotateCcw size={16} />Restart demo</Button>
              <Button variant="ghost" onClick={onChange}>Choose another length</Button>
              <Button variant="ghost" onClick={() => nav('/')}>Back to Home</Button>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.section key={slot.id} aria-label={slot.label} initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
              <View m={m} stepLeftMs={slot.end - elapsed} alloc={alloc} setAlloc={setAlloc} confirmed={confirmed} confirm={() => { setConfirmed(true); setAuto(false) }} autoAllocated={auto} role={role} pick={setTeam} />
            </motion.section>
          </AnimatePresence>
        )}
      </main>

      <nav aria-label="Demo controls" className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <span className="hidden text-xs text-mute sm:block">Step {idx + 1} of {sched.length} · <b className="text-white">{slot.label}</b></span>
          <div className="flex flex-1 items-center justify-center gap-1.5 sm:flex-none">
            <Button size="sm" variant="ghost" onClick={prev} aria-label="Previous step" disabled={done}><ChevronLeft size={16} /></Button>
            <Button size="sm" onClick={() => setPaused((x) => !x)} aria-label={paused ? 'Resume demo' : 'Pause demo'} disabled={done} className="min-w-24">{paused ? <><Play size={15} />Resume</> : <><Pause size={15} />Pause</>}</Button>
            <Button size="sm" variant="ghost" onClick={next} aria-label="Next step" disabled={done}><ChevronRight size={16} /></Button>
            {idx === 0 && !done && <Button size="sm" variant="ghost" onClick={next}><SkipForward size={15} />Skip intro</Button>}
            <Button size="sm" variant="ghost" onClick={onRestart} aria-label="Restart demo"><RotateCcw size={15} /></Button>
          </div>
        </div>
      </nav>

      <TeamDrawer team={team} m={m} onClose={() => setTeam(null)} />
    </div>
  )
}

export default function Demo() {
  const [cfg, setCfg] = useState<{ preset: Preset; role: Role; run: number } | null>(null)
  return cfg
    ? <Player key={cfg.run} preset={cfg.preset} role={cfg.role} onRestart={() => setCfg({ ...cfg, run: cfg.run + 1 })} onChange={() => setCfg(null)} />
    : <Chooser onStart={(preset, role) => setCfg({ preset, role, run: 0 })} />
}
