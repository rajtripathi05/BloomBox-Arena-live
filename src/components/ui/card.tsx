import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('surface-elev rounded-2xl bg-gradient-to-b from-panel-2/70 to-panel/90 p-4 ring-1 ring-line', className)} {...p} />
)

const tones = {
  blue: 'bg-bloom/15 text-blue-300 ring-bloom/30', gold: 'bg-coin/15 text-coin ring-coin/30', green: 'bg-win/15 text-win ring-win/30',
  red: 'bg-loss/15 text-loss ring-loss/30', gray: 'bg-white/5 text-mute ring-white/10',
}
export const Badge = ({ tone = 'gray', className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1', tones[tone], className)} {...p} />
)

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-medium text-mute">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-mute/80">{hint}</span>}
  </label>
)

export const inputCls = 'w-full min-h-11 rounded-xl bg-ink px-3 text-sm text-white ring-1 ring-line placeholder:text-mute/60 focus:ring-2 focus:ring-bloom outline-none'
export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => <input className={cn(inputCls, className)} {...p} />
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cn(inputCls, 'py-2', className)} {...p} />
export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select className={cn(inputCls, className)} {...p} />

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-8 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-mute">{children}</div>}
    </div>
  )
}
