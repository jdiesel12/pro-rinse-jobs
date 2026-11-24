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
    if (error) { setMsg(error.message); return }
    if (mode === 'up' && !data.session) {
      setMsg('Account created. Tap the confirmation link in your email, then sign in here.')
      setMode('in')
    }
  }

  return (
    <div className="login">
      <div className="login-glow" />
      <div className="login-inner">
        <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="login-logo" />
        <h1>Pro Rinse</h1>
        <p className="login-tag">Every job, every pane, every price.</p>
        <form onSubmit={submit} className="login-card">
          <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="Password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn primary big" disabled={busy}>{busy ? 'One sec…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
          {msg && <p className="login-msg">{msg}</p>}
        </form>
        <button className="login-switch" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg('') }}>
          {mode === 'in' ? 'First time here? Create your account' : 'Already set up? Sign in'}
        </button>
      </div>
    </div>
  )
}
