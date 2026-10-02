// Progreso: peso, e1RM, volumen, carrera, tibia y tests. Los datos salen de las vistas
// (v_weight_trend_8w, v_e1rm, v_weekly_volume_fractional) y de magnus_briefing().
import { useMemo, useState } from 'react'
import { fetchBriefing, fetchWeightTrend, fetchE1rm, fetchVolumeHistory, fetchRuns, fetchTibia, fetchTests, fetchTestCatalog } from '../lib/api'
import { useData } from '../lib/hooks'
import { today, addDays, parseISO } from '../lib/dates'
import { fmtNum } from '../components/ui'
import Chart from '../components/Chart'
import { MUSCLE } from './WeekScreen'
import './week.css'

const S1 = 'var(--series-1)', S2 = 'var(--series-2)'
const UNIT = { deg: '°', cm: 'cm', m: 'm', reps: 'reps', pass: '' }
const wk = s => parseISO(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })

function Section({ title, sub, children }) {
  return (
    <section className="prog-sec">
      <div><h2 className="prog-title">{title}</h2>{sub && <p className="t2">{sub}</p>}</div>
      {children}
    </section>
  )
}

export default function ProgressScreen() {
  const from8w = addDays(today(), -56), from30 = addDays(today(), -30)
  const { data: b } = useData('briefing', fetchBriefing)
  const { data: weight } = useData('weight', fetchWeightTrend)
  const { data: e1 } = useData('e1rm', fetchE1rm)
  const { data: vol } = useData('vol:' + from8w, () => fetchVolumeHistory(from8w))
  const { data: runs } = useData('runs:' + from8w, () => fetchRuns(from8w))
  const { data: tibia } = useData('tibia:' + from30, () => fetchTibia(from30))
  const { data: tests } = useData('tests', fetchTests)
  const { data: testCat } = useData('test-catalog', fetchTestCatalog)

  // e1RM: el mejor de cada sesión por ejercicio. Punto hueco = el RPE de ese día no es fiable.
  const e1By = useMemo(() => {
    const m = {}
    for (const r of e1 || []) {
      const ex = (m[r.exercise_id] ||= { name: r.exercise, days: {} })
      const d = ex.days[r.performed_date]
      if (!d || Number(r.e1rm_epley) > d.y) ex.days[r.performed_date] = { x: r.performed_date, y: Number(r.e1rm_epley), hollow: r.rpe_reliability !== 'reported', note: r.rpe_reliability !== 'reported' ? 'RPE no fiable' : null }
    }
    return Object.entries(m).map(([id, v]) => ({ id, name: v.name, points: Object.values(v.days).sort((a, c) => a.x.localeCompare(c.x)) }))
      .filter(x => x.points.length >= 2).sort((a, c) => c.points.at(-1).x.localeCompare(a.points.at(-1).x) || a.name.localeCompare(c.name, 'es'))
  }, [e1])
  const [exId, setExId] = useState(null)
  const ex = e1By.find(x => x.id === exId) || e1By[0]

  const muscles = useMemo(() => [...new Set((vol || []).map(v => v.muscle))].sort((a, c) => (MUSCLE[a] || a).localeCompare(MUSCLE[c] || c, 'es')), [vol])
  const [muscle, setMuscle] = useState(null)
  const mus = muscle || muscles[0]
  const volBars = (vol || []).filter(v => v.muscle === mus).map(v => ({ label: wk(v.week_start), y: Number(v.fractional_sets), title: 'Semana del ' + wk(v.week_start) }))
  const target = b?.volume_week?.find(v => v.muscle === mus)?.target

  const imp = b?.impact_7d
  const runBars = (runs || []).filter(r => r.distance_km != null).map(r => ({ label: wk(r.date), y: Number(r.distance_km), title: wk(r.date) + (r.duration_min ? ` · ${fmtNum(r.duration_min)} min` : '') }))
  const tibiaPts = (tibia || []).map(t => ({ x: t.date, y: t.tibia_score, tone: t.tibia_score >= 5 ? 'err' : t.tibia_score >= 3 ? 'warn' : null }))

  const testGroups = useMemo(() => {
    const m = {}
    for (const t of tests || []) (m[t.test_code] ||= []).push(t)
    return Object.entries(m).map(([code, rows]) => ({ code, cat: testCat?.find(c => c.code === code), rows: rows.slice().sort((a, c) => a.date.localeCompare(c.date)) })).filter(g => g.cat && g.cat.unit !== 'pass')
  }, [tests, testCat])

  return (
    <div className="body">
      <div className="head"><h1 className="h1">Progreso</h1></div>

      <Section title="Peso" sub={b?.weight?.avg_7d != null ? `Media de 7 días: ${fmtNum(b.weight.avg_7d)} kg` : 'Últimas 8 semanas'}>
        <Chart label="Peso: pesajes y media de 7 días" unit="kg" series={[
          { name: 'Media de 7 días', short: 'media', color: S1, points: (weight || []).filter(w => w.ma_7d != null).map(w => ({ x: w.date, y: Math.round(Number(w.ma_7d) * 10) / 10 })) },
          { name: 'Pesajes', color: 'var(--text-3)', line: false, points: (weight || []).map(w => ({ x: w.date, y: Number(w.weight_kg) })) }
        ]} />
      </Section>

      <Section title="e1RM" sub="Mejor estimación de cada sesión. Punto hueco: el RPE de ese día no es fiable.">
        {e1By.length ? (
          <>
            <select className="text-in" aria-label="Ejercicio" value={ex.id} onChange={e => setExId(e.target.value)}>
              {e1By.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <Chart label={'e1RM de ' + ex.name} unit="kg" series={[{ name: ex.name, color: S1, points: ex.points }]} />
          </>
        ) : <p className="t2">Hacen falta al menos dos sesiones de un ejercicio.</p>}
      </Section>

      <Section title="Volumen semanal" sub="Series efectivas fraccionales por músculo, últimas 8 semanas.">
        {muscles.length ? (
          <>
            <select className="text-in" aria-label="Músculo" value={mus} onChange={e => setMuscle(e.target.value)}>
              {muscles.map(m => <option key={m} value={m}>{MUSCLE[m] || m}</option>)}
            </select>
            <Chart label={'Volumen semanal de ' + (MUSCLE[mus] || mus)} unit="series" bars={volBars}
              refs={target != null ? [{ y: Number(target), label: 'objetivo' }] : []} />
          </>
        ) : <p className="t2">Sin series efectivas en las últimas 8 semanas.</p>}
      </Section>

      <Section title="Carrera" sub={imp ? `7 días: ${imp.runs || 0} ${imp.runs === 1 ? 'salida' : 'salidas'} · ${fmtNum(imp.run_km ?? 0)} km · ${fmtNum(imp.run_min ?? 0)} min` : null}>
        <Chart label="Distancia de cada salida" unit="km" bars={runBars}
          refs={imp?.next_run_cap_km != null ? [{ y: Number(imp.next_run_cap_km), label: 'tope' }] : []} />
        {imp && <div className="panel"><div className="row"><span className="grow t0">Contactos de salto (7 días)</span><span className="num t0">{imp.jump_contacts ?? 0}</span></div></div>}
      </Section>

      <Section title="Tibia" sub="Molestia diaria de 0 a 10, últimos 30 días.">
        <Chart label="Tibia" min0 series={[{ name: 'Tibia', color: 'var(--text-2)', line: false, points: tibiaPts }]}
          refs={[{ y: 3, label: 'aviso', tone: 'warn' }, { y: 5, label: 'alerta', tone: 'err' }]} />
      </Section>

      <Section title="Tests" sub={testGroups.length ? null : 'Sin tests registrados.'}>
        {testGroups.map(g => {
          const unit = UNIT[g.cat.unit] ?? g.cat.unit
          const mk = (side, name, color) => ({ name, short: side || undefined, color, points: g.rows.filter(r => (r.side || null) === side).map(r => ({ x: r.date, y: Number(r.value) })) })
          const series = g.cat.sided ? [mk('L', 'Izquierda', S1), mk('R', 'Derecha', S2)].filter(s => s.points.length) : [mk(null, g.cat.name, S1)]
          return (
            <div key={g.code} className="prog-test">
              <h3 className="t0">{g.cat.name} <span className="t2">{g.cat.higher_is_better ? 'más es mejor' : 'menos es mejor'}</span></h3>
              <Chart label={g.cat.name} unit={unit} series={series} />
            </div>
          )
        })}
      </Section>
    </div>
  )
}
