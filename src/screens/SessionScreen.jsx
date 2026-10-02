// Sesión en curso: consola de pulgar (fase 2) con las convenciones de la spec §11.
// - Carga y reps precargadas; el RPE nunca: pulsar un RPE registra la serie.
// - Saltos: sin RPE ni peso; "Hecho" registra; reps = contactos.
// - Unilaterales: una fila por serie, "reps por lado"; si solo un lado, side L/R.
// - Borrador en IndexedDB en cada cambio; al finalizar, 10 s para deshacer y después a la cola.
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSession, fetchCatalog, fetchLastTimes, lookup, queueTrainingLog } from '../lib/api'
import { kv } from '../lib/queue'
import { useData, useWakeLock, haptic, alarm, unlockAudio } from '../lib/hooks'
import { today, addDays, fmtRelative } from '../lib/dates'
import { SyncBadge, Sheet, fmtNum, go, back } from '../components/ui'
import { timeTarget } from '../lib/sessions'
import './session.css'

const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const LOAD_LABEL = { per_hand: 'kg por mano', total: 'kg totales', added: 'lastre (kg)' }
const ZONES = ['hombro', 'codo', 'muñeca', 'lumbar', 'cadera', 'rodilla', 'tibia', 'tobillo', 'otra']
const INTENSITY = { 1: 'leve', 2: 'moderada', 3: 'fuerte' }
const firstInt = v => { const m = String(v ?? '').match(/\d+/); return m ? Number(m[0]) : null }

export function buildPlan(session, catalog) {
  return (session?.exercises || []).map((ex, i) => {
    const cat = lookup(catalog, ex.name)
    const t = ex.target || {}
    const pattern = cat?.pattern || ex.pattern
    const lt = ex.loading_type || cat?.loading_type
    const conv = cat?.load_convention
      || (lt === 'bw' || lt === 'bodyweight_time' ? 'none' : lt === 'bw_weighted' ? 'added' : 'total')
    const sets = ex.sets || []
    // Sin lista de series (p. ej. una plancha con target {sets, seconds}): salen del target.
    // Un bloque informativo (calentamiento) trae target.sets = 0.
    const nSets = sets.length || Number(t.sets) || 0
    return {
      i, name: ex.name, notes: ex.execution_notes, target: t, sets, nSets, info: nSets === 0,
      exerciseId: cat?.id || null,
      conv: pattern === 'jump' ? 'none' : conv,
      jump: pattern === 'jump',
      // Sin RPE: saltos (spec §11) y trabajo de técnica, movilidad o flow dentro de una sesión de fuerza
      noRpe: ['jump', 'locomotion', 'mobility', 'flow'].includes(pattern),
      unilateral: cat?.laterality === 'unilateral',
      time: lt === 'bodyweight_time',
      timeUnit: t.seconds != null ? 'segundos' : 'minutos',
      rest: ['isolation', 'jump', 'locomotion', 'mobility', 'flow'].includes(pattern) ? 75 : 150
    }
  })
}

function prescribed(e, k) {
  const s = e.sets[k] || {}
  return {
    w: e.conv === 'none' ? null : (s.weight_kg ?? e.target.weight_kg ?? e.target.weight ?? null),
    r: s.reps ?? firstInt(e.target.reps) ?? firstInt(e.target.seconds)
  }
}

export function targetText(e) {
  const t = e.target
  const w = t.weight_kg ?? t.weight
  const load = e.conv === 'none' || w == null ? '' : (e.conv === 'added' ? '+' : '') + fmtNum(w) + ' kg × '
  if (e.time) return `${timeTarget(t)}${e.unilateral || t.per_side ? ' por lado' : ''}${!e.noRpe && t.rpe ? ' · RPE ' + fmtNum(t.rpe) : ''}`
  const reps = e.jump ? `${t.reps ?? '?'} contactos` : e.time ? (t.seconds != null ? `${t.seconds} s` : `${t.reps ?? '?'} min`) : `${t.reps ?? '?'}${e.unilateral ? ' por lado' : ''}`
  return `${t.sets ?? e.nSets} × ${load}${reps}${!e.noRpe && t.rpe ? ' · RPE ' + fmtNum(t.rpe) : ''}`
}

function lastText(e, last) {
  if (!last) return null
  const sets = last.sets.map(s => {
    const noLoad = s.weight_kg == null || e.conv === 'none' || (e.conv === 'added' && !Number(s.weight_kg))
    const w = noLoad ? '' : (e.conv === 'added' ? '+' : '') + fmtNum(s.weight_kg) + '×'
    // spec §11: el RPE solo se enseña si es fiable
    const rpe = s.rpe != null && s.rpe_reliability === 'reported' ? ' @' + fmtNum(s.rpe) : ''
    return w + s.reps + (s.side ? ' ' + s.side : '') + rpe
  })
  return `${sets.join(', ')} · ${fmtRelative(last.date)}`
}

export default function SessionScreen({ id }) {
  useWakeLock(true)
  const { data: session, error } = useData('session:' + id, () => fetchSession(id), [id])
  const { data: catalog, error: catError } = useData('catalog', fetchCatalog)
  const catReady = !!catalog || !!catError // sin red ni copia del catálogo: se sigue con lo que trae la sesión
  const plan = useMemo(() => buildPlan(session, catalog), [session, catalog])
  const ids = useMemo(() => plan.map(e => e.exerciseId).filter(Boolean), [plan])
  const { data: lastTimes } = useData('last:' + ids.join(','), () => fetchLastTimes(ids), [ids.join(',')])

  const [d, setD] = useState(null) // borrador
  const [sheet, setSheet] = useState(null) // 'table' | 'when' | 'notes' | 'issue'
  const [issue, setIssue] = useState({ zone: null, intensity: null })
  const [pending, setPending] = useState(null) // payload en la ventana de deshacer
  const [now, setNow] = useState(Date.now())
  const undoT = useRef(null)
  const alarmed = useRef(false)

  // Cargar o crear el borrador
  useEffect(() => {
    if (!plan.length || !catReady || d) return
    kv.get('draft:' + id).then(saved => {
      if (saved) return setD(saved)
      const ei = Math.max(0, plan.findIndex(e => !e.info))
      const first = plan[ei]
      setD({ clientId: crypto.randomUUID(), ei: plan[0]?.info ? 0 : ei, si: 0, logged: [], restEnd: null, side: null,
        cur: first ? prescribed(first, 0) : { w: null, r: null }, started: Date.now() })
    })
  }, [plan, id, d, catReady])

  useEffect(() => { if (d) kv.set('draft:' + id, d).catch(() => {}) }, [d, id])

  // Reloj del descanso
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  const restLeft = d?.restEnd ? Math.max(0, Math.round((d.restEnd - now) / 1000)) : null
  useEffect(() => {
    if (restLeft === 0 && !alarmed.current) { alarmed.current = true; alarm() }
  }, [restLeft])

  if (error && !session) return <div className="body"><p className="err-text">No se pudo cargar la sesión: {error.message}</p><button className="btn" onClick={() => go('/hoy')}>Volver a Hoy</button></div>
  if (!session || !catReady || !d) return <div className="loading">Cargando sesión…</div>

  const e = plan[d.ei]
  const totalSets = plan.reduce((a, x) => a + x.nSets, 0)
  const loggedOf = name => d.logged.filter(s => s.exercise_name === name)
  const scheduled = session.scheduled_date
  const overdue = scheduled < today()

  function update(patch) { setD(prev => ({ ...prev, ...patch })) }

  function nextFrom(state, ei, si) {
    const cur = plan[ei]
    if (cur && !cur.info && si + 1 < cur.nSets) return { ei, si: si + 1 }
    for (let j = ei + 1; j < plan.length; j++) if (!plan[j].info || j === ei + 1) return { ei: j, si: 0 }
    return { ei, si, done: true }
  }

  function moveTo(state, pos) {
    const ne = plan[pos.ei]
    const prevSame = state.logged.filter(s => s.exercise_name === ne?.name).at(-1)
    // Herencia: carga y reps de la serie anterior del mismo ejercicio; nunca el RPE
    const cur = prevSame ? { w: prevSame.weight_kg, r: prevSame.reps } : ne ? prescribed(ne, pos.si) : state.cur
    return { ...state, ei: pos.ei, si: pos.si, cur, side: pos.ei === state.ei ? state.side : null }
  }

  function logSet(rpe) {
    unlockAudio()
    haptic(25)
    alarmed.current = false
    setD(prev => {
      const set = {
        exercise_name: e.name, exercise_id: e.exerciseId, set_number: prev.si + 1,
        reps: prev.cur.r ?? 0,
        weight_kg: e.conv === 'none' ? null : prev.cur.w,
        rpe: e.noRpe ? null : rpe, rir: null,
        side: e.unilateral ? prev.side : null,
        is_calibration: false, to_failure: false, notes: null
      }
      const state = { ...prev, logged: [...prev.logged.filter(s => !(s.exercise_name === e.name && s.set_number === set.set_number)), set], restEnd: Date.now() + e.rest * 1000 }
      return moveTo(state, nextFrom(state, prev.ei, prev.si))
    })
  }

  function skip() { setD(prev => moveTo(prev, nextFrom(prev, prev.ei, prev.si))) }

  function undoLast() {
    setD(prev => {
      const last = prev.logged.at(-1)
      if (!last) return prev
      const ei = plan.findIndex(x => x.name === last.exercise_name)
      return { ...prev, logged: prev.logged.slice(0, -1), ei, si: last.set_number - 1, cur: { w: last.weight_kg, r: last.reps }, side: last.side, restEnd: null }
    })
    setSheet(null)
  }

  function finish(performedDate) {
    setSheet(null)
    const payload = {
      client_id: d.clientId,
      performed_date: performedDate,
      programmed_session_id: session.id,
      session_type: session.session_type || null,
      duration_min: Math.max(1, Math.round((Date.now() - d.started) / 60000)),
      sets: d.logged.map(({ exercise_id, ...s }) => ({ ...s, exercise_id: exercise_id || null })),
      issues: d.issues || []
    }
    setPending(payload)
    clearTimeout(undoT.current)
    undoT.current = setTimeout(async () => {
      await queueTrainingLog(payload)
      await kv.del('draft:' + id)
      setPending(null)
      go('/hoy')
    }, 10000)
  }

  function onFinish() {
    if (!d.logged.length) return
    if (overdue) setSheet('when')
    else finish(today())
  }

  // ---------- Render ----------
  const done = loggedOf(e?.name || '')
  const last = e && lastText(e, lastTimes?.[e.exerciseId])
  const repsLabel = e?.jump ? 'contactos' : e?.time ? e.timeUnit + (e.unilateral ? ' por lado' : '') : e?.unilateral ? 'reps por lado' : 'reps'
  const wStep = 2.5

  return (
    <div className="screen ses">
      <header className="ses-top">
        <button className="ses-exit" onClick={() => back('/hoy')} aria-label="Salir (el borrador se guarda)">Salir</button>
        <div className={'ses-timer' + (restLeft === 0 ? ' is-done' : '')} aria-live="polite">
          {restLeft == null
            ? <><span className="tv num">—:—</span><span className="tl">El descanso arranca al registrar</span></>
            : <button className="tv-btn" onClick={() => update({ restEnd: null })} aria-label="Parar el descanso">
                <span className="tv num">{Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}</span>
                <span className="tl">{restLeft === 0 ? 'Descanso terminado' : 'Descanso · tocar para parar'}</span>
              </button>}
        </div>
        <span className="ses-prog num">{d.logged.length}/{totalSets}</span>
      </header>

      <div className="ses-ctx">
        <div className="t2">{session.session_name} · {fmtRelative(scheduled)}</div>
        {e?.info ? (
          <>
            <h1 className="ses-name">{e.name}</h1>
            {e.target.reps && <div className="ses-of">{e.target.reps}</div>}
            {e.notes && <p className="ses-notes">{e.notes}</p>}
          </>
        ) : e && (
          <>
            <h1 className="ses-name">{e.name}</h1>
            <div className="ses-of">Serie <span className="num">{d.si + 1}</span> de <span className="num">{e.nSets}</span></div>
            <dl className="ses-ref">
              <dt>Objetivo</dt><dd className="num">{targetText(e)}</dd>
              {last && <><dt>Última vez</dt><dd className="num">{last}</dd></>}
            </dl>
            <div className="ses-links">
              {e.notes && <button onClick={() => setSheet(sheet === 'notes' ? null : 'notes')} aria-expanded={sheet === 'notes'}>Notas técnicas</button>}
              <button onClick={() => setSheet('table')}>Ver toda la sesión</button>
              <button onClick={() => { setIssue({ zone: null, intensity: null }); setSheet('issue') }}>Molestia</button>
            </div>
            {sheet === 'notes' && <p className="ses-notes">{e.notes}</p>}
            {(d.issues || []).filter(i => i.exercise_name === e.name).map((i, k) => (
              <div className="ses-issue" key={k}>
                <span>Molestia en {i.zone} · {INTENSITY[i.intensity]}</span>
                <button onClick={() => update({ issues: d.issues.filter(x => x !== i) })} aria-label="Quitar molestia">Quitar</button>
              </div>
            ))}
            {done.length > 0 && (
              <ul className="ses-done">
                {done.map(s => (
                  <li key={s.set_number}><span>Serie {s.set_number}</span>
                    <span className="num">{s.weight_kg != null ? (e.conv === 'added' ? '+' : '') + fmtNum(s.weight_kg) + ' × ' : ''}{s.reps}{s.side ? ' ' + s.side : ''}{s.rpe != null ? ' @ ' + fmtNum(s.rpe) : ''}</span></li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="console">
        {e?.info ? (
          <button className="btn btn--primary btn--block console-big" onClick={skip}>Hecho · siguiente ejercicio</button>
        ) : e && (
          <>
            {e.conv !== 'none' && (
              <Stepper label={LOAD_LABEL[e.conv]} value={d.cur.w} step={wStep} prefix={e.conv === 'added' ? '+' : ''}
                onChange={w => update({ cur: { ...d.cur, w } })} decimals />
            )}
            <Stepper label={repsLabel} value={d.cur.r} step={1} onChange={r => update({ cur: { ...d.cur, r } })} />
            {e.unilateral && (
              <div className="side-row" role="group" aria-label="Lado">
                {[[null, 'Ambos lados'], ['L', 'Solo izquierdo'], ['R', 'Solo derecho']].map(([v, l]) => (
                  <button key={l} className="chip" aria-pressed={d.side === v} onClick={() => update({ side: v })}>{l}</button>
                ))}
              </div>
            )}
            {e.noRpe ? (
              <button className="btn btn--primary btn--block console-big" onClick={() => logSet(null)}>Hecho</button>
            ) : (
              <>
                <div className="rpe-lbl"><span>RPE · pulsa para registrar la serie</span>{e.target.rpe && <span>objetivo {fmtNum(e.target.rpe)}</span>}</div>
                <div className="rpe-grid" role="group" aria-label="RPE de la serie">
                  {RPES.map(v => <button key={v} className="num" onClick={() => logSet(v)}>{fmtNum(v)}</button>)}
                </div>
              </>
            )}
          </>
        )}
        <div className="ses-actions">
          <SyncBadge />
          {!e?.info && <button className="btn btn--sm btn--ghost" onClick={skip}>Saltar serie</button>}
          <button className="btn btn--sm" onClick={onFinish} disabled={!d.logged.length || !!pending}>Finalizar</button>
        </div>
      </div>

      {sheet === 'table' && (
        <Sheet label="Sesión completa" onClose={() => setSheet(null)}>
          <h2>Sesión completa</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="ses-table">
              <thead><tr><th>Ejercicio</th><th>Serie</th><th>Carga</th><th>Reps</th><th>RPE</th></tr></thead>
              <tbody>
                {plan.filter(x => !x.info).flatMap(x => Array.from({ length: x.nSets }, (_, k) => {
                  const s = d.logged.find(l => l.exercise_name === x.name && l.set_number === k + 1)
                  const p = prescribed(x, k)
                  return (
                    <tr key={x.name + k} className={s ? '' : 'is-todo'} onClick={() => { setD(prev => ({ ...moveTo(prev, { ei: x.i, si: k }) })); setSheet(null) }}>
                      <td>{k === 0 ? x.name : ''}</td><td className="num">{k + 1}</td>
                      <td className="num">{x.conv === 'none' ? '—' : fmtNum(s ? s.weight_kg : p.w)}</td>
                      <td className="num">{s ? s.reps : p.r}{s?.side ? ' ' + s.side : ''}</td>
                      <td className="num">{s?.rpe != null ? fmtNum(s.rpe) : '—'}</td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
          <p className="t2">Toca una fila para ir a esa serie.</p>
          <button className="btn btn--block" onClick={undoLast} disabled={!d.logged.length}>Deshacer la última serie</button>
        </Sheet>
      )}

      {sheet === 'issue' && e && (
        <Sheet label="Molestia" onClose={() => setSheet(null)}>
          <h2>Molestia en {e.name}</h2>
          <div className="field"><span className="lbl">Zona</span>
            <div className="seg" role="group" aria-label="Zona">
              {ZONES.map(z => <button key={z} className="chip" aria-pressed={issue.zone === z} onClick={() => setIssue({ ...issue, zone: z })}>{z}</button>)}
            </div>
          </div>
          <div className="field"><span className="lbl">Intensidad</span>
            <div className="side-row" role="group" aria-label="Intensidad">
              {[1, 2, 3].map(n => <button key={n} className="chip" aria-pressed={issue.intensity === n} onClick={() => setIssue({ ...issue, intensity: n })}>{n} · {INTENSITY[n]}</button>)}
            </div>
          </div>
          <button className="btn btn--primary btn--block" disabled={!issue.zone || !issue.intensity}
            onClick={() => { update({ issues: [...(d.issues || []), { exercise_name: e.name, zone: issue.zone, intensity: issue.intensity }] }); setSheet(null) }}>Añadir molestia</button>
        </Sheet>
      )}

      {sheet === 'when' && (
        <Sheet label="¿Cuándo la hiciste?" onClose={() => setSheet(null)}>
          <h2>¿Cuándo la hiciste?</h2>
          <p className="t2">Estaba planificada para {fmtRelative(scheduled)}.</p>
          <button className="btn btn--primary btn--block" onClick={() => finish(today())}>Hoy</button>
          <button className="btn btn--block" onClick={() => finish(addDays(today(), -1))}>Ayer</button>
          <label className="field"><span className="lbl">Otra fecha</span>
            <input className="text-in" type="date" max={today()} defaultValue={scheduled} onChange={ev => ev.target.value && finish(ev.target.value)} />
          </label>
        </Sheet>
      )}

      {pending && (
        <div className="toast" role="status">
          <span className="grow">Sesión registrada · <span className="num">{pending.sets.length}</span> {pending.sets.length === 1 ? 'serie' : 'series'}</span>
          <button onClick={() => { clearTimeout(undoT.current); setPending(null) }}>Deshacer</button>
          <span className="drain" />
        </div>
      )}
    </div>
  )
}

function Stepper({ label, value, step, onChange, prefix = '', decimals = false }) {
  const [text, setText] = useState(null) // null = mostrando el valor; string = editando
  const set = v => onChange(v == null ? null : Math.max(0, Math.round(v * 100) / 100))
  return (
    <div className="stepper">
      <span className="sl">{label}</span>
      <button onClick={() => set((value ?? 0) - step)} aria-label={'Menos ' + label}>−</button>
      <input className="sv num" inputMode={decimals ? 'decimal' : 'numeric'} aria-label={label}
        value={text ?? (value == null ? '—' : prefix + fmtNum(value))}
        onFocus={ev => { setText(value == null ? '' : String(value).replace('.', ',')); requestAnimationFrame(() => ev.target.select()) }}
        onChange={ev => setText(ev.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={() => { const n = text === '' || text == null ? value : Number(text.replace(',', '.')); setText(null); set(Number.isFinite(n) ? n : value) }} />
      <button onClick={() => set((value ?? 0) + step)} aria-label={'Más ' + label}>+</button>
    </div>
  )
}
