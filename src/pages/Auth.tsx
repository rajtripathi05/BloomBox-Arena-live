import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { BloomLogo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Card, Field, Input } from '@/components/ui/card'
import { VirtualNote } from '@/components/widgets'
import { api } from '@/services'
import { useApp } from '@/state/AppProvider'
import type { Role } from '@/lib/types'

export default function Auth() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const { session, isDemo, refresh } = useApp()
  const nav = useNavigate()
  if (session) return <Navigate to="/app" replace />

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const email = String(f.get('email')).trim(), password = String(f.get('password'))
    setBusy(true); setError(''); setInfo('')
    try {
      if (mode === 'register') {
        const name = String(f.get('name')).trim()
        if (name.length < 2) throw new Error('Enter your name')
        if (!isDemo && password.length < 8) throw new Error('Password must be at least 8 characters')
        const r = await api.signUp(name, email, password)
        if (r.needsConfirmation) { setInfo('Check your email to confirm your account, then sign in. Your 1,000 BLC will be waiting.'); setMode('login'); return }
      } else await api.signIn(email, password)
      await refresh()
      nav('/app')
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') } finally { setBusy(false) }
  }
  async function demo(role: Role) { await api.demoLogin?.(role); await refresh(); nav(role === 'participant' ? '/app' : '/admin') }

  return (
    <div className="mx-auto grid min-h-dvh max-w-md content-center gap-5 px-4 py-8">
      <Link to="/" className="flex items-center gap-3"><BloomLogo h={44} /><span className="font-display text-xl font-bold">BloomBox Pitch Arena</span></Link>
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-2 rounded-xl bg-ink p-1 text-sm font-semibold" role="tablist">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError('') }} className={`min-h-10 rounded-lg ${mode === m ? 'bg-bloom text-white' : 'text-mute'}`}>{m === 'login' ? 'Sign in' : 'Register'}</button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && <Field label="Full name"><Input name="name" autoComplete="name" required /></Field>}
          <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
          <Field label="Password" hint={isDemo ? 'Demo mode: password is not checked.' : mode === 'register' ? 'At least 8 characters.' : undefined}>
            <Input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required={!isDemo} />
          </Field>
          {error && <p role="alert" className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}
          {info && <p role="status" className="rounded-lg bg-win/10 px-3 py-2 text-sm text-win">{info}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account · get 1,000 BLC'}</Button>
        </form>
        {mode === 'register' && <VirtualNote />}
      </Card>

      {isDemo && (
        <Card className="space-y-3 ring-coin/30">
          <p className="text-sm font-semibold text-coin">Local demo mode: fictional data stored in this browser only.</p>
          <div className="grid gap-2">
            <Button variant="ghost" onClick={() => demo('participant')} data-testid="demo-participant">Continue as participant</Button>
            <Button variant="ghost" onClick={() => demo('judge')} data-testid="demo-judge">Continue as judge</Button>
            <Button variant="ghost" onClick={() => demo('admin')} data-testid="demo-admin">Continue as council admin</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
