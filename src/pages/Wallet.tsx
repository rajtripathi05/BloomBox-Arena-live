import { InstallButton } from '@/components/InstallButton'
import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Gift, Hourglass, Medal, RotateCw, Undo2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CoinIcon } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Badge, Card, Empty, Select } from '@/components/ui/card'
import { PageTitle, Spinner, VirtualNote } from '@/components/widgets'
import { api } from '@/services'
import { fmtDate, fmtNum } from '@/lib/utils'
import type { EntryKind } from '@/lib/types'
import { useApp } from '@/state/AppProvider'

const kindMeta: Record<EntryKind, { label: string; icon: typeof Gift }> = {
  grant: { label: 'Welcome grant', icon: Gift }, invest: { label: 'Investment', icon: ArrowUpRight }, payout: { label: 'Winner payout', icon: ArrowDownLeft },
  refund: { label: 'Refund', icon: Undo2 }, expire: { label: 'Expired', icon: Hourglass }, adjust: { label: 'Adjustment', icon: RotateCw },
}

export function Wallet() {
  const { snap, balance } = useApp()
  const [filter, setFilter] = useState<'all' | EntryKind>('all')
  if (!snap) return <Spinner />
  const ev = (id: string | null) => snap.events.find((e) => e.id === id)?.title
  const open = snap.myAllocations.filter((a) => snap.events.find((e) => e.id === a.eventId)?.status !== 'settled').reduce((a, x) => a + x.amount, 0)
  const sum = (k: EntryKind[]) => snap.myEntries.filter((e) => k.includes(e.kind)).reduce((a, e) => a + e.amount, 0)
  const returned = sum(['payout', 'refund']), expired = -sum(['expire'])
  const net = balance + open - 1000
  const list = snap.myEntries.filter((e) => filter === 'all' || e.kind === filter)
  return (
    <div className="space-y-5">
      <PageTitle title="Wallet" sub="Your BloomBox Coins. Balances are computed by the server ledger." />
      <Card className="bg-gradient-to-br from-bloom-deep/40 via-panel to-panel p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-mute">Spendable balance</p>
        <p className="num mt-1 flex items-center gap-2 text-4xl font-bold"><CoinIcon size={30} />{fmtNum(balance)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-mute">In open events</dt><dd className="num text-lg font-bold text-coin">{fmtNum(open)}</dd></div>
          <div><dt className="text-mute">Returned to you</dt><dd className="num text-lg font-bold text-win">{fmtNum(returned)}</dd></div>
          <div><dt className="text-mute">Expired</dt><dd className="num text-lg font-bold text-mute">{fmtNum(expired)}</dd></div>
          <div><dt className="text-mute">Net vs. 1,000 start</dt><dd className={`num text-lg font-bold ${net >= 0 ? 'text-win' : 'text-loss'}`}>{net >= 0 ? '+' : ''}{fmtNum(net)}</dd></div>
        </dl>
      </Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Transactions</h2>
        <Select aria-label="Filter" className="w-40" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | EntryKind)}>
          <option value="all">All</option>{Object.entries(kindMeta).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </Select>
      </div>
      {list.length === 0 ? <Empty title="No transactions">Nothing matches this filter.</Empty> : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {list.map((e) => { const M = kindMeta[e.kind]; return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${e.amount > 0 ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}><M.icon size={16} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{M.label}{ev(e.eventId) && <span className="font-normal text-mute"> · {ev(e.eventId)}</span>}</p><p className="truncate text-xs text-mute">{e.note} · {fmtDate(e.createdAt)}</p></div>
                <div className="text-right"><p className={`num font-bold ${e.amount > 0 ? 'text-win' : 'text-loss'}`}>{e.amount > 0 ? '+' : ''}{fmtNum(e.amount)}</p><p className="num text-[11px] text-mute">bal {fmtNum(e.balanceAfter)}</p></div>
              </li>) })}
          </ul>
        </Card>
      )}
      <VirtualNote />
    </div>
  )
}

export function Leaderboard() {
  const { snap } = useApp()
  const [scope, setScope] = useState<string>('global')
  if (!snap) return <Spinner />
  const events = snap.events.filter((e) => snap.leaderboard.some((l) => l.eventId === e.id))
  const global = scope === 'global'
  const rows = snap.leaderboard.filter((l) => (global ? l.eventId === null : l.eventId === scope)).sort((a, b) => (global ? b.total - a.total : b.net - a.net))
  const me = rows.findIndex((r) => r.isYou)
  return (
    <div className="space-y-4">
      <PageTitle title="Leaderboard" sub={global ? 'Ranked by total BLC (balance plus coins in open events).' : 'Ranked by net BLC result in this event.'} right={<Select aria-label="Scope" className="w-44" value={scope} onChange={(e) => setScope(e.target.value)}><option value="global">Global</option>{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</Select>} />
      {me >= 0 && (
        <Card className="flex items-center gap-3 bg-bloom/10 ring-bloom/40"><Medal className="text-bloom" /><div><p className="text-xs text-mute">Your performance</p><p className="font-display text-lg font-bold">Rank #{me + 1} <span className="text-mute">of {rows.length}</span> · <span className={rows[me].net >= 0 ? 'text-win' : 'text-loss'}>{rows[me].net >= 0 ? '+' : ''}{fmtNum(rows[me].net)} net</span></p></div></Card>
      )}
      {rows.length === 0 ? <Empty title="No rankings yet" /> : (
        <Card className="p-0"><ol className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.userId} className={`flex items-center gap-3 px-4 py-3 ${r.isYou ? 'bg-bloom/10' : ''}`}>
              <span className={`num grid size-8 place-items-center rounded-full text-sm font-bold ${i < 3 ? 'bg-coin text-ink' : 'bg-white/5 text-mute'}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}{r.isYou && <Badge tone="blue" className="ml-2">You</Badge>}</span>
              <span className="text-right"><span className="num block font-bold">{fmtNum(global ? r.total : r.net)}</span><span className={`num text-[11px] ${r.net >= 0 ? 'text-win' : 'text-loss'}`}>{r.net >= 0 ? '+' : ''}{fmtNum(r.net)}</span></span>
            </li>
          ))}
        </ol></Card>
      )}
    </div>
  )
}

export function Profile() {
  const { session, isDemo, isStaff, refresh } = useApp()
  if (!session) return <Spinner />
  return (
    <div className="space-y-4">
      <PageTitle title="Profile" />
      <Card className="space-y-2">
        <p className="font-display text-xl font-bold">{session.name}</p>
        <p className="text-sm text-mute">{session.email}</p>
        <Badge tone={session.role === 'admin' ? 'gold' : session.role === 'judge' ? 'blue' : 'gray'}>{session.role === 'admin' ? 'Council admin' : session.role === 'judge' ? 'Judge' : 'Participant'}</Badge>
        <p className="pt-1 text-xs text-mute">Your role is assigned by the council on the server. It cannot be changed from this screen.</p>
      </Card>
      {isStaff && <Button asChild variant="ghost"><Link to="/admin">Open admin console</Link></Button>}
      <Card className="space-y-2 text-sm"><p className="font-semibold">Install BloomBox</p><p className="text-mute">Install the web app for a full-screen, home-screen experience. Saved screens open offline; coin changes need a connection.</p><InstallButton size="sm" variant="ghost" /></Card>
      <Button asChild variant="ghost"><Link to="/">{isDemo ? 'Exit demo · Back to Home' : 'Back to Home'}</Link></Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={async () => { await api.signOut(); await refresh() }}>Sign out</Button>
        {isDemo && <Button variant="danger" onClick={async () => { await api.resetDemo?.(); await refresh() }}>Reset demo data</Button>}
      </div>
      <VirtualNote />
    </div>
  )
}
