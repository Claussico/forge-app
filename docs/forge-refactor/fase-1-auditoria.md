# Fase 1: auditoría de la app actual

Rama `refactor/fase-1-auditoria`, base `main@340f40c`. No se ha cambiado código. **Aprobado por Claudio el 2026-10-01.**

Estado:

- [x] Inventario de pantallas y flujos
- [x] `/audit` técnico: código, build, contrastes y medición de zonas táctiles en el navegador
- [x] Medición de las tareas del brief, sección 2: conteo de toques
- [x] Capturas a 390 × 844 contra staging local, que es una copia exacta de producción (`capturas-fase-1/`)
- [x] `/critique` con dos evaluaciones aisladas: A, revisión de diseño, y B, detector en el navegador
- [ ] Tiempos reales en el iPhone. Los hace Claudio con el protocolo de la sección 4.

---

## 0. Resumen para revisar: hallazgos priorizados

**Notas:** `/audit` técnico 10/20 (aceptable); `/critique` heurístico 17/40 (pobre).

El aspecto visual tiene criterio y encaja con el producto. Lo que falla es todo lo demás: la sesión en curso no cumple los requisitos de la sección 4 del brief y hay varios valores por defecto que se guardan como datos reales.

| # | Prioridad | Hallazgo | Fuentes | Se resuelve en |
|---|---|---|---|---|
| 1 | P0 | El registro no está protegido. El guardado no es atómico, no hay cola sin conexión, los errores salen en `alert()` y, si falla a medias, queda una sesión bloqueada y vacía con el borrador inalcanzable. | Auditoría y A | Fase 3: `save_training_log`, cola en IndexedDB e indicador de sincronización |
| 2 | P0 | Valores por defecto que se guardan como datos reales: el RPE objetivo como RPE real, y la calidad de sueño, el estrés y el hambre se envían siempre aunque no se abra el panel. **Confirmado en producción por Claudio: 228 de 341 series comparables (67 %) tienen el RPE real igual al objetivo.** El histórico de RPE no es fiable y se marcará desde el Project de desarrollo. | Auditoría, A y datos de producción | Fase 3: el RPE nunca se precarga y se pulsa siempre; los campos no tocados del check-in se envían como `null` (corrección al brief, sección 4) |
| 3 | P0 | No se puede registrar carrera ni otras actividades (`external_load`). | Auditoría y A | Fase 3: especificación, apartado 1 |
| 4 | P1 | La sesión en curso no cumple la sección 4 del brief: no hay temporizador, ni Wake Lock, ni herencia entre series, ni botones de RPE, ni etiqueta por `load_convention`, ni notas técnicas. La tab bar sigue visible durante la sesión. | A y auditoría | Fase 2: boceto; fase 3 |
| 5 | P1 | La arquitectura de información no responde a "qué toca hoy y cómo va la semana". Semana son los últimos 7 días y no el plan del bloque, no hay "Omitir", "Reporte" son medidas y sin bloque activo se lee "SEMANA ? · BLOQUE ?". | A y auditoría | Fase 2 |
| 6 | P1 | Tibia: falta `tibia_score` siempre visible. Hoy está en dos sliders de 2 px dentro de "más contexto" y pintada con el verde de éxito. | A y especificación, apartado 2 | Fase 3 |
| 7 | P1 | Contraste: `--text-3` da entre 2,8 y 3,2:1 y `--text-4` entre 1,8 y 1,9:1. En el navegador fallan 74 de 75 textos medidos con esos dos grises. | Auditoría, B y A | Fase 3: tokens; fase 4: pulido |
| 8 | P1 | Texto de menos de 12 px: 79 elementos en las 4 vistas, con muchas etiquetas de 9 px. Zonas táctiles pequeñas: check de 32 px, flechas de 30 × 22, "IR A HOY" de 47 × 15 y sliders de 2 px de alto. Además, `user-scalable=no`. | B, capturas y auditoría | Fase 3 |
| 9 | P1 | "Finalizar" es irreversible: no se puede corregir una serie mal registrada. | A y auditoría | Fase 2: decidir si la sesión se puede reabrir o si cada serie se sincroniza al confirmarla |
| 10 | P2 | El front recalcula métricas (peso medio, adherencia y días de programa) y adivina la carga con `BW_KEYWORDS`. Además, `fetchWeekSummary` calcula en UTC. | Auditoría y A | Fase 3: datos de `magnus_briefing()`, de las vistas y del catálogo |
| 11 | P2 | Sin caché de datos ni fuentes disponibles sin conexión: cada cambio de pestaña muestra "Cargando…" y, sin red, la app cae a la fuente del sistema. | Auditoría | Fase 3 |
| 12 | P2 | Modo claro inexistente. Hay tres formatos de fecha distintos y el H1 de Check-in y Medidas es la fecha, no la tarea. | A y auditoría | Fase 3 y fase 4 |

**Frustraciones de Claudio** (2026-10-01):

1. No puede tocar la fecha de arriba para abrir un calendario y moverse por las sesiones con agilidad; solo hay flechas día a día.
2. Si pulsa "loggear sesión" sin querer, no hay vuelta atrás para liberarla. Propone una doble confirmación. Hoy ya hay una hoja de confirmación, pero cierra la sesión en solo lectura de forma irreversible (ver el hallazgo 9).

**Lo que hay que conservar:**

- Lo prescrito precargado y confirmable con 1 toque.
- Las cifras tabulares de 28 px.
- El borrador en `localStorage`.
- Las fechas locales en `todayLocal()`.
- La paleta sobria con un único acento.
- El copy técnico, sin mensajes motivacionales.

**Preguntas de diseño para la fase 2**, salidas de la evaluación A:

1. ¿La sesión en curso debería ser una sola serie a pantalla completa, la siguiente, con la tabla como vista secundaria?
2. ¿Y si cada serie se encola al confirmarla? Entonces "Finalizar" deja de ser un momento de riesgo y puede ser reversible.
3. ¿Hoy debería ser la semana, con una tira de 7 días y la sesión del día desplegada, y la pestaña Semana pasar a ser Progreso?

---

## 1. Inventario de pantallas y flujos

La navegación es un `useState` en `App.jsx`, sin router, con cuatro pestañas en una barra inferior.

| Pantalla | Archivo | Lee | Escribe |
|---|---|---|---|
| Login | `LoginScreen.jsx` | — | Auth con email y contraseña |
| Hoy | `HomeScreen.jsx` (956 líneas) | `v_forge_briefing`, `programmed_sessions` (por fecha), `daily_checkins`, `training_logs`, `exercise_logs` | `training_logs` y después `exercise_logs`, en dos inserts separados |
| Check-in | `CheckinScreen.jsx` | `daily_checkins` de hoy | `daily_checkins` (un insert nuevo cada vez) |
| Reporte | `ReportScreen.jsx` | `v_latest_measurements` | `body_measurements` |
| Semana | `WeekScreen.jsx` | `v_adherence_4w`, `v_weight_trend_8w`, `training_logs`, `programmed_sessions` (conteo), `v_forge_briefing`, `v_active_program_context` | — |

Flujos:

- **Registrar sesión** (Hoy):
  1. Se navega por fechas con flechas: hasta 14 días hacia delante y sin límite hacia atrás.
  2. Las tarjetas de ejercicio son un acordeón y solo hay una abierta a la vez.
  3. Cada serie tiene tres inputs numéricos (kg, reps, RPE) y un check.
  4. El botón "Finalizar sesión" abre una hoja de confirmación.
  5. Al confirmar, los datos se guardan y la sesión pasa a solo lectura, sin forma de volver a editarla.
  6. Mientras tanto, el borrador se guarda en `localStorage` por fecha.
- **Check-in:** el modo rápido pide peso, sueño y energía. "+ Añadir más contexto" despliega calidad de sueño, estrés, hambre, 9 zonas de dolor con slider de 0 a 10, pasos y notas. Si ya había un check-in ese día, se inserta otra fila; el botón dice "Actualizar", pero no actualiza nada.
- **Reporte:** 13 perímetros y notas.
- **Semana:** métricas de los últimos 7 días (adherencia, peso medio, RPE medio y sesiones), gráfica de peso, lista de sesiones y enlace "Pedir análisis a Magnus", que abre claude.ai con un prompt.

Lo que falta frente al brief y la especificación:

- No se puede registrar carrera ni otras actividades: el front no usa `external_load`.
- No hay vista de Progreso: ni e1RM, ni volumen fraccional, ni contactos, ni tibia como métrica.
- No hay plan de la semana del bloque con estados ni opción de omitir o mover.
- Durante la sesión no hay temporizador de descanso, Wake Lock ni cola sin conexión.
- `load_convention` no se usa: la columna siempre dice "Kg" y el tipo de carga se adivina por palabras clave del nombre (`BW_KEYWORDS`).

Código muerto en `queries.js`: `saveWeeklyReport`, `fetchLatestWeeklyReport`, `fetchMeasurementsTrend` y `fetchExerciseHistory` no se usan desde ninguna pantalla. El README describe un login por magic link y un "reporte completo" que ya no existen.

---

## 2. Tareas del brief (sección 2): estado actual

He contado los toques recorriendo el código. Los tiempos son estimaciones con el modelo de pulsaciones (KLM) y hay que confirmarlos en el iPhone.

| Tarea | Objetivo | Hoy | Veredicto |
|---|---|---|---|
| Serie igual a lo prescrito | 1–2 toques | **1 toque** (check). Cambiar de ejercicio suma otro toque para abrir la tarjeta siguiente. Cerrar la sesión cuesta 2 toques más (Finalizar y Confirmar). | ✅ en el toque, pero ver P0-2 |
| Serie que difiere (peso, reps o RPE) | ≤ 5 toques, sin teclado alfanumérico | Cambiar el peso de 60 a 62,5: tocar el campo, borrar 2 caracteres, teclear 4 y marcar el check. **Unos 8 toques** con teclado decimal. Cambiar el peso y el RPE: **unos 13**. | ❌ |
| Check-in diario | < 30 s | Rápido: entrar en la pestaña, peso (tocar y teclear ~4), sueño (tocar y teclear 1–3), arrastrar el slider de energía y guardar. **Unos 11 toques, 15–20 s estimados.** Con dolor de tibia hay que desplegar y arrastrar dos sliders entre 9 zonas: **más de 30 s**. | ⚠️ solo el rápido |
| Salida de carrera | < 30 s | **Imposible**: no hay formulario. | ❌ |
| Hoy y la semana en una pantalla | 1 pantalla, sin scroll | Hoy no enseña nada de la semana. Semana muestra los últimos 7 días móviles, no la semana del bloque, y está en otra pestaña. | ❌ |

---

## 3. Auditoría técnica (`/audit`)

### Puntuación

| # | Dimensión | Nota | Hallazgo clave |
|---|---|---|---|
| 1 | Accesibilidad | 1 | `user-scalable=no`; `--text-3` y `--text-4` no llegan a AA y se usan en 53 sitios; los inputs de las series no tienen nombre accesible |
| 2 | Rendimiento | 3 | Bundle de 110 KB en gzip, correcto. Cada cambio de pestaña vuelve a pedir todo, sin caché de datos. |
| 3 | Responsive | 2 | Solo móvil, que es el objetivo, pero con zonas táctiles de 24–32 px en los controles críticos y el zoom bloqueado |
| 4 | Theming | 2 | Hay tokens y se usan, pero no hay modo claro, y los estilos inline duplicados (cerca de 50 bloques de "micro-etiqueta mono") hacen el sistema difícil de mantener |
| 5 | Integridad de implementación | 2 | El front recalcula métricas que deberían venir de la base de datos y precarga el RPE objetivo como si fuera el real |
| **Total** | | **10/20** | **Aceptable: hace falta trabajo significativo** |

### Veredicto de integridad

**No pasa.** La estética es propia: IBM Plex, verde industrial y densidad de herramienta, y encaja con el producto. Lo que falla es el sistema. Todo son estilos inline sin componentes compartidos, y varios valores por defecto convierten un toque rápido en un dato falso (P0-2 y P1-5). El detector de Impeccable devuelve 0 hallazgos. Es un **falso negativo**: el detector apenas analiza los estilos inline en JSX, que es donde vive el 95 % del estilo de esta app.

### P0: bloquean la tarea o comprometen los datos

**P0-1. La sesión no se guarda sin cobertura y el guardado no es atómico.**

- **Dónde:** `HomeScreen.finishSession` y `queries.saveTrainingLog`.
- **Qué pasa:**
  - Todo se envía de golpe al final. Sin conexión, sale un `alert('Error al guardar')` y el borrador sigue en `localStorage`. No se pierde, pero no hay ni cola ni reintento.
  - Si el insert de `training_logs` va bien y el de `exercise_logs` falla, queda un log vacío. Al recargar, la fecha aparece como "Sesión registrada" sin series, el borrador ya no se muestra y **las series se pierden en la práctica**.
- **Solución:** la RPC `save_training_log`, ya creada en producción (especificación, apartado 8). Hace el guardado atómico y es idempotente por `client_id`. Encima, una cola en IndexedDB que reenvía el payload tal cual (fase 3).

**P0-2. El RPE objetivo se registra como RPE real.**

- **Dónde:** `HomeScreen.loadDateData` precarga `rpe: st.rpe ?? ex.target?.rpe`.
- **Qué pasa:** con un solo toque en el check se guarda el RPE prescrito aunque no se haya evaluado. Contamina justo la variable que filtra el volumen efectivo.
- **Solución:** precargar la carga y las reps, pero exigir que el RPE se elija explícitamente en las series efectivas (brief, sección 4).

**P0-3. No se puede registrar carrera ni otras actividades.**

- **Qué pasa:** falta la tarea entera; `external_load` no aparece en el front.

### P1: dificultad seria o incumplimiento de WCAG AA

**P1-1. El zoom está bloqueado.**

- **Dónde:** en `index.html`, `user-scalable=no`.
- **Norma:** WCAG 1.4.4.
- **Solución:** quitarlo. El zoom al enfocar un input se evita con `font-size ≥ 16px` en los inputs.

**P1-2. Contraste insuficiente.**

- **Qué pasa:**
  - `--text-3` (#5c6269) da entre 2,8 y 3,2:1 sobre los fondos y se usa en 39 sitios, casi todos texto de 9 a 11 px.
  - `--text-4` (#3d4148) da entre 1,7 y 1,9:1 y se usa en 14 sitios: unidades, cabeceras de columna y "últ: xx cm".
  - El botón primario deshabilitado queda en 2,0:1.
- **Norma:** WCAG 1.4.3.
- **Solución:** recalibrar los grises.

**P1-3. Zonas táctiles pequeñas en los controles de la sesión.**

- **Dónde:**
  - El check de la serie mide 32 × 32 px.
  - Las flechas de fecha miden unos 24 × 24 px.
  - "IR A HOY" es texto de 9 px con 2 px de padding.
  - Los inputs de las series miden unos 44 px de alto.
- **Norma:** el brief pide 48 px o más.

**P1-4. Controles sin nombre accesible.**

- **Dónde:** los inputs de kg, reps y RPE de cada serie, el check (`SetRow`) y los inputs de las medidas. El `<label>` de `NumberField` no está asociado a su input.
- **Dato:** solo hay 2 `aria-label` en toda la app.

**P1-5. Los valores por defecto del check-in se registran como datos.**

- **Dónde:** los sliders arrancan en energía 7, calidad de sueño 7, estrés 4 y hambre 5.
- **Qué pasa:** se guardan aunque no se hayan tocado. El dolor de tibia está enterrado en "más contexto", repartido en dos zonas (`pain_areas.tibia_izq` y `tibia_der`), y la información solo existe si se abre esa sección. La especificación, en su apartado 2, pide `tibia_score` siempre visible. Hay que decidir si el histórico de `pain_areas.tibia_*` se sigue enseñando.

**P1-6. El RPE se escribe con teclado.**

- **Qué pasa:** es un `<input type=number step=0.5>`. El brief pide botones de 6 a 10 en pasos de 0,5.
- **Posible fallo a comprobar en el iPhone:** en un iPhone en español, `inputMode="decimal"` saca la coma. Hay que comprobar que Safari la acepta en `type=number` y no deja el valor vacío.

**P1-7. El front recalcula métricas.**

- **Dónde:** en `WeekScreen`:
  - el peso medio, que es la media de los últimos 7 puntos de `v_weight_trend_8w`;
  - la adherencia, que cuenta en el cliente las sesiones programadas de los últimos 7 días;
  - el progreso del programa, con días transcurridos y totales.
- **Qué pasa:** el brief lo prohíbe; estos datos tienen que venir de `magnus_briefing()` y de las vistas.
- **Fecha en UTC:** además, `fetchWeekSummary` calcula "hace 7 días" con `toISOString()`, es decir, en UTC. Queda anotado para la fase 3: todas las fechas de registro se calculan en hora local.

### P2: molestias con alternativa

**P2-1. Sin caché de datos.**

- **Qué pasa:**
  - Cada cambio de pestaña monta la pantalla desde cero y enseña "Cargando…".
  - Con mala cobertura, Semana y Check-in se quedan en blanco o con error.
  - `fetchProfile()` hace una petición extra antes de cada escritura.

**P2-2. Las fuentes no funcionan sin conexión.**

- **Qué pasa:** IBM Plex se carga desde Google Fonts y el service worker no la precachea (tiene 8 entradas, todas del build). Sin red, la app cae a la fuente del sistema y las cifras dejan de ser tabulares.

**P2-3. Acordeón de un solo ejercicio.**

- **Qué pasa:** al terminar un ejercicio hay que tocar la cabecera del siguiente, porque no avanza solo.

**P2-4. La sesión cerrada no se puede corregir.**

- **Qué pasa:** después de "Finalizar" no hay forma de corregir una serie mal registrada. El diálogo lo avisa, pero el error de dato se queda en la base de datos.

**P2-5. Sin modo claro.**

- **Qué pasa:** el brief lo pide como opción; hoy no hay `prefers-color-scheme` ni selector.

**P2-6. Errores poco útiles.**

- **Qué pasa:** se muestran como `alert()` o como el `err.message` de Supabase en inglés y sin ninguna acción para recuperarse.

### P3: pulido

- Micro-texto de 9 a 10,5 px en 26 sitios (etiquetas mono en mayúsculas): cuesta leerlo en el gimnasio.
- Degradado en los pies fijos (`linear-gradient` sobre `--bg-0`). Es funcional, porque funde el contenido, pero roza el antipatrón del brief.
- Nombres de navegación: "Reporte" en realidad son medidas y "Semana" en realidad son los últimos 7 días.

### Lo que funciona y hay que conservar

- **Fechas locales** en `todayLocal()` y `dateToLocalStr()`, bien razonadas. Solo `fetchWeekSummary` se escapa.
- **El borrador en `localStorage`** que sobrevive a que iOS cierre la PWA. Es la semilla de la cola sin conexión.
- **Identidad visual con criterio:** IBM Plex Mono con `tabular-nums` para las cifras, un único acento verde sin saturar y fondos casi negros. Es un buen punto de partida para el "registro de producto" que pide el brief.
- **El check de la serie** ya cuesta un solo toque, y la sesión futura se enseña en solo lectura.
- **El bundle** es pequeño y la PWA tiene manifest, orientación bloqueada y safe areas trabajadas.

### Patrones sistémicos

1. **Estilos inline sin componentes:** la micro-etiqueta mono se repite unas 50 veces con pequeñas variaciones. Cualquier cambio de token o de tamaño hay que hacerlo en decenas de sitios.
2. **Valores por defecto que se registran como datos:** pasa con el RPE de las series y con los sliders del check-in. Hacer rápido el registro no puede costar la verdad del dato.
3. **Lógica de dominio en el front:** la heurística `BW_KEYWORDS`, los recálculos de semana y la adherencia deberían venir del catálogo (`load_convention`) y de las vistas.

---

## 4. Protocolo de medición en el iPhone (para Claudio)

Con la app de producción, en la próxima sesión real, y cronometrando con otra persona o con una grabación de pantalla:

1. Check-in rápido: desde abrir la app hasta ver "Check-in hecho".
2. Check-in con dolor de tibia: lo mismo, pero registrando la tibia.
3. Serie cambiada: desde el fin de la serie hasta marcar el check, cambiando el peso y el RPE.
4. ¿El teclado decimal escribe coma o punto en los campos de kg y RPE? ¿Se guarda el valor?

---

## 5. `/critique` (Impeccable)

Método: dos evaluaciones aisladas. La A es una revisión de diseño hecha sobre el código y las capturas. La B combina el detector CLI con su inyección en el navegador, logueado en local y en solo lectura. La A terminó antes de ver los resultados de la B.

### Heurísticas de Nielsen (evaluación A)

| # | Heurística | Nota | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 1 | Sin estado de sincronización ni temporizador; "SEMANA ? · BLOQUE ?" se muestra como si fuera un dato |
| 2 | Relación con el mundo real | 3 | El vocabulario es correcto, pero la columna "KG" no se adapta a `load_convention` ("BW + 2.5 kg") |
| 3 | Control y libertad | 1 | "Finalizar" es irreversible y no existe "Omitir" |
| 4 | Consistencia | 2 | Tres formatos de fecha y estilos inline que divergen entre pantallas |
| 5 | Prevención de errores | 1 | RPE libre y opcional, sliders con valores por defecto y guardado no atómico |
| 6 | Reconocer antes que recordar | 2 | No se ve "la última vez" en el registro de series; las notas técnicas solo están en los bloques INFO |
| 7 | Flexibilidad y eficiencia | 1 | Sin herencia entre series, sin steppers, sin botones de RPE y sin avance automático |
| 8 | Estética y diseño minimalista | 3 | Sobrio y denso, pero la cabecera ocupa 5 líneas y la rejilla de KPI se queda vacía |
| 9 | Recuperación de errores | 1 | `alert()` con el error crudo de Supabase y sin reintento |
| 10 | Ayuda y documentación | 2 | Hay bloques INFO, pero falta el texto de tibia de la especificación y las notas técnicas |
| **Total** | | **17/40** | **Pobre** |

**Carga cognitiva:** alta. Fallan 5 de los 8 puntos del checklist.

- En el registro de series compiten la navegación de fechas, la cabecera, el acordeón, "Finalizar" y las 4 pestañas.
- Un ejercicio desplegado muestra 12 controles.
- La acción principal, el check de 32 px con borde tenue, es lo menos visible de cada fila.

**Recorrido emocional durante la sesión:**

- **Arranque:** bueno, porque lo prescrito viene precargado.
- **Valles:**
  - No hay temporizador, así que hay que salir a la app Reloj.
  - Sin Wake Lock la pantalla se apaga, y al volver hay que reorientarse.
  - Al desviarse de lo prescrito hace falta el teclado.
- **Final, el peor momento:** "sin vuelta atrás", un posible `alert()` técnico y el riesgo de una sesión vacía y bloqueada. Justo cuando más importa no hay ninguna confirmación de que el registro está a salvo.

### Detector (evaluación B)

- **CLI:** `impeccable detect` sobre `src` e `index.html` da 0 hallazgos. Es un **falso negativo**: hay 165 bloques `style={{…}}` frente a 57 `className`, y el análisis estático no resuelve ni los estilos inline ni las `var(--…)`.
- **Inyección en el navegador:** detecta 7 problemas en Hoy, 30 en el registro de series del 22 de julio, 21 en Check-in y 21 en Semana. Los reales son `low-contrast`, con ratios de 1,8 a 3,2:1, y `undersized-ui-text`, con 9 a 10,5 px.
- **Falsos positivos descartados:**
  - `dark-glow` y `text-occlusion`: son artefactos del propio overlay al reinyectarse en la SPA.
  - `kicker-above-heading` y `wide-tracking` en las etiquetas en mayúsculas: son una decisión de estilo y se valorarán en la fase 2.
- **Mediciones propias de la evaluación B:**
  - Texto de menos de 12 px: 6 elementos de 9 en Hoy, 30 de 52 en el registro, 29 de 53 en Check-in y 14 de 22 en Semana.
  - Contraste de los dos grises: 74 de 75 casos por debajo de 4,5:1.
- El live server se ha parado y el repo no se ha tocado.

### Coincidencias y discrepancias

- **Coinciden las tres fuentes** (auditoría, A y B): contraste, micro-texto y zonas táctiles.
- **Solo lo detecta la revisión humana** (auditoría y A): todos los problemas de integridad de datos, P0-1 y P0-2, y de flujo, como la sesión en curso o la arquitectura de información. El detector no puede verlos.
- **Aportación propia de B:** la cuantificación por vista, que confirma que el problema de contraste es sistémico y no puntual.

---

## Pendiente de esta fase

- Tiempos reales en el iPhone (sección 4).
- Revisión de este informe por Claudio antes de la fase 2.
