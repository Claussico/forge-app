import { useState } from 'react'
import { go } from '../components/ui'
import { Icon, SyncBadge } from '../components/ui'
import { supabase } from '../lib/supabase'

const ITEMS = [
  ['/registrar/actividad', 'Actividad', 'Carrera, sprint, pista, pliometría…'],
  ['/registrar/checkin', 'Check-in', 'Peso, sueño, tibia, energía'],
  ['/registrar/tests', 'Tests', 'Movilidad, salto, carrera, fuerza'],
  ['/registrar/medidas', 'Medidas', 'Perímetros corporales']
]

export default function LogHub() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const pick = t => {
    setTheme(t)
    if (t === 'light') document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
    try { localStorage.setItem('forge:theme', t) } catch {}
  }
  return (
    <div className="body">
      <div className="head"><h1 className="h1">Registrar</h1><SyncBadge /></div>
      <div className="panel">
        {ITEMS.map(([to, title, sub]) => (
          <button className="row" key={to} onClick={() => go(to)}>
            <div className="grow"><div className="t0">{title}</div><div className="t2">{sub}</div></div>
            <Icon.right />
          </button>
        ))}
      </div>
      <div className="field"><span className="lbl">Tema</span>
        <div className="seg" role="group" aria-label="Tema">
          <button className="chip" aria-pressed={theme === 'dark'} onClick={() => pick('dark')}>Oscuro</button>
          <button className="chip" aria-pressed={theme === 'light'} onClick={() => pick('light')}>Claro</button>
        </div>
      </div>
      <button className="btn btn--ghost" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  )
}
