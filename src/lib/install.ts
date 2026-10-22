import { useSyncExternalStore } from 'react'

/**
 * PWA install state. The `beforeinstallprompt` listener is attached at import time (main.tsx imports this
 * module before rendering) so an early event is never missed.
 */
interface BIPEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export type InstallStatus = 'installed' | 'ready' | 'ios' | 'safari' | 'waiting' | 'unsupported'

let deferred: BIPEvent | null = null
let installed = false
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

if (typeof window !== 'undefined') {
  installed = isStandalone()
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; emit() })
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; emit() })
  matchMedia('(display-mode: standalone)').addEventListener?.('change', (e) => { if (e.matches) { installed = true; emit() } })
}

function platform(): Exclude<InstallStatus, 'installed' | 'ready'> {
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (ios) return 'ios'
  const chromium = /Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua)
  if (chromium || /SamsungBrowser/.test(ua)) return 'waiting'
  if (/Safari/.test(ua) && !/Firefox|FxiOS/.test(ua)) return 'safari'
  return 'unsupported'
}

function status(): InstallStatus {
  if (installed) return 'installed'
  if (deferred) return 'ready'
  return platform()
}

export function useInstall() {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, status, () => 'unsupported' as const)
  /** Shows the browser's own prompt. Resolves to true only if the visitor accepted it. */
  async function install() {
    const e = deferred
    if (!e) return false
    await e.prompt()
    const { outcome } = await e.userChoice
    deferred = null
    if (outcome === 'accepted') installed = true
    emit()
    return outcome === 'accepted'
  }
  return { status: s, install }
}
