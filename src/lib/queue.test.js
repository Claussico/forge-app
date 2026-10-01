// node --test src/lib/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createQueue } from './queue.js'
import { addDays, toLocalISO, fmtRelative } from './dates.js'

function memStore() {
  const m = new Map()
  return { all: async () => [...m.values()], put: async o => { m.set(o.id, o) }, del: async id => { m.delete(id) }, m }
}

test('sin red, la operación se queda en la cola y se envía al volver la red', async () => {
  const store = memStore()
  let online = false
  const sent = []
  const q = createQueue({ store, isOnline: () => online, exec: async (k, p) => { sent.push(p) } })
  await q.enqueue('rpc', { client_id: 'a' })
  await q.flush()
  assert.equal(store.m.size, 1)
  online = true
  await q.flush()
  assert.equal(store.m.size, 0)
  assert.deepEqual(sent, [{ client_id: 'a' }])
})

test('un fallo de red no borra nada y para la cola; un error del servidor se marca y se reintenta', async () => {
  const store = memStore()
  let mode = 'network'
  const q = createQueue({ store, exec: async () => {
    if (mode === 'network') throw new TypeError('Failed to fetch')
    if (mode === 'server') throw new Error('Falta performed_date')
  } })
  await q.enqueue('rpc', { n: 1 })
  await q.enqueue('rpc', { n: 2 })
  await q.flush()
  assert.equal(store.m.size, 2)
  assert.equal(q.getState().failing, 0)
  mode = 'server'
  await q.flush()
  assert.equal(store.m.size, 2)
  assert.equal(q.getState().failing, 2)
  assert.equal(q.getState().lastError, 'Falta performed_date')
  mode = 'ok'
  await q.flush()
  assert.equal(store.m.size, 0)
})

test('se envía en orden de creación', async () => {
  const store = memStore()
  let t = 0
  const order = []
  const q = createQueue({ store, now: () => ++t, isOnline: () => false, exec: async (k, p) => { order.push(p.n) } })
  await q.enqueue('rpc', { n: 1 }); await q.enqueue('rpc', { n: 2 }); await q.enqueue('rpc', { n: 3 })
  const q2 = createQueue({ store, exec: async (k, p) => { order.push(p.n) } })
  await q2.flush()
  assert.deepEqual(order, [1, 2, 3])
})

test('lo que llega mientras se vacía la cola también se envía en la misma pasada', async () => {
  const store = memStore()
  const sent = []
  let release
  const gate = new Promise(r => { release = r })
  const q = createQueue({ store, exec: async (k, p) => { if (p.n === 1) await gate; sent.push(p.n) } })
  const first = q.enqueue('insert', { n: 1 })   // empieza a enviarse y se queda esperando
  await new Promise(r => setTimeout(r, 0))
  await q.enqueue('insert', { n: 2 })             // llega durante el envío del primero
  release()
  await first
  while (q.getState().syncing) await new Promise(r => setTimeout(r, 1)) // sin forzar otra pasada
  assert.deepEqual(sent, [1, 2])
  assert.equal(store.m.size, 0)
})

test('fechas locales', () => {
  assert.equal(toLocalISO(new Date(2026, 9, 1, 0, 30)), '2026-10-01')
  assert.equal(addDays('2026-10-01', -2), '2026-09-29')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(fmtRelative('2026-09-30', '2026-10-01'), 'ayer')
})
