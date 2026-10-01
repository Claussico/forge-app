import { useEffect, useState } from 'react'
import { useQueueState } from '../lib/hooks'
import { fmtDay } from '../lib/dates'

const I = ({ d, size = 22, sw = 1.7, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>
)
export const Icon = {
  today: p => <I {...p} d={<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />} />,
  week: p => <I {...p} d={<><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>} />,
  progress: p => <I {...p} d={<><path d="M3 20h18" /><path d="M4 16l5-5 4 3 7-8" /></>} />,
  log: p => <I {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>} />,
  chev: p => <I size={18} sw={1.8} {...p} d={<path d="M6 9l6 6 6-6" />} />,
  right: p => <I size={18} sw={1.8} {...p} d={<path d="M9 6l6 6-6 6" />} />
}

// ---------- Router por hash: #/hoy, #/sesion/<id>, #/registrar/actividad?s=<id> ----------
function parse() {
  const [path, qs] = (location.hash.slice(1) || '/hoy').split('?')
  return { parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs || '')) }
}
export function useRoute() {
  const [r, setR] = useState(parse)
  useEffect(() => {
    const on = () => setR(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}
export const go = to => { location.hash = to }
export const back = fallback => { if (history.length > 1) history.back(); else go(fallback) }

const TABS = [
  { key: 'hoy', label: 'Hoy', icon: Icon.today },
  { key: 'semana', label: 'Semana', icon: Icon.week },
  { key: 'progreso', label: 'Progreso', icon: Icon.progress },
  { key: 'registrar', label: 'Registrar', icon: Icon.log }
]
export function NavBar({ current }) {
  return (
    <nav className="nav" aria-label="Principal">
      {TABS.map(t => (
        <button key={t.key} aria-current={current === t.key ? 'page' : undefined} onClick={() => go('/' + t.key)}>
          <t.icon />{t.label}
        </button>
      ))}
    </nav>
  )
}

export function SyncBadge() {
  const q = useQueueState()
  if (q.failing) return <span className="sync sync--err" role="status"><i />{q.failing} sin guardar</span>
  if (q.pending) return <span className="sync sync--pending" role="status"><i />{q.pending} pendiente{q.pending > 1 ? 's' : ''}</span>
  return <span className="sync" role="status"><i />Todo guardado</span>
}

// Selección única con botones. clearable: volver a pulsar deja el valor en null.
export function Choice({ options, value, onChange, clearable = false, className = 'seg', label, mono = false }) {
  return (
    <div className={className} role="group" aria-label={label}>
      {options.map(o => {
        const v = typeof o === 'object' ? o.value : o
        const text = typeof o === 'object' ? o.label : String(o).replace('.', ',')
        const on = value === v
        return (
          <button key={String(v)} type="button" className={'chip' + (mono ? ' num' : '')} aria-pressed={on}
            onClick={() => onChange(on && clearable ? null : v)}>{text}</button>
        )
      })}
    </div>
  )
}

// Número con teclado numérico. Acepta coma decimal (teclado es-ES de iOS) y devuelve número o null.
export function NumField({ id, value, onChange, unit, decimals = false, placeholder = '—', label }) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','))
  useEffect(() => {
    const cur = text === '' ? null : Number(text.replace(',', '.'))
    if (cur !== value) setText(value == null ? '' : String(value).replace('.', ','))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="numin">
      <input id={id} type="text" inputMode={decimals ? 'decimal' : 'numeric'} autoComplete="off" aria-label={label}
        placeholder={placeholder} value={text}
        onChange={e => {
          const t = e.target.value.replace(/[^\d.,]/g, '')
          setText(t)
          const n = t === '' ? null : Number(t.replace(',', '.'))
          onChange(Number.isFinite(n) ? n : null)
        }} />
      {unit && <span className="unit">{unit}</span>}
    </div>
  )
}

export function Sheet({ onClose, children, label }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={label} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

// Fecha grande que abre el calendario nativo (frustración 1).
export function DateButton({ value, onChange }) {
  return (
    <label className="date-btn">
      <span>{fmtDay(value)}</span><Icon.chev />
      <input type="date" value={value} aria-label="Elegir fecha" onChange={e => e.target.value && onChange(e.target.value)} />
    </label>
  )
}

export const fmtNum = n => n == null ? '—' : String(Math.round(n * 100) / 100).replace('.', ',')

export function Status({ status, late }) {
  if (late) return <span className="st st--late"><i />Sin registrar</span>
  const map = { done: ['done', 'Hecha'], planned: ['planned', 'Planificada'], skipped: ['skipped', 'Omitida'], moved: ['moved', 'Movida'] }
  const [cls, txt] = map[status] || map.planned
  return <span className={'st st--' + cls}><i />{txt}</span>
}
