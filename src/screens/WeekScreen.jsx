import { useState, useEffect } from 'react'
import { fetchWeekSummary, fetchBriefing, fetchActiveProgramContext } from '../lib/queries'
import { LineChart } from '../components/UI'

export default function WeekScreen() {
  const [data, setData] = useState(null)
  const [briefing, setBriefing] = useState(null)
  const [program, setProgram] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchWeekSummary(), fetchBriefing(), fetchActiveProgramContext()])
      .then(([summary, b, p]) => {
        setData(summary)
        setBriefing(b)
        setProgram(p)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Cargando…</div>
  if (error) return <div style={{ padding: 20, color: 'var(--err)' }}>{error}</div>
  if (!data) return null

  const currentWeek = data.adherence?.[0]
  const sessionsCount = data.sessions?.length || 0
  const sessionsPlanned = data.sessionsPlanned ?? 0

  // Preparar gráfica de peso
  const weightData = (data.weightTrend || []).slice(-7).map(w => ({
    x: new Date(w.date).toLocaleDateString('es-ES', { weekday: 'short' }).substring(0, 2),
    y: Number(w.weight_kg)
  }))

  const weightAvg = weightData.length > 0
    ? (weightData.reduce((s, d) => s + d.y, 0) / weightData.length).toFixed(1)
    : null

  const weightDelta = weightData.length >= 7 && briefing?.weight_avg_prev_7d
    ? (Number(weightAvg) - Number(briefing.weight_avg_prev_7d)).toFixed(1)
    : null

  const avgRpe = currentWeek?.avg_rpe || null

  // Construir labels del programa si hay programa activo
  const programLabel = program?.program_name || null
  const blockLabel = briefing
    ? `Semana ${briefing.current_block_week || '?'} · Bloque ${briefing.current_block || '?'} ${briefing.current_block_phase || ''}`.trim()
    : null

  // Días desde inicio / restantes del programa
  let programProgressLabel = null
  if (program?.program_start_date && program?.program_end_planned) {
    const today = new Date()
    const start = new Date(program.program_start_date + 'T00:00:00')
    const end = new Date(program.program_end_planned + 'T00:00:00')
    const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.round((today - start) / (1000 * 60 * 60 * 24))
    if (elapsedDays < 0) {
      const daysToStart = -elapsedDays
      programProgressLabel = `Empieza en ${daysToStart}d · ${totalDays}d totales`
    } else if (elapsedDays > totalDays) {
      programProgressLabel = `Programa completado (+${elapsedDays - totalDays}d)`
    } else {
      programProgressLabel = `Día ${elapsedDays}/${totalDays}`
    }
  }

  const magnusPromptUrl = buildMagnusPromptUrl()

  return (
    <div className="screen">
      <div className="screen-body safe-top" style={{ padding: '24px 20px 24px' }}>

        <div style={{
          fontFamily: 'var(--ff-mono)', fontSize: 10.5,
          letterSpacing: '0.1em', color: 'var(--text-3)',
          textTransform: 'uppercase', marginBottom: 6
        }}>
          Últimos 7 días
        </div>
        <h1 className="h1" style={{ marginBottom: 4, fontWeight: 600 }}>Resumen</h1>

        {/* Contexto del programa */}
        {programLabel && (
          <div style={{ marginBottom: 4 }}>
            <div style={{
              fontSize: 13, color: 'var(--text-1)',
              fontWeight: 500, lineHeight: 1.3
            }}>
              {programLabel}
            </div>
          </div>
        )}
        {blockLabel && (
          <div style={{
            fontFamily: 'var(--ff-mono)', fontSize: 11,
            color: 'var(--text-3)', marginTop: 2
          }}>
            {blockLabel}
          </div>
        )}
        {programProgressLabel && (
          <div style={{
            fontFamily: 'var(--ff-mono)', fontSize: 10,
            color: 'var(--text-4)', marginTop: 2,
            letterSpacing: '0.05em'
          }}>
            {programProgressLabel}
          </div>
        )}

        <div style={{ height: 22 }} />

        {/* Grid 2x2 métricas */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10, marginBottom: 18
        }}>
          <Metric
            label="Adherencia"
            value={sessionsPlanned > 0 ? `${sessionsCount}/${sessionsPlanned}` : `${sessionsCount}`}
            sub={sessionsPlanned > 0 ? 'sesiones' : 'sin programar'}
          />
          <Metric
            label="Peso medio"
            value={weightAvg ? `${weightAvg} kg` : '—'}
            sub={weightDelta !== null
              ? `${Number(weightDelta) >= 0 ? '+' : ''}${weightDelta} vs sem. ant.`
              : ''}
          />
          <Metric
            label="RPE medio"
            value={avgRpe ? Number(avgRpe).toFixed(1) : '—'}
            sub=""
          />
          <Metric
            label="Sesiones"
            value={sessionsCount}
            sub="completadas"
          />
        </div>

        {/* Gráfica de peso */}
        <div className="card" style={{ padding: 16, marginBottom: 18 }}>
          <div style={{
            fontFamily: 'var(--ff-mono)', fontSize: 10,
            letterSpacing: '0.1em', color: 'var(--text-3)',
            textTransform: 'uppercase', marginBottom: 12
          }}>
            Peso · Tendencia 7D
          </div>
          <LineChart data={weightData} height={140} valueKey="y" xKey="x" />
        </div>

        {/* Sesiones completadas */}
        <div style={{
          fontFamily: 'var(--ff-mono)', fontSize: 10,
          letterSpacing: '0.1em', color: 'var(--text-3)',
          textTransform: 'uppercase', marginBottom: 10
        }}>
          Sesiones completadas
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {data.sessions && data.sessions.length > 0 ? data.sessions.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              borderTop: i > 0 ? '1px solid var(--border-1)' : 'none'
            }}>
              <div style={{
                fontFamily: 'var(--ff-mono)', fontSize: 10,
                color: 'var(--text-3)', minWidth: 48
              }}>
                {new Date(s.performed_date + 'T00:00:00')
                  .toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' })
                  .replace('.', '').toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--text-0)' }}>
                  {s.session_name || 'Sesión'}
                </div>
                <div style={{
                  fontFamily: 'var(--ff-mono)', fontSize: 10.5,
                  color: 'var(--text-3)', marginTop: 2
                }}>
                  {s.duration_min ? `${s.duration_min} min` : '—'} · RPE {s.overall_rpe || '—'}
                </div>
              </div>
            </div>
          )) : (
            <div style={{
              padding: '30px 16px', textAlign: 'center',
              color: 'var(--text-3)', fontSize: 12,
              fontFamily: 'var(--ff-mono)'
            }}>
              Sin sesiones registradas
            </div>
          )}
        </div>
      </div>

      {/* Footer fijo con botón Magnus */}
      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        padding: '12px 20px',
        background: 'linear-gradient(to top, var(--bg-0) 70%, transparent)',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
      }}>
        <a
          href={magnusPromptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--block btn--lg"
          style={{
            textDecoration: 'none',
            textAlign: 'center',
            background: 'var(--accent-bg)',
            borderColor: 'var(--accent-border)',
            color: 'var(--accent-hi)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          Pedir análisis a Magnus ↗
        </a>
      </div>
    </div>
  )
}

function Metric({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{
        fontFamily: 'var(--ff-mono)', fontSize: 9,
        letterSpacing: '0.1em', color: 'var(--text-3)',
        textTransform: 'uppercase', marginBottom: 6
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--ff-mono)', fontSize: 22,
        fontWeight: 500, color: 'var(--text-0)',
        fontVariantNumeric: 'tabular-nums'
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: 'var(--ff-mono)', fontSize: 10,
          color: 'var(--text-3)', marginTop: 2
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function buildMagnusPromptUrl() {
  const prompt = `Magnus, revísame la semana. Consulta v_adherence_4w, v_weight_trend_8w, v_weekly_volume_per_muscle y v_active_program_context, y dame análisis de progreso vs targets del bloque + ajuste para la próxima semana.`
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
}
