import { useState, useEffect } from 'react'
import {
  fetchBriefing,
  fetchTodaySession,
  fetchTodayCheckin,
  fetchTrainingLogByDate,
  fetchExerciseLogsByTrainingLog,
  saveTrainingLog
} from '../lib/queries'
import { Icon } from '../components/UI'

// Helpers de fecha. Trabajamos en zona horaria local sin pasar por UTC
// para evitar bugs de offset (toISOString siempre devuelve UTC y puede
// desplazar el día respecto al local).

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function dateToLocalStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function todayStr() {
  return dateToLocalStr(new Date())
}

function shiftDate(dateStr, deltaDays) {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  d.setDate(d.getDate() + deltaDays)
  return dateToLocalStr(d)
}

function isFutureDate(dateStr) {
  return dateStr > todayStr()
}

function formatDateLong(dateStr) {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
    .replace('.', '').toUpperCase()
}

// ============================================================
// Resolución de la propuesta de carga para el header del ejercicio.
// Jerarquía:
//   1. exercise.loading_type explícito (Magnus lo mete en el JSONB)
//   2. Heurística por nombre: si matchea palabras BW → asume bw
//   3. Default → "calibrate" (Magnus quiere que el atleta encuentre la carga)
// ============================================================

const BW_KEYWORDS = [
  'dominada', 'dominadas', 'pull-up', 'pull up', 'pullup',
  'fondos', 'fondo', 'dip', 'dips',
  'push-up', 'push up', 'flexión', 'flexion', 'flexiones',
  'plancha', 'plank', 'hollow', 'l-sit',
  'chin-up', 'chin up', 'chinup', 'muscle-up', 'muscle up',
  'pistola', 'pistol squat'
]

function resolveLoadingType(exercise) {
  if (exercise.loading_type) return exercise.loading_type
  const nameLower = (exercise.name || '').toLowerCase()
  if (BW_KEYWORDS.some(kw => nameLower.includes(kw))) return 'bw'
  return 'calibrate'
}

function formatLoadProposal(exercise) {
  const target = exercise.target || {}
  const lt = resolveLoadingType(exercise)
  const w = target.weight_kg ?? target.weight ?? null

  if (lt === 'bw') return 'BW'
  if (lt === 'bodyweight_time') return 'BW'
  if (lt === 'bw_weighted') {
    if (w && Number(w) > 0) return `BW + ${w} kg`
    return 'BW + lastre'
  }
  if (lt === 'calibrate') return 'calibrar'
  // weighted (o fallback con peso)
  if (w && Number(w) > 0) return `${w} kg propuesto`
  return 'calibrar'
}

export default function HomeScreen({ onGoToCheckin }) {
  const [briefing, setBriefing] = useState(null)
  const [checkin, setCheckin] = useState(null)
  const [selectedDate, setSelectedDate] = useState(todayStr())

  // Estado de la fecha seleccionada
  const [session, setSession] = useState(null)
  const [existingLog, setExistingLog] = useState(null)
  const [existingExerciseLogs, setExistingExerciseLogs] = useState([])
  const [exercises, setExercises] = useState([])
  const [expandedIdx, setExpandedIdx] = useState(0)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Carga inicial: briefing y checkin (no dependen de fecha)
  useEffect(() => {
    Promise.all([fetchBriefing(), fetchTodayCheckin()])
      .then(([b, c]) => {
        setBriefing(b)
        setCheckin(c)
      })
      .catch(err => setError(err.message))
  }, [])

  // Carga reactiva: cuando cambia selectedDate, recargar sesión + log
  useEffect(() => {
    loadDateData(selectedDate)
  }, [selectedDate])

  const loadDateData = async (date) => {
    setLoading(true)
    setError('')
    try {
      const [s, log] = await Promise.all([
        fetchTodaySession(date),
        fetchTrainingLogByDate(date)
      ])
      setSession(s)
      setExistingLog(log)

      if (log) {
        // Sesión ya logueada: cargar exercise_logs en modo lectura
        const exLogs = await fetchExerciseLogsByTrainingLog(log.id)
        setExistingExerciseLogs(exLogs || [])
        setExercises([]) // no editable
      } else if (s && s.exercises) {
        // Sesión programada sin loguear: preparar logger
        const exArray = Array.isArray(s.exercises) ? s.exercises : []
        const prepared = exArray.map(ex => ({
          ...ex,
          sets: (ex.sets || []).map((st, i) => ({
            set_number: st.set_number || i + 1,
            weight_kg: st.weight_kg ?? ex.target?.weight ?? 0,
            reps: st.reps ?? ex.target?.reps ?? 0,
            rpe: st.rpe ?? ex.target?.rpe ?? null,
            done: false
          }))
        }))
        setExercises(prepared)
        setExistingExerciseLogs([])
        // Expandir el primer ejercicio rellenable (saltando bloques de info como calentamiento)
        const firstEditable = prepared.findIndex(ex => ex.sets && ex.sets.length > 0)
        setExpandedIdx(firstEditable >= 0 ? firstEditable : 0)
        return
      } else {
        // Sin sesión ni log
        setExercises([])
        setExistingExerciseLogs([])
      }
      setExpandedIdx(0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const goPrev = () => setSelectedDate(d => shiftDate(d, -1))
  const goNext = () => {
    const next = shiftDate(selectedDate, 1)
    // Tope razonable: 14 días en el futuro. Más allá no aporta valor operativo
    // y evita que el usuario navegue a la infinitud por accidente.
    const maxFuture = shiftDate(todayStr(), 14)
    if (next <= maxFuture) setSelectedDate(next)
  }
  const goToday = () => setSelectedDate(todayStr())

  const updateSet = (exIdx, setIdx, field, value) => {
    setExercises(prev => {
      const copy = [...prev]
      copy[exIdx] = { ...copy[exIdx] }
      copy[exIdx].sets = [...copy[exIdx].sets]
      copy[exIdx].sets[setIdx] = { ...copy[exIdx].sets[setIdx], [field]: value }
      return copy
    })
  }

  const toggleDone = (exIdx, setIdx) => {
    updateSet(exIdx, setIdx, 'done', !exercises[exIdx].sets[setIdx].done)
  }

  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
  const doneSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0)

  const finishSession = async () => {
    if (doneSets === 0) return
    setSaving(true)
    try {
      const toSave = exercises.map(ex => ({
        name: ex.name,
        movement_pattern: ex.pattern || null,
        muscle_groups: ex.muscle_groups || null,
        sets: ex.sets.filter(s => s.done).map(s => ({
          set_number: s.set_number,
          reps: Number(s.reps),
          weight_kg: Number(s.weight_kg),
          rpe: s.rpe ? Number(s.rpe) : null
        }))
      })).filter(ex => ex.sets.length > 0)

      await saveTrainingLog({
        session: {
          programmed_session_id: session?.id || null,
          performed_date: selectedDate,
          duration_min: null,
          overall_rpe: null,
          notes: null
        },
        exercises: toSave
      })

      // Recargar para mostrar la sesión ya en modo lectura
      loadDateData(selectedDate)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const isToday = selectedDate === todayStr()
  const isFuture = isFutureDate(selectedDate)
  // Habilitar/deshabilitar flecha derecha por tope, no por "no ir a futuro"
  const atMaxFuture = selectedDate >= shiftDate(todayStr(), 14)

  return (
    <div className="screen">
      <div className="screen-body safe-top" style={{ padding: '20px 16px 120px' }}>

        <Header
          briefing={briefing}
          checkin={checkin}
          onGoToCheckin={onGoToCheckin}
          selectedDate={selectedDate}
          isToday={isToday}
          isFuture={isFuture}
          atMaxFuture={atMaxFuture}
          goPrev={goPrev}
          goNext={goNext}
          goToday={goToday}
          totalSets={totalSets}
          doneSets={doneSets}
          existingLog={existingLog}
          session={session}
        />

        {loading ? (
          <div className="loading">Cargando…</div>
        ) : existingLog ? (
          <ReadOnlyView log={existingLog} exerciseLogs={existingExerciseLogs} />
        ) : !session ? (
          <EmptyState selectedDate={selectedDate} />
        ) : (
          exercises.map((ex, exIdx) => (
            (!ex.sets || ex.sets.length === 0) ? (
              <InfoBlock
                key={ex.id || exIdx}
                exercise={ex}
                expanded={expandedIdx === exIdx}
                onToggle={() => setExpandedIdx(expandedIdx === exIdx ? -1 : exIdx)}
              />
            ) : (
              <ExerciseCard
                key={ex.id || exIdx}
                exercise={ex}
                expanded={expandedIdx === exIdx}
                onToggle={() => setExpandedIdx(expandedIdx === exIdx ? -1 : exIdx)}
                onUpdateSet={(setIdx, field, value) => updateSet(exIdx, setIdx, field, value)}
                onToggleDone={(setIdx) => toggleDone(exIdx, setIdx)}
                readOnly={isFuture}
              />
            )
          ))
        )}

        {error && <div style={{ color: 'var(--err)', fontSize: 12, marginTop: 16, padding: '0 8px' }}>{error}</div>}
      </div>

      {/* Footer solo si hay sesión editable (no futuro, no ya logueada) */}
      {!existingLog && session && exercises.length > 0 && !isFuture && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          padding: '12px 16px',
          background: 'linear-gradient(to top, var(--bg-0) 70%, transparent)',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
        }}>
          <button
            className="btn btn--primary btn--block btn--lg"
            disabled={doneSets === 0 || saving}
            onClick={finishSession}
          >
            {saving ? 'Guardando…' : `Finalizar sesión · ${doneSets}/${totalSets} series`}
          </button>
        </div>
      )}
    </div>
  )
}

function Header({
  briefing, checkin, onGoToCheckin,
  selectedDate, isToday, isFuture, atMaxFuture, goPrev, goNext, goToday,
  totalSets, doneSets, existingLog, session
}) {
  const dateStr = formatDateLong(selectedDate)
  const blockLabel = briefing
    ? `SEMANA ${briefing.current_block_week || '?'} · BLOQUE ${briefing.current_block || '?'} ${briefing.current_block_phase || ''}`.toUpperCase()
    : ''

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Navegador de fechas */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12
      }}>
        <button
          onClick={goPrev}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-2)',
            cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center'
          }}
          aria-label="Día anterior"
        >
          <Icon.chevLeft />
        </button>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1
        }}>
          <div style={{
            fontFamily: 'var(--ff-mono)', fontSize: 10.5,
            letterSpacing: '0.1em', color: 'var(--text-3)'
          }}>
            {dateStr}
            {session && session.session_name ? ` · ${session.session_name}` : ''}
          </div>
          {!isToday && (
            <button
              onClick={goToday}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--accent)', fontFamily: 'var(--ff-mono)',
                fontSize: 9, letterSpacing: '0.1em', cursor: 'pointer',
                padding: '2px 0', marginTop: 2
              }}
            >
              IR A HOY
            </button>
          )}
        </div>

        <button
          onClick={goNext}
          disabled={atMaxFuture}
          style={{
            background: 'transparent', border: 'none',
            color: atMaxFuture ? 'var(--text-4)' : 'var(--text-2)',
            cursor: atMaxFuture ? 'not-allowed' : 'pointer',
            padding: '4px 8px', display: 'flex', alignItems: 'center'
          }}
          aria-label="Día siguiente"
        >
          <Icon.chevRight />
        </button>
      </div>

      {/* Título de la sesión / estado */}
      {existingLog ? (
        <h1 className="h1" style={{ marginBottom: 4, fontWeight: 600 }}>
          Sesión registrada
        </h1>
      ) : session ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <h1 className="h1" style={{ margin: 0, fontWeight: 600 }}>
            {session.session_name}
          </h1>
          {isFuture && (
            <span style={{
              fontFamily: 'var(--ff-mono)', fontSize: 9,
              letterSpacing: '0.12em', color: 'var(--accent-hi)',
              textTransform: 'uppercase',
              padding: '3px 7px',
              border: '1px solid var(--accent-border)',
              background: 'var(--accent-bg)',
              borderRadius: 4
            }}>
              PRÓXIMA
            </span>
          )}
        </div>
      ) : (
        <h1 className="h1" style={{ marginBottom: 4, fontWeight: 600, color: 'var(--text-3)' }}>
          Sin sesión
        </h1>
      )}

      {blockLabel && (
        <div style={{
          fontFamily: 'var(--ff-mono)', fontSize: 10,
          letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 14
        }}>
          {blockLabel}
        </div>
      )}

      {/* Series progress: solo en hoy (en futuro no procede) */}
      {!existingLog && !isFuture && totalSets > 0 && (
        <div style={{
          fontFamily: 'var(--ff-mono)', fontSize: 10.5,
          color: 'var(--text-3)', marginBottom: 10
        }}>
          {doneSets}/{totalSets} SERIES
        </div>
      )}

      {/* Chip checkin (solo en hoy) */}
      {isToday && (
        <button
          onClick={onGoToCheckin}
          className="btn"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12, padding: '6px 12px',
            background: checkin ? 'var(--accent-bg)' : 'var(--bg-2)',
            borderColor: checkin ? 'var(--accent-border)' : 'var(--border-0)',
            color: checkin ? 'var(--accent-hi)' : 'var(--text-2)'
          }}
        >
          {checkin ? (
            <>
              <Icon.check style={{ width: 12, height: 12 }} />
              <span>Check-in hecho</span>
              <span className="mono" style={{ color: 'var(--text-3)', marginLeft: 4 }}>
                {checkin.weight_kg && `${checkin.weight_kg}kg`}
                {checkin.sleep_hours && ` · ${checkin.sleep_hours}h`}
                {checkin.energy && ` · e${checkin.energy}`}
              </span>
            </>
          ) : (
            <span>○ Check-in pendiente</span>
          )}
        </button>
      )}
    </div>
  )
}

function EmptyState({ selectedDate }) {
  const isToday = selectedDate === todayStr()
  return (
    <div style={{
      padding: '40px 20px', textAlign: 'center',
      color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--ff-mono)'
    }}>
      {isToday
        ? 'No hay sesión programada para hoy.'
        : 'Sin sesión programada ni registrada para esta fecha.'}
    </div>
  )
}

function ReadOnlyView({ log, exerciseLogs }) {
  // Agrupar exercise_logs por exercise_name
  const grouped = {}
  for (const el of exerciseLogs) {
    if (!grouped[el.exercise_name]) grouped[el.exercise_name] = []
    grouped[el.exercise_name].push(el)
  }
  const exerciseNames = Object.keys(grouped)

  return (
    <>
      {/* Banner de modo lectura */}
      <div style={{
        padding: '10px 14px', marginBottom: 14,
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--r-md)',
        fontFamily: 'var(--ff-mono)', fontSize: 11,
        color: 'var(--accent-hi)', display: 'flex',
        alignItems: 'center', gap: 8
      }}>
        <Icon.check style={{ width: 14, height: 14 }} />
        Sesión completada · solo lectura
      </div>

      {exerciseNames.map(name => {
        const sets = grouped[name]
        return (
          <div key={name} className="card" style={{ marginBottom: 12, padding: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-0)', marginBottom: 8 }}>
              {name}
            </div>
            {sets[0]?.muscle_groups && (
              <div style={{
                fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-4)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10
              }}>
                {sets[0].muscle_groups.join(' · ')}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sets.map(s => (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr 1fr 1fr',
                  gap: 8, alignItems: 'center',
                  fontFamily: 'var(--ff-mono)', fontSize: 12,
                  padding: '6px 0',
                  borderTop: s.set_number > 1 ? '1px solid var(--border-1)' : 'none'
                }}>
                  <div style={{ color: 'var(--text-3)' }}>{s.set_number}</div>
                  <div style={{ textAlign: 'center', color: 'var(--text-1)' }}>
                    {Number(s.weight_kg).toFixed(s.weight_kg % 1 === 0 ? 0 : 1)}
                    <span style={{ color: 'var(--text-4)', fontSize: 9, marginLeft: 2 }}>kg</span>
                  </div>
                  <div style={{ textAlign: 'center', color: 'var(--text-1)' }}>
                    {s.reps}
                    <span style={{ color: 'var(--text-4)', fontSize: 9, marginLeft: 2 }}>reps</span>
                  </div>
                  <div style={{ textAlign: 'center', color: 'var(--text-2)' }}>
                    {s.rpe ? `RPE ${Number(s.rpe).toFixed(s.rpe % 1 === 0 ? 0 : 1)}` : '—'}
                  </div>
                </div>
              ))}
            </div>
            {sets.some(s => s.notes) && (
              <div style={{
                marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-1)',
                fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-3)'
              }}>
                {sets.filter(s => s.notes).map(s => `S${s.set_number}: ${s.notes}`).join(' · ')}
              </div>
            )}
          </div>
        )
      })}

      {log.notes && (
        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <div style={{
            fontFamily: 'var(--ff-mono)', fontSize: 9,
            letterSpacing: '0.1em', color: 'var(--text-3)',
            textTransform: 'uppercase', marginBottom: 6
          }}>
            Notas de sesión
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-1)' }}>
            {log.notes}
          </div>
        </div>
      )}
    </>
  )
}

function ExerciseCard({ exercise, expanded, onToggle, onUpdateSet, onToggleDone, readOnly = false }) {
  const doneCount = exercise.sets.filter(s => s.done).length
  const totalCount = exercise.sets.length
  const target = exercise.target || {}
  const loadProposal = formatLoadProposal(exercise)

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', cursor: 'pointer'
      }} onClick={onToggle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-0)' }}>
            {exercise.name}
          </div>
          {/* Metadata principal: series × reps · RPE */}
          <div style={{
            fontFamily: 'var(--ff-mono)', fontSize: 11,
            color: 'var(--text-3)', marginTop: 2
          }}>
            {target.sets || totalCount}×{target.reps || '?'}
            {target.rpe ? ` · RPE ${target.rpe}` : ''}
          </div>
          {/* Carga propuesta (resaltada en verde, línea separada) */}
          <div style={{
            fontFamily: 'var(--ff-mono)', fontSize: 11,
            color: 'var(--accent-hi)', marginTop: 2
          }}>
            {loadProposal}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!readOnly && (
            <div style={{
              fontFamily: 'var(--ff-mono)', fontSize: 13,
              color: doneCount === totalCount ? 'var(--accent)' : 'var(--text-2)'
            }}>
              {doneCount}/{totalCount}
            </div>
          )}
          {expanded ? <Icon.chevUp /> : <Icon.chevDown />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-1)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: readOnly ? '32px 1fr 1fr 1fr' : '32px 1fr 1fr 1fr 44px',
            gap: 8, padding: '10px 12px 6px',
            fontFamily: 'var(--ff-mono)', fontSize: 9,
            letterSpacing: '0.1em', color: 'var(--text-4)',
            textTransform: 'uppercase'
          }}>
            <div>#</div>
            <div style={{ textAlign: 'center' }}>Kg</div>
            <div style={{ textAlign: 'center' }}>Reps</div>
            <div style={{ textAlign: 'center' }}>RPE</div>
            {!readOnly && <div />}
          </div>

          {exercise.sets.map((s, i) => (
            <SetRow
              key={i}
              set={s}
              index={i}
              readOnly={readOnly}
              onChange={(field, value) => onUpdateSet(i, field, value)}
              onToggleDone={() => onToggleDone(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SetRow({ set, index, onChange, onToggleDone, readOnly = false }) {
  const locked = set.done || readOnly
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: readOnly ? '32px 1fr 1fr 1fr' : '32px 1fr 1fr 1fr 44px',
      gap: 8, padding: '8px 12px',
      alignItems: 'center',
      borderTop: index > 0 ? '1px solid var(--border-1)' : 'none',
      background: locked ? 'transparent' : 'var(--bg-2)'
    }}>
      <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'var(--text-3)' }}>
        {index + 1}
      </div>
      <input
        type="number"
        inputMode="decimal"
        className={`num-input ${locked ? 'num-input-readonly' : ''}`}
        value={set.weight_kg ?? ''}
        onChange={(e) => onChange('weight_kg', e.target.value)}
        readOnly={locked}
      />
      <input
        type="number"
        inputMode="numeric"
        className={`num-input ${locked ? 'num-input-readonly' : ''}`}
        value={set.reps ?? ''}
        onChange={(e) => onChange('reps', e.target.value)}
        readOnly={locked}
      />
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        className={`num-input ${locked ? 'num-input-readonly' : ''}`}
        value={set.rpe ?? ''}
        onChange={(e) => onChange('rpe', e.target.value)}
        readOnly={locked}
      />
      {!readOnly && (
        <button
          onClick={onToggleDone}
          style={{
            width: 32, height: 32, padding: 0,
            background: set.done ? 'var(--accent-bg-hi)' : 'transparent',
            border: `1px solid ${set.done ? 'var(--accent)' : 'var(--border-0)'}`,
            borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: set.done ? 'var(--accent-hi)' : 'var(--text-3)',
            justifySelf: 'end'
          }}
        >
          {set.done && <Icon.check />}
        </button>
      )}
    </div>
  )
}

function InfoBlock({ exercise, expanded, onToggle }) {
  const target = exercise.target || {}
  const duration = target.reps || null   // suele ser texto tipo "15 min"
  const notes = exercise.execution_notes || ''

  // Intentar parsear pasos numerados "1) ... 2) ... 3) ..."
  // Si no hay coincidencias, se muestra el texto tal cual
  const steps = parseNumberedSteps(notes)

  return (
    <div className="card" style={{ marginBottom: 12, opacity: 0.95 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', cursor: 'pointer'
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--ff-mono)', fontSize: 9,
            letterSpacing: '0.12em', color: 'var(--text-3)',
            textTransform: 'uppercase',
            padding: '3px 7px',
            border: '1px solid var(--border-0)',
            borderRadius: 4,
            flexShrink: 0
          }}>
            INFO
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 500, color: 'var(--text-1)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {exercise.name}
            </div>
            {duration && (
              <div style={{
                fontFamily: 'var(--ff-mono)', fontSize: 11,
                color: 'var(--text-3)', marginTop: 2
              }}>
                {duration}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {expanded ? <Icon.chevUp /> : <Icon.chevDown />}
        </div>
      </div>

      {expanded && notes && (
        <div style={{
          borderTop: '1px solid var(--border-1)',
          padding: '12px 16px 14px',
          fontSize: 13, lineHeight: 1.55, color: 'var(--text-1)'
        }}>
          {steps.length > 0 ? (
            <ol style={{
              margin: 0, padding: 0, listStyle: 'none',
              display: 'flex', flexDirection: 'column', gap: 10
            }}>
              {steps.map((step, i) => (
                <li key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr',
                  gap: 10, alignItems: 'baseline'
                }}>
                  <span style={{
                    fontFamily: 'var(--ff-mono)', fontSize: 10,
                    color: 'var(--text-3)', letterSpacing: '0.05em'
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>{notes}</div>
          )}
        </div>
      )}
    </div>
  )
}

function parseNumberedSteps(text) {
  if (!text || typeof text !== 'string') return []
  // Coincide con patrones tipo "1) ", "2) ", "10) " al inicio o tras espacio
  // Captura el contenido hasta el siguiente "N) " o fin de cadena
  const regex = /(?:^|\s)(\d{1,2})\)\s+/g
  const matches = [...text.matchAll(regex)]
  if (matches.length < 2) return []   // necesita al menos 2 pasos para considerarse lista
  const steps = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const content = text.slice(start, end).trim()
    if (content) steps.push(content)
  }
  return steps
}
