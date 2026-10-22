import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import type { Kind } from './Scene'

const GOLD = { color: '#f5b942', metalness: 0.85, roughness: 0.28 }

/** Procedural "B" face for the coin: no external assets. */
function useCoinFace() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#f5b942'; g.fillRect(0, 0, 256, 256)
    g.strokeStyle = '#a8730b'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke()
    g.fillStyle = '#7a4f05'; g.font = '800 150px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('B', 128, 138)
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

function Coin() {
  const g = useRef<Group>(null)
  const face = useCoinFace()
  useFrame((_, d) => { if (g.current) g.current.rotation.y += d * 0.9 })
  return (
    <Float speed={1.6} floatIntensity={0.6}>
      <group ref={g} rotation={[0.2, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[1, 1, 0.16, 56]} /><meshStandardMaterial {...GOLD} /></mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, s * 0.082, 0]} rotation={[-s * Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.9, 48]} /><meshStandardMaterial map={face} metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
      </group>
    </Float>
  )
}

/** Small pitch stage: round dais, three podium blocks in brand colours, faint spotlight cone. */
function Stage() {
  const g = useRef<Group>(null)
  useFrame((_, d) => { if (g.current) g.current.rotation.y += d * 0.25 })
  const blocks: [number, number, string][] = [[-0.7, 0.5, '#1d4ed8'], [0, 0.8, '#3b82f6'], [0.7, 0.35, '#c8323c']]
  return (
    <group ref={g} position={[0, -0.6, 0]} rotation={[0.1, 0, 0]}>
      <mesh><cylinderGeometry args={[1.5, 1.6, 0.14, 48]} /><meshStandardMaterial color="#16223f" metalness={0.4} roughness={0.5} /></mesh>
      <mesh position={[0, 0.075, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.45, 0.025, 8, 64]} /><meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.8} /></mesh>
      {blocks.map(([x, h, c]) => (
        <mesh key={x} position={[x, 0.07 + h / 2, 0]}><boxGeometry args={[0.6, h, 0.6]} /><meshStandardMaterial color={c} metalness={0.3} roughness={0.45} /></mesh>
      ))}
      <mesh position={[0, 1.9, 0]}><coneGeometry args={[1.1, 1.8, 32, 1, true]} /><meshBasicMaterial color="#93c5fd" transparent opacity={0.07} depthWrite={false} /></mesh>
    </group>
  )
}

/** Trophy with a one-shot rise-and-settle entrance, then a slow turn. */
function Trophy() {
  const g = useRef<Group>(null)
  const t = useRef(0)
  const gold = { color: '#f5b942', metalness: 0.9, roughness: 0.25 }
  useFrame((_, d) => {
    t.current = Math.min(1, t.current + d / 1.2)
    const e = 1 - Math.pow(1 - t.current, 3)
    if (g.current) { g.current.rotation.y += d * (0.7 + (1 - e) * 6); g.current.scale.setScalar(0.4 + e * 0.6); g.current.position.y = -0.5 - (1 - e) * 0.8 }
  })
  return (
    <Float speed={1.4} floatIntensity={0.3}>
      <group ref={g}>
        <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.7, 0.35, 0.9, 32]} /><meshStandardMaterial {...gold} /></mesh>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.12, 0.12, 0.6, 16]} /><meshStandardMaterial {...gold} /></mesh>
        <mesh position={[0, -0.15, 0]}><cylinderGeometry args={[0.55, 0.65, 0.2, 32]} /><meshStandardMaterial color="#1d4ed8" metalness={0.5} roughness={0.4} /></mesh>
        {[-0.78, 0.78].map((x) => <mesh key={x} position={[x, 0.95, 0]}><torusGeometry args={[0.22, 0.05, 8, 20]} /><meshStandardMaterial {...gold} /></mesh>)}
        <mesh position={[0, 1.38, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.7, 0.03, 8, 48]} /><meshStandardMaterial {...gold} emissive="#f5b942" emissiveIntensity={0.4} /></mesh>
      </group>
      <Sparkles count={40} scale={[3, 3, 2]} size={3} speed={0.4} color="#ffe29a" />
    </Float>
  )
}

/** Layered pitch arena: stage dais, backdrop screen, podiums, sweeping spotlights and orbiting coins, with a slow camera drift. */
function Arena() {
  const spots = useRef<(Mesh | null)[]>([])
  const coins = useRef<Group>(null)
  const screen = useRef<Mesh>(null)
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime
    camera.position.x = Math.sin(t * 0.18) * 0.9
    camera.position.y = 1.5 + Math.sin(t * 0.13) * 0.15
    camera.lookAt(0, 0.4, 0)
    spots.current.forEach((m, i) => { if (m) m.rotation.z = Math.sin(t * 0.6 + i * 2.1) * 0.35 + (i - 1) * 0.25 })
    if (coins.current) coins.current.rotation.y = t * 0.35
    if (screen.current) (screen.current.material as MeshStandardMaterial).emissiveIntensity = 0.55 + Math.sin(t * 1.4) * 0.12
  })
  const podiums: [number, number, string][] = [[-0.85, 0.45, '#1d4ed8'], [0, 0.75, '#f5b942'], [0.85, 0.3, '#c8323c']]
  return (
    <group position={[0, -0.7, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><circleGeometry args={[4, 64]} /><meshStandardMaterial color="#0b1430" metalness={0.6} roughness={0.35} /></mesh>
      {[1.9, 2.6, 3.3].map((r) => <mesh key={r} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[r, r + 0.015, 96]} /><meshBasicMaterial color="#3b82f6" transparent opacity={0.25} /></mesh>)}
      <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[1.6, 1.7, 0.14, 64]} /><meshStandardMaterial color="#16223f" metalness={0.4} roughness={0.5} /></mesh>
      <mesh position={[0, 0.145, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.58, 0.02, 8, 80]} /><meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={1.2} /></mesh>
      <mesh ref={screen} position={[0, 1.5, -1.9]}><planeGeometry args={[4.2, 1.9]} /><meshStandardMaterial color="#0e1530" emissive="#1d4ed8" emissiveIntensity={0.55} /></mesh>
      {podiums.map(([x, h, c]) => (
        <mesh key={x} position={[x, 0.14 + h / 2, 0.1]}><boxGeometry args={[0.66, h, 0.66]} /><meshStandardMaterial color={c} metalness={0.35} roughness={0.4} /></mesh>
      ))}
      {[-1.6, 0, 1.6].map((x, i) => (
        <mesh key={x} ref={(m) => { spots.current[i] = m }} position={[x, 3, -0.3]}>
          <coneGeometry args={[0.7, 3, 32, 1, true]} /><meshBasicMaterial color={i === 1 ? '#ffe29a' : '#93c5fd'} transparent opacity={0.06} depthWrite={false} />
        </mesh>
      ))}
      <group ref={coins} position={[0, 1.4, 0]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2
          return <mesh key={i} position={[Math.cos(a) * 1.9, Math.sin(a * 2) * 0.2, Math.sin(a) * 1.9]} rotation={[Math.PI / 2, 0, a]}><cylinderGeometry args={[0.16, 0.16, 0.03, 24]} /><meshStandardMaterial {...GOLD} /></mesh>
        })}
      </group>
    </group>
  )
}

/** Stop rendering while the tab is hidden; the canvas itself unmounts when scrolled off screen (see Scene.tsx). */
function useVisible() {
  const [v, setV] = useState(() => !document.hidden)
  useEffect(() => { const f = () => setV(!document.hidden); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f) }, [])
  return v
}

export default function Scene3D({ kind }: { kind: Kind }) {
  const visible = useVisible()
  const wide = kind === 'stage' || kind === 'arena'
  return (
    <Canvas frameloop={visible ? 'always' : 'never'} dpr={[1, 1.5]} camera={{ position: [0, wide ? 1.5 : 0.4, kind === 'arena' ? 6 : wide ? 5 : 4], fov: 40 }} gl={{ antialias: true, powerPreference: 'low-power' }}>
      <ambientLight intensity={kind === 'arena' ? 0.5 : 0.8} />
      <directionalLight position={[3, 4, 3]} intensity={2.2} />
      <pointLight position={[-3, -1, 2]} intensity={8} color="#3b82f6" />
      {kind === 'arena' && <pointLight position={[0, 3, 1.5]} intensity={12} color="#ffe29a" />}
      {kind === 'coin' ? <Coin /> : kind === 'stage' ? <Stage /> : kind === 'arena' ? <Arena /> : <Trophy />}
    </Canvas>
  )
}
