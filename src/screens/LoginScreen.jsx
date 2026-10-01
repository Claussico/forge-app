import { useState } from 'react'

export default function LoginScreen({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!email.includes('@')) return setError('Email no válido')
    if (!password) return setError('Introduce la contraseña')
    setLoading(true)
    try {
      await onSignIn(email, password)
    } catch (err) {
      // Supabase responde "Invalid login credentials" para todo: no se distingue qué falló.
      setError(/invalid/i.test(err?.message || '') ? 'Email o contraseña incorrectos' : (err?.message || 'No se pudo entrar'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="body" style={{ paddingTop: 72 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-0)', marginBottom: 32 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" aria-hidden="true">
          <path d="M4 9h16M6 9v3h12V9M9 12v2h6M12 9V7" />
        </svg>
        <span className="num" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '0.15em' }}>FORGE</span>
      </div>
      <h1 className="h1">Entrar</h1>
      <label className="field"><span className="lbl">Email</span>
        <input className="text-in" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="field"><span className="lbl">Contraseña</span>
        <input className="text-in" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p className="err-text" role="alert">{error}</p>}
      <button className="btn btn--primary btn--block" type="submit" disabled={loading || !email || !password}>{loading ? 'Entrando…' : 'Entrar'}</button>
    </form>
  )
}
