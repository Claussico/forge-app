import { useState, useEffect } from 'react'
import {
  fetchLatestMeasurements,
  saveBodyMeasurements
} from '../lib/queries'

const MEASUREMENTS = [
  { key: 'neck_cm', label: 'Cuello' },
  { key: 'shoulders_cm', label: 'Hombros' },
  { key: 'chest_cm', label: 'Pecho' },
  { key: 'waist_cm', label: 'Cintura' },
  { key: 'hips_cm', label: 'Cadera' },
  { key: 'arm_left_cm', label: 'Brazo izq' },
  { key: 'arm_right_cm', label: 'Brazo der' },
  { key: 'forearm_left_cm', label: 'Antebrazo izq', optional: true },
  { key: 'forearm_right_cm', label: 'Antebrazo der', optional: true },
  { key: 'thigh_left_cm', label: 'Muslo izq' },
  { key: 'thigh_right_cm', label: 'Muslo der' },
  { key: 'calf_left_cm', label: 'Pantorrilla izq' },
  { key: 'calf_right_cm', label: 'Pantorrilla der' }
]

export default function ReportScreen() {
  const [measurements, setMeasurements] = useState({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lastMeasurements, setLastMeasurements] = useState(null)

  useEffect(() => {
    fetchLatestMeasurements()
      .then(setLastMeasurements)
      .catch(err => setError(err.message))
  }, [])

  const updateMeasurement = (key, value) => {
    setMeasurements(prev => ({ ...prev, [key]: value }))
  }

  const hasAnyMeasurement = Object.values(measurements).some(
    v => v !== '' && v !== null && v !== undefined
  )

  const save = async () => {
    if (!hasAnyMeasurement) {
      setError('Introduce al menos una medida')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const cleanPayload = {}
      for (const k of Object.keys(measurements)) {
        const v = measurements[k]
        if (v !== '' && v !== null && v !== undefined) {
          cleanPayload[k] = Number(v)
        }
      }
      if (notes.trim()) cleanPayload.notes = notes.trim()

      await saveBodyMeasurements(cleanPayload)
      setSuccess('Medidas guardadas')
      setMeasurements({})
      setNotes('')
      fetchLatestMeasurements().then(setLastMeasurements)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const today = new Date()
  const dateStr = today.toLocaleDateString('es-ES', {
    weekday: 'short', day: '2-digit', month: 'short'
  }).replace('.', '').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div className="screen">
      <div className="screen-body safe-top" style={{ padding: '24px 20px 120px' }}>

        <div style={{
          fontFamily: 'var(--ff-mono)', fontSize: 10.5,
          letterSpacing: '0.1em', color: 'var(--text-3)',
          textTransform: 'uppercase', marginBottom: 6
        }}>
          Medidas semanales
        </div>
        <h1 className="h1" style={{ marginBottom: 4, fontWeight: 600 }}>
          {dateStr}
        </h1>

        <div style={{
          fontFamily: 'var(--ff-mono)', fontSize: 11,
          color: 'var(--text-3)', marginBottom: 22
        }}>
          {lastMeasurements
            ? `Últimas medidas: ${formatDateAgo(lastMeasurements.date)}`
            : 'Sin mediciones previas'}
        </div>

        <div className="card" style={{ padding: 6, marginBottom: 18 }}>
          {MEASUREMENTS.map((m, i) => {
            const lastValue = lastMeasurements?.[m.key]
            return (
              <div
                key={m.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 110px',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 12px',
                  borderTop: i > 0 ? '1px solid var(--border-1)' : 'none'
                }}
              >
                <div>
                  <div style={{
                    fontSize: 14, color: 'var(--text-1)', fontWeight: 500
                  }}>
                    {m.label}
                    {m.optional && (
                      <span style={{
                        color: 'var(--text-4)', fontSize: 11, marginLeft: 6
                      }}>
                        opcional
                      </span>
                    )}
                  </div>
                  {lastValue && (
                    <div style={{
                      fontFamily: 'var(--ff-mono)', fontSize: 10.5,
                      color: 'var(--text-4)', marginTop: 2
                    }}>
                      últ: {Number(lastValue).toFixed(1)} cm
                    </div>
                  )}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'baseline',
                  gap: 4, justifyContent: 'flex-end'
                }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    className="num-input"
                    style={{ width: 70, textAlign: 'right', fontSize: 18 }}
                    value={measurements[m.key] ?? ''}
                    onChange={(e) => updateMeasurement(m.key, e.target.value)}
                    placeholder="—"
                  />
                  <span style={{
                    color: 'var(--text-3)',
                    fontFamily: 'var(--ff-mono)', fontSize: 11
                  }}>cm</span>
                </div>
              </div>
            )
          })}
        </div>

        <label className="label">Notas (opcional)</label>
        <textarea
          className="field"
          style={{
            minHeight: 70, fontFamily: 'var(--ff-sans)',
            resize: 'vertical', marginBottom: 8
          }}
          placeholder="Contexto sobre la medición: día del ciclo, hora, después de entrenar, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <div style={{ color: 'var(--err)', fontSize: 12, marginTop: 12 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ color: 'var(--accent-hi)', fontSize: 12, marginTop: 12 }}>
            {success}
          </div>
        )}
      </div>

      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        padding: '12px 20px',
        background: 'linear-gradient(to top, var(--bg-0) 70%, transparent)',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
      }}>
        <button
          className="btn btn--primary btn--block btn--lg"
          disabled={saving || !hasAnyMeasurement}
          onClick={save}
        >
          {saving ? 'Guardando…' : 'Guardar medidas'}
        </button>
      </div>
    </div>
  )
}

function formatDateAgo(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'hoy'
  if (diffDays === 1) return 'ayer'
  if (diffDays < 7) return `hace ${diffDays}d`
  if (diffDays < 14) return 'hace 1 sem'
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} sem`
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
