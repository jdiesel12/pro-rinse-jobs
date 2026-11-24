import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg('')
    if (!navigator.onLine) { setMsg('First sign-in needs signal. After that it works offline.'); setBusy(false); return }
    const { data, error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) { setMsg(error.message.includes('Database error') ? 'Sign-ups are closed — this app already has its owner.' : error.message); return }
    if (mode === 'up' && !data.session) {
      setMsg('Account created. Check your email for the confirmation link, tap it, then come back and sign in.')
      setMode('in')
    }
  }

  return (
    <div className="screen login">
      <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="login-logo" />
      <h1>Pro Rinse Jobs</h1>
      <p className="muted">{mode === 'in' ? 'Sign in' : 'Create your account (one-time)'}</p>
      <form onSubmit={submit} className="stack">
        <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="Password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn primary big" disabled={busy}>{busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      </form>
      {msg && <p className="note">{msg}</p>}
      <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg('') }}>
        {mode === 'in' ? 'First time? Create account' : 'Have an account? Sign in'}
      </button>
    </div>
  )
}
