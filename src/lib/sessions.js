// Qué se hace con cada tipo de sesión programada. Lo usan Hoy, Semana y el detalle de sesión.
import { go } from '../components/ui'

export const TYPE_LABEL = { strength: 'Fuerza', power: 'Potencia', run: 'Carrera', mobility: 'Movilidad', flow: 'Flow', tests: 'Tests', other: 'Otra' }
export const PHASE = { accumulation: 'Acumulación', intensification: 'Intensificación', realization: 'Realización', deload: 'Descarga', testing: 'Tests' }

export const typeOf = s => s.session_type || 'strength'
export const isMobility = s => ['mobility', 'flow'].includes(typeOf(s))
export const isStrength = s => ['strength', 'power'].includes(typeOf(s))

// Abre la pantalla donde se registra la sesión (de hoy o de cualquier otro día).
export function startSession(s) {
  const t = typeOf(s)
  if (t === 'mobility' || t === 'flow') go('/movilidad/' + s.id)
  else if (t === 'run' || t === 'other') go('/registrar/actividad?s=' + s.id)
  else if (t === 'tests') go('/registrar/tests?s=' + s.id)
  else go('/sesion/' + s.id)
}

export const viewSession = (s, from = 'hoy') => go(`/ver/${s.id}?f=${from}`)

export function startLabel(s, hasDraft) {
  const t = typeOf(s)
  if (hasDraft) return 'Continuar sesión'
  if (t === 'mobility' || t === 'flow') return 'Empezar movilidad'
  if (t === 'run') return 'Registrar carrera'
  if (t === 'other') return 'Registrar actividad'
  if (t === 'tests') return 'Registrar tests'
  return 'Empezar sesión'
}
