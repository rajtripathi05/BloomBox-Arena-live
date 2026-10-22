import { motion } from 'motion/react'
import { Check, Minus, Plus, RotateCcw, Split, Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CoinIcon, TeamLogo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Badge, Card, Empty } from '@/components/ui/card'
import { PageTitle, ScoreBar, Spinner, VirtualNote } from '@/components/widgets'
import { api } from '@/services'
import { countdown, fmtNum } from '@/lib/utils'
import { teamRows } from '@/lib/select'
import { useApp, useNow } from '@/state/AppProvider'

const STEP = 50

export default function Invest() {
  const { eventId } = useParams()
  const { snap, balance, online, run } = useApp()
  const now = useNow()
  const [draft, setDraft] = useState<Record<string, number> | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)

  const ev = snap?.events.find((e) => e.id === eventId)
  const mine = useMemo(() => Object.fromEntries((snap?.myAllocations ?? []).filter((a) => a.eventId === eventId).map((a) => [a.teamId, a.amount])), [snap, eventId])
  useEffect(() => { if (snap && draft === null) setDraft(mine) }, [snap, mine, draft])

  if (!snap || !ev || draft === null) return snap ? <Empty title="Event not found" /> : <Spinner />
  const rows = teamRows(snap, ev)
  const committed = Object.values(mine).reduce((a, b) => a + b, 0)
  const available = balance + committed
  const spent = Object.values(draft).reduce((a, b) => a + b, 0)
  const left = available - spent
  const dirty = rows.some((r) => (draft[r.team.id] ?? 0) !== (mine[r.team.id] ?? 0))
  const open = ev.status === 'investing' && new Date(ev.investDeadline).getTime() > now
  const over = left < 0
  const set = (id: string, v: number) => { setSaved(false); setConfirming(false); setDraft((d) => ({ ...d!, [id]: Math.max(0, Math.round(v) || 0) })) }

  const split = () => { const per = Math.floor(available / rows.length / 10) * 10; setDraft(Object.fromEntries(rows.map((r) => [r.team.id, per]))); setConfirming(false) }

  async function save() {
    const clean = Object.fromEntries(Object.entries(draft!).filter(([, v]) => v > 0))
    const ok = await run(async () => { await api.allocate(ev!.id, clean); return true }, 'Allocation saved')
    if (ok) { setConfirming(false); setSaved(true); setDraft(null) }
  }

  return (
    <div className="space-y-4 pb-28">
      <Link to={`/app/events/${ev.id}`} className="text-sm text-bloom">← {ev.title}</Link>
      <PageTitle title="Back your teams" sub="Round 3 · Audience investment" right={open ? <Badge tone="gold">{countdown(ev.investDeadline, now)} left</Badge> : <Badge tone="red"><Lock size={11} />Closed</Badge>} />

      {!open && <Card className="ring-loss/40"><p className="text-sm">{ev.status === 'investing' ? 'The investment deadline has passed. Allocations are locked.' : ev.status === 'settled' ? 'This event is settled. See the results page for your outcome.' : 'Investing is not open for this event.'}</p>{ev.status === 'settled' && <Button asChild variant="link"><Link to={`/app/events/${ev.id}/results`}>View results</Link></Button>}</Card>}

      <Card className="sticky top-14 z-20 space-y-2.5 bg-panel-2 py-3 shadow-[var(--shadow-elev-2)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
        <div><p className="text-[11px] uppercase tracking-wide text-mute">Left to allocate</p><p className={`num flex items-center gap-1.5 text-2xl font-bold ${over ? 'text-loss' : ''}`}><CoinIcon size={22} />{fmtNum(left)}</p></div>
        <div className="text-right text-xs text-mute"><p>Allocated <b className="num text-white">{fmtNum(spent)}</b></p><p>Available <b className="num text-white">{fmtNum(available)}</b></p></div>
        </div>
        <ScoreBar value={available ? Math.min(100, (spent / available) * 100) : 0} color={over ? '#fb7185' : '#f5b942'} />
      </Card>
      {over && <p role="alert" className="rounded-xl bg-loss/10 px-3 py-2 text-sm text-loss">You have allocated {fmtNum(-left)} BLC more than you have. Reduce a stake to continue.</p>}

      {open && (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={split}><Split size={14} />Split evenly</Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft(mine)}><RotateCcw size={14} />Reset</Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft({})}>Clear all</Button>
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((r) => {
          const v = draft[r.team.id] ?? 0
          return (
            <li key={r.team.id}>
              <Card className="space-y-3">
                <div className="flex items-center gap-3">
                  <TeamLogo team={r.team} />
                  <div className="min-w-0 flex-1"><Link to={`/app/events/${ev.id}/teams/${r.team.id}`} className="font-display block truncate font-bold">{r.team.name}</Link><p className="truncate text-xs text-mute">{r.team.tagline}</p></div>
                  <div className="text-right"><p className="num text-lg font-bold text-coin">{fmtNum(r.stake)}</p><p className="text-[10px] uppercase text-mute">pool backing</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="size-11 p-0" aria-label={`Decrease ${r.team.name}`} disabled={!open || v <= 0} onClick={() => set(r.team.id, v - STEP)}><Minus size={16} /></Button>
                  <input aria-label={`${r.team.name} amount`} inputMode="numeric" disabled={!open} value={v} onChange={(e) => set(r.team.id, Number(e.target.value.replace(/\D/g, '')))} className="num min-h-11 w-full min-w-0 rounded-xl bg-ink px-3 text-center text-xl font-bold ring-1 ring-line focus:ring-2 focus:ring-bloom disabled:opacity-60" />
                  <Button variant="ghost" size="sm" className="size-11 p-0" aria-label={`Increase ${r.team.name}`} disabled={!open || left < STEP} onClick={() => set(r.team.id, v + STEP)}><Plus size={16} /></Button>
                </div>
                <input type="range" aria-label={`${r.team.name} slider`} min={0} max={Math.max(available, 1)} step={10} value={Math.min(v, available)} disabled={!open} onChange={(e) => set(r.team.id, Number(e.target.value))} className="w-full" />
                <ScoreBar value={available ? (v / available) * 100 : 0} color={r.team.color} />
              </Card>
            </li>
          )
        })}
      </ul>
      <VirtualNote />

      <div className="safe-b fixed inset-x-0 bottom-16 z-30 border-t border-line bg-ink/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 md:px-0">
          {saved && !dirty && <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-win"><Check size={16} />Saved. You can still edit until the deadline.</motion.p>}
          {confirming ? (
            <Card className="space-y-2 ring-bloom/50">
              <p className="text-sm font-semibold">Confirm: commit {fmtNum(spent)} BLC across {Object.values(draft).filter((x) => x > 0).length} teams, leaving {fmtNum(left)} BLC.</p>
              <div className="flex gap-2"><Button className="flex-1" onClick={save} disabled={!online}>Confirm allocation</Button><Button variant="ghost" onClick={() => setConfirming(false)}>Back</Button></div>
            </Card>
          ) : (
            <Button size="lg" disabled={!open || !dirty || over || !online} onClick={() => setConfirming(true)}>{!online ? 'Offline: reconnect to invest' : dirty ? 'Review allocation' : 'No changes'}</Button>
          )}
        </div>
      </div>
    </div>
  )
}
