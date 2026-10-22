import { AnimatePresence, motion } from 'motion/react'
import { Crown, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { BloomLogo, CoinIcon, InstitutionLogos, TeamLogo } from '@/components/brand'
import { Scene } from '@/components/Scene'
import { Spinner } from '@/components/widgets'
import { countdown, fmtNum } from '@/lib/utils'
import { statusLabel, teamRows } from '@/lib/select'
import { useApp, useNow } from '@/state/AppProvider'

/** Projector view: large type, high contrast, live-updating (realtime + refetch), reorders with animation. */
export default function Display() {
  const { eventId } = useParams()
  const { snap, online } = useApp()
  const now = useNow()
  if (!snap) return <Spinner />
  const ev = snap.events.find((e) => e.id === eventId)
  if (!ev) return <div className="grid min-h-dvh place-items-center">Event not found. <Link to="/app" className="ml-2 text-bloom">Back</Link></div>
  const rows = teamRows(snap, ev)
  const totalPool = rows.reduce((a, r) => a + r.stake, 0)
  const res = snap.results.find((r) => r.eventId === ev.id)
  const winner = res && rows.find((r) => r.team.id === res.winnerTeamId)
  const max = Math.max(1, ...rows.map((r) => r.composite ?? 0))

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-6 py-5 md:px-12 md:py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4"><BloomLogo h={56} /><div><h1 className="font-display text-3xl font-bold md:text-5xl">{ev.title}</h1><p className="text-lg text-mute">{statusLabel[ev.status]} · Virtual prediction game</p></div></div>
        <div className="flex items-center gap-4">
          {ev.status === 'investing' && <div className="text-right"><p className="text-sm uppercase tracking-widest text-mute">Investing closes in</p><p className="num text-4xl font-bold text-coin md:text-6xl">{countdown(ev.investDeadline, now)}</p></div>}
          <Link to={`/app/events/${ev.id}`} aria-label="Exit display mode" className="grid size-11 place-items-center rounded-full bg-white/5 text-mute hover:text-white"><X /></Link>
        </div>
      </header>

      <AnimatePresence>
        {winner && (
          <motion.section initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center gap-6 rounded-3xl bg-gradient-to-r from-coin/20 via-coin/10 to-coin/20 p-4 ring-2 ring-coin/60">
            <Scene kind="trophy" className="h-32 w-32 md:h-44 md:w-44" />
            <div><p className="text-sm font-bold uppercase tracking-[0.3em] text-coin">Winner</p><p className="font-display text-4xl font-bold md:text-7xl">{winner.team.name}</p><p className="text-lg text-mute">{winner.team.tagline}</p></div>
          </motion.section>
        )}
      </AnimatePresence>

      <ol className="grid flex-1 content-start gap-3">
        {rows.map((r, i) => (
          <motion.li layout transition={{ type: 'spring', stiffness: 220, damping: 26 }} key={r.team.id} className="flex items-center gap-2 rounded-2xl bg-panel/90 p-3 ring-1 ring-line md:gap-6 md:p-5">
            <span className="num w-6 text-center text-2xl font-bold text-mute md:w-10 md:text-5xl">{i + 1}</span>
            <span className="hidden md:inline-flex"><TeamLogo team={r.team} size={64} /></span><span className="md:hidden"><TeamLogo team={r.team} size={36} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-display flex items-center gap-2 truncate text-lg font-bold md:text-4xl">{r.team.name}{ev.winnerTeamId === r.team.id && <Crown className="text-coin" />}</p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: r.team.color }} animate={{ width: `${((r.composite ?? 0) / max) * 100}%` }} transition={{ type: 'spring', stiffness: 60, damping: 16 }} /></div>
            </div>
            <div className="hidden text-center md:block"><p className="num text-2xl font-bold">{r.r1?.toFixed(1) ?? '–'}</p><p className="text-xs uppercase text-mute">AI</p></div>
            <div className="hidden text-center md:block"><p className="num text-2xl font-bold">{r.r2?.toFixed(1) ?? '–'}</p><p className="text-xs uppercase text-mute">Live</p></div>
            <div className="text-center"><p className="num flex items-center gap-1 text-base font-bold text-coin md:text-3xl"><CoinIcon size={24} />{fmtNum(r.stake)}</p><p className="text-xs uppercase text-mute">backed</p></div>
            <div className="min-w-14 text-right"><p className="num text-2xl font-bold md:text-6xl">{r.composite?.toFixed(1) ?? '–'}</p></div>
          </motion.li>
        ))}
      </ol>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-mute">
        <InstitutionLogos />
        <p className="text-sm">{fmtNum(totalPool)} BLC backed in total · {online ? 'Live' : 'Offline: showing last update'} · BLC are virtual points with no cash value</p>
      </footer>
    </div>
  )
}
