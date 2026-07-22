import { supabase } from './supabase'

/**
 * Fecha de HOY en zona local (YYYY-MM-DD), sin pasar por UTC.
 * toISOString() devuelve UTC y en España (UTC+1/+2) de madrugada
 * desplaza el día, guardando check-ins/logs con fecha corrida.
 */
function todayLocal() {
  const d = new Date()
  const p = n => (n < 10 ? '0' + n : '' + n)
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

/**
 * Briefing del usuario logueado. Ahora incluye últimas medidas y último reporte.
 */
export async function fetchBriefing() {
  const { data, error } = await supabase
    .from('v_forge_briefing')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Perfil del usuario.
 */
export async function fetchProfile() {
  const { data, error } = await supabase
    .from('profile')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Sesión programada para una fecha (default: hoy).
 */
export async function fetchTodaySession(date = null) {
  const targetDate = date || todayLocal()
  const { data, error } = await supabase
    .from('programmed_sessions')
    .select('*')
    .eq('scheduled_date', targetDate)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Check-in más reciente del día de hoy.
 * Ahora ordena por recorded_at desc porque permitimos múltiples por día.
 */
export async function fetchTodayCheckin() {
  const today = todayLocal()
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('date', today)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Training log existente para una fecha dada (si lo hay).
 * Devuelve null si la fecha no tiene log.
 */
export async function fetchTrainingLogByDate(date) {
  const { data, error } = await supabase
    .from('training_logs')
    .select('*')
    .eq('performed_date', date)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Series logueadas vinculadas a un training_log.
 */
export async function fetchExerciseLogsByTrainingLog(trainingLogId) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('training_log_id', trainingLogId)
    .order('exercise_name', { ascending: true })
    .order('set_number', { ascending: true })
  if (error) throw error
  return data
}

/**
 * Guarda un check-in. Cada llamada inserta una fila nueva,
 * para mantener histórico temporal con recorded_at.
 */
export async function saveCheckin(payload) {
  const profile = await fetchProfile()
  if (!profile) throw new Error('Perfil no encontrado')

  const today = todayLocal()
  const row = {
    profile_id: profile.id,
    date: today,
    recorded_at: new Date().toISOString(),
    ...payload
  }

  const { data, error } = await supabase
    .from('daily_checkins')
    .insert(row)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Guarda una sesión de entrenamiento completa: training_log + exercise_logs.
 */
export async function saveTrainingLog({ session, exercises }) {
  const profile = await fetchProfile()
  if (!profile) throw new Error('Perfil no encontrado')

  const performedDate = session.performed_date || todayLocal()

  const { data: trainingLog, error: tlErr } = await supabase
    .from('training_logs')
    .insert({
      profile_id: profile.id,
      programmed_session_id: session.programmed_session_id || null,
      performed_date: performedDate,
      recorded_at: new Date().toISOString(),
      duration_min: session.duration_min || null,
      overall_rpe: session.overall_rpe || null,
      general_feeling: session.general_feeling || null,
      pain_during: session.pain_during || null,
      notes: session.notes || null
    })
    .select()
    .single()

  if (tlErr) throw tlErr

  const rows = []
  for (const ex of exercises) {
    for (const s of ex.sets) {
      rows.push({
        training_log_id: trainingLog.id,
        exercise_name: ex.name,
        movement_pattern: ex.movement_pattern || null,
        muscle_groups: ex.muscle_groups || null,
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight_kg,
        rpe: s.rpe || null,
        rir: s.rir || null,
        notes: s.notes || null
      })
    }
  }

  if (rows.length > 0) {
    const { error: elErr } = await supabase.from('exercise_logs').insert(rows)
    if (elErr) throw elErr
  }

  return trainingLog
}

/**
 * Resumen semanal: adherencia + tendencia de peso + sesiones.
 */
export async function fetchWeekSummary() {
  const [adh, weightTrend] = await Promise.all([
    supabase.from('v_adherence_4w').select('*').order('week_start', { ascending: false }).limit(4),
    supabase.from('v_weight_trend_8w').select('*').order('date', { ascending: true })
  ])

  if (adh.error) throw adh.error
  if (weightTrend.error) throw weightTrend.error

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  const { data: sessions, error: sessErr } = await supabase
    .from('training_logs')
    .select('*')
    .gte('performed_date', sevenDaysAgoStr)
    .order('performed_date', { ascending: false })
  if (sessErr) throw sessErr

  // Contar sesiones programadas en los últimos 7 días (no hardcodear 4)
  const today = todayLocal()
  const { count: plannedCount, error: plannedErr } = await supabase
    .from('programmed_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('scheduled_date', sevenDaysAgoStr)
    .lte('scheduled_date', today)
  if (plannedErr) throw plannedErr

  return {
    adherence: adh.data,
    weightTrend: weightTrend.data,
    sessions,
    sessionsPlanned: plannedCount || 0
  }
}

/**
 * Contexto del programa activo (programa + bloque + assessment vinculados).
 * Devuelve null si no hay programa activo.
 */
export async function fetchActiveProgramContext() {
  const { data, error } = await supabase
    .from('v_active_program_context')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Histórico de un ejercicio: progresión de 1RM.
 */
export async function fetchExerciseHistory(exerciseName) {
  const { data, error } = await supabase
    .from('v_1rm_progression')
    .select('*')
    .eq('exercise_name', exerciseName)
    .order('performed_date', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}

// ============================================================
// MEDIDAS Y REPORTES
// ============================================================

/**
 * Última medición corporal registrada.
 */
export async function fetchLatestMeasurements() {
  const { data, error } = await supabase
    .from('v_latest_measurements')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Histórico de mediciones (últimas N).
 */
export async function fetchMeasurementsTrend(limit = 10) {
  const { data, error } = await supabase
    .from('v_measurements_trend')
    .select('*')
    .limit(limit)
  if (error) throw error
  return data
}

/**
 * Guarda un set de medidas corporales.
 */
export async function saveBodyMeasurements(payload) {
  const profile = await fetchProfile()
  if (!profile) throw new Error('Perfil no encontrado')

  const today = todayLocal()
  const row = {
    profile_id: profile.id,
    date: today,
    recorded_at: new Date().toISOString(),
    ...payload
  }

  // Limpiar valores vacíos: convertir "" a null
  Object.keys(row).forEach(k => {
    if (row[k] === '' || row[k] === undefined) row[k] = null
  })

  const { data, error } = await supabase
    .from('body_measurements')
    .insert(row)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Último reporte semanal.
 */
export async function fetchLatestWeeklyReport() {
  const { data, error } = await supabase
    .from('v_weekly_reports_recent')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Guarda un reporte semanal. Si payload incluye measurements con valores,
 * los guarda primero y vincula el ID al reporte.
 */
export async function saveWeeklyReport({ report, measurements }) {
  const profile = await fetchProfile()
  if (!profile) throw new Error('Perfil no encontrado')

  let measurementId = null

  if (measurements && Object.values(measurements).some(v => v !== null && v !== '' && v !== undefined)) {
    const measureRow = await saveBodyMeasurements(measurements)
    measurementId = measureRow.id
  }

  const today = todayLocal()
  const reportRow = {
    profile_id: profile.id,
    date: today,
    recorded_at: new Date().toISOString(),
    food_adherence: report.food_adherence || null,
    sleep_adherence: report.sleep_adherence || null,
    training_adherence: report.training_adherence || null,
    observations: report.observations || null,
    events: report.events || null,
    body_measurement_id: measurementId
  }

  const { data, error } = await supabase
    .from('weekly_reports')
    .insert(reportRow)
    .select()
    .single()

  if (error) throw error
  return data
}