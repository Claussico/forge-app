// Acceso a Supabase. Lecturas directas; todas las escrituras del registro pasan por la cola
// (src/lib/queue.js) para sobrevivir a la falta de cobertura. Nada de service_role aquí.
import { supabase } from './supabase'
import { createQueue, idbOps } from './queue'
import { today } from './dates'

async function uid() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Sesión caducada: vuelve a entrar')
  return id // profile.id = auth.uid() (RLS)
}

const must = ({ data, error }) => { if (error) throw error; return data }

// ---------- Cola ----------

async function exec(kind, p) {
  if (kind === 'rpc') return must(await supabase.rpc(p.fn, p.args))
  if (kind === 'insert') return must(await supabase.from(p.table).upsert(p.row, { onConflict: 'id', ignoreDuplicates: true }))
  if (kind === 'update') return must(await supabase.from(p.table).update(p.patch).eq('id', p.id))
  if (kind === 'delete') return must(await supabase.from(p.table).delete().eq('id', p.id))
  throw new Error('Operación desconocida: ' + kind)
}

export const queue = createQueue({ store: idbOps, exec, isOnline: () => navigator.onLine })

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => queue.flush())
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queue.flush() })
  setInterval(() => { if (queue.getState().pending) queue.flush() }, 30000)
  queue.refreshCounts().then(() => queue.flush())
}

const insertQueued = async (table, row) => {
  const full = { id: crypto.randomUUID(), profile_id: await uid(), ...row }
  await queue.enqueue('insert', { table, row: full })
  return full
}

// ---------- Lecturas ----------

export const fetchBriefing = async () => must(await supabase.rpc('magnus_briefing', { p_as_of: today() }))

export async function fetchSessionsBetween(from, to) {
  return must(await supabase.from('programmed_sessions')
    .select('id, scheduled_date, session_name, session_type, status, status_note, exercises, block_week')
    .gte('scheduled_date', from).lte('scheduled_date', to)
    .order('scheduled_date').order('created_at'))
}

export const fetchSession = async id =>
  must(await supabase.from('programmed_sessions').select('*').eq('id', id).single())

// Catálogo por nombre y alias (en minúsculas). Es estático: se cachea con useData.
export async function fetchCatalog() {
  const [cat, alias] = await Promise.all([
    supabase.from('exercise_catalog').select('id, name, pattern, loading_type, laterality, load_convention, equipment, mobility_zones').eq('active', true),
    supabase.from('exercise_alias').select('alias, exercise_id')
  ])
  const byId = Object.fromEntries(must(cat).map(c => [c.id, c]))
  const byName = {}
  for (const c of Object.values(byId)) byName[c.name.toLowerCase().trim()] = c.id
  for (const a of must(alias)) byName[a.alias.toLowerCase().trim()] = a.exercise_id
  return { byId, byName }
}

export const lookup = (catalog, name) => catalog?.byId[catalog.byName[(name || '').toLowerCase().trim()]] || null

// Última vez de cada ejercicio: la sesión más reciente que lo contenga.
export async function fetchLastTimes(exerciseIds) {
  if (!exerciseIds.length) return {}
  const rows = must(await supabase.from('training_logs')
    .select('performed_date, exercise_logs!inner(exercise_id, set_number, reps, weight_kg, rpe, rpe_reliability, side)')
    .in('exercise_logs.exercise_id', exerciseIds)
    .order('performed_date', { ascending: false })
    .limit(40))
  const out = {}
  for (const tl of rows) {
    for (const id of new Set(tl.exercise_logs.map(e => e.exercise_id))) {
      if (out[id]) continue
      out[id] = { date: tl.performed_date, sets: tl.exercise_logs.filter(e => e.exercise_id === id).sort((a, b) => a.set_number - b.set_number) }
    }
  }
  return out
}

export const fetchTodayCheckin = async () => must(await supabase.from('daily_checkins')
  .select('*').eq('date', today()).order('recorded_at', { ascending: false }).limit(1).maybeSingle())

export const fetchRecentLoads = async () => must(await supabase.from('external_load')
  .select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(10))

export const fetchTestCatalog = async () => must(await supabase.from('performance_test_catalog').select('*').order('category').order('name'))

export const fetchTests = async () => must(await supabase.from('performance_tests')
  .select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200))

export const fetchLatestMeasurements = async () => must(await supabase.from('v_latest_measurements').select('*').limit(1).maybeSingle())

// ---------- Escrituras (encoladas) ----------

// Sesión completa en una transacción (spec §8). client_id se genera al empezar la sesión.
export const queueTrainingLog = payload => queue.enqueue('rpc', { fn: 'save_training_log', args: { p: payload } })

// Campos no tocados = null; nunca valores por defecto (corrección del brief §4).
export const queueCheckin = fields => insertQueued('daily_checkins', { date: today(), recorded_at: new Date().toISOString(), ...fields })

export const queueExternalLoad = row => insertQueued('external_load', row)
export const queueExternalLoadUpdate = (id, patch) => queue.enqueue('update', { table: 'external_load', id, patch })
export const queueExternalLoadDelete = id => queue.enqueue('delete', { table: 'external_load', id })

export const queueSkipSession = (id, note) =>
  queue.enqueue('update', { table: 'programmed_sessions', id, patch: { status: 'skipped', status_note: note || null } })

export const queueTests = async rows => {
  const profile_id = await uid()
  for (const r of rows) await queue.enqueue('insert', { table: 'performance_tests', row: { id: crypto.randomUUID(), profile_id, ...r } })
}

export const queueMeasurements = fields => insertQueued('body_measurements', { date: today(), recorded_at: new Date().toISOString(), ...fields })
