import { cn } from '@/lib/utils'
import type { Team } from '@/lib/types'

/** Original logos sit on white chips: the source files are opaque JPG/PNG with white backgrounds. */
export function LogoChip({ src, alt, className, h = 40 }: { src: string; alt: string; className?: string; h?: number }) {
  return (
    <span className={cn('inline-flex items-center justify-center rounded-xl bg-white p-1 ring-1 ring-white/20', className)}>
      <img src={src} alt={alt} style={{ height: h }} className="w-auto object-contain" loading="lazy" />
    </span>
  )
}
export const BloomLogo = ({ h = 36, className }: { h?: number; className?: string }) => <LogoChip src="/brand/bloombox_kjsce_logo.jpg" alt="BloomBox" h={h} className={className} />

export function InstitutionLogos({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <LogoChip src="/brand/k_j_somaiya_school_of_engineering_logo.jpg" alt="K. J. Somaiya School of Engineering" h={44} className="px-2" />
      <LogoChip src="/brand/somaiya_logo.png" alt="Somaiya Vidyavihar" h={44} />
    </div>
  )
}

export function TeamLogo({ team, size = 44 }: { team: Pick<Team, 'name' | 'initials' | 'color' | 'logoUrl'>; size?: number }) {
  if (team.logoUrl)
    return <img src={team.logoUrl} alt={`${team.name} logo`} className="shrink-0 rounded-xl bg-white object-contain p-0.5" style={{ width: size, height: size }} />
  return (
    <span
      aria-hidden
      className="font-display inline-flex shrink-0 items-center justify-center rounded-xl font-bold text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${team.color}, ${team.color}99)`, fontSize: size * 0.38 }}
    >
      {team.initials}
    </span>
  )
}

export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="11" fill="#f5b942" />
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="#a8730b" strokeWidth="1.2" />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fill="#7a4f05" fontFamily="system-ui">B</text>
    </svg>
  )
}
