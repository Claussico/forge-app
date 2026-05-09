import { useState } from 'react'
import { Wordmark } from '../components/UI'

export default function LoginScreen({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!email.includes('@')) {
      setError('Email no válido')
      return
    }
    if (!password) {
      setError('Introduce la contraseña')
      return
    }
    setLoading(true)
    try {
      await onSignIn(email, password)
      // Si no lanza, useAuth pillará el cambio de sesión y App.jsx renderizará HomeScreen
    } catch (err) {
      // Mensaje genérico — Supabase devuelve "Invalid login credentials" para
      // todo (email no existe, password mal). No filtramos qué falló por seguridad.
      const msg = err?.message || ''
      if (msg.toLowerCase().includes('invalid')) {
        setError('Credenciales incorrectas')
      } else {
        setError(msg || 'Error iniciando sesión')
      }
    } finally {
      setLoading(false)
    }
  }

  // Permite enviar con Enter desde cualquier input
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) submit()
  }

  return (
    <div className="screen" style={{ background: 'var(--bg-0)' }}>
      <div className="screen-body safe-top" style={{ padding: '88px 28px 28px', display: 'flex', flexDirection: 'column' }}>

        <div style={{ marginBottom: 56 }}>
          <Wordmark size={22} />
        </div>

        <h1 className="h1" style={{ margin: '0 0 6px', fontWeight: 500 }}>
          Entrar
        </h1>
        <p className="muted" style={{ margin: '0 0 28px', fontSize: 13 }}>
          Email y contraseña.
        </p>

        <label className="label">Email</label>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="field"
          placeholder="tucorreo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onKeyDown}
          style={{ marginBottom: 18 }}
        />

        <label className="label">Contraseña</label>
        <input
          type="password"
          autoComplete="current-password"
          className="field"
          placeholder="••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKeyDown}
          style={{ marginBottom: error ? 6 : 18 }}
        />

        {error && (
          <div style={{
            fontSize: 12, color: 'var(--err)',
            fontFamily: 'var(--ff-mono)', marginBottom: 14
          }}>
            {error}
          </div>
        )}

        <button
          className="btn btn--primary btn--block btn--lg"
          onClick={submit}
          disabled={loading || !email || !password}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

      </div>
    </div>
  )
}
