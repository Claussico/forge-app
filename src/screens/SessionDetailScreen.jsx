// Detalle de una sesión programada, sea del día que sea:
// - planificada: su contenido y el botón para hacerla (también adelantada o atrasada) u omitirla;
// - hecha: lo que se registró (series, molestias, carrera o movilidad).
import { useEffect, useMemo, useState } from 'react'
import { fetchSession, fetchCatalog, fetchSessionRecord, queueSkipSession, lookup } from '../lib/api'
import { kv } from '../lib/queue'
import { useData } from '../lib/hooks'
import { today, fmtDay, fmtRelative } from '../lib/dates'
import { TYPE_LABEL, typeOf, isMobility, startSession, startLabel } from '../lib/sessions'
import { Status, Sheet, Icon, DemoLink, fmtNum, go, back } from '../components/ui'
import { buildPlan, targetText } from './SessionScreen'
import { doseText } from './MobilityScreen'

const INTENSITY = { 1: 'leve', 2: 'moderada', 3: 'fuerte' }

export default function SessionDetailScreen({ id, from = 'hoy' }) {
  const { data: s, error } = useData('session:' + id, () => fetchSession(id), [id])
  const { data: catalog } = useData('catalog', fetchCatalog)
  const { data: rec } = useData('record:' + id, () => fetchSessionRecord(id), [id, s?.status])
  const plan = useMemo(() => buildPlan(s, catalog), [s, catalog])
  const [draft, setDraft] = useState(false)
  const [skip, setSkip] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => { kv.get('draft:' + id).then(v => setDraft(!!v)).catch(() => {}) }, [id])

  if (error && !s) return <div className="body"><p className="err-text">No se pudo cargar la sesión: {error.message}</p></div>
  if (!s) return <div className="loading">Cargando…</div>

  const t = typeOf(s)
  const late = s.status === 'planned' && s.scheduled_date < today()
  const otherDay = s.scheduled_date !== today()
  const log = rec?.log
  const load = rec?.load
  const byEx = {}
  for (const e of log?.exercise_logs || []) (byEx[e.exercise_name] ||= []).push(e)

  async function doSkip() {
    await queueSkipSession(s.id, note.trim())
    setSkip(false)
    setTimeout(() => go('/' + from), 600)
  }

  return (
    <>
      <div className="body">
        <div className="head">
          <button className="back-btn" onClick={() => back('/' + from)}><Icon.left />Volver</button>
          <h1 className="h1">{s.session_name}</h1>
          <div className="today-meta">
            <span className="ctx">{fmtDay(s.scheduled_date)} · {TYPE_LABEL[t]}</span>
            <Status status={s.status} late={late} />
          </div>
          {s.status_note && <p className="t2">{s.status_note}</p>}
        </div>

        {s.status === 'done' && (log || load) && (
          <section className="stack" style={{ gap: 8 }}>
            <h2 className="sec">Registrado</h2>
            {log && (
              <div className="panel">
                <div className="row"><div className="grow t0">Hecha {fmtRelative(log.performed_date)}</div>
                  <span className="t2 num">{[log.duration_min && log.duration_min + ' min', log.overall_rpe && 'RPE ' + fmtNum(log.overall_rpe)].filter(Boolean).join(' · ')}</span></div>
                {Object.entries(byEx).map(([name, sets]) => {
                  const e = plan.find(p => p.name === name)
                  return (
                    <div className="row detail-row" key={name}>
                      <div className="t0">{name}</div>
                      <div className="detail-sets num">
                        {sets.sort((a, b) => a.set_number - b.set_number).map(x => (
                          <span key={x.set_number}>{x.weight_kg != null && Number(x.weight_kg) ? (e?.conv === 'added' ? '+' : '') + fmtNum(x.weight_kg) + '×' : ''}{x.reps}{x.side ? ' ' + x.side : ''}{x.rpe != null ? ' @' + fmtNum(x.rpe) : ''}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {(log.exercise_issues || []).map((i, k) => (
                  <div className="row" key={'i' + k}><div className="grow t0">Molestia: {i.zone}</div><span className="t2">{i.exercise_name} · {INTENSITY[i.intensity] || i.intensity}</span></div>
                ))}
                {log.notes && <div className="row"><p className="t2">{log.notes}</p></div>}
                {isMobility(s) && !log.exercise_logs?.length && <div className="row"><p className="t2">Sesión de movilidad: se registra entera, sin series.</p></div>}
              </div>
            )}
            {load && (
              <div className="panel">
                <div className="row"><div className="grow t0">{fmtRelative(load.date)}</div>
                  <span className="t2 num">{[load.distance_km != null && fmtNum(load.distance_km) + ' km', load.duration_min != null && fmtNum(load.duration_min) + ' min', load.avg_hr && load.avg_hr + ' ppm', load.rpe != null && 'RPE ' + fmtNum(load.rpe)].filter(Boolean).join(' · ')}</span></div>
                {load.notes && <div className="row"><p className="t2">{load.notes}</p></div>}
              </div>
            )}
          </section>
        )}

        <section className="stack" style={{ gap: 8 }}>
          <h2 className="sec">{s.status === 'done' ? 'Lo programado' : 'Contenido'}</h2>
          <div className="panel">
            {(s.exercises || []).map((ex, k) => {
              const e = plan[k]
              const tx = isMobility(s) ? doseText(ex.target || {}) : e?.info ? (ex.target?.reps || '') : e ? targetText(e) : ''
              return (
                <div className="row detail-row" key={k}>
                  <div className="today-meta"><span className="t0">{ex.name}</span><span className="t2 num">{tx}</span></div>
                  {ex.execution_notes && <p className="t2">{ex.execution_notes}</p>}
                  <DemoLink url={lookup(catalog, ex.name)?.demo_url} />
                </div>
              )
            })}
            {!(s.exercises || []).length && <div className="row"><p className="t2">Sin ejercicios detallados.</p></div>}
          </div>
        </section>
      </div>

      {s.status === 'planned' && (
        <div className="foot">
          {otherDay && <p className="t2">Programada para {fmtRelative(s.scheduled_date)}. {late ? 'Al registrarla te preguntaré cuándo la hiciste.' : 'Si la haces hoy, se guarda con la fecha de hoy.'}</p>}
          <button className="btn btn--primary btn--block" onClick={() => startSession(s)}>{startLabel(s, draft)}{otherDay && !draft ? ' hoy' : ''}</button>
          <button className="btn btn--ghost btn--block" onClick={() => setSkip(true)}>Omitir esta sesión</button>
        </div>
      )}

      {skip && (
        <Sheet label="Omitir sesión" onClose={() => setSkip(false)}>
          <h2>Omitir {s.session_name}</h2>
          <label className="field"><span className="lbl">Motivo <span className="hint">opcional</span></span>
            <input className="text-in" value={note} onChange={e => setNote(e.target.value)} placeholder="Viaje, molestia, falta de tiempo…" /></label>
          <button className="btn btn--primary btn--block" onClick={doSkip}>Omitir</button>
          <button className="btn btn--ghost btn--block" onClick={() => setSkip(false)}>Cancelar</button>
        </Sheet>
      )}
    </>
  )
}
