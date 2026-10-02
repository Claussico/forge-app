// Semana del bloque: plan con estados (tocar una sesión abre su detalle, donde se hace u omite),
// volumen fraccional frente a objetivo, movilidad e impacto de 7 días. Los números vienen de
// magnus_briefing(); aquí no se recalcula nada.
import { useState } from 'react'
import { fetchBriefing, fetchSessionsBetween } from '../lib/api'
import { useData } from '../lib/hooks'
import { today, addDays, parseISO, fmtDayShort } from '../lib/dates'
import { PHASE, TYPE_LABEL, typeOf, viewSession } from '../lib/sessions'
import { Status, Icon, fmtNum } from '../components/ui'
import './week.css'

export const MUSCLE = { pecho: 'Pecho', dorsal: 'Dorsal', espalda_alta: 'Espalda alta', hombro_anterior: 'Hombro anterior', hombro_lateral: 'Hombro lateral', hombro_posterior: 'Hombro posterior', biceps: 'Bíceps', triceps: 'Tríceps', cuadriceps: 'Cuádriceps', isquios: 'Isquios', gluteo: 'Glúteo', gemelo: 'Gemelo', core: 'Core' }
export const ZONE = { isquios: 'Isquios', toracica: 'Torácica', hombro_overhead: 'Hombro overhead', flexores_cadera: 'Flexores de cadera', cadera_rotacion: 'Rotación de cadera', aductores: 'Aductores', tobillo: 'Tobillo', gemelo_soleo: 'Gemelo y sóleo', pectoral: 'Pectoral', muneca: 'Muñeca' }
const MIDLINE = new Set(['toracica'])

const fmtRange = (a, b) => {
  const f = s => parseISO(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
  return `${f(a)} – ${f(b)}`
}
// Lunes de la semana de hoy, para cuando no hay bloque activo
const mondayOf = s => addDays(s, -((parseISO(s).getDay() + 6) % 7))

export function Bar({ value, target }) {
  const pct = target > 0 ? Math.min(100, (100 * value) / target) : value > 0 ? 100 : 0
  return <span className="bar" role="img" aria-label={`${fmtNum(value)} de ${target != null ? fmtNum(target) : 'sin objetivo'}`}><span style={{ width: pct + '%' }} /></span>
}

export default function WeekScreen() {
  const { data: b } = useData('briefing', fetchBriefing)
  const [offset, setOffset] = useState(0)
  const blk = b?.block
  const base = blk?.week_window?.[0] || mondayOf(today())
  const from = addDays(base, 7 * offset)
  const to = addDays(from, 6)
  const { data: sessions, error } = useData(`week:${from}`, () => fetchSessionsBetween(from, to), [from])
  const current = offset === 0
  const weekN = blk ? blk.week_real + offset : null

  const vol = (b?.volume_week || []).filter(v => v.target != null || v.fractional_sets > 0)
  const mob = b?.mobility_week
  const imp = b?.impact_7d

  return (
    <div className="body">
      <div className="head">
        <div className="week-nav">
          <button className="week-arrow" onClick={() => setOffset(o => o - 1)} aria-label="Semana anterior"><Icon.left /></button>
          <h1 className="h1">{weekN != null && weekN >= 1 && weekN <= blk.weeks_planned ? `Semana ${weekN}` : current ? 'Esta semana' : 'Semana'}</h1>
          <button className="week-arrow" onClick={() => setOffset(o => o + 1)} aria-label="Semana siguiente"><Icon.right /></button>
        </div>
        <div className="ctx">
          {blk && <><b>Bloque {blk.number} · {PHASE[blk.phase] || blk.phase}</b> · </>}<span className="num">{fmtRange(from, to)}</span>
          {!current && <> · <button className="link-btn" onClick={() => setOffset(0)}>Semana actual</button></>}
        </div>
      </div>

      {error && !sessions && <div className="alert alert--err">Sin conexión y sin datos guardados para esta semana.</div>}

      {sessions && (sessions.length ? (
        <div className="panel">
          {sessions.map(s => {
            const late = s.status === 'planned' && s.scheduled_date < today()
            const isToday = s.scheduled_date === today()
            return (
              <button className="row" key={s.id} onClick={() => viewSession(s, 'semana')}>
                <span className={'week-day num' + (isToday ? ' is-today' : '')}>{fmtDayShort(s.scheduled_date)}</span>
                <span className="grow">
                  <span className={'t0 week-name' + (s.status === 'skipped' ? ' is-off' : '')}>{s.session_name}</span>
                  <span className="t2 week-sub">{[TYPE_LABEL[typeOf(s)], isToday && 'hoy', s.status_note].filter(Boolean).join(' · ')}</span>
                </span>
                <Status status={s.status} late={late} />
              </button>
            )
          })}
        </div>
      ) : <div className="panel empty-state">No hay sesiones programadas esta semana.</div>)}

      {current && blk && (
        <>
          <h2 className="sec">Volumen fraccional · series efectivas</h2>
          {vol.length ? (
            <div className="panel vol">
              {vol.map(v => (
                <div className="vol-row" key={v.muscle}>
                  <span className="vol-m">{MUSCLE[v.muscle] || v.muscle}</span>
                  <Bar value={Number(v.fractional_sets)} target={v.target != null ? Number(v.target) : null} />
                  <span className="vol-v num">{fmtNum(v.fractional_sets)}{v.target != null ? ' / ' + fmtNum(v.target) : ''}</span>
                </div>
              ))}
            </div>
          ) : <p className="t2">Sin objetivos de volumen en este bloque.</p>}

          {mob && (mob.sessions_planned_to_date > 0 || mob.dose_by_zone?.length > 0) && (
            <>
              <h2 className="sec">Movilidad · <span className="num">{mob.sessions_done}</span> de <span className="num">{mob.sessions_planned_to_date}</span> sesiones</h2>
              {mob.dose_by_zone?.length > 0 && (
                <div className="panel vol">
                  {mob.dose_by_zone.map(z => (
                    <div className="vol-row" key={z.zone}>
                      <span className="vol-m">{ZONE[z.zone] || z.zone}</span>
                      <Bar value={Number(z.minutes)} target={z.target_min != null ? Number(z.target_min) : null} />
                      <span className="vol-v num">{fmtNum(z.minutes)}{z.target_min != null ? ' / ' + fmtNum(z.target_min) : ''} min</span>
                    </div>
                  ))}
                  <p className="t2 vol-note">Minutos por lado, salvo torácica.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {current && imp && (
        <>
          <h2 className="sec">Impacto · últimos 7 días</h2>
          <div className="panel">
            <div className="row"><span className="grow t0">Carrera</span><span className="num t0">{imp.runs ? `${imp.runs} ${imp.runs === 1 ? 'salida' : 'salidas'} · ${fmtNum(imp.run_km)} km · ${fmtNum(imp.run_min)} min` : 'Sin salidas'}</span></div>
            {imp.next_run_cap_km != null && <div className="row"><span className="grow t0">Tope de la próxima salida</span><span className="num t0">{fmtNum(imp.next_run_cap_km)} km</span></div>}
            <div className="row"><span className="grow t0">Sprints</span><span className="num t0">{imp.sprint_reps ?? 0} reps</span></div>
            <div className="row"><span className="grow t0">Contactos de salto</span><span className="num t0">{imp.jump_contacts ?? 0}</span></div>
            <div className="row"><span className="grow t0">Tibia (máximo en 3 días)</span>
              <span className={'num t0' + (imp.tibia_max_3d >= 5 ? ' is-err' : imp.tibia_max_3d >= 3 ? ' is-warn' : '')}>{imp.tibia_max_3d ?? 'Sin registros'}</span></div>
          </div>
        </>
      )}
    </div>
  )
}
