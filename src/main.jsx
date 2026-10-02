import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'

// Actualización forzada de la PWA: en iOS la app vuelve de segundo plano sin navegar, así que se
// busca versión nueva al volver al primer plano y cada hora. Con registerType 'autoUpdate', cuando
// el service worker nuevo toma el control la página se recarga sola. Es seguro: el borrador de la
// sesión y la cola de envíos viven en IndexedDB.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}) }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
    setInterval(check, 60 * 60 * 1000)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
