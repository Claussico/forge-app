# Release 2 (puntos 1 a 4)

Aprobada por Claudio el 2026-10-02. Contenido: ver y hacer cualquier sesión de la semana, Semana, Progreso, detalle de las sesiones hechas y molestias por ejercicio. Quedan fuera el vídeo de demostración (`demo_url`) y el aviso de fin de descanso en silencio.

## Despliegue anterior, para volver atrás

| Campo | Valor |
|---|---|
| Deployment | `dpl_4PF31N3D9Lp7BTrT83LBbE57ciwF` |
| Commit | `912416d` (release 1.1, barra inferior en iOS) |

Para volver atrás: `vercel rollback dpl_4PF31N3D9Lp7BTrT83LBbE57ciwF --scope claussicos-projects`, o "Promote to Production" sobre ese deployment en el panel de Vercel. No toca la base de datos.

## Comprobado en local

Supabase local restaurado desde el dump de producción del 2026-10-02 10:41, con el Programa 3, 97 ejercicios en el catálogo y `demo_url`.

- **Semana real del 5 al 11 de octubre**, con el reloj en el lunes 5: Hoy, Semana y el detalle de las 14 sesiones se pintan bien, y las pantallas de registro de fuerza, potencia, movilidad, flow y carrera se abren con los datos correctos.
- **Sesión adelantada:** queda guardada con `performed_date` de hoy y enlazada a su `programmed_session_id`.
- **Molestias:** se guardan en `exercise_issues`.
- **Omitir:** la sesión pasa a `skipped` con su motivo.
- **Regresión de la release 1:** pasa, con la cola sin red incluida.
- **Pruebas y detector:** `npm test` 5/5 y detector de Impeccable sin hallazgos.
- **Catálogo:** `v_exercise_unmapped` vacío.

## Ajustes al programa real

- Ejercicios sin lista de series (por ejemplo, Plancha Copenhagen, con `target {sets, seconds, per_side}`): las series salen del `target`.
- Ejercicios por tiempo: se muestran como "6 × 4 min", "15 min" o "2 × 25 s por lado".
- Patrones `locomotion`, `mobility` y `flow` dentro de una sesión de fuerza o potencia: se registran con "Hecho", sin RPE, como los saltos.
- Antes del inicio del bloque, Hoy indica cuándo empieza.
- Suitcase carry: corregido en producción a `bodyweight_time` con `target {sets: 3, seconds: 35, per_side: true}` y la carga en las notas. Ya no hay metros como reps.

## Botón "Ver demostración" (2026-10-02)

Commit `33a4c94`. Enlace externo a `exercise_catalog.demo_url`, solo si es una URL https. La columna ya existe en producción.

| Campo | Valor |
|---|---|
| Deployment anterior | `dpl_2L26uJMGQsjgkGifWn5PB5r44Ay1` |
| Commit | `a6eb096` (release 2) |

Para volver atrás: `vercel rollback dpl_2L26uJMGQsjgkGifWn5PB5r44Ay1 --scope claussicos-projects`. No toca la base de datos.

## Pendiente

Fase 4 (`/polish`, `/audit` final, mediciones y `DESIGN.md`): después de la primera semana real de uso, a partir del 12 de octubre.
