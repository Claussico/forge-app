import { useState } from 'react'
import { fetchLatestMeasurements, queueMeasurements } from '../lib/api'
import { useData } from '../lib/hooks'
import { fmtRelative } from '../lib/dates'
import { NumField, fmtNum, go } from '../components/ui'

const FIELDS = [
  ['neck_cm', 'Cuello'], ['shoulders_cm', 'Hombros'], ['chest_cm', 'Pecho'], ['waist_cm', 'Cintura'], ['hips_cm', 'Cadera'],
  ['arm_left_cm', 'Brazo izq'], ['arm_right_cm', 'Brazo der'], ['forearm_left_cm', 'Antebrazo izq'], ['forearm_right_cm', 'Antebrazo der'],
  ['thigh_left_cm', 'Muslo izq'], ['thigh_right_cm', 'Muslo der'], ['calf_left_cm', 'Pantorrilla izq'], ['calf_right_cm', 'Pantorrilla der']
]

export default function MeasurementsScreen() {
  const { data: last } = useData('measurements:last', fetchLatestMeasurements)
  const [m, setM] = useState({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const any = Object.values(m).some(v => v != null)

  async function save() {
    setSaving(true); setErr('')
    try {
      await queueMeasurements({ ...Object.fromEntries(Object.entries(m).filter(([, v]) => v != null)), notes: notes.trim() || null })
      go('/registrar')
    } catch (e) { setErr('No se pudo guardar en el dispositivo: ' + e.message); setSaving(false) }
  }

  return (
    <>
      <div className="body">
        <div className="head">
          <h1 className="h1">Medidas</h1>
          <div className="ctx">{last ? `Últimas: ${fmtRelative(last.date)}` : 'Sin mediciones previas'} · solo se guardan las que rellenes</div>
        </div>
        <div className="panel">
          {FIELDS.map(([k, label]) => (
            <div className="row" key={k}>
              <label className="grow" htmlFor={'m-' + k}>
                <div className="t0">{label}</div>
                {last?.[k] != null && <div className="t2 num">últ. {fmtNum(last[k])} cm</div>}
              </label>
              <div style={{ width: 130 }}><NumField id={'m-' + k} decimals unit="cm" value={m[k] ?? null} onChange={v => setM(p => ({ ...p, [k]: v }))} label={label} /></div>
            </div>
          ))}
        </div>
        <label className="field"><span className="lbl">Notas <span className="hint">opcional</span></span>
          <textarea className="text-in" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Hora, en ayunas, después de entrenar…" /></label>
        {err && <p className="err-text" role="alert">{err}</p>}
      </div>
      <div className="foot"><button className="btn btn--primary btn--block" disabled={!any || saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar medidas'}</button></div>
    </>
  )
}
