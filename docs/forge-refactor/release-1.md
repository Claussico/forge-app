# Release 1

Aprobada por Claudio el 2026-10-02. Incluye las fases 0 a 3: base común, capa de datos y seis pantallas (Sesión en curso, Check-in, Registrar actividad, Hoy, Movilidad y Tests).

## Despliegue anterior, para volver atrás

| Campo | Valor |
|---|---|
| Deployment | `dpl_CPbecxYeXPyTZeGESfwK7rL8Q2jx` |
| URL | https://forge-pxl352wat-claussicos-projects.vercel.app |
| Commit | `340f40c` ("confirmado"), en `main` |
| Fecha | 2026-07-22 |
| Alias | forge-app-ashy.vercel.app, forge-app-claussicos-projects.vercel.app |

Para volver atrás, elige una de estas dos vías:

- Desde la CLI: `vercel rollback dpl_CPbecxYeXPyTZeGESfwK7rL8Q2jx --scope claussicos-projects`.
- Desde el panel de Vercel: Deployments → ese deployment → "Promote to Production".

Volver atrás no toca la base de datos. Hay que tener en cuenta que el front antiguo vuelve a precargar el RPE objetivo y que no usa `save_training_log`.

## Antes del push

- **Variables de Vercel:** solo existen en Production, como Config (`VITE_SUPABASE_URL` de producción y la clave anon public). Preview no tiene variables.
- **Service worker:** se actualiza solo. Busca versión nueva al volver al primer plano y cada hora, y la página se recarga cuando el service worker nuevo toma el control. Lo he probado en Chromium pasando de la versión 1 a la 2 sin tocar nada.
- **Pruebas:** las de aceptación pasan en local y `npm test` también (5/5).
