import { useState } from 'react'
import { Wordmark } from '../components/UI'

export default function LoginScreen({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!email.includes('@')) {
      setError('Email no válido')
      return
    }
    setLoading(true)
    try {
      await onSignIn(email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Error enviando el enlace')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen" style={{ background: 'var(--bg-0)' }}>
      <div className="screen-body safe-top" style={{ padding: '88px 28px 28px', display: 'flex', flexDirection: 'column' }}>

        <div style={{ marginBottom: 56 }}>
          <Wordmark size={22} />
        </div>

        {!sent ? (
          <>
            <h1 className="h1" style={{ margin: '0 0 6px', fontWeight: 500 }}>
              Entrar
            </h1>
            <p className="muted" style={{ margin: '0 0 28px', fontSize: 13 }}>
              Recibirás un enlace mágico por email.
            </p>

            <label className="label">Email</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="field"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              disabled={loading || !email}
            >
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </>
        ) : (
          <div className="anim-fade">
            <h1 className="h1" style={{ margin: '0 0 10px', fontWeight: 500 }}>
              Enlace enviado
            </h1>
            <p className="muted" style={{ margin: '0 0 28px', fontSize: 13, lineHeight: 1.55 }}>
              Revisa <span className="mono" style={{ color: 'var(--text-1)' }}>{email}</span>.
              El enlace caduca en 15 minutos. Al tocarlo desde el móvil, volverás a FORGE autenticado.
            </p>
            <button
              className="btn btn--ghost btn--block"
              style={{ border: 'none', color: 'var(--text-3)' }}
              onClick={() => { setSent(false); setEmail('') }}
            >
              Usar otro email
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
