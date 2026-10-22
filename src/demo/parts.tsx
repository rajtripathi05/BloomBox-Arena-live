import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react'
import { ArrowDown, ArrowUp, Crown, Radio, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TeamLogo } from '@/components/brand'
import { Badge } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { aiReveal, aiTotal, board, feed, judgeScores, JUDGES, TEAMS, type Alloc, type DemoTeam, type Moment, type Row } from './script'

export const logo = (t: DemoTeam) => ({ ...t, logoUrl: null })

export function Num({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const mv = useSpring(value, { stiffness: 110, damping: 22 })
  useEffect(() => { mv.set(value) }, [mv, value])
  const txt = useTransform(mv, (v) => v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
  return <motion.span className={cn('num', className)}>{txt}</motion.span>
}

export const SimTag = ({ className }: { className?: string }) => <Badge tone="gold" className={cn('tracking-wide', className)}>SIMULATED</Badge>

export function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${value}%` }} transition={{ type: 'spring', stiffness: 70, damping: 18 }} />
    </div>
  )
}

type Sort = 'composite' | 'ai' | 'judge' | 'stake'
const sorts: { k: Sort; l: string }[] = [{ k: 'composite', l: 'Overall' }, { k: 'ai', l: 'AI' }, { k: 'judge', l: 'Judges' }, { k: 'stake', l: 'Coins' }]

/** Animated leaderboard. Rank arrows compare against a deterministic earlier moment, so movement is scripted, not noisy. */
export function Leaderboard({ m, alloc, onPick, compact, highlight }: { m: Moment; alloc: Alloc; onPick?: (t: DemoTeam) => void; compact?: boolean; highlight?: string }) {
  const [sort, setSort] = useState<Sort>('composite')
  const rows = board(m, alloc)
  const before = board({ idx: m.idx, p: Math.max(0, m.p - 0.15) }, alloc).map((r) => r.team.id)
  const key = (r: Row) => (sort === 'composite' ? r.composite : sort === 'ai' ? r.ai : sort === 'judge' ? r.judge : r.stake) ?? -1
  const sorted = sort === 'composite' ? rows : [...rows].sort((a, b) => key(b) - key(a))
  return (
    <div>
      {!compact && (
        <div role="tablist" aria-label="Sort leaderboard" className="mb-2 flex gap-1 rounded-xl bg-ink/70 p-1 text-xs font-semibold">
          {sorts.map((s) => <button key={s.k} role="tab" aria-selected={sort === s.k} onClick={() => setSort(s.k)} className={cn('min-h-9 flex-1 rounded-lg transition', sort === s.k ? 'bg-bloom text-white' : 'text-mute hover:text-white')}>{s.l}</button>)}
        </div>
      )}
      <ol aria-label="Simulated leaderboard" className="space-y-1.5">
        {sorted.map((r, i) => {
          const delta = sort === 'composite' ? before.indexOf(r.team.id) - i : 0
          return (
            <motion.li key={r.team.id} layout transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
              <button type="button" onClick={() => onPick?.(r.team)} className={cn('flex w-full items-center gap-3 rounded-xl bg-panel/80 px-3 py-2 text-left ring-1 ring-line transition hover:ring-bloom/60', i === 0 && r.composite !== null && 'ring-coin/50 bg-coin/5', highlight === r.team.id && 'ring-bloom')}>
                <span className="num w-5 text-center text-sm font-bold text-mute">{i + 1}</span>
                <TeamLogo team={logo(r.team)} size={compact ? 30 : 36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold">{r.team.name}</span>{i === 0 && r.composite !== null && <Crown size={13} className="shrink-0 text-coin" />}</span>
                  {!compact && <span className="block truncate text-[11px] text-mute">AI {r.ai ?? '–'} · Judges {r.judge ?? '–'} · {r.stake.toLocaleString('en-IN')} BLC</span>}
                </span>
                <AnimatePresence>{delta !== 0 && <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={cn('flex items-center text-[11px] font-bold', delta > 0 ? 'text-win' : 'text-loss')}>{delta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(delta)}</motion.span>}</AnimatePresence>
                <span className="w-14 text-right text-base font-bold">{sort === 'stake' ? <Num value={r.stake} /> : key(r) < 0 ? <span className="text-mute">–</span> : <Num value={key(r)} decimals={1} />}</span>
              </button>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

export function Ticker({ m }: { m: Moment }) {
  const items = feed(m, 1)
  return (
    <div className="flex min-h-9 items-center gap-2 overflow-hidden rounded-xl bg-ink/70 px-3 text-xs ring-1 ring-line" aria-live="polite">
      <span className="flex shrink-0 items-center gap-1 font-bold text-loss"><Radio size={13} className="animate-pulse" />FEED</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={items[0]?.text ?? 'none'} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="truncate text-slate-200">{items[0]?.text ?? 'Waiting for the event to start…'}</motion.span>
      </AnimatePresence>
      <span className="ml-auto shrink-0 text-[10px] font-bold text-coin">SIMULATED</span>
    </div>
  )
}

export function Feed({ m, limit = 5 }: { m: Moment; limit?: number }) {
  return (
    <ul className="space-y-1.5 text-xs">
      <AnimatePresence initial={false}>
        {feed(m, limit).map((f) => (
          <motion.li key={f.text} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 rounded-lg bg-white/[.03] px-2.5 py-1.5"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-bloom" />{f.text}</motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

/** Team profile drawer: bottom sheet on phones, side panel on desktop. */
export function TeamDrawer({ team, m, onClose }: { team: DemoTeam | null; m: Moment; onClose: () => void }) {
  useEffect(() => {
    if (!team) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [team, onClose])
  return (
    <AnimatePresence>
      {team && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] flex items-end bg-black/60 backdrop-blur-sm md:items-stretch md:justify-end" onClick={onClose}>
          <motion.aside role="dialog" aria-modal="true" aria-label={`${team.name} profile`} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-panel p-5 ring-1 ring-line md:max-h-none md:max-w-md md:rounded-none md:rounded-l-3xl">
            <div className="flex items-start gap-3">
              <TeamLogo team={logo(team)} size={56} />
              <div className="min-w-0 flex-1"><h2 className="font-display text-xl font-bold">{team.name}</h2><p className="text-sm text-mute">{team.tagline}</p></div>
              <button type="button" autoFocus onClick={onClose} aria-label="Close profile" className="grid size-9 place-items-center rounded-lg text-mute hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5"><Badge tone="blue">{team.sector}</Badge>{team.strengths.map((s) => <Badge key={s} tone="green">{s}</Badge>)}<SimTag /></div>
            <p className="mt-4 text-sm leading-relaxed text-slate-200">{team.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-ink/60 p-3"><dt className="text-[11px] uppercase text-mute">Founders</dt><dd className="font-medium">{team.founders}</dd></div>
              <div className="rounded-xl bg-ink/60 p-3"><dt className="text-[11px] uppercase text-mute">The ask</dt><dd className="font-medium">{team.ask}</dd></div>
            </dl>
            <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-mute">AI rubric (simulated){aiReveal(m, TEAMS.indexOf(team)) >= 1 && ` · ${aiTotal(team)}`}</h3>
            {aiReveal(m, TEAMS.indexOf(team)) >= 1 ? (
              <div className="mt-2 space-y-2">
                {(Object.entries(team.ai) as [string, number][]).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[80px_1fr_32px] items-center gap-2 text-xs"><span className="capitalize text-mute">{k}</span><Bar value={v} color={team.color} label={`${k} score`} /><span className="num text-right font-bold">{v}</span></div>
                ))}
              </div>
            ) : <p className="mt-1 text-xs text-mute">Revealed in the AI round.</p>}
            <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-mute">Judge panel (simulated)</h3>
            <ul className="mt-2 space-y-1 text-sm">{JUDGES.map((j, i) => { const v = judgeScores(m, TEAMS.indexOf(team))[i]; return <li key={j} className="flex justify-between"><span className="text-mute">{j}</span><span className="num font-bold">{v ?? '–'}</span></li> })}</ul>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
