// Tests de rendimiento (spec §10). sided → dos filas (L y R). reps_fixed_load → ejercicio y carga.
// flow_skill → conseguido (1) o no (0), con el hito en notes.
import { useMemo, useState } from 'react'
import { fetchTestCatalog, fetchTests, fetchCatalog, fetchSession, queueTests, queueTrainingLog } from '../lib/api'
import { useData } from '../lib/hooks'
import { today, fmtRelative } from '../lib/dates'
import { Choice, NumField, fmtNum, back, go } from '../components/ui'
import './forms.css'

const CAT = { mobility: 'Movilidad', jump: 'Salto', run: 'Carrera', strength: 'Fuerza', skill: 'Habilidad' }
const UNIT = { deg: '°', cm: 'cm', m: 'm', reps: 'reps', pass: '' }
const fmtVal = (v, unit) => unit === 'pass' ? (Number(v) === 1 ? 'Conseguido' : 'No conseguido') : `${fmtNum(v)}${UNIT[unit] === '°' ? '°' : ' ' + (UNIT[unit] || unit)}`

export default function TestsScreen({ sessionId }) {
  const { data: session } = useData('session:' + (sessionId || 'none'), () => sessionId ? fetchSession(sessionId) : Promise.resolve(null), [sessionId])
  const { data: cat } = useData('test-catalog', fetchTestCatalog)
  const { data: hist, reload } = useData('tests', fetchTests)
  const { data: exCat } = useData('catalog', fetchCatalog)
  const [code, setCode] = useState(null)
  const [v, setV] = useState({ L: null, R: null, one: null, exercise_id: null, load_kg: null, notes: '' })
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const t = cat?.find(c => c.code === code)

  const latest = useMemo(() => {
    const out = {}
    for (const r of hist || []) { const k = r.test_code + (r.side || ''); if (!out[k]) out[k] = r }
    return out
  }, [hist])

  const strengthEx = useMemo(() => Object.values(exCat?.byId || {}).filter(e => !['mobility', 'flow', 'jump', 'locomotion'].includes(e.pattern)).sort((a, b) => a.name.localeCompare(b.name, 'es')), [exCat])

  const rows = !t ? [] : t.code === 'flow_skill'
    ? (v.one == null ? [] : [{ value: v.one, notes: v.notes.trim() || null }])
    : t.sided
      ? [['L', v.L], ['R', v.R]].filter(([, x]) => x != null).map(([side, value]) => ({ side, value }))
      : (v.one == null ? [] : [{ value: v.one, ...(t.code === 'reps_fixed_load' ? { exercise_id: v.exercise_id, load_kg: v.load_kg } : {}) }])
  const valid = rows.length > 0
    && (t?.code !== 'reps_fixed_load' || (v.exercise_id && v.load_kg != null))
    && (t?.code !== 'flow_skill' || v.notes.trim())

  async function save() {
    setSaving(true); setMsg('')
    try {
      await queueTests(rows.map(r => ({ date, test_code: t.code, notes: r.notes ?? (v.notes.trim() || null), ...r })))
      setMsg(`${t.name} guardado`)
      setCode(null); setV({ L: null, R: null, one: null, exercise_id: null, load_kg: null, notes: '' })
      setTimeout(reload, 800)
    } catch (e) { setMsg('No se pudo guardar en el dispositivo: ' + e.message) }
    setSaving(false)
  }

  const groups = Object.entries((cat || []).reduce((a, c) => ((a[c.category] ||= []).push(c), a), {}))

  return (
    <>
      <div className="body">
        <div className="head">
          <h1 className="h1">{t ? t.name : 'Tests'}</h1>
          {!t && <div className="ctx">Elige el test que vas a registrar.</div>}
        </div>
        {msg && <p className="ctx" role="status">{msg}</p>}
        {!t && session?.status === 'planned' && (
          <div className="panel today-card">
            <div className="t0">{session.session_name} · {fmtRelative(session.scheduled_date)}</div>
            <p className="t2">Registra los tests de la sesión y, al terminar, márcala como hecha.</p>
            <button className="btn btn--primary btn--block" onClick={async () => {
              // Como la movilidad: un training_log sin series enlazado a la sesión; el trigger la marca done.
              await queueTrainingLog({ client_id: crypto.randomUUID(), performed_date: today(), programmed_session_id: session.id, session_type: 'tests' })
              go('/hoy')
            }}>Marcar la sesión como hecha</button>
          </div>
        )}

        {!t && groups.map(([g, list]) => (
          <section key={g} className="stack" style={{ gap: 8 }}>
            <h2 className="sec">{CAT[g] || g}</h2>
            <div className="panel">
              {list.map(c => {
                const last = c.sided ? ['L', 'R'].map(s => latest[c.code + s]).filter(Boolean) : [latest[c.code]].filter(Boolean)
                return (
                  <button className="row" key={c.code} onClick={() => setCode(c.code)}>
                    <div className="grow">
                      <div className="t0">{c.name}</div>
                      <div className="t2 num">{last.length ? last.map(r => (r.side ? r.side + ' ' : '') + fmtVal(r.value, c.unit)).join(' · ') + ' · ' + fmtRelative(last[0].date) : 'Sin registros'}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        {t && (
          <>
            <div className="panel" style={{ padding: 14 }}><p className="t2" style={{ color: 'var(--text-1)' }}>{t.protocol}</p></div>
            {t.code === 'flow_skill' ? (
              <>
                <label className="field"><span className="lbl">Hito</span>
                  <input className="text-in" value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} placeholder="Por ejemplo: flow de 2 min sin pausas" /></label>
                <div className="field"><span className="lbl">Resultado</span>
                  <Choice options={[{ value: 1, label: 'Conseguido' }, { value: 0, label: 'No conseguido' }]} value={v.one} onChange={x => setV({ ...v, one: x })} clearable label="Resultado" /></div>
              </>
            ) : t.sided ? (
              <div className="two">
                <label className="field"><span className="lbl">Izquierda</span><NumField id="t-l" decimals unit={UNIT[t.unit]} value={v.L} onChange={x => setV({ ...v, L: x })} label="Izquierda" /></label>
                <label className="field"><span className="lbl">Derecha</span><NumField id="t-r" decimals unit={UNIT[t.unit]} value={v.R} onChange={x => setV({ ...v, R: x })} label="Derecha" /></label>
              </div>
            ) : (
              <label className="field"><span className="lbl">Resultado</span><NumField id="t-v" decimals={t.unit !== 'reps'} unit={UNIT[t.unit]} value={v.one} onChange={x => setV({ ...v, one: x })} label="Resultado" /></label>
            )}
            {t.code === 'reps_fixed_load' && (
              <div className="two">
                <label className="field"><span className="lbl">Ejercicio</span>
                  <select className="text-in" value={v.exercise_id || ''} onChange={e => setV({ ...v, exercise_id: e.target.value || null })}>
                    <option value="">Elegir…</option>
                    {strengthEx.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select></label>
                <label className="field"><span className="lbl">Carga</span><NumField id="t-load" decimals unit="kg" value={v.load_kg} onChange={x => setV({ ...v, load_kg: x })} label="Carga" /></label>
              </div>
            )}
            {t.code !== 'flow_skill' && (
              <label className="field"><span className="lbl">Notas <span className="hint">opcional</span></span>
                <input className="text-in" value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} /></label>
            )}
            <label className="field"><span className="lbl">Fecha</span><input className="text-in" type="date" max={today()} value={date} onChange={e => e.target.value && setDate(e.target.value)} /></label>
          </>
        )}
      </div>
      {t && (
        <div className="foot">
          <button className="btn btn--primary btn--block" disabled={!valid || saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar test'}</button>
          <button className="btn btn--ghost btn--block" onClick={() => setCode(null)}>Elegir otro test</button>
        </div>
      )}
      {!t && <div className="foot"><button className="btn btn--ghost btn--block" onClick={() => back('/registrar')}>Volver</button></div>}
    </>
  )
}
