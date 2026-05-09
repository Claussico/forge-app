import { useState, useEffect } from 'react'
import { fetchTodayCheckin, saveCheckin } from '../lib/queries'
import { Icon } from '../components/UI'

const PAIN_ZONES = [
  'hombro_izq', 'hombro_der', 'codo_izq', 'codo_der',
  'lumbar', 'rodilla_izq', 'rodilla_der',
  'tibia_izq', 'tibia_der'
]

const ZONE_LABELS = {
  hombro_izq: 'Hombro izq', hombro_der: 'Hombro der',
  codo_izq: 'Codo izq', codo_der: 'Codo der',
  lumbar: 'Lumbar',
  rodilla_izq: 'Rodilla izq', rodilla_der: 'Rodilla der',
  tibia_izq: 'Tibia izq', tibia_der: 'Tibia der'
}

export default function CheckinScreen({ onDone }) {
  const [weight, setWeight] = useState('')
  const [sleepHours, setSleepHours] = useState('')
  const [sleepQuality, setSleepQuality] = useState(7)
  const [energy, setEnergy] = useState(7)
  const [stress, setStress] = useState(4)
  const [hunger, setHunger] = useState(5)
  const [painAreas, setPainAreas] = useState({})
  const [steps, setSteps] = useState('')
  const [notes, setNotes] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTodayCheckin().then(data => {
      if (data) {
        setExisting(data)
        setWeight(data.weight_kg || '')
        setSleepHours(data.sleep_hours || '')
        setSleepQuality(data.sleep_quality || 7)
        setEnergy(data.energy || 7)
        setStress(data.stress || 4)
        setHunger(data.hunger || 5)
        setPainAreas(data.pain_areas || {})
        setSteps(data.steps || '')
        setNotes(data.notes || '')
      }
    })
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await saveCheckin({
        weight_kg: weight ? Number(weight) : null,
        sleep_hours: sleepHours ? Number(sleepHours) : null,
        sleep_quality: Number(sleepQuality),
        energy: Number(energy),
        stress: Number(stress),
        hunger: Number(hunger),
        pain_areas: Object.keys(painAreas).length > 0 ? painAreas : null,
        steps: steps ? Number(steps) : null,
        notes: notes || null
      })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const today = new Date()
  const dateStr = today.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
    .replace('.', '').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div className="screen">
      <div className="screen-body safe-top" style={{ padding: '24px 20px 120px' }}>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>
          Check-in {existing ? '(editando)' : 'diario'}
        </div>
        <h1 className="h1" style={{ marginBottom: 18, fontWeight: 600 }}>{dateStr}</h1>

        {/* Modo rápido */}
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
          Rápido · 15s
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <NumberField label="Peso" value={weight} onChange={setWeight} unit="kg" step="0.1" />
          <div style={{ height: 1, background: 'var(--border-1)', margin: '14px 0' }} />
          <NumberField label="Sueño" value={sleepHours} onChange={setSleepHours} unit="h" step="0.5" />
          <div style={{ height: 1, background: 'var(--border-1)', margin: '14px 0' }} />
          <Slider label="Energía" value={energy} onChange={setEnergy} leftLabel="Agotado" rightLabel="Punta" />
        </div>

        {/* Más contexto */}
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="btn btn--block"
            style={{
              borderStyle: 'dashed',
              background: 'transparent',
              color: 'var(--text-3)'
            }}
          >
            + Añadir más contexto
          </button>
        ) : (
          <div className="card" style={{ padding: 16, marginTop: 14 }}>
            <Slider label="Calidad sueño" value={sleepQuality} onChange={setSleepQuality} leftLabel="Malo" rightLabel="Excelente" />
            <div style={{ height: 1, background: 'var(--border-1)', margin: '14px 0' }} />
            <Slider label="Estrés" value={stress} onChange={setStress} leftLabel="Calma" rightLabel="Alto" />
            <div style={{ height: 1, background: 'var(--border-1)', margin: '14px 0' }} />
            <Slider label="Hambre" value={hunger} onChange={setHunger} leftLabel="Saciado" rightLabel="Alto" />

            <div style={{ height: 1, background: 'var(--border-1)', margin: '14px 0' }} />
            <div>
              <label className="label" style={{ marginBottom: 10 }}>Dolor por zona</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {PAIN_ZONES.map(z => (
                  <PainZone
                    key={z}
                    label={ZONE_LABELS[z]}
                    value={painAreas[z] || 0}
                    onChange={(v) => {
                      const copy = { ...painAreas }
                      if (v === 0) delete copy[z]
                      else copy[z] = v
                      setPainAreas(copy)
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border-1)', margin: '14px 0' }} />
            <NumberField label="Pasos" value={steps} onChange={setSteps} unit="" step="100" />

            <div style={{ height: 1, background: 'var(--border-1)', margin: '14px 0' }} />
            <label className="label">Notas</label>
            <textarea
              className="field"
              style={{ minHeight: 80, fontFamily: 'var(--ff-sans)', resize: 'vertical' }}
              placeholder="Algo relevante del día"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        {error && <div style={{ color: 'var(--err)', fontSize: 12, marginTop: 12 }}>{error}</div>}
      </div>

      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        padding: '12px 20px',
        background: 'linear-gradient(to top, var(--bg-0) 70%, transparent)',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
      }}>
        <button
          className="btn btn--primary btn--block btn--lg"
          disabled={saving || (!weight && !sleepHours)}
          onClick={save}
        >
          {saving ? 'Guardando…' : existing ? 'Actualizar check-in' : 'Guardar check-in'}
        </button>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange, unit, step = 1 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <label style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>{label}</label>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 6,
        background: 'var(--bg-2)',
        border: '1px solid var(--border-0)',
        borderRadius: 'var(--r-md)',
        padding: '6px 10px',
        minWidth: 130
      }}>
        <input
          type="number"
          inputMode="decimal"
          step={step}
          className="num-input"
          style={{ width: 100, textAlign: 'right', fontSize: 22, padding: 0 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
        />
        {unit && <span style={{ color: 'var(--text-3)', fontFamily: 'var(--ff-mono)', fontSize: 12 }}>{unit}</span>}
      </div>
    </div>
  )
}

function Slider({ label, value, onChange, leftLabel, rightLabel }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>{label}</label>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 22, color: 'var(--text-0)', fontWeight: 500 }}>
          {value}
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}> /10</span>
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--accent)',
          height: 4
        }}
      />
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 6,
        fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-4)'
      }}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}

function PainZone({ label, value, onChange }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: value > 0 ? 'var(--accent-bg)' : 'var(--bg-2)',
      border: `1px solid ${value > 0 ? 'var(--accent-border)' : 'var(--border-0)'}`,
      borderRadius: 'var(--r-md)'
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min={0}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)', height: 2 }}
        />
        <span style={{
          fontFamily: 'var(--ff-mono)', fontSize: 13, minWidth: 18,
          textAlign: 'right', color: value > 0 ? 'var(--accent-hi)' : 'var(--text-3)'
        }}>
          {value}
        </span>
      </div>
    </div>
  )
}
