import { useEffect, useState, useCallback } from 'react'
import { queue } from './api'

// Muestra al instante lo último que se cargó (localStorage) y revalida en segundo plano.
// Sin cobertura, la pantalla sigue enseñando los datos cacheados en vez de quedarse en blanco.
export function useData(key, fetcher, deps = []) {
  const read = () => { try { const v = localStorage.getItem('forge:c:' + key); return v ? JSON.parse(v) : undefined } catch { return undefined } }
  const [data, setData] = useState(read)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    return fetcher()
      .then(d => {
        setData(d); setError(null)
        try { localStorage.setItem('forge:c:' + key, JSON.stringify(d)) } catch {}
      })
      .catch(e => setError(e))
      .finally(() => setLoading(false))
  }, [key, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setData(read()); reload() }, [reload]) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload }
}

export function useQueueState() {
  const [s, setS] = useState(queue.getState())
  useEffect(() => queue.subscribe(setS), [])
  return s
}

// Pantalla encendida durante la sesión (Screen Wake Lock). iOS lo suelta al ir a segundo plano:
// se vuelve a pedir al volver.
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock = null
    const req = () => navigator.wakeLock.request('screen').then(l => { lock = l }).catch(() => {})
    const onVis = () => { if (!document.hidden) req() }
    req()
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}) }
  }, [active])
}

// Respuesta háptica. iOS Safari no tiene navigator.vibrate: allí se usa el input "switch" de
// iOS 18, que vibra al conmutarse (solo funciona dentro de un toque del usuario).
let sw = null
export function haptic(pattern = 20) {
  try {
    if (navigator.vibrate) { navigator.vibrate(pattern); return }
    if (!sw) {
      const label = document.createElement('label')
      label.ariaHidden = 'true'
      label.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.setAttribute('switch', '')
      label.appendChild(input)
      document.body.appendChild(label)
      sw = label
    }
    sw.click()
  } catch {}
}

// Aviso de fin de descanso: vibración donde exista y un pitido corto (iOS no vibra sin un toque).
let ctx = null
export function unlockAudio() {
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume() } catch {}
}
export function alarm() {
  try { navigator.vibrate?.([200, 100, 200]) } catch {}
  if (!ctx) return
  try {
    for (const [t, f] of [[0, 880], [0.22, 880]]) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2)
    }
  } catch {}
}
