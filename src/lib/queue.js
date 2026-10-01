// Cola de escrituras sin conexión. Cada operación se guarda en IndexedDB ANTES de intentar
// enviarla y solo se borra cuando el servidor responde sin error. Las operaciones son
// idempotentes (save_training_log por client_id; inserts con id generado en el dispositivo
// y ON CONFLICT DO NOTHING), así que reenviar nunca duplica.

export function createQueue({ store, exec, isOnline = () => true, now = () => Date.now() }) {
  let flushing = null
  let dirty = false // llegó algo mientras se vaciaba la cola: hay que dar otra pasada
  const listeners = new Set()
  let state = { pending: 0, failing: 0, syncing: false, lastError: null }

  const emit = patch => {
    state = { ...state, ...patch }
    listeners.forEach(fn => fn(state))
  }

  async function refreshCounts() {
    const ops = await store.all()
    emit({ pending: ops.length, failing: ops.filter(o => o.lastError).length })
    return ops
  }

  async function enqueue(kind, payload) {
    const op = { id: crypto.randomUUID(), kind, payload, createdAt: now(), attempts: 0, lastError: null }
    await store.put(op)
    await refreshCounts()
    flush()
    return op.id
  }

  function flush() {
    if (flushing) { dirty = true; return flushing }
    flushing = (async () => {
      emit({ syncing: true })
      let stop = false
      try {
        do {
          dirty = false
          const ops = (await store.all()).sort((a, b) => a.createdAt - b.createdAt)
          for (const op of ops) {
            if (!isOnline()) { stop = true; break }
            try {
              await exec(op.kind, op.payload)
              await store.del(op.id)
            } catch (err) {
              const network = isNetworkError(err)
              await store.put({ ...op, attempts: op.attempts + 1, lastError: network ? null : String(err?.message || err) })
              if (network) { stop = true; break } // sin red: no tiene sentido seguir con el resto
            }
          }
        } while (dirty && !stop)
      } finally {
        const ops = await refreshCounts()
        emit({ syncing: false, lastError: ops.find(o => o.lastError)?.lastError ?? null })
        flushing = null
      }
    })()
    return flushing
  }

  function subscribe(fn) {
    listeners.add(fn)
    fn(state)
    return () => listeners.delete(fn)
  }

  return { enqueue, flush, subscribe, refreshCounts, getState: () => state }
}

export function isNetworkError(err) {
  const m = String(err?.message || err || '')
  return err?.name === 'TypeError' || /fetch|network|load failed|timeout/i.test(m)
}

// ---------- IndexedDB ----------

let dbp = null
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open('forge', 1)
      r.onupgradeneeded = () => {
        r.result.createObjectStore('ops', { keyPath: 'id' })
        r.result.createObjectStore('kv')
      }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
  }
  return dbp
}

async function tx(name, mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(name, mode)
    const req = fn(t.objectStore(name))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
  })
}

export const idbOps = {
  all: () => tx('ops', 'readonly', s => s.getAll()),
  put: op => tx('ops', 'readwrite', s => s.put(op)),
  del: id => tx('ops', 'readwrite', s => s.delete(id))
}

// Almacén clave-valor para borradores (sesión en curso).
export const kv = {
  get: k => tx('kv', 'readonly', s => s.get(k)),
  set: (k, v) => tx('kv', 'readwrite', s => s.put(v, k)),
  del: k => tx('kv', 'readwrite', s => s.delete(k))
}
