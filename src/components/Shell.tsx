import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, CheckCircle2, CircleUserRound, Coins, Home, Layers, PanelLeftClose, PanelLeftOpen, ShieldCheck, Trophy, Tv, Wallet, WifiOff, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '@/state/AppProvider'
import { cn, fmtNum } from '@/lib/utils'
import { featuredEvent } from '@/lib/select'
import { BloomLogo, CoinIcon, InstitutionLogos } from './brand'
import { Button } from './ui/button'
import { InstallButton } from './InstallButton'
import { ModeBadge } from './ModeBadge'

function useNav() {
  const { snap, isStaff } = useApp()
  const ev = snap ? featuredEvent(snap) : null
  const items = [
    { to: '/app', end: true, label: 'Home', icon: Home, hero: false },
    { to: '/app/events', end: false, label: 'Events', icon: Layers, hero: false },
    { to: ev ? `/app/events/${ev.id}/invest` : '/app/events', end: false, label: 'Invest', icon: Coins, hero: true },
    { to: '/app/wallet', end: false, label: 'Wallet', icon: Wallet, hero: false },
    { to: '/app/leaderboard', end: false, label: 'Ranks', icon: Trophy, hero: false },
  ]
  const extra = isStaff ? [{ to: '/admin', end: false, label: 'Admin', icon: ShieldCheck, hero: false }] : []
  return { items, extra, ev }
}

export function Shell() {
  const { balance, online, isDemo, loadError, needRefresh, applyUpdate, toasts } = useApp()
  const { items, extra, ev } = useNav()
  const loc = useLocation()
  const [mini, setMini] = useState(() => { try { return localStorage.getItem('bb-sidebar') === 'mini' } catch { return false } })
  const toggle = () => setMini((m) => { try { localStorage.setItem('bb-sidebar', m ? 'full' : 'mini') } catch { /* storage unavailable */ } return !m })
  return (
    <div className={cn('min-h-dvh md:grid md:transition-[grid-template-columns] md:duration-200', mini ? 'md:grid-cols-[76px_1fr]' : 'md:grid-cols-[240px_1fr]')}>
      <aside className={cn('sticky top-0 hidden h-dvh flex-col gap-6 overflow-hidden border-r border-line bg-gradient-to-b from-ink-2/90 to-ink/60 md:flex', mini ? 'p-3' : 'p-5')}>
        <div className={cn('flex items-center gap-2', mini ? 'flex-col' : 'justify-between')}>
          <Link to="/app" className="flex items-center gap-3"><BloomLogo h={mini ? 32 : 40} />{!mini && <span className="font-display text-lg font-bold leading-tight">Pitch<br />Arena</span>}</Link>
          <button type="button" onClick={toggle} aria-label={mini ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!mini} className="grid size-9 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-white">{mini ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {[...items, ...extra].map((i) => (
            <NavLink key={i.label} to={i.to} end={i.end} title={mini ? i.label : undefined} aria-label={mini ? i.label : undefined} className={({ isActive }) => cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-mute transition hover:bg-white/5 hover:text-white', mini && 'justify-center px-0', isActive && 'bg-bloom/15 text-white ring-1 ring-bloom/40')}>
              <i.icon size={18} className="shrink-0" />{!mini && i.label}
            </NavLink>
          ))}
          {ev && <NavLink to={`/display/${ev.id}`} title={mini ? 'Display mode' : undefined} aria-label={mini ? 'Display mode' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-mute hover:bg-white/5 hover:text-white', mini && 'justify-center px-0')}><Tv size={18} className="shrink-0" />{!mini && 'Display mode'}</NavLink>}
        </nav>
        {!mini && <div className="mt-auto space-y-3">
          <InstallButton size="sm" variant="ghost" className="w-full" />
          <Link to="/" className="flex items-center gap-2 text-xs text-mute hover:text-white"><ArrowLeft size={14} />{isDemo ? 'Exit demo · Back to Home' : 'Back to Home'}</Link>
          <InstitutionLogos />
          <p className="text-[11px] leading-snug text-mute">BloomBox, the E-Cell of K. J. Somaiya College of Engineering. A virtual prediction game: coins have no cash value.</p>
        </div>}
      </aside>

      <div className="min-w-0 pb-24 md:pb-8">
        <header className="safe-t sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-ink/85 px-4 py-2.5 backdrop-blur md:px-8">
          <Link to="/app" className="flex items-center gap-2 md:hidden"><BloomLogo h={30} /><span className="font-display font-bold">Pitch Arena</span></Link>
          <Link to="/" aria-label="Back to Home" title="Back to Home" className="hidden items-center gap-1.5 text-xs text-mute hover:text-white md:flex"><ArrowLeft size={14} />Home</Link>
          <div className="flex items-center gap-2">
            <ModeBadge mode={isDemo ? 'demo' : loadError ? 'error' : 'live'} className="max-sm:px-2 max-sm:text-[10px]" />
            {!online && <span className="flex items-center gap-1 rounded-full bg-loss/15 px-2.5 py-1 text-[11px] font-bold text-loss ring-1 ring-loss/40"><WifiOff size={12} />Offline</span>}
            <Link to="/app/wallet" aria-label="Wallet balance" className="num flex min-h-10 items-center gap-1.5 rounded-full bg-panel-2 px-3 text-sm font-bold ring-1 ring-line"><CoinIcon />{fmtNum(balance)}</Link>
            <Link to="/app/profile" aria-label="Profile" className="grid size-10 place-items-center rounded-full bg-panel-2 ring-1 ring-line"><CircleUserRound size={20} /></Link>
          </div>
        </header>

        {(needRefresh || !online) && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl bg-bloom/15 px-4 py-2.5 text-sm ring-1 ring-bloom/40 md:mx-8">
            {needRefresh ? <><span>A new version of BloomBox is ready.</span><Button size="sm" onClick={applyUpdate}>Update</Button></> : <span>Offline: you can browse saved screens, but coin changes are disabled until you reconnect.</span>}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8">
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>

      <nav aria-label="Main" className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {items.map((i) => (
            <li key={i.label}>
              <NavLink to={i.to} end={i.end} className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-mute', isActive && 'text-white', i.hero && '-mt-4')}>
                {({ isActive }) => i.hero
                  ? <><span className="grid size-12 place-items-center rounded-full bg-coin text-ink shadow-[0_8px_24px_-6px_rgba(245,185,66,.7)]"><i.icon size={22} /></span><span className="text-white">{i.label}</span></>
                  : <><span className="relative grid place-items-center">{isActive && <motion.span layoutId="nav-pill" className="absolute -inset-x-3 -inset-y-1 rounded-full bg-bloom/15" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}<i.icon size={21} className={cn('relative', isActive && 'text-bloom')} /></span>{i.label}</>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} className={cn('pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl ring-1 backdrop-blur', t.kind === 'ok' ? 'bg-emerald-950/95 text-win ring-win/40' : 'bg-rose-950/95 text-rose-200 ring-loss/50')}>
              {t.kind === 'ok' ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}{t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
