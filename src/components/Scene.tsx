import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Trophy } from 'lucide-react'

const Scene3D = lazy(() => import('./Scene3D'))

export type Kind = 'coin' | 'stage' | 'trophy' | 'arena'

/** 3D is a progressive enhancement: skipped on reduced motion, data-saver, low-core devices or no WebGL. */
function can3D() {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    const n = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
    if (n.connection?.saveData) return false
    if ((n.hardwareConcurrency ?? 4) < 4 || (n.deviceMemory ?? 4) < 4) return false
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

/** Pure CSS/SVG stand-in: shown before the chunk loads, when WebGL is unavailable, or if the scene throws. */
function Fallback({ kind, className }: { kind: Kind; className: string }) {
  if (kind === 'trophy') return <div className={`${className} grid place-items-center text-coin`} data-scene-fallback={kind} aria-hidden><Trophy size={64} strokeWidth={1.4} className="drop-shadow-[0_0_24px_rgba(245,185,66,.6)]" /></div>
  if (kind === 'arena') return (
    <div className={`${className} relative overflow-hidden`} data-scene-fallback={kind} aria-hidden>
      <div className="absolute inset-x-[8%] bottom-[12%] h-[22%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,#1d4ed8_0%,#16223f_55%,transparent_72%)]" />
      <div className="absolute left-1/2 top-0 h-3/4 w-2/3 -translate-x-1/2 bg-[conic-gradient(from_160deg_at_50%_0%,transparent_0deg,rgba(147,197,253,.18)_20deg,transparent_40deg)]" />
      <div className="absolute inset-x-0 bottom-[22%] flex items-end justify-center gap-2">
        {[['h-14', '#1d4ed8'], ['h-20', '#f5b942'], ['h-10', '#c8323c']].map(([h, c]) => <div key={c} className={`${h} w-[14%] rounded-t-lg`} style={{ background: `linear-gradient(${c}, ${c}66)` }} />)}
      </div>
    </div>
  )
  return (
    <div className={`${className} grid place-items-center`} data-scene-fallback={kind} aria-hidden>
      <div className="grid aspect-square w-3/5 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#ffe29a,#f5b942_45%,#a8730b)] shadow-[0_12px_40px_-8px_rgba(245,185,66,.55)] ring-4 ring-[#a8730b]/60">
        <span className="font-display text-5xl font-extrabold text-[#7a4f05]">B</span>
      </div>
    </div>
  )
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** The canvas is mounted only while on screen, so off-screen scenes cost nothing and release their GL context. */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return }
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '80px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, on] as const
}

export function Scene({ kind, className = 'h-40 w-40' }: { kind: Kind; className?: string }) {
  const [ok] = useState(can3D)
  const [ref, visible] = useOnScreen<HTMLDivElement>()
  const fb = <Fallback kind={kind} className={className} />
  if (!ok) return fb
  return (
    <div ref={ref} className={className} data-scene={kind} aria-hidden>
      {visible ? <Boundary fallback={fb}><Suspense fallback={fb}><Scene3D kind={kind} /></Suspense></Boundary> : fb}
    </div>
  )
}
