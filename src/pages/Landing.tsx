import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, Bot, Coins, Gavel, Mic2, PlayCircle, ShieldCheck, Trophy, User, Wallet, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BloomLogo, InstitutionLogos, TeamLogo } from '@/components/brand'
import { InstallButton } from '@/components/InstallButton'
import { ModeBadge } from '@/components/ModeBadge'
import { Scene } from '@/components/Scene'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { VirtualNote } from '@/components/widgets'
import { Leaderboard, logo, Num } from '@/demo/parts'
import { board, marketProgress, STEPS, TEAMS, type Moment } from '@/demo/script'
import { cn } from '@/lib/utils'
import { useApp } from '@/state/AppProvider'

const rounds = [
  { icon: Bot, t: 'AI evaluation', d: 'Every pitch deck is scored against a fixed rubric, labelled with its source.' },
  { icon: Mic2, t: 'Live panel', d: 'Judges score each team on stage; the council releases numbers to the scoreboard.' },
  { icon: Coins, t: 'Audience investment', d: 'Spread 1,000 virtual BloomBox Coins across the teams you believe in.' },
]
const tour = [
  { icon: User, t: 'Participants', d: 'Browse startups, back them with BLC before the deadline, track your wallet and watch the leaderboard live.' },
  { icon: Gavel, t: 'Judges', d: 'Score teams on stage against shared criteria. Scores are audited and released by the council.' },
  { icon: ShieldCheck, t: 'Council', d: 'Create events, manage rounds and scores, open and close the market, then declare and settle results.' },
]

const idx = (id: string) => STEPS.findIndex((s) => s.id === id)
/** 24-second scripted loop through judging → investing → market, reusing the demo engine. Never real data. */
function usePreviewMoment(): Moment {
  const [t, setT] = useState(0)
  useEffect(() => { const i = setInterval(() => setT((x) => (x + 0.5) % 24), 500); return () => clearInterval(i) }, [])
  if (t < 8) return { idx: idx('judging'), p: t / 8 }
  if (t < 14) return { idx: idx('invest'), p: (t - 8) / 6 }
  return { idx: idx('market'), p: Math.min(1, (t - 14) / 8) }
}

function LivePreview() {
  const m = usePreviewMoment()
  const rows = board(m, {})
  const pool = rows.reduce((a, r) => a + r.stake, 0)
  const phase = m.idx === idx('judging') ? 1 : 2
  return (
    <section aria-labelledby="preview-h" className="mt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-bloom">Live event preview</p><h2 id="preview-h" className="font-display text-2xl font-bold md:text-3xl">What event night looks like</h2></div>
        <ModeBadge mode="simulated" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold"><span className="size-2 animate-pulse rounded-full bg-loss" />Founders Cup · {phase === 1 ? 'Live judging' : marketProgress(m) < 1 ? 'Audience market open' : 'Market closed'}</span>
            <span className="text-xs text-mute">Fictional teams</span>
          </div>
          <Leaderboard m={m} alloc={{}} compact />
        </Card>
        <div className="grid gap-4">
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-mute">Round timeline</p>
            <ol className="mt-3 flex items-center gap-2">
              {['AI round', 'Judging', 'Market', 'Results'].map((r, i) => (
                <li key={r} className="flex flex-1 flex-col items-center gap-1 text-center">
                  <span className={cn('grid size-8 place-items-center rounded-full text-xs font-bold ring-1', i < phase ? 'bg-win/20 text-win ring-win/40' : i === phase ? 'bg-bloom text-white ring-bloom' : 'bg-white/5 text-mute ring-line')}>{i + 1}</span>
                  <span className="text-[10px] text-mute">{r}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="bg-gradient-to-br from-coin/15 to-panel ring-coin/30">
            <div className="flex items-center justify-between"><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mute"><Wallet size={14} />BLC wallet</p><span className="text-[10px] font-bold text-coin">SIMULATED</span></div>
            <p className="num mt-2 text-3xl font-bold">1,000 <span className="text-sm text-coin">BLC</span></p>
            <div className="mt-2 flex justify-between text-xs text-mute"><span>Total pool</span><Num value={pool} className="font-bold text-coin" /></div>
          </Card>
        </div>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
        {TEAMS.map((t) => (
          <div key={t.id} className="w-56 shrink-0 rounded-2xl bg-panel/80 p-3 ring-1 ring-line">
            <div className="flex items-center gap-2"><TeamLogo team={logo(t)} size={34} /><div className="min-w-0"><p className="truncate text-sm font-bold">{t.name}</p><p className="truncate text-[11px] text-mute">{t.tagline}</p></div></div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Landing() {
  const { session, isDemo, loadError, online, loading } = useApp()
  const nav = useNavigate()
  const [noBackend, setNoBackend] = useState(false)
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const glowY = useTransform(scrollY, [0, 600], [0, reduce ? 0 : 120])
  const mode = isDemo ? 'demo' : loading ? 'connecting' : loadError ? 'error' : 'live'

  function enter() {
    if (isDemo) { setNoBackend(true); return }
    nav(session ? '/app' : '/auth')
  }

  return (
    <div className="relative overflow-x-clip">
      <motion.div aria-hidden style={{ y: glowY }} className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px]">
        <div className="absolute left-1/2 top-[-120px] h-[520px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,.35),transparent)]" />
        <div className="absolute right-[-10%] top-[220px] h-[320px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(245,185,66,.14),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      </motion.div>

      <div className="mx-auto max-w-6xl px-4 pb-16">
        <header className="safe-t flex items-center justify-between gap-3 py-4">
          <div className="flex min-w-0 items-center gap-3"><BloomLogo h={38} /><span className="font-display hidden text-lg font-bold sm:inline">BloomBox Pitch Arena</span></div>
          <div className="flex items-center gap-2">
            <ModeBadge mode={mode} />
            {session ? <Button asChild size="sm" variant="ghost"><Link to="/app">Open app</Link></Button> : !isDemo && <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>}
          </div>
        </header>

        <section className="grid items-center gap-8 py-8 md:grid-cols-[1.15fr_1fr] md:py-14">
          <div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] font-bold uppercase tracking-[.25em] text-bloom">BloomBox E-Cell · KJSSE</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="font-display mt-3 text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
              The live arena for<br /><span className="bg-gradient-to-r from-blue-400 via-sky-300 to-coin bg-clip-text text-transparent">startup pitches.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-4 max-w-xl text-base text-mute md:text-lg">
              AI scoring, live judges and an audience market of virtual BloomBox Coins. Back the startup you believe in and watch the scoreboard move.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={enter} data-testid="enter-arena">Enter Arena <ArrowRight size={18} /></Button>
              <Button asChild size="lg" variant="coin"><Link to="/demo" data-testid="try-demo"><PlayCircle size={18} />Try Interactive Demo</Link></Button>
              <InstallButton size="lg" variant="ghost" />
            </motion.div>
            <p className="mt-4 max-w-xl text-xs text-mute">
              {isDemo
                ? <>This build has no Supabase connection, so <b className="text-coin">connected mode is unavailable</b>. The interactive demo is a scripted, fictional event: nothing in it is real event data.</>
                : mode === 'error'
                  ? <span className="text-loss"><WifiOff size={12} className="mr-1 inline" />Supabase is configured but could not be reached{!online && ' (you are offline)'}. No data is being simulated in its place.</span>
                  : <>Enter Arena uses the live Supabase backend. The interactive demo is separate, fictional and never touches real accounts or coins.</>}
            </p>
            <AnimatePresence>
              {noBackend && (
                <motion.div role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Card className="mt-4 ring-coin/40">
                    <p className="font-semibold">Connected mode is not available</p>
                    <p className="mt-1 text-sm text-mute">Supabase is not configured for this build (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), so there is no live event to join. You can explore with fictional data instead.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="coin" size="sm"><Link to="/demo">Try Interactive Demo</Link></Button>
                      <Button asChild variant="ghost" size="sm"><Link to={session ? '/app' : '/auth'}>Open demo sandbox (local, fictional)</Link></Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative">
            <Scene kind="arena" className="h-64 w-full md:h-[26rem]" />
            <div className="pointer-events-none absolute inset-x-6 bottom-2 flex justify-center gap-6 text-center">
              {[['6', 'startups'], ['3', 'rounds'], ['1,000', 'BLC each']].map(([n, l]) => <div key={l}><p className="num text-xl font-bold md:text-2xl">{n}</p><p className="text-[10px] uppercase tracking-wide text-mute">{l}</p></div>)}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3" aria-label="How it works">
          {rounds.map((r, i) => (
            <motion.div key={r.t} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <Card className="h-full"><div className="flex items-center gap-2"><span className="num text-xs font-bold text-mute">0{i + 1}</span><r.icon className="text-bloom" size={20} /></div><h2 className="font-display mt-3 text-lg font-bold">{r.t}</h2><p className="mt-1 text-sm text-mute">{r.d}</p></Card>
            </motion.div>
          ))}
        </section>

        <LivePreview />

        <section aria-labelledby="tour-h" className="mt-14">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-bloom">Feature tour</p>
          <h2 id="tour-h" className="font-display text-2xl font-bold md:text-3xl">One app, three roles</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {tour.map((x, i) => (
              <motion.div key={x.t} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <Card className="h-full"><x.icon className="text-coin" /><h3 className="font-display mt-3 text-lg font-bold">{x.t}</h3><p className="mt-1 text-sm text-mute">{x.d}</p></Card>
              </motion.div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild variant="coin"><Link to="/demo"><Trophy size={16} />Play the 2–4 minute demo</Link></Button>
            <span className="text-xs text-mute">Pick participant, judge or council view. No sign-up.</span>
          </div>
        </section>

        <Card className="mt-10 flex items-start gap-3 bg-coin/5 ring-coin/30">
          <ShieldCheck className="mt-0.5 shrink-0 text-coin" />
          <div className="space-y-1"><p className="font-semibold">A virtual prediction game. Not gambling.</p><VirtualNote /></div>
        </Card>

        <footer className="mt-10 space-y-3 border-t border-line pt-6">
          <InstitutionLogos />
          <p className="text-xs text-mute">BloomBox is the student-run Entrepreneurship Cell at K. J. Somaiya College of Engineering, Mumbai.</p>
        </footer>
      </div>
    </div>
  )
}
