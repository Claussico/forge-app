// Hoy: qué toca (o cualquier fecha elegida en el calendario), avisos y cómo va la semana.
// Todo lo calculado sale de magnus_briefing(); el front no recalcula semanas ni volumen.
import { useEffect, useState } from 'react'
import { fetchBriefing, fetchSessionsBetween, fetchTodayCheckin } from '../lib/api'
import { kv } from '../lib/queue'
import { useData } from '../lib/hooks'
import { today, fmtRelative, daysBetween } from '../lib/dates'
import { DateButton, Status, fmtNum, go } from '../components/ui'
import { PHASE, TYPE_LABEL, startSession, startLabel, viewSession, timeTarget } from '../lib/sessions'

export default function TodayScreen({ date }) {
  const day = date || today()
  const isToday = day === today()
  const { data: b, error: bErr } = useData('briefing', fetchBriefing)
  const { data: sessions, error: sErr } = useData('sessions:' + day, () => fetchSessionsBetween(day, day), [day])
  const { data: checkin } = useData('checkin:' + today(), fetchTodayCheckin)
  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    if (!sessions) return
    Promise.all(sessions.map(s => kv.get('draft:' + s.id).then(v => [s.id, !!v]).catch(() => [s.id, false])))
      .then(r => setDrafts(Object.fromEntries(r)))
  }, [sessions])

  const blk = b?.block
  const unlogged = (b?.flags || []).find(f => f.flag === 'programmed_not_logged')?.detail || []
  const cap = b?.impact_7d?.next_run_cap_km
  const plan = b?.week_plan || []
  const strength = plan.filter(p => ['strength', 'power'].includes(p.type || 'strength'))
  const mob = b?.mobility_week

  return (
    <div className="body">
      <div className="head">
        <DateButton value={day} onChange={d => go(d === today() ? '/hoy' : '/hoy?d=' + d)} />
        <div className="ctx">
          {blk
            ? blk.start_date > today()
              ? <><b>Bloque {blk.number} · {PHASE[blk.phase] || blk.phase}</b> · empieza {fmtRelative(blk.start_date)}</>
              : <><b>Bloque {blk.number} · {PHASE[blk.phase] || blk.phase}</b> · semana <span className="num">{blk.week_real}</span> de <span className="num">{blk.weeks_planned}</span>{isToday && <> · día <span className="num">{blk.day_in_week}</span></>}</>
            : b ? 'Sin bloque activo' : ' '}
          {!isToday && <> · <button className="link-btn" onClick={() => go('/hoy')}>Ir a hoy</button></>}
        </div>
      </div>

      {(bErr || sErr) && !sessions && <div className="alert alert--err">Sin conexión y sin datos guardados para este día.</div>}

      {isToday && unlogged.map(u => (
        <div className="alert" role="status" key={u.date + u.session}>
          <div className="grow">{u.session} ({fmtRelative(u.date)}) sin registrar</div>
          <button className="btn btn--sm" onClick={async () => {
            const [s] = await fetchSessionsBetween(u.date, u.date).then(r => r.filter(x => x.session_name === u.session && x.status === 'planned'))
            if (s) startSession(s)
          }}>Registrar</button>
        </div>
      ))}

      {sessions && sessions.length === 0 && (
        <div className="panel today-card"><h2 className="today-title">Descanso</h2><p className="t2">No hay nada programado {isToday ? 'hoy' : 'este día'}.</p></div>
      )}

      {(sessions || []).map(s => {
        const t = s.session_type || 'strength'
        const ex = (s.exercises || []).filter(e => (e.sets || []).length || e.target?.seconds || e.target?.reps)
        const future = daysBetween(today(), s.scheduled_date) > 0
        const late = s.status === 'planned' && s.scheduled_date < today()
        const canAct = s.status === 'planned' && !future
        return (
          <div className="panel today-card" key={s.id}>
            <div className="today-meta"><Status status={s.status} late={late} /><span className="t2">{TYPE_LABEL[t]}</span></div>
            <h2 className="today-title">{s.session_name}</h2>
            {s.status_note && <p className="t2">{s.status_note}</p>}
            {t === 'run' && ex[0] && (
              <>
                <p className="t2">{[ex[0].name, timeTarget(ex[0].target), ex[0].target?.distance_km != null && 'objetivo ' + fmtNum(ex[0].target.distance_km) + ' km'].filter(Boolean).join(' · ')}</p>
                {ex[0].execution_notes && <p className="today-notes">{ex[0].execution_notes}</p>}
                {cap != null && <div className="cap"><span>Tope de distancia (+10 % sobre la salida más larga)</span><span className="num">{fmtNum(cap)} km</span></div>}
              </>
            )}
            {t !== 'run' && ex.length > 0 && (
              <p className="t2">{ex.map(e => e.name).join(' · ')}</p>
            )}
            {canAct && <button className="btn btn--primary btn--block" onClick={() => startSession(s)}>{startLabel(s, drafts[s.id])}</button>}
            <button className="btn btn--ghost btn--block" onClick={() => viewSession(s, 'hoy')}>{s.status === 'done' ? 'Ver lo registrado' : future ? 'Ver sesión o hacerla hoy' : 'Ver sesión'}</button>
          </div>
        )
      })}

      {isToday && (
        <div className="panel">
          <button className="row" onClick={() => go('/registrar/checkin')}>
            <div className="grow">
              <div className="t0">Check-in de hoy</div>
              <div className={'t2' + (checkin ? ' num' : '')}>{checkin
                ? [checkin.weight_kg != null && fmtNum(checkin.weight_kg) + ' kg', checkin.sleep_hours != null && fmtNum(checkin.sleep_hours) + ' h', checkin.tibia_score != null && 'tibia ' + checkin.tibia_score].filter(Boolean).join(' · ') || 'Hecho'
                : 'Pendiente'}</div>
            </div>
            <span className="btn btn--sm">{checkin ? 'Otro' : 'Hacer check-in'}</span>
          </button>
          {blk && blk.start_date <= today() && (
            <div className="row">
              <div className="grow">
                <div className="t0">Semana {blk.week_real}</div>
                <div className="t2"><span className="num">{strength.filter(p => p.status === 'done').length}</span> de <span className="num">{strength.length}</span> sesiones de fuerza
                  {mob && <> · movilidad <span className="num">{mob.sessions_done}</span>/<span className="num">{mob.sessions_planned_to_date}</span></>}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
