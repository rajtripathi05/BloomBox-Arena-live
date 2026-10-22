import { motion } from 'motion/react'
import { ArrowRight, Bot, CalendarDays, Coins, Crown, Mic2, MapPin, Trophy, Tv } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CoinIcon, TeamLogo } from '@/components/brand'
import { Scene } from '@/components/Scene'
import { Button } from '@/components/ui/button'
import { Badge, Card, Empty } from '@/components/ui/card'
import { PageTitle, Podium, ScoreBar, Spinner, StageBadge, TeamCard } from '@/components/widgets'
import { fmtDate, fmtNum, countdown } from '@/lib/utils'
import { featuredEvent, isActive, statusLabel, teamRows } from '@/lib/select'
import type { PitchEvent, Snapshot } from '@/lib/types'
import { useApp, useNow } from '@/state/AppProvider'

const tone = (e: PitchEvent) => (e.status === 'investing' ? 'gold' : e.status === 'live' ? 'red' : e.status === 'settled' ? 'green' : 'blue') as 'gold' | 'red' | 'green' | 'blue'

function useSnap() {
  const { snap, loading, loadError } = useApp()
  return { snap, loading, loadError }
}
function Gate({ children }: { children: (s: Snapshot) => React.ReactNode }) {
  const { snap, loading, loadError } = useSnap()
  if (!snap) return loading ? <Spinner /> : <Empty title="Could not load data">{loadError ?? 'Check your connection and try again.'}</Empty>
  return <>{children(snap)}</>
}

export function EventCard({ e, s }: { e: PitchEvent; s: Snapshot }) {
  const n = s.teams.filter((t) => t.eventId === e.id).length
  return (
    <Link to={`/app/events/${e.id}`} className="block">
      <Card className="transition hover:ring-bloom/60">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-bold">{e.title}</h3>
          <div className="flex shrink-0 gap-1">{e.isDemo && <Badge>Demo</Badge>}<Badge tone={tone(e)}>{statusLabel[e.status]}</Badge></div>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-mute">{e.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
          <span className="flex items-center gap-1"><CalendarDays size={13} />{fmtDate(e.startsAt)}</span>
          <span className="flex items-center gap-1"><MapPin size={13} />{e.venue}</span>
          <span>{n} teams</span>
        </div>
      </Card>
    </Link>
  )
}

export function Home() {
  return <Gate>{(s) => <HomeInner s={s} />}</Gate>
}
function HomeInner({ s }: { s: Snapshot }) {
  const { session, balance } = useApp()
  const now = useNow()
  const ev = featuredEvent(s)
  const rows = ev ? teamRows(s, ev) : []
  const mine = ev ? s.myAllocations.filter((a) => a.eventId === ev.id) : []
  const committed = mine.reduce((a, x) => a + x.amount, 0)
  const board = s.leaderboard.filter((l) => l.eventId === null).sort((a, b) => b.total - a.total)
  const myRank = board.findIndex((l) => l.isYou) + 1
  const upcoming = s.events.filter((e) => e.status === 'upcoming')
  const active = s.events.filter(isActive)
  return (
    <div className="space-y-6">
      <PageTitle title={`Hi, ${session?.name.split(' ')[0] ?? 'there'}`} sub="Here is what is happening in the Arena." />
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <Card className="relative overflow-hidden bg-gradient-to-br from-bloom-deep/40 via-panel to-panel p-5">
          <div className="absolute -right-4 -top-4 opacity-90"><Scene kind="coin" className="h-32 w-32" /></div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">Your balance</p>
          <p className="num mt-1 flex items-center gap-2 text-4xl font-bold"><CoinIcon size={30} />{fmtNum(balance)}<span className="text-base text-mute">BLC</span></p>
          <p className="mt-2 text-sm text-mute">{committed > 0 ? `${fmtNum(committed)} BLC committed in ${ev?.title}` : 'Nothing invested yet'}{myRank > 0 && ` · Rank #${myRank} of ${board.length}`}</p>
          <div className="mt-4 flex gap-2">
            <Button asChild variant="coin"><Link to={ev ? `/app/events/${ev.id}/invest` : '/app/events'}><Coins size={16} />{ev?.status === 'investing' ? 'Invest now' : 'Browse events'}</Link></Button>
            <Button asChild variant="ghost"><Link to="/app/wallet">Wallet</Link></Button>
          </div>
        </Card>
        {ev && (
          <Card>
            <div className="flex items-center justify-between"><Badge tone={tone(ev)}>{statusLabel[ev.status]}</Badge>{ev.status === 'investing' && <span className="num text-sm font-bold text-coin">{countdown(ev.investDeadline, now)} left</span>}</div>
            <h2 className="font-display mt-2 text-lg font-bold">{ev.title}</h2>
            <p className="text-xs text-mute">{fmtDate(ev.startsAt)} · {ev.venue}</p>
            <ol className="mt-3 space-y-1.5">
              {rows.slice(0, 3).map((r, i) => (
                <li key={r.team.id} className="flex items-center gap-2 text-sm"><span className="num w-4 text-mute">{i + 1}</span><TeamLogo team={r.team} size={26} /><span className="flex-1 truncate font-medium">{r.team.name}</span><span className="num font-bold">{r.composite?.toFixed(1) ?? '–'}</span></li>
              ))}
            </ol>
            <Button asChild variant="link" className="mt-3"><Link to={`/app/events/${ev.id}`}>Full scoreboard <ArrowRight size={14} /></Link></Button>
          </Card>
        )}
      </div>

      {active.length > 0 && <section><h2 className="font-display mb-2 text-lg font-bold">Active events</h2><div className="grid gap-3 md:grid-cols-2">{active.map((e) => <EventCard key={e.id} e={e} s={s} />)}</div></section>}
      {upcoming.length > 0 && <section><h2 className="font-display mb-2 text-lg font-bold">Upcoming</h2><div className="grid gap-3 md:grid-cols-2">{upcoming.map((e) => <EventCard key={e.id} e={e} s={s} />)}</div></section>}

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="font-display font-bold">Recent activity</h2><Link to="/app/wallet" className="text-xs text-bloom">All</Link></div>
          {s.myEntries.length === 0 ? <p className="text-sm text-mute">No activity yet.</p> : (
            <ul className="divide-y divide-line">
              {s.myEntries.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm"><span className="min-w-0 truncate"><span className="capitalize">{e.kind}</span> <span className="text-mute">· {e.note}</span></span><span className={`num font-bold ${e.amount > 0 ? 'text-win' : 'text-loss'}`}>{e.amount > 0 ? '+' : ''}{fmtNum(e.amount)}</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="font-display font-bold">Top players</h2><Link to="/app/leaderboard" className="text-xs text-bloom">Leaderboard</Link></div>
          <ol className="space-y-1.5">
            {board.slice(0, 5).map((l, i) => (
              <li key={l.userId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${l.isYou ? 'bg-bloom/15 ring-1 ring-bloom/40' : ''}`}><span className="num w-5 text-mute">{i + 1}</span><span className="flex-1 truncate">{l.name}{l.isYou && ' (you)'}</span><span className="num font-bold">{fmtNum(l.total)}</span></li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}

export function Events() {
  return <Gate>{(s) => (
    <div>
      <PageTitle title="Events" sub="Pitch nights, past and present." />
      {s.events.length === 0 ? <Empty title="No events yet">The council has not published an event.</Empty> : <div className="grid gap-3 md:grid-cols-2">{s.events.filter((e) => e.status !== 'archived').map((e) => <EventCard key={e.id} e={e} s={s} />)}</div>}
    </div>
  )}</Gate>
}

export function EventDetail() {
  const { eventId } = useParams()
  return <Gate>{(s) => {
    const ev = s.events.find((e) => e.id === eventId)
    if (!ev) return <Empty title="Event not found"><Link to="/app/events" className="text-bloom">Back to events</Link></Empty>
    const rows = teamRows(s, ev)
    const rounds = s.rounds.filter((r) => r.eventId === ev.id).sort((a, b) => a.number - b.number)
    const icons = [Bot, Mic2, Coins]
    return (
      <div className="space-y-5">
        <PageTitle title={ev.title} sub={`${fmtDate(ev.startsAt)} · ${ev.venue}`} right={<Badge tone={tone(ev)}>{statusLabel[ev.status]}</Badge>} />
        <p className="text-sm text-mute">{ev.description}</p>
        <div className="flex flex-wrap gap-2">
          {ev.status === 'investing' && <Button asChild variant="coin"><Link to={`/app/events/${ev.id}/invest`}><Coins size={16} />Invest</Link></Button>}
          {(ev.status === 'settled' || ev.status === 'locked') && <Button asChild variant="primary"><Link to={`/app/events/${ev.id}/results`}><Trophy size={16} />Results</Link></Button>}
          <Button asChild variant="ghost"><Link to={`/display/${ev.id}`}><Tv size={16} />Display mode</Link></Button>
        </div>
        <section className="grid gap-2 md:grid-cols-3" aria-label="Rounds">
          {rounds.map((r, i) => { const I = icons[i]; return (
            <Card key={r.id} className="flex items-start gap-3 p-3">
              <I className="mt-0.5 text-bloom" size={18} />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">R{r.number} · {r.name}</p><p className="text-xs text-mute">{r.status === 'complete' ? 'Complete' : r.status === 'active' ? 'In progress' : 'Not started'}{r.kind !== 'audience' && (r.scoreVisible ? ' · scores released' : ' · scores hidden')}</p></div>
            </Card>) })}
        </section>
        <section>
          <h2 className="font-display mb-2 text-lg font-bold">Startups</h2>
          {rows.length === 0 ? <Empty title="No teams listed yet" /> : <div className="grid gap-3 md:grid-cols-2">{rows.map((r, i) => <TeamCard key={r.team.id} row={r} rank={i + 1} to={`/app/events/${ev.id}/teams/${r.team.id}`} winner={ev.winnerTeamId === r.team.id} />)}</div>}
        </section>
      </div>
    )
  }}</Gate>
}

export function TeamDetail() {
  const { eventId, teamId } = useParams()
  return <Gate>{(s) => {
    const ev = s.events.find((e) => e.id === eventId)
    const team = s.teams.find((t) => t.id === teamId && t.eventId === eventId)
    if (!ev || !team) return <Empty title="Team not found" />
    const row = teamRows(s, ev).find((r) => r.team.id === team.id)!
    const mine = s.myAllocations.find((a) => a.teamId === team.id)?.amount ?? 0
    const stakes = s.stakes.filter((x) => x.eventId === ev.id)
    const total = stakes.reduce((a, x) => a + x.total, 0)
    const rounds = s.rounds.filter((r) => r.eventId === ev.id && r.number < 3)
    return (
      <div className="space-y-5">
        <Link to={`/app/events/${ev.id}`} className="text-sm text-bloom">← {ev.title}</Link>
        <div className="flex items-center gap-4">
          <TeamLogo team={team} size={72} />
          <div className="min-w-0"><h1 className="font-display text-2xl font-bold md:text-3xl">{team.name}</h1><p className="text-sm text-mute">{team.tagline}</p><div className="mt-1.5 flex gap-1.5"><StageBadge team={team} />{ev.winnerTeamId === team.id && <Badge tone="gold"><Crown size={11} />Winner</Badge>}{team.isDemo && <Badge>Fictional</Badge>}</div></div>
        </div>
        <Card><h2 className="font-display font-bold">{team.pitchTitle || 'Pitch'}</h2><p className="mt-1 text-sm text-mute">{team.description}</p>{team.pitchSlot && <p className="mt-2 text-xs text-mute">Pitch slot: {fmtDate(team.pitchSlot)}</p>}</Card>
        <div className="grid gap-3 md:grid-cols-2">
          {rounds.map((r) => {
            const evals = s.evaluations.filter((x) => x.teamId === team.id && x.roundNumber === r.number)
            return (
              <Card key={r.id}>
                <div className="flex items-center justify-between"><h3 className="font-display font-bold">R{r.number} · {r.name}</h3><span className="num text-xl font-bold">{(r.number === 1 ? row.r1 : row.r2)?.toFixed(1) ?? '–'}</span></div>
                {evals.length === 0 ? <p className="mt-2 text-sm text-mute">{r.scoreVisible ? 'No score recorded yet.' : 'Scores will appear once the council releases them.'}</p> : (
                  <>
                    <ul className="mt-3 space-y-2">
                      {r.criteria.map((c) => {
                        const avg = evals.reduce((a, x) => a + (x.scores[c.key] ?? 0), 0) / evals.length
                        return <li key={c.key}><div className="flex justify-between text-xs"><span>{c.label}</span><span className="num text-mute">{avg.toFixed(1)} / {c.max}</span></div><ScoreBar value={(avg / c.max) * 100} color={team.color} /></li>
                      })}
                    </ul>
                    <p className="mt-3 text-[11px] text-mute">{evals[0].source === 'live' ? `${evals.length} judge${evals.length > 1 ? 's' : ''}` : `Entered by the council (${evals[0].source})`}{evals[0].isDemo && ' · demo sample, not from a real model'}</p>
                  </>
                )}
              </Card>
            )
          })}
        </div>
        <Card className="flex items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-wide text-mute">Backed by {row.backers} {row.backers === 1 ? 'player' : 'players'}</p><p className="num text-2xl font-bold text-coin">{fmtNum(row.stake)} BLC <span className="text-sm text-mute">{total ? `· ${Math.round((row.stake / total) * 100)}% of pool` : ''}</span></p>{mine > 0 && <p className="text-xs text-win">Your stake: {fmtNum(mine)} BLC</p>}</div>
          {ev.status === 'investing' && <Button asChild variant="coin"><Link to={`/app/events/${ev.id}/invest`}>Invest</Link></Button>}
        </Card>
      </div>
    )
  }}</Gate>
}

export function Results() {
  const { eventId } = useParams()
  return <Gate>{(s) => {
    const ev = s.events.find((e) => e.id === eventId)
    if (!ev) return <Navigate to="/app/events" replace />
    const res = s.results.find((r) => r.eventId === ev.id)
    const rows = teamRows(s, ev)
    const winner = res && s.teams.find((t) => t.id === res.winnerTeamId)
    const entries = s.myEntries.filter((e) => e.eventId === ev.id && e.kind !== 'expire')
    const invested = -entries.filter((e) => e.kind === 'invest').reduce((a, e) => a + e.amount, 0)
    const returned = entries.filter((e) => e.kind === 'payout' || e.kind === 'refund').reduce((a, e) => a + e.amount, 0)
    const expired = -s.myEntries.filter((e) => e.eventId === ev.id && e.kind === 'expire').reduce((a, e) => a + e.amount, 0)
    return (
      <div className="space-y-5">
        <PageTitle title="Final results" sub={ev.title} />
        {!res || !winner ? <Empty title="Results are not in yet">{ev.status === 'locked' ? 'Investing is closed. The council will confirm the winner and settle shortly.' : 'The winner has not been declared.'}</Empty> : (
          <>
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 14 }}>
              <Card className="flex flex-col items-center gap-2 bg-gradient-to-b from-coin/15 to-panel p-6 text-center ring-coin/50">
                <Scene kind="trophy" className="h-44 w-44" />
                <Badge tone="gold">Winner</Badge>
                <TeamLogo team={winner} size={64} />
                <h2 className="font-display text-3xl font-bold">{winner.name}</h2>
                <p className="text-sm text-mute">{winner.tagline}</p>
              </Card>
            </motion.div>
            <Card><Podium rows={rows} /></Card>
            <Card>
              <h3 className="font-display font-bold">Your outcome</h3>
              {entries.length === 0 ? <p className="mt-1 text-sm text-mute">You did not take part in this event.</p> : (
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div><dt className="text-mute">Invested</dt><dd className="num text-lg font-bold">{fmtNum(invested)}</dd></div>
                  <div><dt className="text-mute">Returned</dt><dd className="num text-lg font-bold text-win">{fmtNum(returned)}</dd></div>
                  <div><dt className="text-mute">Net</dt><dd className={`num text-lg font-bold ${returned - invested >= 0 ? 'text-win' : 'text-loss'}`}>{returned - invested >= 0 ? '+' : ''}{fmtNum(returned - invested)}</dd></div>
                  <div><dt className="text-mute">Expired</dt><dd className="num text-lg font-bold text-mute">{fmtNum(expired)}</dd></div>
                </dl>
              )}
              <p className="mt-3 text-xs text-mute">Pool of {fmtNum(res.pool)} BLC {res.refunded ? 'refunded to backers because nobody backed the winner.' : 'shared pro-rata among backers of the winner (provisional demo rule).'}</p>
            </Card>
          </>
        )}
        <section><h3 className="font-display mb-2 font-bold">Final standings</h3><div className="grid gap-3 md:grid-cols-2">{rows.map((r, i) => <TeamCard key={r.team.id} row={r} rank={i + 1} to={`/app/events/${ev.id}/teams/${r.team.id}`} winner={ev.winnerTeamId === r.team.id} />)}</div></section>
      </div>
    )
  }}</Gate>
}
