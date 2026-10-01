# Fase 2: arquitectura y pantallas clave

Aprobada por Claudio el 2026-10-01, con los cambios de la sección 3. Las maquetas navegables están en `maquetas-fase-2/index.html` (página privada: https://claude.ai/artifact/Low4KDZEy9HXEiFBLUYavd). Donde la maqueta y este documento no coincidan, manda este documento.

## 1. Navegación: A

La barra inferior tiene cuatro pestañas: **Hoy · Semana · Progreso · Registrar**. La Sesión en curso es una pantalla a pantalla completa sin barra de pestañas.

| Pantalla | Contenido |
|---|---|
| Hoy | Fecha que se puede tocar para abrir el calendario nativo (frustración 1). Debajo, el bloque, la semana y el día del bloque; los avisos (por ejemplo, una sesión pasada sin registrar); la sesión del día con su acción principal; y dos filas resumen, check-in y semana. |
| Semana | El plan de la semana del bloque con sus estados (planificada, hecha, omitida, movida), la acción "Omitir" con un motivo opcional, el volumen fraccional frente al objetivo y el impacto de los últimos 7 días. |
| Progreso | e1RM (`v_e1rm`), volumen (`v_weekly_volume_fractional`), peso con media de 7 días, carrera, contactos y tibia (desde `tibia_score`). Se diseña en la fase 3 con los datos reales. |
| Registrar | Carrera y otras actividades (`external_load`), check-in y medidas. |
| Sesión en curso | La consola de pulgar (sección 2). |

Los datos calculados (semana, volumen, topes e impacto) vienen de `magnus_briefing()` y de las vistas. El front no los recalcula.

## 2. Sesión en curso: consola de pulgar

Se eligió en la página de decisión de Impeccable (sorteo `783fe604`, estructura `consola`).

- **Arriba:** "Salir" (se guarda el borrador), el temporizador de descanso y el progreso de series.
- **En el centro:** el ejercicio y "Serie n de N", el objetivo y la última vez como referencia, las notas técnicas desplegables y un botón para ver toda la sesión en tabla.
- **Abajo, siempre igual:** carga ± (oculta si `load_convention = none`), reps ± y la rejilla de RPE de 6 a 10 en pasos de 0,5. **Pulsar un RPE registra la serie.**
- **Al registrar una serie:** vibra, arranca el descanso (que vibra al terminar) y la serie siguiente hereda la carga y las reps, nunca el RPE.
- **Etiqueta de carga:** `per_hand` muestra "kg por mano", `total` "kg totales", `added` "lastre (kg)" con un "+" delante, y `none` oculta el campo.
- **"Finalizar":** muestra "Sesión registrada · Deshacer" durante 10 s y después encola el payload de `save_training_log`. Así se resuelve la frustración 2 sin cambiar la base de datos.
- **Wake Lock** durante toda la sesión. Cola en IndexedDB con estado de sincronización visible.

## 3. Cambios exigidos antes de implementar

1. **Unilaterales:** una fila por serie, con "reps por lado". Si solo se trabaja un lado, se ofrece un selector L o R que se guarda en `side`. Nunca dos filas por serie.
2. **Saltos (`pattern = jump`):** sin RPE. El botón "Hecho" registra la serie y las reps se llaman "contactos". En `bodyweight_time`, la etiqueta es minutos o segundos.
3. **Sesión atrasada:** al registrar una sesión planificada pasada, se pregunta "¿Cuándo la hiciste?" con tres opciones: Hoy, Ayer u Otra fecha. La fecha elegida se guarda como `performed_date` en hora local.
4. **"Última vez":** solo carga × reps, sin RPE, hasta que el histórico tenga marcada la fiabilidad del RPE.
5. **Tibia:** la escala va en dos filas (0–5 y 6–10), con zonas de al menos 48 px.

## 4. Reglas que salen de la fase 1 y siguen vigentes

- El RPE nunca se precarga y se pulsa siempre.
- En el check-in, los campos que no se tocan se envían como `null`.
- Todas las fechas de registro se calculan en hora local, nunca con `toISOString`.
- Los tokens se recalibran a AA: texto de 12 px como mínimo, zonas táctiles de 48 px o más y la fuente mono reservada para las cifras.
- Modo oscuro por defecto, con modo claro disponible.
- El guardado usa `save_training_log` con un `client_id` por sesión; la cola reenvía el payload tal cual.
