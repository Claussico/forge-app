# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

PWA instalada desde Safari en el iPhone (modo standalone, orientación vertical). Es el único dispositivo objetivo: el escritorio no es un objetivo de diseño.

## Users

Un solo usuario: Claudio. Graduado en CAFYD, técnico y exigente; quiere datos, no motivación.

Contextos de uso, por orden de importancia:

1. **En mitad de la sesión** (casa o gimnasio): móvil en una mano, manos sudadas, descansos de 60–180 s y a veces mala cobertura. Registrar una serie tiene que costar segundos.
2. **Por la mañana**: check-in diario en menos de 30 s.
3. **Revisión**: ver la semana, el progreso y el impacto.

## Product Purpose

FORGE registra el entrenamiento (series, carrera y otras actividades), el check-in diario y las medidas corporales, y muestra el plan y el progreso. La programación la hace Magnus, el entrenador IA de Claudio (un chat de Claude que lee la base de datos de FORGE). Magnus no forma parte de la interfaz: la app registra y muestra; Magnus programa y lee.

El éxito se mide con estas tareas:

| Tarea | Objetivo |
|---|---|
| Registrar una serie que coincide con lo prescrito | 1–2 toques |
| Registrar una serie que difiere (peso, reps o RPE) | ≤ 5 toques, sin teclado alfanumérico |
| Check-in diario completo | < 30 s |
| Registrar una salida de carrera | < 30 s |
| Saber qué toca hoy y cómo va la semana | 1 pantalla, sin hacer scroll para lo esencial |

## Positioning

Una herramienta personal hecha a medida de un único atleta técnico y de su entrenador IA. La calidad de los datos importa más que cualquier otra cosa, porque Magnus toma decisiones con ellos. Por ejemplo, una serie efectiva sin RPE no cuenta para el volumen.

## Operating Context

- Gimnasio o casa, con descansos cortos entre series y cobertura irregular. Registrar sin conexión y sincronizar después es un requisito.
- Pantalla encendida durante toda la sesión, con temporizador de descanso y vibración.
- Idioma: castellano en toda la interfaz.
- Backend: Supabase (proyecto de producción `zbtivaogiuspxfockyff`). Los datos calculados vienen de `magnus_briefing()` (RPC) y de las vistas; el front no recalcula semanas, volumen ni topes.

## Capabilities and Constraints

- **Stack**: React 18 + Vite + vite-plugin-pwa, `@supabase/supabase-js`, desplegada en Vercel (`forge-app-ashy.vercel.app`).
- **Un solo perfil**: la base de datos asume `select id from profile limit 1`. Nunca crear un segundo usuario en producción.
- **Esquema**: no se cambia desde el repo del front. Las columnas, vistas y RPC nuevas se piden como migración desde el Project de desarrollo de FORGE.
- **Triggers**: no se replica su lógica en el front (resolución de `exercise_id`, marcado de sesiones como hechas).
- **Histórico**: tiene que seguir leyéndose igual. Los nombres antiguos de ejercicios se resuelven por alias.
- **Seguridad**: la clave `service_role` nunca va en el cliente.
- **Carga**: la etiqueta depende de `load_convention` del catálogo ("kg por mano", "kg totales", "lastre" o sin peso). En los saltos, reps = contactos, sin peso.
- **RPE**: de 6 a 10 en pasos de 0,5; obligatorio en las series efectivas.
- **Tibia**: escala de dolor con umbrales 0–2 (neutro), 3–4 (aviso) y 5 o más (alerta).

## Brand Commitments

- Nombre: FORGE.
- Voz: castellano técnico y directo, sin mensajes motivacionales.
- Registro de producto, no de marca: una herramienta de trabajo densa y legible.

## Evidence on Hand

- Datos reales de entrenamiento, check-ins y medidas en producción. No se inventan datos ni se escriben datos de prueba en producción.
- Brief de UX: `docs/forge-refactor/FORGE_UX_brief.md`.
- Especificación funcional: `docs/forge-refactor/FORGE_front_spec_pasos_5-7.md`.

## Product Principles

1. **El registro es sagrado.** Ninguna serie se pierde, ni con mala cobertura ni si se cierra la app.
2. **Lo prescrito es el valor por defecto.** Confirmar lo planificado cuesta un toque; desviarse cuesta pocos más y nunca exige teclado.
3. **Los datos ya calculados se muestran, no se recalculan.** La verdad está en la base de datos (vistas y RPC).
4. **Datos antes que motivación.** Hay que mostrar números precisos y el estado real.

## Accessibility & Inclusion

- Contraste WCAG AA como mínimo; se usa en el gimnasio con luz variable.
- Zonas táctiles de 48 px o más, pensadas para usar con una mano y con las manos sudadas.
- Los controles principales van al alcance del pulgar.
