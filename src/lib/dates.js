// Fechas de registro SIEMPRE en hora local (YYYY-MM-DD). Nunca toISOString(): en España
// de madrugada devuelve el día anterior en UTC.

const pad = n => String(n).padStart(2, '0')

export const toLocalISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => toLocalISO()

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s, n) {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toLocalISO(d)
}

export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000)

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

// "Miércoles 1 oct"
export function fmtDay(s) {
  const d = parseISO(s)
  const wd = d.toLocaleDateString('es-ES', { weekday: 'long' })
  const mo = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
  return `${cap(wd)} ${d.getDate()} ${mo}`
}

// "X 1"
export function fmtDayShort(s) {
  const d = parseISO(s)
  return `${'DLMXJVS'[d.getDay()]} ${d.getDate()}`
}

// "hoy", "ayer", "mañana" o "lun 29 sep"
export function fmtRelative(s, ref = today()) {
  const n = daysBetween(ref, s)
  if (n === 0) return 'hoy'
  if (n === -1) return 'ayer'
  if (n === 1) return 'mañana'
  const d = parseISO(s)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
}
