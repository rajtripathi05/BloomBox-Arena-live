import { cn } from '@/lib/utils'

export type Mode = 'live' | 'demo' | 'simulated' | 'error' | 'connecting'

const look: Record<Mode, { text: string; cls: string; dot: string; title: string }> = {
  live: { text: 'LIVE / SUPABASE', cls: 'bg-win/12 text-win ring-win/40', dot: 'bg-win', title: 'Connected to the Supabase backend. Data is real event data.' },
  error: { text: 'SUPABASE UNREACHABLE', cls: 'bg-loss/12 text-loss ring-loss/40', dot: 'bg-loss', title: 'Supabase is configured but could not be reached. Nothing shown is simulated.' },
  connecting: { text: 'CONNECTING…', cls: 'bg-white/5 text-mute ring-line', dot: 'bg-mute', title: 'Checking the Supabase connection.' },
  demo: { text: 'DEMO PREVIEW', cls: 'bg-coin/15 text-coin ring-coin/40', dot: 'bg-coin', title: 'Fictional data stored in this browser only. Nothing is sent to a server.' },
  simulated: { text: 'SIMULATED', cls: 'bg-coin/15 text-coin ring-coin/40', dot: 'bg-coin', title: 'Scripted demo. No real accounts, coins, scores or AI calls.' },
}

export function ModeBadge({ mode, className }: { mode: Mode; className?: string }) {
  const l = look[mode]
  return (
    <span title={l.title} data-mode={mode} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1', l.cls, className)}>
      <span className="relative flex size-2">
        {mode === 'live' && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', l.dot)} />}
        <span className={cn('relative size-2 rounded-full', l.dot)} />
      </span>
      {l.text}
    </span>
  )
}
