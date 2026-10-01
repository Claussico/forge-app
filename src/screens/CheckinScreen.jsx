// Check-in diario. Lo que no se toca se envía como null (corrección del brief §4).
// Tibia siempre visible (spec §2) en dos filas de botones (fase 2, cambio 5).
import { useState } from 'react'
import { queueCheckin, fetchTodayCheckin } from '../lib/api'
import { useData } from '../lib/hooks'
import { fmtDay, today } from '../lib/dates'
import { Choice, NumField, go } from '../components/ui'
import './forms.css'

const TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const level = v => v == null ? 'none' : v >= 5 ? 'err' : v >= 3 ? 'warn' : 'none'

export default function CheckinScreen() {
  const { data: prev } = useData('checkin:' + today(), fetchTodayCheckin)
  const [f, setF] = useState({ weight_kg: null, sleep_hours: null, tibia_score: null, energy: null, sleep_quality: null, stress: null, hunger: null, steps: null, notes: null })
  const [more, setMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = k => v => setF(p => ({ ...p, [k]: v }))
  const touched = Object.values(f).some(v => v != null && v !== '')

  async function save() {
    setSaving(true); setErr('')
    try {
      await queueCheckin(f)
      go('/hoy')
    } catch (e) { setErr('No se pudo guardar en el dispositivo: ' + e.message); setSaving(false) }
  }

  return (
    <>
      <div className="body">
        <div className="head">
          <h1 className="h1">Check-in</h1>
          <div className="ctx">{fmtDay(today())} · lo que no toques se guarda vacío{prev ? ' · ya hay uno hoy; este se añade' : ''}</div>
        </div>

        <div className="two">
          <label className="field"><span className="lbl">Peso</span><NumField id="c-w" decimals unit="kg" value={f.weight_kg} onChange={set('weight_kg')} label="Peso en kg" /></label>
          <label className="field"><span className="lbl">Sueño</span><NumField id="c-s" decimals unit="h" value={f.sleep_hours} onChange={set('sleep_hours')} label="Horas de sueño" /></label>
        </div>

        <Tibia value={f.tibia_score} onChange={set('tibia_score')} />

        <div className="field"><span className="lbl">Energía <span className="hint">1–10</span></span>
          <Choice className="chips chips--5" mono clearable label="Energía" options={TEN} value={f.energy} onChange={set('energy')} />
        </div>

        <button className="btn btn--block btn--ghost" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? 'Menos campos' : 'Más campos · calidad de sueño, estrés, hambre, pasos, notas'}
        </button>
        {more && (
          <div className="stack">
            <div className="field"><span className="lbl">Calidad de sueño <span className="hint">1–10</span></span>
              <Choice className="chips chips--5" mono clearable label="Calidad de sueño" options={TEN} value={f.sleep_quality} onChange={set('sleep_quality')} /></div>
            <div className="field"><span className="lbl">Estrés <span className="hint">1–10</span></span>
              <Choice className="chips chips--5" mono clearable label="Estrés" options={TEN} value={f.stress} onChange={set('stress')} /></div>
            <div className="field"><span className="lbl">Hambre <span className="hint">1–10</span></span>
              <Choice className="chips chips--5" mono clearable label="Hambre" options={TEN} value={f.hunger} onChange={set('hunger')} /></div>
            <label className="field"><span className="lbl">Pasos</span><NumField id="c-steps" value={f.steps} onChange={set('steps')} label="Pasos" /></label>
            <label className="field"><span className="lbl">Notas</span>
              <textarea className="text-in" value={f.notes ?? ''} onChange={e => set('notes')(e.target.value || null)} placeholder="Opcional" /></label>
          </div>
        )}
        {err && <p className="err-text" role="alert">{err}</p>}
      </div>
      <div className="foot">
        <button className="btn btn--primary btn--block" disabled={!touched || saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar check-in'}</button>
      </div>
    </>
  )
}

export function Tibia({ value, onChange }) {
  const lv = level(value)
  const row = arr => arr.map(v => (
    <button key={v} className="num" aria-pressed={value === v} onClick={() => onChange(value === v ? null : v)}>{v}</button>
  ))
  return (
    <div className="tibia" data-level={lv} role="group" aria-label="Tibia de 0 a 10">
      <div className="tibia-head">
        <div><div className="t0">Tibia</div><div className="t2">Molestia en la cara interna de la tibia (0 = nada, 10 = máxima)</div></div>
        <span className="tibia-val num">{value ?? '—'}</span>
      </div>
      <div className="tibia-scale">{row([0, 1, 2, 3, 4, 5])}</div>
      <div className="tibia-scale">{row([6, 7, 8, 9, 10])}</div>
      <div className="tibia-legend"><span>0–2 normal</span><span>3–4 aviso</span><span>5 o más alerta</span></div>
    </div>
  )
}
