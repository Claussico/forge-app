# FORGE — Cambios del front (pasos 5–7 del refactor)

Especificación para ejecutar en el repo `forge-app` con Claude Code. La base de datos ya está preparada (migraciones aplicadas el 2026-09-30). Este documento describe qué ha cambiado y qué tiene que hacer la PWA.

## 0. Contexto que no hay que romper

- El front escribe siempre como usuario autenticado (rol `authenticated`), con la clave anon y la sesión del usuario. **No uses nunca la clave `service_role` en el cliente.**
- La base de datos tiene guardas que bloquean escrituras del rol `postgres` en las tablas de input del front. No afectan al front, pero explican por qué las correcciones manuales en el Table Editor de Supabase fallan: se hacen por SQL con `select set_config('forge.maintenance','on',true);` en la misma transacción.
- Varios triggers trabajan solos. **No repliques su lógica en el front**:
  - `exercise_logs.exercise_id` se rellena a partir de `exercise_name`.
  - `programmed_sessions.status` pasa a `done` al insertar un `training_logs` o un `external_load` con `programmed_session_id`.

## 1. Registro de carrera y otras actividades (`external_load`) — imprescindible

Tabla nueva. Formulario para registrar una actividad fuera de las sesiones de fuerza.

| Campo | Tipo | Obligatorio | Validación (igual que en la BD) | UI |
|---|---|---|---|---|
| `date` | date | Sí | — | Por defecto, hoy |
| `activity` | text | Sí | `run`, `sprint`, `court`, `plyometrics`, `other` | Selector: Carrera, Sprint, Pista, Pliometría, Otra |
| `duration_min` | numeric | No | ≥ 0 | Minutos |
| `distance_km` | numeric | No* | ≥ 0 | km con 2 decimales. *Para `run`, pedirla siempre: la regla del 10 % depende de ella |
| `avg_hr` | integer | No | 30–230 | Pulso medio (del reloj o la banda) |
| `rpe` | numeric | No | 0–10 | Selector de 0 a 10 |
| `surface` | text | No | `grass`, `track`, `treadmill`, `asphalt`, `dirt`, `sand`, `indoor`, `other` | Césped, Pista, Cinta, Asfalto, Tierra, Arena, Interior, Otra |
| `reps` | integer | No | ≥ 0 | Repeticiones de sprint o intervalos |
| `jump_contacts` | integer | No | ≥ 0 | Solo para pliometría fuera de las sesiones de fuerza |
| `programmed_session_id` | uuid | No | FK a `programmed_sessions` | Selector con las sesiones `planned` de hoy y de ayer. Si se elige, el trigger marca la sesión como `done` |
| `notes` | text | No | — | Texto libre |

- `profile_id` = id del usuario autenticado (RLS: `profile_id = auth.uid()`).
- Listado de las actividades recientes con edición y borrado.

## 2. Tibia en el check-in diario — imprescindible

- Columna nueva `daily_checkins.tibia_score` (smallint, 0–10, admite null).
- Deslizador de 0 a 10 con el texto: "Molestia en la cara interna de la tibia (0 = nada, 10 = máxima)".
- Que no sea obligatorio, pero que aparezca siempre visible en el check-in.

## 3. Plan semanal — imprescindible

- Vista de la semana en curso del bloque: `programmed_sessions` entre las fechas de la semana, ordenadas por fecha, con `session_name` y un indicador de `status` (`planned`, `done`, `skipped`, `moved`) y `status_note` si existe.
- Semana y fechas: `current_state.current_block_week` (lo sincroniza un job diario) y `program_blocks.start_date` del bloque activo. Ventana de la semana N: de `start_date + 7·(N−1)` a `start_date + 7·N − 1`.
- Acción "Omitir" sobre una sesión `planned`: `status = 'skipped'` y `status_note` con un motivo opcional.
- **El front no marca `done`**: lo hace el trigger al registrar la sesión.
- Sesiones de carrera (`session_name` "Carrera"): muestran `execution_notes` y la duración objetivo. Al pulsarlas se abre el formulario del punto 1 con `programmed_session_id` rellenado.

## 4. Selector de ejercicios del catálogo — recomendado

- Tablas de solo lectura para el front: `exercise_catalog`, `exercise_alias`, `exercise_muscle_contribution`.
- Al añadir un ejercicio no planificado, elegir de `exercise_catalog` (filtrable por `pattern` y `equipment`) y escribir `exercise_name` con el `name` exacto del catálogo. El trigger rellena `exercise_id`.
- Etiqueta del campo de peso según `load_convention`:
  - `per_hand` → "kg por mano";
  - `total` → "kg totales";
  - `added` → "lastre (kg)";
  - `none` → ocultar el peso.

## 5. Compatibilidad con valores nuevos — comprobar

- `pattern` admite `jump` y `locomotion` además de los valores anteriores.
- `muscle_groups` puede contener `core` y puede venir vacío (`[]`) en saltos y carrera.
- `loading_type` `bodyweight_time`: `reps` son minutos.
- En ejercicios `bw`, el peso puede ir vacío o a 0 sin que la interfaz lo trate como error.
- Saltos: se registran como `exercise_logs` con `reps` = contactos por serie y sin peso.

## 6. RPE en las series efectivas — recomendado

Las vistas de volumen solo cuentan series con RPE ≥ 6 o RIR ≤ 4. Una serie efectiva registrada sin RPE no cuenta. Que el RPE sea obligatorio en las series que no sean de calentamiento o calibración.

## 7. Copia de seguridad — tarea puntual

Haz un `pg_dump` de la base de datos de producción y guárdalo **fuera del repo**:

- Esquemas `public`, `forge_sys`, `snap_20260930` y `supabase_migrations`, en formato custom (`-Fc`) y con `--no-owner`.
- Conexión: la cadena "Session pooler" del botón Connect del dashboard. Necesita pg_dump 17 o superior.

## 8. Guardado atómico de la sesión (`save_training_log`) — imprescindible (fase 3)

Sustituye al `saveTrainingLog` actual de `src/lib/queries.js`, que inserta el `training_log` y las series por separado y puede dejar una sesión sin series. La RPC guarda la sesión, sus series y sus molestias en una sola transacción: o se guarda todo o no se guarda nada.

```js
const { data, error } = await supabase.rpc('save_training_log', { p: payload });
// data = { training_log_id, duplicate, sets_saved, issues_saved }
```

Payload:

```json
{
  "client_id": "uuid generado en el dispositivo al empezar la sesión",
  "performed_date": "2026-10-05",
  "programmed_session_id": "uuid | null",
  "duration_min": 62,
  "overall_rpe": 7.5,
  "general_feeling": 8,
  "pain_during": null,
  "notes": "texto libre",
  "sets": [
    { "exercise_name": "Sentadilla búlgara", "exercise_id": null, "set_number": 1, "reps": 8,
      "weight_kg": 22.5, "rpe": 8, "rir": null, "side": null, "is_calibration": false,
      "to_failure": false, "notes": null }
  ],
  "issues": [
    { "exercise_name": "Sentadilla búlgara", "zone": "rodilla", "intensity": 1 }
  ]
}
```

- **`client_id`**: se genera una vez por sesión (`crypto.randomUUID()`) y se guarda con el borrador. Si el envío se reintenta con el mismo `client_id`, la RPC devuelve la sesión ya guardada con `duplicate: true` y no crea otra. Es lo que hace segura la cola sin conexión: se puede reenviar sin miedo a duplicar.
- **`exercise_id`, `movement_pattern` y `muscle_groups`**: opcionales. Si no se envían, la base de datos los rellena a partir del nombre y del catálogo.
- **Obligatorios**: `performed_date` en fecha local (no `toISOString`), y en cada serie `exercise_name`, `set_number` y `reps`. Si falta algo, la RPC devuelve error y no guarda nada.
- **`issues`**: `intensity` de 1 a 3.
- **Sesión programada**: si se envía `programmed_session_id`, la sesión pasa a `done` automáticamente.
- **Cola sin conexión**: guarda el payload completo en IndexedDB y reenvíalo tal cual al recuperar la conexión, hasta recibir respuesta sin error.

## 9. Tipos de sesión y movilidad guiada — imprescindible (fase 3)

- `programmed_sessions.session_type`: `strength`, `power`, `run`, `mobility`, `flow`, `tests` u `other`.
- **Sesiones `mobility` y `flow`**: reproductor guiado.
  - Cada ejercicio trae en `target` `{"sets": n, "seconds": n, "per_side": true|false}`. `seconds` es la duración de cada serie en cada lado. Con `per_side: true`, el reproductor cronometra primero un lado y luego el otro en cada serie.
  - Un temporizador por estiramiento, con vibración al cambiar de lado y de ejercicio.
  - La dosis por zona del briefing (`mobility_week.dose_by_zone[].minutes`) es **por músculo estirado**, no tiempo de sesión: 2 × 60 s por lado son 2 minutos para cada isquio, aunque la sesión dure 4. Muéstrala así ("min por lado" cuando la zona es bilateral) y compárala con `target_min`, que está en la misma unidad.
  - Los ejercicios con `reps` en lugar de `seconds` (elevaciones de tibial o de sóleo) se muestran como contador.
- **Registro**: un solo botón "Hecha", más una nota opcional. Se guarda con `save_training_log` sin series:
  `{ "client_id", "performed_date", "programmed_session_id", "session_type": "mobility", "notes" }`.
  No se registra nada por ejercicio: la base de datos calcula la dosis a partir de lo prescrito.
- **Separación de la fuerza**: estas sesiones no cuentan como sesiones de fuerza en Hoy ni en Semana. El briefing ya las separa (`mobility_week`).

## 10. Tests de rendimiento (`performance_tests`) — imprescindible (fase 3)

- Catálogo de solo lectura: `performance_test_catalog`, con `code`, `name`, `category`, `unit`, `higher_is_better`, `sided` y `protocol`.
- **Pantalla de tests** dentro de Registrar:
  - Elegir el test y mostrar su `protocol`.
  - Introducir `value`. Si `sided` es true, pedir izquierda y derecha; son dos filas con `side` `L` y `R`.
  - `reps_fixed_load`: además, el ejercicio del catálogo (`exercise_id`) y la carga (`load_kg`).
  - `flow_skill`: conseguido o no conseguido (1/0), con el hito en `notes`.
- **Progreso**: evolución de cada test en el tiempo, por lado cuando aplique.

## 11. Convenciones de la consola de sesión — imprescindible (fase 3)

- **Unilaterales** (`laterality = unilateral`): una fila por serie con la etiqueta "reps por lado". Si solo se trabaja un lado, selector de lado (L o R) en `side`. Nunca dos filas por serie: duplicaría el volumen.
- **Saltos** (`pattern = jump`): sin RPE. El botón "Hecho" registra la serie, las reps se llaman "contactos" y no hay campo de peso.
- **`bodyweight_time`**: la etiqueta es minutos o segundos.
- **RPE**: nunca se precarga ni se guarda por defecto. Si no se pulsa, va como `null`. La RPC marca la fiabilidad sola: `reported` si hay RPE.
- **"Última vez"**: muestra el RPE solo si `exercise_logs.rpe_reliability = 'reported'`. En el resto de casos, solo carga × reps.
- **Sesión atrasada**: al registrar una sesión planificada pasada, preguntar "¿Cuándo la hiciste?" (Hoy, Ayer u Otra fecha) y guardarla como `performed_date`, en hora local.

## 12. Sesiones de tests — imprescindible (release 2)

- Una sesión programada con `session_type = 'tests'` abre la pantalla de tests (apartado 10) con la sesión enlazada.
- Los resultados se guardan en `performance_tests`, que no tiene enlace con `programmed_sessions`. Para que la sesión pase a `done`, el botón "Marcar la sesión como hecha" guarda un `training_log` sin series con `save_training_log`:
  `{ "client_id", "performed_date", "programmed_session_id", "session_type": "tests" }`.
  El trigger marca la sesión como `done`, igual que en movilidad (apartado 9).
- Estas sesiones no cuentan como sesiones de fuerza.

## Pruebas de aceptación

Ejecutar en el SQL editor después de probar cada función en la app:

```sql
-- 1 y 3: la carrera registrada con sesión enlazada marca la sesión como done
select el.date, el.activity, el.distance_km, ps.session_name, ps.status
from external_load el left join programmed_sessions ps on ps.id = el.programmed_session_id
order by el.created_at desc limit 5;

-- 2: tibia en el check-in
select date, tibia_score from daily_checkins order by date desc limit 5;

-- 4: ningún nombre registrado fuera del catálogo
select * from v_exercise_unmapped;

-- Briefing: el impacto y la tibia aparecen
select magnus_briefing()->'impact_7d';
```
