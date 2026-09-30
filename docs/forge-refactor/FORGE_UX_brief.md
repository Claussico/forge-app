# FORGE — Brief de UX para Claude Code

Úsalo junto con `FORGE_front_spec_pasos_5-7.md`, que define las funciones nuevas y el contrato de datos. Este brief define cómo tiene que funcionar y sentirse la app, y en qué orden trabajar.

## 1. Producto y usuario

Un solo usuario: Claudio. Graduado en CAFYD, técnico y exigente; quiere datos, no motivación.

Tres contextos de uso, por orden de importancia:

- **En mitad de la sesión** (casa o gimnasio): móvil en una mano, manos sudadas, descansos de 60–180 s y a veces mala cobertura. Registrar una serie tiene que costar segundos.
- **Por la mañana**: check-in diario en menos de 30 segundos.
- **Revisión**: ver la semana, el progreso y el impacto, en el móvil o en el escritorio.

Idioma: castellano en toda la interfaz.

## 2. Tareas y métricas de éxito

| Tarea | Objetivo |
|---|---|
| Registrar una serie que coincide con lo prescrito | 1–2 toques |
| Registrar una serie que difiere (peso, reps o RPE) | ≤ 5 toques, sin teclado alfanumérico |
| Check-in diario completo | < 30 s |
| Registrar una salida de carrera | < 30 s |
| Saber qué toca hoy y cómo va la semana | 1 pantalla, sin hacer scroll para lo esencial |

Mide el estado actual de estas tareas en la fase 1 para poder comparar al final.

## 3. Arquitectura de información propuesta

Valídala en la fase 2 contra lo que exista hoy.

- **Hoy**: sesión del día (o "descanso"), check-in pendiente, botón para empezar la sesión y acceso rápido a registrar una actividad.
- **Semana**: plan de la semana del bloque con estados (planificada, hecha, omitida, movida), acción de omitir, volumen fraccional frente a objetivo e impacto de 7 días.
- **Progreso**:
  - e1RM por ejercicio (`v_e1rm`);
  - volumen (`v_weekly_volume_fractional`);
  - peso (media de 7 días);
  - carrera: km, minutos y tope de la próxima salida;
  - contactos de salto;
  - tibia.
- **Registrar**: carrera y otras actividades (`external_load`), check-in y medidas.
- **Sesión en curso**: pantalla dedicada y a pantalla completa (sección 4).

Los datos calculados vienen de `magnus_briefing()` (RPC) y de las vistas. No recalcules en el front semanas, volumen ni topes.

## 4. Sesión en curso: requisitos

- Cada serie viene precargada con el objetivo (carga, reps y RIR/RPE). Confirmarla tal cual es un toque.
- La siguiente serie hereda los valores de la anterior.
- RPE: botones grandes de 6 a 10 en pasos de 0,5. En series efectivas es obligatorio, porque las vistas de volumen no cuentan series sin RPE.
- Etiqueta de carga según `load_convention` del catálogo: "kg por mano", "kg totales", "lastre" o sin campo de peso.
- Temporizador de descanso: arranca solo al confirmar una serie, vibra al terminar y lo hace visible en la parte superior.
- Pantalla: se mantiene encendida durante la sesión (Screen Wake Lock API).
- Sin conexión: las series se guardan en local y se sincronizan al volver la cobertura. El usuario ve el estado de sincronización y ningún registro se pierde.
- Saltos: reps = contactos, sin peso.
- Carrera programada dentro de la semana: abre el formulario de `external_load` con la sesión ya enlazada.
- Ver las `execution_notes` y la nota técnica de cada ejercicio sin salir de la pantalla.

## 5. Dirección de diseño

- Registro de producto, no de marca: herramienta de trabajo densa y legible.
- Modo oscuro por defecto (uso en el gimnasio), con modo claro disponible.
- Tipografía: cifras tabulares para cargas, reps y tiempos. Jerarquía tipográfica clara.
- Color:
  - un solo acento para la acción principal;
  - colores semánticos para los estados de sesión y para la tibia (0–2 neutro, 3–4 aviso, 5 o más alerta);
  - usar tokens, no colores sueltos.
- Toque: zonas de al menos 48 px, controles principales al alcance del pulgar y nada crítico en la parte superior en la pantalla de sesión.
- Accesibilidad: contraste WCAG AA como mínimo.
- Evitar: gradientes decorativos, tarjetas dentro de tarjetas, iconos de relleno y animaciones que no informen. Las reglas antipatrón de Impeccable aplican.

## 6. Proceso de trabajo

Una rama por fase, con su deployment de preview en Vercel para probar en el móvil antes de fusionar.

**Base de datos de las previews.** Las previews no deben escribir en la base de datos de producción. Si lo hicieran, se mezclarían datos de prueba con los datos reales y Magnus los leería. Hay dos opciones:

- Recomendada: un segundo proyecto de Supabase (el plan Free admite dos) restaurado con el esquema del `pg_dump` de la tarea 7 de la especificación, y variables de entorno de Preview en Vercel apuntando a él.
- Aceptable solo en la fase 1: previews de solo lectura sobre producción.

Aviso: la base de datos asume un solo perfil (`select id from profile limit 1`). No crees un segundo usuario de prueba en producción.

### Fase 0 — Preparación

- Lee el repo: stack, estructura, cómo lee y escribe Supabase y si hay capa sin conexión.
- Instala Impeccable como skill de proyecto y crea su contexto de diseño a partir de este brief.
- Ejecuta la tarea 7 de la especificación (`pg_dump`) y monta el proyecto de staging.
- Pregunta a Claudio cuáles son sus tres mayores frustraciones con la app actual.

### Fase 1 — Auditoría (sin cambiar código)

- Inventario de pantallas y flujos.
- `/audit` (técnico: accesibilidad, rendimiento, responsive) y `/critique` (UX) sobre la app actual.
- Medición de las tareas de la sección 2 (toques y tiempo).
- Informe breve con los hallazgos priorizados. Claudio lo revisa antes de seguir.

### Fase 2 — Arquitectura y pantallas clave

- Propuesta de navegación y bocetos de 5 pantallas: Hoy, Sesión en curso, Semana, Registrar actividad y Check-in.
- Aprobación de Claudio antes de implementar.

### Fase 3 — Implementación

- Las funciones de la especificación (secciones 1–6) dentro de la arquitectura nueva.
- Sesión en curso con los requisitos de la sección 4.
- Pruebas de aceptación de la especificación, en staging.

### Fase 4 — Pulido y cierre

- `/polish`, `/audit` final y repetición de las mediciones de la sección 2.
- Fusión a producción y verificación en el móvil real.

## 7. Límites

- **Esquema de base de datos**: no se cambia desde el repo del front. Si hace falta una columna, vista o RPC nueva, se pide y se hace como migración desde el Project de desarrollo de FORGE, donde viven las guardas y el registro de cambios.
- **Clave service_role**: nunca en el cliente.
- **Lógica de triggers**: no se replica en el front (resolución de `exercise_id` y marcado de sesiones como hechas).
- **Datos existentes**: el histórico tiene que seguir leyéndose igual. Los nombres antiguos de ejercicios se resuelven por alias.
