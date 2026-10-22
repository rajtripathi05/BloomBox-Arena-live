import { AnimatePresence, motion } from 'motion/react'
import { Bot, CheckCircle2, Coins, Gavel, Megaphone, Minus, Plus, ScanSearch, Sparkles, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { TeamLogo } from '@/components/brand'
import { Scene } from '@/components/Scene'
import { Button } from '@/components/ui/button'
import { Badge, Card, Input } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Bar, Feed, Leaderboard, logo, Num, SimTag } from './parts'
import {
  aiReveal, aiTotal, allocated, board, EVENT, JUDGES, judgeScores, marketProgress, onStage, projected, settlement, START_BALANCE, TEAMS,
  validate, type Alloc, type DemoTeam, type Moment, type Role,
} from './script'

export interface StageProps {
  m: Moment; stepLeftMs: number; alloc: Alloc; setAlloc: (a: Alloc) => void; confirmed: boolean; confirm: () => void
  autoAllocated: boolean; role: Role; pick: (t: DemoTeam) => void
}

const H = ({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) => (
  <div className="mb-4">
    <p className="text-[11px] font-bold uppercase tracking-[.2em] text-bloom">{kicker}</p>
    <h2 className="font-display mt-1 text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
    {sub && <p className="mt-1 max-w-2xl text-sm text-mute">{sub}</p>}
  </div>
)
const secs = (ms: number) => `${Math.max(0, Math.ceil(ms / 1000))}s`

export function Welcome({ m }: StageProps) {
  return (
    <div className="grid items-center gap-6 md:grid-cols-[1.2fr_1fr]">
      <div>
        <H kicker="Fictional event · Demo" title={`Welcome to the ${EVENT.title}`} sub="Six student startups pitch for the cup. You will watch the AI round and live judging, then back the teams you believe in with virtual BloomBox Coins." />
        <div className="grid gap-2 sm:grid-cols-3">
          {[{ i: Bot, t: 'AI round', d: 'Rubric scores for every deck' }, { i: Gavel, t: 'Live judging', d: 'Three judges score on stage' }, { i: Coins, t: 'Audience market', d: 'Stake your 1,000 BLC' }].map((x, k) => (
            <motion.div key={x.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: m.p > k * 0.2 ? 1 : 0.25, y: 0 }} className="rounded-xl bg-panel/80 p-3 ring-1 ring-line">
              <x.i size={18} className="text-bloom" /><p className="mt-1.5 text-sm font-semibold">{x.t}</p><p className="text-xs text-mute">{x.d}</p>
            </motion.div>
          ))}
        </div>
        <Card className="mt-4 flex items-center gap-3 bg-coin/5 ring-coin/30">
          <Coins className="shrink-0 text-coin" />
          <p className="text-sm"><b>BloomBox Coins (BLC)</b> are virtual points with no cash value. Every attendee starts with <b className="text-coin">1,000 BLC</b>. In this demo they are simulated and reset when you leave.</p>
        </Card>
      </div>
      <div className="relative grid place-items-center">
        <Scene kind="coin" className="h-48 w-48 md:h-64 md:w-64" />
        <p className="text-xs text-mute"><Users size={12} className="mr-1 inline" /><Num value={Math.round(EVENT.attendees * Math.min(1, 0.4 + m.p))} /> attendees checked in</p>
      </div>
    </div>
  )
}

export function Teams({ m, pick }: StageProps) {
  const spot = Math.min(TEAMS.length - 1, Math.floor(m.p * TEAMS.length))
  return (
    <div>
      <H kicker="Explore teams" title="Meet the six startups" sub="Tap any card to open its profile. The spotlight walks through each team automatically." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEAMS.map((t, i) => (
          <motion.button key={t.id} type="button" onClick={() => pick(t)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, scale: spot === i ? 1.02 : 1 }} transition={{ delay: i * 0.04 }}
            className={cn('rounded-2xl bg-panel/90 p-4 text-left ring-1 transition hover:ring-bloom/60', spot === i ? 'ring-bloom shadow-[0_0_0_4px_rgba(59,130,246,.15)]' : 'ring-line')}>
            <div className="flex items-center gap-3"><TeamLogo team={logo(t)} /><div className="min-w-0"><p className="font-display truncate font-bold">{t.name}</p><p className="truncate text-xs text-mute">{t.tagline}</p></div></div>
            <p className="mt-3 line-clamp-2 text-xs text-slate-300">{t.description}</p>
            <div className="mt-3 flex flex-wrap gap-1"><Badge tone="blue">{t.sector}</Badge>{t.strengths.slice(0, 2).map((s) => <Badge key={s}>{s}</Badge>)}</div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

export function AiRound({ m, pick }: StageProps) {
  const active = TEAMS.findIndex((_, i) => aiReveal(m, i) < 1)
  return (
    <div>
      <H kicker="Round 1 · AI evaluation" title="Scoring every pitch deck" sub="A rubric model scores problem, market, product and team. This is a scripted animation: no AI service is called in the demo." />
      <div className="mb-3 flex items-center gap-2 text-sm"><SimTag /><ScanSearch size={16} className="text-bloom" />{active >= 0 ? <>Analysing <b>{TEAMS[active].name}</b>…</> : <b className="text-win">All decks scored</b>}</div>
      <div className="grid gap-2 md:grid-cols-2">
        {TEAMS.map((t, i) => {
          const r = aiReveal(m, i)
          return (
            <button key={t.id} type="button" onClick={() => pick(t)} className={cn('relative overflow-hidden rounded-xl bg-panel/80 p-3 text-left ring-1 ring-line', r > 0 && r < 1 && 'ring-bloom')}>
              {r > 0 && r < 1 && <motion.span className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-bloom/25 to-transparent" animate={{ x: ['-20%', '600%'] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }} />}
              <div className="relative flex items-center gap-3">
                <TeamLogo team={logo(t)} size={36} />
                <span className="flex-1 font-semibold">{t.name}</span>
                <span className="num text-xl font-bold">{r >= 1 ? <Num value={aiTotal(t)} decimals={1} /> : <span className="text-mute">{r > 0 ? `${Math.round(r * 100)}%` : '–'}</span>}</span>
              </div>
              <div className="relative mt-2 grid grid-cols-4 gap-2">
                {(Object.entries(t.ai) as [string, number][]).map(([k, v], j) => (
                  <div key={k}><p className="text-[10px] capitalize text-mute">{k}</p><Bar value={r > (j + 1) / 5 ? v : 0} color={t.color} label={`${t.name} ${k}`} /></div>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Judging({ m, alloc, pick, role }: StageProps) {
  const i = onStage(m), t = TEAMS[i], scores = judgeScores(m, i)
  const [guest, setGuest] = useState(80)
  const [sent, setSent] = useState<Record<string, number>>({})
  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
      <div>
        <H kicker="Round 2 · Live judging" title="On stage now" />
        <div className="mb-3 flex gap-1" aria-label="Pitch order">{TEAMS.map((x, k) => <span key={x.id} className={cn('h-1.5 flex-1 rounded-full', k < i ? 'bg-win' : k === i ? 'bg-bloom' : 'bg-white/10')} />)}</div>
        <AnimatePresence mode="wait">
          <motion.div key={t.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <Card className="p-5">
              <div className="flex items-center gap-3"><TeamLogo team={logo(t)} size={52} /><div><p className="font-display text-xl font-bold">{t.name}</p><p className="text-sm text-mute">{t.tagline}</p></div><SimTag className="ml-auto" /></div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {JUDGES.map((j, k) => (
                  <div key={j} className="rounded-xl bg-ink/70 p-3 text-center ring-1 ring-line">
                    <p className="truncate text-[10px] text-mute">{j}</p>
                    <AnimatePresence mode="wait">
                      {scores[k] !== undefined
                        ? <motion.p key="s" initial={{ scale: 1.6, color: '#f5b942' }} animate={{ scale: 1, color: '#e8edff' }} className="num text-3xl font-bold">{scores[k]}</motion.p>
                        : <motion.p key="w" className="num text-3xl font-bold text-mute/40">··</motion.p>}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
              {role === 'judge' && (
                <div className="mt-4 rounded-xl bg-bloom/10 p-3 ring-1 ring-bloom/30">
                  <p className="text-xs font-semibold">Guest judge (demo role): your score for {t.name}</p>
                  {sent[t.id] !== undefined ? <p className="mt-2 flex items-center gap-1.5 text-sm text-win"><CheckCircle2 size={16} />Recorded {sent[t.id]} in this demo session only</p> : (
                    <div className="mt-2 flex items-center gap-3">
                      <input type="range" min={0} max={100} value={guest} onChange={(e) => setGuest(Number(e.target.value))} aria-label="Guest judge score" className="flex-1" />
                      <span className="num w-8 font-bold">{guest}</span>
                      <Button size="sm" onClick={() => setSent((s) => ({ ...s, [t.id]: guest }))}>Submit</Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
        <div className="mt-4"><Feed m={m} limit={4} /></div>
      </div>
      <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-mute">Live leaderboard</p><Leaderboard m={m} alloc={alloc} onPick={pick} highlight={t.id} /></div>
    </div>
  )
}

export function Invest({ m, stepLeftMs, alloc, setAlloc, confirmed, confirm, pick }: StageProps) {
  const [draft, setDraft] = useState<Alloc>(alloc)
  const [review, setReview] = useState(false)
  const err = validate(draft), left = START_BALANCE - allocated(draft)
  const rows = board(m, alloc)
  const set = (id: string, v: number) => { setDraft({ ...draft, [id]: Math.max(0, Math.round(v)) }); setReview(false) }
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <H kicker="Round 3 · Audience investment" title="Back the teams you believe in" sub="Spread your simulated 1,000 BLC across one or more teams. You can change it until the market closes." />
        <Card className="mb-3 flex items-center justify-between">
          <div><p className="text-xs text-mute">Left to allocate</p><p className={cn('num text-3xl font-bold', left < 0 ? 'text-loss' : 'text-coin')}><Num value={left} /> <span className="text-sm">BLC</span></p></div>
          <div className="text-right"><p className="text-xs text-mute">Market closes in</p><p className="num text-xl font-bold">{secs(stepLeftMs)}</p></div>
        </Card>
        <ul className="space-y-2">
          {TEAMS.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-xl bg-panel/80 p-2.5 ring-1 ring-line">
              <button type="button" onClick={() => pick(t)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><TeamLogo team={logo(t)} size={34} /><span className="truncate text-sm font-semibold">{t.name}</span></button>
              <Button size="sm" variant="ghost" aria-label={`Remove 50 from ${t.name}`} onClick={() => set(t.id, (draft[t.id] ?? 0) - 50)}><Minus size={14} /></Button>
              <Input aria-label={`${t.name} amount`} inputMode="numeric" className="num w-20 text-center" value={draft[t.id] ?? 0} onChange={(e) => set(t.id, Number(e.target.value.replace(/\D/g, '')) || 0)} />
              <Button size="sm" variant="ghost" aria-label={`Add 50 to ${t.name}`} onClick={() => set(t.id, (draft[t.id] ?? 0) + 50)}><Plus size={14} /></Button>
            </li>
          ))}
        </ul>
        {err && <p role="alert" className="mt-3 rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{err}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {!review ? <Button onClick={() => setReview(true)} disabled={!!err || allocated(draft) === 0}>Review allocation</Button> : (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-xl bg-bloom/10 p-3 ring-1 ring-bloom/30">
              <p className="text-sm">Commit <b className="text-coin">{allocated(draft)} BLC</b> across {Object.values(draft).filter(Boolean).length} team(s)? <span className="text-mute">(simulated)</span></p>
              <div className="mt-2 flex gap-2"><Button variant="coin" onClick={() => { setAlloc(draft); confirm(); setReview(false) }}>Confirm allocation</Button><Button variant="ghost" onClick={() => setReview(false)}>Back</Button></div>
            </motion.div>
          )}
        </div>
        <AnimatePresence>
          {confirmed && !review && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-3 rounded-xl bg-win/10 p-3 text-sm text-win ring-1 ring-win/30" role="status">
              <motion.span initial={{ rotateY: 0 }} animate={{ rotateY: 720 }} transition={{ duration: 1 }}><Coins size={22} /></motion.span>Allocation saved (simulated). {allocated(alloc)} BLC committed.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mute">Pool totals · {Math.round(marketProgress(m) * 100)}% of crowd in</p>
        <ul className="space-y-2">
          {[...rows].sort((a, b) => b.stake - a.stake).map((r) => (
            <motion.li layout key={r.team.id} className="rounded-xl bg-panel/70 px-3 py-2 ring-1 ring-line">
              <div className="flex justify-between text-sm"><span className="font-semibold">{r.team.name}</span><Num value={r.stake} className="font-bold text-coin" /></div>
              <div className="mt-1.5"><Bar value={(r.stake / 12000) * 100} color={r.team.color} label={`${r.team.name} pool`} /></div>
            </motion.li>
          ))}
        </ul>
        <div className="mt-3"><Feed m={m} limit={3} /></div>
      </div>
    </div>
  )
}

export function Market({ m, alloc, pick, autoAllocated }: StageProps) {
  const closed = m.p >= 0.8, total = board(m, alloc).reduce((a, r) => a + r.stake, 0)
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <H kicker="Live market" title={closed ? 'Market closed' : 'Market closing…'} sub="Coins keep flowing until the bell. Watch the overall ranks shift as the audience round lands." />
        <Card className={cn('text-center', closed ? 'ring-loss/40' : 'ring-coin/40')}>
          <p className="text-xs text-mute">Total pool</p>
          <p className="num text-4xl font-bold text-coin"><Num value={total} /> <span className="text-base">BLC</span></p>
          <div className="mt-3"><Bar value={Math.min(100, (m.p / 0.8) * 100)} color={closed ? '#fb7185' : '#f5b942'} label="Time until market close" /></div>
          <p className="mt-2 text-xs font-bold">{closed ? <span className="text-loss">LOCKED · no more changes</span> : <span className="text-coin">CLOSING</span>}</p>
        </Card>
        {autoAllocated && <p className="mt-3 rounded-lg bg-coin/10 px-3 py-2 text-xs text-coin ring-1 ring-coin/30">You didn't confirm an allocation, so the demo placed a suggested 800 BLC for you.</p>}
        <div className="mt-3"><Feed m={m} limit={4} /></div>
      </div>
      <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-mute">Leaderboard</p><Leaderboard m={m} alloc={alloc} onPick={pick} /></div>
    </div>
  )
}

function txs(alloc: Alloc, settled: boolean) {
  const s = settlement(alloc)
  return [
    { l: 'Welcome grant', a: START_BALANCE },
    ...TEAMS.filter((t) => alloc[t.id]).map((t) => ({ l: `Invested in ${t.name}`, a: -alloc[t.id] })),
    ...(settled ? [{ l: `Payout · ${s.winner.name} won`, a: s.returned }] : []),
  ]
}

export function WalletStage({ m, alloc }: StageProps) {
  const list = txs(alloc, false), proj = projected(m, alloc)
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <H kicker="Wallet" title="Your simulated wallet" sub="Every coin movement is recorded. Stakes are locked until the council settles the event." />
        <Card className="bg-gradient-to-br from-coin/15 to-panel ring-coin/30">
          <p className="text-xs text-mute">Available balance</p>
          <p className="num text-4xl font-bold"><Num value={START_BALANCE - allocated(alloc)} /> <span className="text-base text-coin">BLC</span></p>
          <p className="mt-1 text-xs text-mute">{allocated(alloc)} BLC locked in stakes</p>
        </Card>
        <h3 className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-mute">Transactions</h3>
        <ul className="space-y-1.5" aria-label="Simulated transactions">
          {list.map((x, i) => <motion.li key={x.l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex justify-between rounded-lg bg-panel/70 px-3 py-2 text-sm ring-1 ring-line"><span>{x.l}</span><span className={cn('num font-bold', x.a >= 0 ? 'text-win' : 'text-slate-200')}>{x.a >= 0 ? '+' : ''}{x.a}</span></motion.li>)}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-mute md:mt-16">Projected outcome (simulated)</h3>
        <ul className="space-y-2">
          {proj.map((p) => (
            <li key={p.team.id} className="flex items-center gap-3 rounded-xl bg-panel/80 p-3 ring-1 ring-line">
              <TeamLogo team={logo(p.team)} size={34} /><div className="flex-1"><p className="text-sm font-semibold">{p.team.name}</p><p className="text-xs text-mute">Staked {p.stake} BLC</p></div>
              <div className="text-right"><p className="text-[10px] uppercase text-mute">If it wins</p><p className="num font-bold text-win">+{p.ifWins}</p></div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-mute">Simulated rule: the winning team's backers share the whole pool pro rata. Stakes on other teams expire.</p>
      </div>
    </div>
  )
}

function Confetti() {
  const bits = Array.from({ length: 28 }, (_, i) => i)
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {bits.map((i) => (
        <motion.span key={i} className="absolute top-0 h-2.5 w-1.5 rounded-sm" style={{ left: `${(i * 37) % 100}%`, background: ['#f5b942', '#3b82f6', '#34d399', '#c8323c'][i % 4] }}
          initial={{ y: -20, rotate: 0, opacity: 1 }} animate={{ y: 420, rotate: 360 + i * 20, opacity: 0 }} transition={{ duration: 2.4 + (i % 5) * 0.3, delay: 0.4 + (i % 7) * 0.12, ease: 'easeIn' }} />
      ))}
    </div>
  )
}

export function Winner({ m, alloc }: StageProps) {
  const s = settlement(alloc), revealed = m.p >= 0.3
  const top = s.final.slice(0, 3), order = [1, 0, 2]
  return (
    <div className="relative">
      {revealed && <Confetti />}
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-coin">Winner reveal · Simulated</p>
        <Scene kind="trophy" className="mx-auto h-40 w-40 md:h-52 md:w-52" />
        <AnimatePresence mode="wait">
          {revealed
            ? <motion.h2 key="w" initial={{ opacity: 0, scale: 0.8, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} className="font-display text-3xl font-bold md:text-5xl">{s.winner.name} <span className="bg-gradient-to-r from-coin to-amber-200 bg-clip-text text-transparent">wins!</span></motion.h2>
            : <motion.h2 key="d" exit={{ opacity: 0 }} className="font-display animate-pulse text-3xl font-bold text-mute md:text-5xl">And the cup goes to…</motion.h2>}
        </AnimatePresence>
      </div>
      {revealed && (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <ol aria-label="Podium" className="grid grid-cols-3 items-end gap-2">
            {order.map((i) => (
              <motion.li key={top[i].team.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 * (2 - i), type: 'spring', damping: 16 }} className="flex flex-col items-center gap-1.5">
                <TeamLogo team={logo(top[i].team)} size={i === 0 ? 52 : 40} />
                <span className="w-full truncate text-center text-xs font-semibold">{top[i].team.name}</span>
                <div className={cn('grid w-full place-items-center rounded-t-xl ring-1', ['h-28', 'h-20', 'h-14'][i], i === 0 ? 'bg-coin/25 ring-coin/60' : 'bg-bloom/15 ring-bloom/40')}><span className="num text-2xl font-bold">{i + 1}</span><span className="num text-[10px] text-mute">{top[i].composite}</span></div>
              </motion.li>
            ))}
          </ol>
          <Card className={cn(s.net >= 0 ? 'ring-win/40' : 'ring-line')}>
            <p className="text-xs text-mute">Your outcome (simulated)</p>
            <p className="num mt-1 text-3xl font-bold">{s.balance} <span className="text-base text-coin">BLC</span></p>
            <p className={cn('text-sm font-semibold', s.net >= 0 ? 'text-win' : 'text-loss')}>{s.net >= 0 ? '+' : ''}{s.net} vs your starting 1,000</p>
            <ul className="mt-3 space-y-1 text-sm">{txs(alloc, true).map((x) => <li key={x.l} className="flex justify-between"><span className="text-mute">{x.l}</span><span className="num">{x.a >= 0 ? '+' : ''}{x.a}</span></li>)}</ul>
          </Card>
        </div>
      )}
    </div>
  )
}

export function Council({ m, role }: StageProps) {
  const [tab, setTab] = useState<'create' | 'scores' | 'results'>('create')
  const [events, setEvents] = useState<string[]>([])
  const [title, setTitle] = useState('Spring Pitch Night')
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [declared, setDeclared] = useState(false)
  const final = board(m, {})
  return (
    <div>
      <H kicker={`Council preview · viewing as ${role}`} title="Behind the scenes" sub="A demo-only console. Nothing here touches real events, scores or wallets." />
      <div role="tablist" className="mb-4 flex gap-1 rounded-xl bg-ink/70 p-1 text-sm font-semibold">
        {([['create', 'Create event'], ['scores', 'Score management'], ['results', 'Declare result']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('min-h-10 flex-1 rounded-lg px-2', tab === k ? 'bg-bloom text-white' : 'text-mute hover:text-white')}>{l}</button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {tab === 'create' && (
            <Card className="space-y-3">
              <label className="block text-xs text-mute">Event title<Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" /></label>
              <div className="grid grid-cols-3 gap-2 text-xs">{['AI rubric 40%', 'Judges 40%', 'Audience 20%'].map((x) => <span key={x} className="rounded-lg bg-ink/60 p-2 text-center ring-1 ring-line">{x}</span>)}</div>
              <Button disabled={!title.trim()} onClick={() => { setEvents((e) => [title.trim(), ...e]); setTitle('') }}><Sparkles size={16} />Create event (simulated)</Button>
              {events.map((e) => <p key={e} className="flex items-center gap-2 text-sm text-win"><CheckCircle2 size={15} />“{e}” created in this demo session only</p>)}
            </Card>
          )}
          {tab === 'scores' && (
            <Card>
              <p className="mb-2 text-xs text-mute">Correct a judge score. Corrections are audited in the real console; here they only change this table.</p>
              <ul className="space-y-1.5">
                {TEAMS.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <TeamLogo team={logo(t)} size={26} /><span className="flex-1 truncate">{t.name}</span>
                    <span className="text-xs text-mute">{JUDGES[0].split(' ').slice(0, 2).join(' ')}</span>
                    <Input aria-label={`${t.name} judge score`} inputMode="numeric" className="num w-16 text-center" value={edits[t.id] ?? t.judges[0]} onChange={(e) => setEdits({ ...edits, [t.id]: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) })} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {tab === 'results' && (
            <Card className="space-y-3">
              <p className="text-sm">Top of the simulated board: <b>{final[0].team.name}</b> ({final[0].composite})</p>
              {!declared ? <Button variant="coin" onClick={() => setDeclared(true)}><Megaphone size={16} />Declare winner & settle (simulated)</Button>
                : <p role="status" className="flex items-center gap-2 text-sm text-win"><Trophy size={16} />Result declared. In the live app this settles every wallet on the server; here nothing was sent.</p>}
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
