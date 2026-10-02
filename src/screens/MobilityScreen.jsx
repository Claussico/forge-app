// Movilidad y flow guiados (spec §9). Se registra con un solo "Hecha", sin series:
// la base de datos calcula la dosis por zona a partir de lo prescrito.
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSession, fetchBriefing, queueTrainingLog } from '../lib/api'
import { kv } from '../lib/queue'
import { useData, useWakeLock, haptic, alarm, unlockAudio } from '../lib/hooks'
import { today, addDays, fmtRelative } from '../lib/dates'
import { Sheet, SyncBadge, fmtNum, go, back } from '../components/ui'
import './session.css'
import './forms.css'

const ZONE = { isquios: 'Isquios', toracica: 'Torácica', hombro_overhead: 'Hombro overhead', flexores_cadera: 'Flexores de cadera', cadera_rotacion: 'Rotación de cadera', aductores: 'Aductores', tobillo: 'Tobillo', gemelo_soleo: 'Gemelo y sóleo', pectoral: 'Pectoral', muneca: 'Muñeca' }
const MIDLINE = new Set(['toracica'])

// Pasos del reproductor: un paso por serie y lado. Los ejercicios por reps son un contador.
export function buildSteps(exercises = []) {
  const steps = []
  exercises.forEach((ex, i) => {
    const t = ex.target || {}
    const sets = Number(t.sets) || 1
    const sides = t.per_side ? ['izquierdo', 'derecho'] : [null]
    for (let s = 1; s <= sets; s++) for (const side of sides) {
      steps.push({ ex: i, name: ex.name, notes: ex.execution_notes, set: s, sets, side, kg: t.weight_kg || null, seconds: t.seconds != null ? Number(t.seconds) : null, reps: t.seconds == null ? (t.reps ?? null) : null })
    }
  })
  return steps
}

export const doseText = t => {
  const kg = t.weight_kg ? ` · ${String(t.weight_kg).replace('.', ',')} kg` : ''
  if (t.seconds != null) return `${t.sets ?? 1} × ${t.seconds} s${t.per_side ? ' por lado' : ''}${kg}`
  return `${t.sets ?? 1} × ${t.reps ?? '?'} reps${t.per_side ? ' por lado' : ''}${kg}`
}

export default function MobilityScreen({ id }) {
  useWakeLock(true)
  const { data: session, error } = useData('session:' + id, () => fetchSession(id), [id])
  const { data: b } = useData('briefing', fetchBriefing)
  const steps = useMemo(() => buildSteps(session?.exercises), [session])
  const [i, setI] = useState(0)
  const [endAt, setEndAt] = useState(null)
  const [left, setLeft] = useState(null) // s restantes con el reloj parado
  const [now, setNow] = useState(Date.now())
  const [sheet, setSheet] = useState(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(null)
  const undoT = useRef(null)
  const clientId = useRef(null)

  useEffect(() => {
    kv.get('mob:' + id).then(v => { clientId.current = v || crypto.randomUUID(); kv.set('mob:' + id, clientId.current) })
  }, [id])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])

  const step = steps[i]
  const remaining = endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : (left ?? step?.seconds ?? null)

  // Fin del estiramiento: avisar y pasar al siguiente paso parado (cambio de lado o de ejercicio)
  useEffect(() => {
    if (endAt && remaining === 0) {
      alarm()
      const nxt = steps[i + 1]
      setLeft(null)
      // El siguiente estiramiento cronometrado arranca solo; el contador de reps espera a "Hecho".
      setEndAt(nxt?.seconds != null ? Date.now() + nxt.seconds * 1000 : null)
      setI(i + 1)
    }
  }, [remaining, endAt, steps, i])

  if (error && !session) return <div className="body"><p className="err-text">No se pudo cargar la sesión: {error.message}</p><button className="btn" onClick={() => go('/hoy')}>Volver a Hoy</button></div>
  if (!session) return <div className="loading">Cargando…</div>

  const finished = i >= steps.length
  const overdue = session.scheduled_date < today()
  const running = !!endAt

  function start() { unlockAudio(); haptic(); setEndAt(Date.now() + (remaining ?? 0) * 1000); setLeft(null) }
  function pause() { setLeft(remaining); setEndAt(null) }
  function next() { haptic(); setEndAt(null); setLeft(null); setI(x => Math.min(x + 1, steps.length)) }
  function prev() { setEndAt(null); setLeft(null); setI(x => Math.max(0, x - 1)) }

  function save(performedDate) {
    setSheet(null)
    const payload = { client_id: clientId.current || crypto.randomUUID(), performed_date: performedDate, programmed_session_id: session.id, session_type: session.session_type || 'mobility', notes: note.trim() || null }
    setPending(payload)
    clearTimeout(undoT.current)
    undoT.current = setTimeout(async () => {
      await queueTrainingLog(payload)
      await kv.del('mob:' + id)
      setPending(null)
      go('/hoy')
    }, 10000)
  }

  const dose = b?.mobility_week?.dose_by_zone || []

  return (
    <div className="screen ses">
      <header className="ses-top">
        <button className="ses-exit" onClick={() => back('/hoy')}>Salir</button>
        <div className="ses-timer"><span className="t2">{session.session_name} · {fmtRelative(session.scheduled_date)}</span></div>
        <span className="ses-prog num">{Math.min(i + 1, steps.length)}/{steps.length}</span>
      </header>

      <div className="ses-ctx">
        {!finished && step ? (
          <>
            <h1 className="ses-name">{step.name}</h1>
            <div className="ses-of">Serie <span className="num">{step.set}</span> de <span className="num">{step.sets}</span>{step.side && <> · lado <b>{step.side}</b></>}</div>
            {step.notes && <p className="ses-notes">{step.notes}</p>}
          </>
        ) : (
          <>
            <h1 className="ses-name">Sesión completada</h1>
            <p className="t2">Pulsa "Hecha" para registrarla. No hace falta apuntar nada por ejercicio.</p>
          </>
        )}
        <h2 className="sec" style={{ marginTop: 8 }}>Ejercicios</h2>
        <ul className="ses-done">
          {(session.exercises || []).map((ex, k) => (
            <li key={k}><span style={{ color: step?.ex === k && !finished ? 'var(--text-0)' : undefined }}>{ex.name}</span><span className="num">{doseText(ex.target || {})}</span></li>
          ))}
        </ul>
        {dose.length > 0 && (
          <>
            <h2 className="sec" style={{ marginTop: 8 }}>Dosis de la semana</h2>
            <ul className="ses-done">
              {dose.map(z => (
                <li key={z.zone}><span>{ZONE[z.zone] || z.zone}</span>
                  <span className="num">{fmtNum(z.minutes)}{z.target_min != null ? ' / ' + fmtNum(z.target_min) : ''} min{MIDLINE.has(z.zone) ? '' : ' por lado'}</span></li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="console">
        {!finished && step && (step.seconds != null ? (
          <>
            <div className={'mob-clock num' + (running ? ' is-running' : '')} aria-live="polite">
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </div>
            <div className="mob-row">
              <button className="btn" onClick={prev} disabled={i === 0}>Anterior</button>
              {running
                ? <button className="btn console-big" onClick={pause}>Pausa</button>
                : <button className="btn btn--primary console-big" onClick={start}>{remaining === step.seconds ? 'Empezar' : 'Seguir'}</button>}
              <button className="btn" onClick={next}>Saltar</button>
            </div>
          </>
        ) : (
          <>
            <div className="mob-clock num">{step.reps ?? '—'} <span className="t2">reps{step.side ? ' · lado ' + step.side : ''}{step.kg ? ' · ' + fmtNum(step.kg) + ' kg' : ''}</span></div>
            <div className="mob-row">
              <button className="btn" onClick={prev} disabled={i === 0}>Anterior</button>
              <button className="btn btn--primary console-big" onClick={next}>Hecho</button>
            </div>
          </>
        ))}
        <label className="field"><span className="lbl">Nota <span className="hint">opcional</span></span>
          <input className="text-in" value={note} onChange={e => setNote(e.target.value)} placeholder="Cómo ha ido" /></label>
        <div className="ses-actions">
          <SyncBadge />
          <button className={'btn ' + (finished ? 'btn--primary' : '')} disabled={!!pending} onClick={() => overdue ? setSheet('when') : save(today())}>Hecha</button>
        </div>
      </div>

      {sheet === 'when' && (
        <Sheet label="¿Cuándo la hiciste?" onClose={() => setSheet(null)}>
          <h2>¿Cuándo la hiciste?</h2>
          <p className="t2">Estaba planificada para {fmtRelative(session.scheduled_date)}.</p>
          <button className="btn btn--primary btn--block" onClick={() => save(today())}>Hoy</button>
          <button className="btn btn--block" onClick={() => save(addDays(today(), -1))}>Ayer</button>
          <label className="field"><span className="lbl">Otra fecha</span>
            <input className="text-in" type="date" max={today()} defaultValue={session.scheduled_date} onChange={ev => ev.target.value && save(ev.target.value)} /></label>
        </Sheet>
      )}

      {pending && (
        <div className="toast" role="status">
          <span className="grow">Movilidad registrada</span>
          <button onClick={() => { clearTimeout(undoT.current); setPending(null) }}>Deshacer</button>
          <span className="drain" />
        </div>
      )}
    </div>
  )
}
