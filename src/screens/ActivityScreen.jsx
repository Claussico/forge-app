// Carrera y otras actividades (spec §1). Con ?s=<id> llega enlazada a una sesión programada
// (el trigger la marca como hecha). Edición y borrado de las recientes.
import { useEffect, useMemo, useState } from 'react'
import { fetchBriefing, fetchRecentLoads, fetchSessionsBetween, fetchSession, queueExternalLoad, queueExternalLoadUpdate, queueExternalLoadDelete } from '../lib/api'
import { useData } from '../lib/hooks'
import { today, addDays, fmtRelative } from '../lib/dates'
import { Choice, NumField, fmtNum, go } from '../components/ui'
import { timeTarget } from '../lib/sessions'
import './forms.css'

const ACTIVITIES = [
  { value: 'run', label: 'Carrera' }, { value: 'sprint', label: 'Sprint' }, { value: 'court', label: 'Pista' },
  { value: 'plyometrics', label: 'Pliometría' }, { value: 'other', label: 'Otra' }
]
const SURFACES = [
  { value: 'grass', label: 'Césped' }, { value: 'dirt', label: 'Tierra' }, { value: 'asphalt', label: 'Asfalto' },
  { value: 'track', label: 'Pista' }, { value: 'treadmill', label: 'Cinta' }, { value: 'sand', label: 'Arena' },
  { value: 'indoor', label: 'Interior' }, { value: 'other', label: 'Otra' }
]
const ACT_LABEL = Object.fromEntries(ACTIVITIES.map(a => [a.value, a.label]))
const SURF_LABEL = Object.fromEntries(SURFACES.map(a => [a.value, a.label]))
const RPE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const EMPTY = { activity: 'run', date: null, duration_min: null, distance_km: null, avg_hr: null, rpe: null, surface: null, reps: null, jump_contacts: null, programmed_session_id: null, notes: null }

export default function ActivityScreen({ sessionId, editId }) {
  const { data: briefing } = useData('briefing', fetchBriefing)
  const { data: recent, reload } = useData('loads', fetchRecentLoads)
  const { data: linkable } = useData('linkable:' + today(), () => fetchSessionsBetween(addDays(today(), -1), today()))
  const { data: preset } = useData('session:' + (sessionId || 'none'), () => sessionId ? fetchSession(sessionId) : Promise.resolve(null), [sessionId])
  const [f, setF] = useState({ ...EMPTY, date: today(), programmed_session_id: sessionId || null })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const set = k => v => setF(p => ({ ...p, [k]: v }))

  const editing = editId ? recent?.find(r => r.id === editId) : null
  useEffect(() => { if (editing) setF({ ...EMPTY, ...editing }) }, [editing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sesiones planned de hoy y de ayer (spec §1), más la enlazada si ya no está planned
  const options = useMemo(() => {
    const list = (linkable || []).filter(s => s.status === 'planned' || s.id === f.programmed_session_id)
    if (preset && !list.some(s => s.id === preset.id)) list.unshift(preset) // adelantada o atrasada más de un día
    return list
  }, [linkable, preset, f.programmed_session_id])
  const linked = options.find(s => s.id === f.programmed_session_id)
  const linkedEx = linked?.exercises?.[0]
  const cap = briefing?.impact_7d?.next_run_cap_km
  const longest = briefing?.impact_7d?.longest_run_km_30d
  const isRun = f.activity === 'run'
  const overCap = isRun && cap != null && f.distance_km != null && f.distance_km > cap
  const invalid = (isRun && f.distance_km == null) || (f.avg_hr != null && (f.avg_hr < 30 || f.avg_hr > 230))

  async function save() {
    setSaving(true); setErr('')
    const row = Object.fromEntries(Object.entries(f).filter(([k]) => k in EMPTY))
    if (row.distance_km != null) row.distance_km = Math.round(row.distance_km * 100) / 100
    try {
      if (editing) await queueExternalLoadUpdate(editing.id, row)
      else await queueExternalLoad(row)
      reload()
      go(editing ? '/registrar/actividad' : '/hoy')
    } catch (e) { setErr('No se pudo guardar en el dispositivo: ' + e.message); setSaving(false) }
  }

  return (
    <>
      <div className="body">
        <div className="head">
          <h1 className="h1">{editing ? 'Editar actividad' : 'Registrar actividad'}</h1>
          {linked && <div className="ctx">Enlazada a <b>{linked.session_name} · {fmtRelative(linked.scheduled_date)}</b>. Al guardar, la sesión queda hecha.</div>}
        </div>

        {linked && linkedEx && (
          <div className="panel" style={{ padding: 14 }}>
            <div className="t0">{linkedEx.name} · {timeTarget(linkedEx.target)}</div>
            {linkedEx.execution_notes && <p className="t2" style={{ marginTop: 4 }}>{linkedEx.execution_notes}</p>}
          </div>
        )}

        <div className="field"><span className="lbl">Actividad</span>
          <Choice options={ACTIVITIES} value={f.activity} onChange={v => v && set('activity')(v)} label="Actividad" />
        </div>

        <div className="two">
          <label className="field"><span className="lbl">Duración</span><NumField id="a-min" decimals unit="min" value={f.duration_min} onChange={set('duration_min')} label="Minutos" /></label>
          <label className="field"><span className="lbl">Distancia {isRun && <span className="hint">obligatoria</span>}</span><NumField id="a-km" decimals unit="km" placeholder="0,00" value={f.distance_km} onChange={set('distance_km')} label="Kilómetros" /></label>
        </div>
        {isRun && cap != null && (
          <div className={'cap' + (overCap ? ' cap--over' : '')}>
            <span>{overCap ? 'Por encima del tope' : 'Tope hoy'} (+10 % sobre {fmtNum(longest)} km)</span><span className="num">{fmtNum(cap)} km</span>
          </div>
        )}

        {f.activity === 'sprint' && <label className="field"><span className="lbl">Repeticiones</span><NumField id="a-reps" value={f.reps} onChange={set('reps')} label="Repeticiones" /></label>}
        {f.activity === 'plyometrics' && <label className="field"><span className="lbl">Contactos de salto</span><NumField id="a-jc" value={f.jump_contacts} onChange={set('jump_contacts')} label="Contactos" /></label>}

        <div className="field"><span className="lbl">RPE <span className="hint">0–10</span></span>
          <Choice className="chips chips--6" mono clearable options={RPE} value={f.rpe} onChange={set('rpe')} label="RPE" />
        </div>

        <div className="field"><span className="lbl">Superficie</span>
          <Choice clearable options={SURFACES} value={f.surface} onChange={set('surface')} label="Superficie" />
        </div>

        <div className="two">
          <label className="field"><span className="lbl">Pulso medio</span><NumField id="a-hr" unit="ppm" value={f.avg_hr} onChange={set('avg_hr')} label="Pulsaciones por minuto" /></label>
          <label className="field"><span className="lbl">Fecha</span><input className="text-in" type="date" max={today()} value={f.date} onChange={e => e.target.value && set('date')(e.target.value)} /></label>
        </div>

        <label className="field"><span className="lbl">Sesión enlazada</span>
          <select className="text-in" value={f.programmed_session_id || ''} onChange={e => set('programmed_session_id')(e.target.value || null)}>
            <option value="">Sin enlazar</option>
            {options.map(s => <option key={s.id} value={s.id}>{s.session_name} · {fmtRelative(s.scheduled_date)}</option>)}
          </select>
        </label>

        <label className="field"><span className="lbl">Notas</span>
          <textarea className="text-in" value={f.notes ?? ''} onChange={e => set('notes')(e.target.value || null)} placeholder="Opcional" /></label>

        {err && <p className="err-text" role="alert">{err}</p>}

        {!editing && (
          <>
            <h2 className="sec">Recientes</h2>
            {recent?.length ? (
              <div className="panel">
                {recent.map(r => (
                  <div className="row" key={r.id}>
                    <div className="grow">
                      <div className="t0">{ACT_LABEL[r.activity]} · {fmtRelative(r.date)}</div>
                      <div className="t2 num">{[r.distance_km != null && fmtNum(r.distance_km) + ' km', r.duration_min != null && fmtNum(r.duration_min) + ' min', r.avg_hr && r.avg_hr + ' ppm', r.rpe != null && 'RPE ' + fmtNum(r.rpe), r.surface && SURF_LABEL[r.surface]].filter(Boolean).join(' · ')}</div>
                    </div>
                    {confirmDel === r.id ? (
                      <div className="list-row-actions">
                        <button className="btn btn--sm btn--danger" onClick={async () => { await queueExternalLoadDelete(r.id); setConfirmDel(null); setTimeout(reload, 800) }}>Borrar</button>
                        <button className="btn btn--sm btn--ghost" onClick={() => setConfirmDel(null)}>No</button>
                      </div>
                    ) : (
                      <div className="list-row-actions">
                        <button className="btn btn--sm btn--ghost" onClick={() => go('/registrar/actividad/' + r.id)}>Editar</button>
                        <button className="btn btn--sm btn--ghost" aria-label="Borrar" onClick={() => setConfirmDel(r.id)}>Borrar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="t2">Sin actividades registradas.</p>}
          </>
        )}
      </div>
      <div className="foot">
        <button className="btn btn--primary btn--block" disabled={invalid || saving} onClick={save}>
          {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar ' + ACT_LABEL[f.activity].toLowerCase()}
        </button>
      </div>
    </>
  )
}
