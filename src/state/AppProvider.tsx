import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { api, isDemo } from '@/services'
import { ApiError, type SessionUser } from '@/services/api'
import type { Snapshot } from '@/lib/types'

interface Toast { id: number; kind: 'ok' | 'err'; msg: string }
interface Ctx {
  isDemo: boolean
  session: SessionUser | null | undefined
  snap: Snapshot | null
  loading: boolean
  loadError: string | null
  online: boolean
  balance: number
  refresh: () => Promise<void>
  /** Run a mutation: blocks offline, toasts the outcome, refreshes server state afterwards. */
  run: <T>(fn: () => Promise<T>, okMsg?: string) => Promise<T | undefined>
  toasts: Toast[]
  needRefresh: boolean
  applyUpdate: () => void
  isStaff: boolean
  isAdmin: boolean
}
const C = createContext<Ctx | null>(null)
export const useApp = () => {
  const c = useContext(C)
  if (!c) throw new Error('useApp outside provider')
  return c
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  const refresh = useCallback(async () => {
    try {
      const s = await api.getSession()
      setSession(s)
      if (!s) { setSnap(null); setLoadError(null); return }
      setSnap(await api.load())
      setLoadError(null)
    } catch (e) {
      // Keep the last good snapshot when offline or the network blips; never invent data.
      setLoadError(e instanceof Error ? e.message : 'Could not load data')
      setSession((p) => (p === undefined ? null : p))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => api.onAuthChange(() => void refresh()), [refresh])
  useEffect(() => (session ? api.subscribe(() => void refresh()) : undefined), [session?.id, refresh])  // eslint-disable-line
  useEffect(() => {
    const up = () => { setOnline(true); void refresh() }
    const down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [refresh])

  const push = useCallback((kind: Toast['kind'], msg: string) => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, kind, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const run = useCallback(async <T,>(fn: () => Promise<T>, okMsg?: string) => {
    if (!navigator.onLine) { push('err', 'You are offline. Nothing was saved. Reconnect and try again.'); return undefined }
    try {
      const out = await fn()
      if (okMsg) push('ok', okMsg)
      await refresh()
      return out
    } catch (e) {
      push('err', e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong')
      await refresh()
      return undefined
    }
  }, [push, refresh])

  const balance = snap?.myEntries.reduce((a, e) => a + e.amount, 0) ?? 0
  const value = useMemo<Ctx>(() => ({
    isDemo, session, snap, loading, loadError, online, balance, refresh, run, toasts,
    needRefresh, applyUpdate: () => void updateServiceWorker(true),
    isStaff: !!session && session.role !== 'participant', isAdmin: session?.role === 'admin',
  }), [session, snap, loading, loadError, online, balance, refresh, run, toasts, needRefresh, updateServiceWorker])
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return n
}
