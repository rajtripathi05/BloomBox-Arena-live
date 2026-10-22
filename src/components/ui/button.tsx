import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const variants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-bloom text-white shadow-[0_6px_24px_-8px_rgba(59,130,246,.8)] hover:bg-blue-500',
        coin: 'bg-coin text-ink hover:brightness-110',
        ghost: 'bg-panel-2 text-slate-100 ring-1 ring-line hover:bg-line/60',
        danger: 'bg-loss/15 text-loss ring-1 ring-loss/40 hover:bg-loss/25',
        link: 'min-h-0 px-0 text-bloom hover:underline',
      },
      size: { md: '', sm: 'min-h-9 px-3 text-xs', lg: 'min-h-12 px-6 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> { asChild?: boolean }

export function Button({ className, variant, size, asChild, ...p }: ButtonProps) {
  const C = asChild ? Slot : 'button'
  return <C className={cn(variants({ variant, size }), className)} {...p} />
}
