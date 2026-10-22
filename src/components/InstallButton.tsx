import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useInstall, type InstallStatus } from '@/lib/install'
import { Button, type ButtonProps } from './ui/button'

const help: Record<Exclude<InstallStatus, 'ready' | 'installed'>, { title: string; steps: string[] }> = {
  ios: { title: 'Install on iPhone or iPad', steps: ['Open this page in Safari.', 'Tap the Share button.', 'Choose “Add to Home Screen”, then “Add”.'] },
  safari: { title: 'Install from Safari', steps: ['In the menu bar choose File → Add to Dock (Safari 17 or later).', 'On iPhone or iPad use Share → Add to Home Screen.'] },
  waiting: {
    title: 'Install from your browser',
    steps: ['Your browser has not offered an install prompt on this visit yet.', 'Use the install icon in the address bar, or the browser menu → “Install app” / “Add to Home screen”.', 'If neither is shown, the app may already be installed, or the page is not served over HTTPS.'],
  },
  unsupported: { title: 'Installation not available', steps: ['This browser does not support installing web apps.', 'Open the site in Chrome, Edge or Samsung Internet (Android/desktop), or Safari on iOS.', 'Everything still works in the browser tab.'] },
}

export function InstallButton({ label = 'Install App', ...p }: ButtonProps & { label?: string }) {
  const { status, install } = useInstall()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [open])

  async function click() {
    setMsg('')
    if (status === 'ready') { const ok = await install(); if (!ok) setMsg('Install dismissed. You can try again any time.') }
    else if (status !== 'installed') setOpen(true)
  }
  const info = status !== 'ready' && status !== 'installed' ? help[status] : null
  return (
    <>
      <Button {...p} onClick={click} disabled={status === 'installed' || p.disabled} data-install-status={status} aria-haspopup={info ? 'dialog' : undefined}>
        {status === 'installed' ? <><CheckCircle2 size={18} />App installed</> : <>{status === 'ios' ? <Share size={18} /> : <Download size={18} />}{label}</>}
      </Button>
      {msg && <span role="status" className="sr-only">{msg}</span>}
      <AnimatePresence>
        {open && info && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-end bg-black/60 p-4 backdrop-blur-sm sm:place-items-center" onClick={() => setOpen(false)}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="install-title" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-panel p-5 ring-1 ring-line">
              <div className="flex items-start justify-between gap-3">
                <h2 id="install-title" className="font-display text-lg font-bold">{info.title}</h2>
                <button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 place-items-center rounded-lg text-mute hover:bg-white/5"><X size={18} /></button>
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-200">{info.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              <p className="mt-4 text-[11px] text-mute">BloomBox installs as a web app (PWA). There is no APK or app-store download.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
