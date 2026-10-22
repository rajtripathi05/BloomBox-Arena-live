import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import type { Team } from '@/lib/types'
import type { TeamRow } from '@/lib/select'
import { cn, fmtNum } from '@/lib/utils'
import { Badge } from './ui/card'
import { TeamLogo } from './brand'

export function ScoreBar({ value, color = '#3b82f6' }: { value: number | null; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Score" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${value ?? 0}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} className="h-full rounded-full" style={{ background: color }} />
    </div>
  )
}

export function ScoreCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-mute">{label}</div>
      <motion.div key={value ?? 'x'} initial={{ scale: 1.25, color: '#f5b942' }} animate={{ scale: 1, color: '#e8edff' }} transition={{ duration: 0.5 }} className="num text-lg font-bold">
        {value === null ? '–' : value.toFixed(1)}
      </motion.div>
    </div>
  )
}

export function TeamCard({ row, rank, to, winner }: { row: TeamRow; rank?: number; to: string; winner?: boolean }) {
  const { team } = row
  return (
    <motion.div layout whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
      <Link to={to} className={cn('block rounded-2xl bg-panel/90 p-4 ring-1 transition hover:ring-bloom/60', winner ? 'ring-coin/70' : 'ring-line')}>
        <div className="flex items-center gap-3">
          {rank !== undefined && <span className="num w-5 text-center text-sm font-bold text-mute">{rank}</span>}
          <TeamLogo team={team} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h3 className="font-display truncate text-base font-bold">{team.name}</h3>{winner && <Crown size={15} className="text-coin" />}</div>
            <p className="truncate text-xs text-mute">{team.tagline}</p>
          </div>
          <div className="text-right">
            <div className="num text-xl font-bold">{row.composite === null ? '–' : row.composite.toFixed(1)}</div>
            <div className="text-[10px] uppercase tracking-wide text-mute">composite</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <ScoreCell label="AI R1" value={row.r1} />
          <ScoreCell label="Live R2" value={row.r2} />
          <div className="min-w-0 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-mute">Backed</div>
            <div className="num text-lg font-bold text-coin">{fmtNum(row.stake)}</div>
          </div>
        </div>
        <div className="mt-2"><ScoreBar value={row.composite} color={team.color} /></div>
      </Link>
    </motion.div>
  )
}

export function StageBadge({ team }: { team: Team }) {
  return <Badge tone="blue">{team.stage || 'Startup'}</Badge>
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0"><h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>{sub && <p className="mt-1 text-sm text-mute">{sub}</p>}</div>
      {right}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5 md:px-8">
      <div className="skeleton h-8 w-48" />
      <div className="grid gap-3 md:grid-cols-2"><div className="skeleton h-36" /><div className="skeleton h-36" /></div>
      <div className="skeleton h-24" /><div className="skeleton h-24" />
      <span className="sr-only">{label}…</span>
    </div>
  )
}

/** Top-three podium: 2nd, 1st, 3rd with heights by rank. Pure DOM so it works without WebGL. */
export function Podium({ rows }: { rows: TeamRow[] }) {
  const top = rows.slice(0, 3)
  if (top.length < 2) return null
  const order = [1, 0, 2].filter((i) => top[i])
  const h = ['h-28', 'h-20', 'h-14']
  return (
    <ol aria-label="Podium" className="mx-auto grid max-w-md grid-cols-3 items-end gap-2">
      {order.map((i) => (
        <motion.li key={top[i].team.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * (2 - i), type: 'spring', damping: 18 }} className="flex min-w-0 flex-col items-center gap-1.5">
          {i === 0 && <Crown size={18} className="text-coin" />}
          <TeamLogo team={top[i].team} size={i === 0 ? 52 : 40} />
          <span className="w-full truncate text-center text-xs font-semibold">{top[i].team.name}</span>
          <div className={cn('grid w-full place-items-center rounded-t-xl ring-1', h[i], i === 0 ? 'bg-coin/25 ring-coin/60' : 'bg-bloom/15 ring-bloom/40')}>
            <span className="num text-2xl font-bold">{i + 1}</span>
          </div>
        </motion.li>
      ))}
    </ol>
  )
}

export const VirtualNote = () => (
  <p className="text-[11px] leading-snug text-mute">BloomBox Coins (BLC) are virtual points for a prediction game. They cannot be bought, sold, withdrawn or transferred, and have no cash value.</p>
)
