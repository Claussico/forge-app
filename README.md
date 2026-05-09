# FORGE PWA

Aplicación personal iOS para logging de entrenamientos, check-ins, medidas corporales y reportes semanales. Backend: Supabase.

## Pantallas

1. **Hoy** — Sesión programada del día con logger inline (peso, reps, RPE por serie).
2. **Check-in** — Registro diario rápido (peso, sueño, energía) o completo (con dolor por zonas).
3. **Reporte** — Medidas corporales (13 perímetros) + adherencia subjetiva + observaciones cualitativas.
4. **Semana** — Resumen agregado de últimos 7 días con tendencia de peso y sesiones.

Todas las escrituras incluyen `recorded_at` para timestamping real.

## Requisitos previos

- Node.js 18+ instalado. Si no lo tienes: descarga la versión LTS desde https://nodejs.org/.
- Tu proyecto Supabase ya configurado (URL y publishable key en `.env`).
- Migraciones SQL aplicadas (esquema base + v1.1 con medidas y reportes).

## Estructura

```
forge-app/
├── src/
│   ├── lib/
│   │   ├── supabase.js        # Cliente Supabase
│   │   ├── queries.js         # Funciones de lectura/escritura
│   │   └── useAuth.js         # Hook de autenticación
│   ├── components/
│   │   └── UI.jsx             # Iconos, Wordmark, NavBar (4 items), LineChart
│   ├── screens/
│   │   ├── LoginScreen.jsx    # Magic link login
│   │   ├── HomeScreen.jsx     # Sesión de hoy + logger
│   │   ├── CheckinScreen.jsx  # Check-in diario
│   │   ├── ReportScreen.jsx   # Medidas + reporte semanal
│   │   └── WeekScreen.jsx     # Resumen semanal
│   ├── App.jsx                # Routing
│   ├── main.jsx               # Entry point
│   └── styles.css             # Tokens de diseño
├── .env                       # Credenciales Supabase
├── index.html
├── package.json
└── vite.config.js
```

## 1. Levantar en local

Abre una terminal en la carpeta del proyecto:

```bash
cd forge-app
```

Instala dependencias (solo la primera vez, tarda 1-2 min):

```bash
npm install
```

Arranca el servidor de desarrollo:

```bash
npm run dev
```

Se abre en http://localhost:5173. También te da una URL con IP local (tipo `http://192.168.x.x:5173`) para abrir desde tu iPhone en la misma WiFi.

## 2. Probar

1. Abre http://localhost:5173 en el navegador.
2. Verás la pantalla de login.
3. Introduce tu email (el que asociaste en Supabase Auth).
4. Recibirás un magic link en tu correo. Tócalo.
5. Vuelves a la app autenticado.
6. Si es la primera vez, no hay sesión programada y la pantalla Home aparecerá vacía.

### Insertar sesión de prueba

Para probar el logger, inserta una sesión manual desde el SQL Editor de Supabase:

```sql
INSERT INTO programmed_sessions (
  profile_id, scheduled_date, session_name,
  block_number, block_week, exercises
) VALUES (
  (SELECT id FROM profile LIMIT 1),
  CURRENT_DATE,
  'Upper A — Empuje',
  1, 1,
  '[
    {
      "name": "Press banca",
      "pattern": "horizontal_push",
      "muscle_groups": ["pecho", "tríceps", "hombro anterior"],
      "target": {"sets": 4, "reps": 8, "weight": 60, "rpe": 7},
      "sets": [
        {"set_number": 1, "weight_kg": 60, "reps": 8, "rpe": 7},
        {"set_number": 2, "weight_kg": 60, "reps": 8, "rpe": 7},
        {"set_number": 3, "weight_kg": 60, "reps": 8, "rpe": 7},
        {"set_number": 4, "weight_kg": 60, "reps": 8, "rpe": 7}
      ]
    }
  ]'::jsonb
);
```

Recarga la app y verás los ejercicios.

## 3. Pantalla Reporte — flujo

**Modo "Medidas rápidas"** (frecuencia ideal: semanal o quincenal):
- 13 inputs de perímetro (cuello, hombros, pecho, cintura, cadera, brazos, antebrazos, muslos, pantorrillas).
- Cada input muestra debajo la última medición previa (en gris) para comparación rápida.
- Los antebrazos están marcados como "opcional" — si pasas, no pasa nada.
- Botón "Guardar medidas".

**Modo "Reporte completo"** (frecuencia ideal: semanal, en revisión):
- Adherencia subjetiva: 3 sliders (comida, sueño, entrenamiento) — tu propia evaluación 1-10.
- Observaciones libres: texto sobre cómo te ves, sensaciones, qué notas, qué te preocupa.
- Eventos relevantes: viaje, lesión, cambio de horario, lo que vaya a afectar la próxima semana.
- Medidas (opcional): si las haces a la vez, se guardan vinculadas al reporte vía `body_measurement_id`.
- Botón "Guardar reporte completo".

Magnus consulta `v_forge_briefing` al inicio de cada chat y ya ve `last_waist_cm`, `last_shoulders_cm`, `last_arm_avg_cm` y `last_weekly_report_date` automáticamente. No tienes que recordarle nada.

## 4. Desplegar en Vercel

### 4.1 Sin GitHub (más rápido)

Ve a https://vercel.com/new → arrastra la carpeta `forge-app` (sin `node_modules`, sin `dist`) → Vercel detecta Vite → añade variables de entorno:

- `VITE_SUPABASE_URL` = `https://zbtivaogiuspxfockyff.supabase.co`
- `VITE_SUPABASE_KEY` = `sb_publishable_c9RhcV8Z-01HXOjjNknbGQ_aKApWxYn`

Deploy.

### 4.2 Con GitHub

```bash
git init
git add .
git commit -m "FORGE PWA initial"
# Crea un repo nuevo en github.com → Add remote → push
git remote add origin https://github.com/tu-user/forge.git
git branch -M main
git push -u origin main
```

En Vercel: New Project → Import from GitHub → tu repo → variables de entorno → Deploy.

### 4.3 Configurar URLs de Supabase para producción

Cuando tengas la URL de Vercel (tipo `https://forge-xxx.vercel.app`):

1. Supabase → Authentication → URL Configuration.
2. **Site URL**: cambia a tu URL de Vercel.
3. **Redirect URLs**: añade tu URL de Vercel.
4. Save.

Sin esto el magic link te redirige a localhost y no funciona desde el móvil.

## 5. Añadir al home screen del iPhone

1. Abre Safari (no otro navegador).
2. Ve a tu URL de Vercel.
3. Toca el botón Compartir (cuadrado con flecha arriba).
4. "Añadir a pantalla de inicio".
5. Nombre: FORGE. Añadir.

Al abrirlo va a pantalla completa, sin barra de Safari.

## Iconos PWA

El manifest pide iconos (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) que no incluyo todavía. La app funciona igual sin ellos — solo verás un icono genérico en home screen. Para generarlos: https://realfavicongenerator.net/ desde un SVG del yunque y los pones en `public/`.

## Flujo de desarrollo

```bash
cd forge-app
npm run dev        # arranca dev server (Ctrl+C para parar)
npm run build      # build de producción
npm run preview    # ver build en local (puerto 4173)
```

## Buenas prácticas operativas

- **Check-in diario**: solo 3 campos en modo rápido. 15 segundos por la mañana.
- **Reporte completo**: una vez por semana. 5-10 min con cinta métrica + reflexión.
- **Logging**: durante o justo después de la sesión, antes de que se te olvide algún peso.
- **No editar a posteriori**: el sistema permite múltiples check-ins por día. Si te equivocas en uno, haz otro nuevo. El más reciente cuenta como actual.
