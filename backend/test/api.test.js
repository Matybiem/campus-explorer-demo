import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { after, before, test } from 'node:test'
import session from 'express-session'
import { createApp } from '../app.js'
import { spaces } from '../data/spaces.js'

const adminPassword = 'test-password-for-admin'
const adminHash = await bcrypt.hash(adminPassword, 4)
const storedSpaces = [
  {
    id: 'P1-R1-C1',
    name: 'Sala de ejemplo',
    type: 'Sala',
    floor: 1,
    x: 0,
    y: 0,
    enabled: true,
    accessible: true,
    capacity: 24,
    description: 'Espacio ficticio para pruebas.',
  },
  {
    id: 'P1-R1-C2',
    name: '',
    type: 'Sala',
    floor: 1,
    x: 1,
    y: 0,
    enabled: false,
    accessible: false,
    capacity: null,
    description: '',
  },
]

let server
let baseUrl
let adminCookie

const repositories = {
  async listPublic({ q, type, floor, accessible }) {
    return storedSpaces
      .filter((space) => space.enabled)
      .filter((space) => !q || `${space.id} ${space.name} ${space.type}`.toLocaleLowerCase('es').includes(q.toLocaleLowerCase('es')))
      .filter((space) => !type || space.type === type)
      .filter((space) => !floor || space.floor === floor)
      .filter((space) => accessible === undefined || space.accessible === accessible)
      .map(({ enabled, ...space }) => space)
  },
  async listSlots(floor) {
    return storedSpaces.filter((space) => space.floor === floor)
  },
  async updateSlot(id, update) {
    const slot = storedSpaces.find((space) => space.id === id)
    if (!slot) return null
    Object.assign(slot, update)
    return slot
  },
  async findAdmin(username) {
    return username === 'admin.test'
      ? { id: 1, username, passwordHash: adminHash }
      : null
  },
}

before(async () => {
  const app = createApp({
    repositories,
    sessionStore: new session.MemoryStore(),
    sessionSecret: 'test-session-secret-that-is-long-enough',
  })
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
})

test('health endpoint reports that the API is running', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('public spaces endpoint hides disabled slots and applies filters', async () => {
  const response = await fetch(`${baseUrl}/api/spaces?type=Sala&floor=1&accessible=true`)
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'P1-R1-C1')
  assert.equal('enabled' in result[0], false)
})

test('spaces endpoint reports invalid filters', async () => {
  const response = await fetch(`${baseUrl}/api/spaces?accessible=yes`)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    error: 'El filtro accessible debe ser true o false.',
  })
})

test('admin endpoints reject unauthenticated requests', async () => {
  const response = await fetch(`${baseUrl}/api/admin/slots?floor=1`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    error: 'Inicia sesión como administrador para continuar.',
  })
})

test('admin login rejects incorrect credentials', async () => {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin.test', password: 'incorrect-password' }),
  })
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'Usuario o contraseña incorrectos.' })
})

test('admin login creates a protected session', async () => {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin.test', password: adminPassword }),
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { authenticated: true, username: 'admin.test' })
  const setCookie = response.headers.get('set-cookie')
  assert.ok(setCookie)
  adminCookie = setCookie.split(';')[0]

  const sessionResponse = await fetch(`${baseUrl}/api/admin/session`, {
    headers: { Cookie: adminCookie },
  })
  assert.deepEqual(await sessionResponse.json(), {
    authenticated: true,
    username: 'admin.test',
  })
})

test('admin can list slots and persist visibility, name, and type changes', async () => {
  const slotsResponse = await fetch(`${baseUrl}/api/admin/slots?floor=1`, {
    headers: { Cookie: adminCookie },
  })
  assert.equal(slotsResponse.status, 200)
  assert.equal((await slotsResponse.json()).length, 2)

  const response = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C2`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Baño mujer',
      type: 'Baño mujer',
      enabled: true,
    }),
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    id: 'P1-R1-C2',
    name: 'Baño mujer',
    type: 'Baño mujer',
    floor: 1,
    x: 1,
    y: 0,
    enabled: true,
    accessible: false,
    capacity: null,
    description: '',
  })

  const publicResponse = await fetch(`${baseUrl}/api/spaces?type=Ba%C3%B1o%20mujer`)
  assert.equal((await publicResponse.json()).length, 1)

  const hideResponse = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C2`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Baño mujer',
      type: 'Baño mujer',
      enabled: false,
    }),
  })
  assert.equal(hideResponse.status, 200)
  const hiddenPublicResponse = await fetch(`${baseUrl}/api/spaces?type=Ba%C3%B1o%20mujer`)
  assert.deepEqual(await hiddenPublicResponse.json(), [])
})

test('admin rejects unsupported space categories', async () => {
  const response = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C1`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Oficina', type: 'Servidor', enabled: true }),
  })
  assert.equal(response.status, 400)
})

test('logout destroys the admin session', async () => {
  const logoutResponse = await fetch(`${baseUrl}/api/admin/logout`, {
    method: 'POST',
    headers: { Cookie: adminCookie },
  })
  assert.equal(logoutResponse.status, 204)

  const response = await fetch(`${baseUrl}/api/admin/slots?floor=1`, {
    headers: { Cookie: adminCookie },
  })
  assert.equal(response.status, 401)
})

test('unknown routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/missing`)
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'Ruta no encontrada.' })
})

test('fictional spaces occupy unique cells within the L-shaped floor plan', () => {
  const occupiedCells = new Set()

  for (const space of spaces) {
    assert.ok(Number.isInteger(space.x) && space.x >= 0 && space.x < 6)
    assert.ok(Number.isInteger(space.y) && space.y >= 0 && space.y < 6)
    assert.ok(space.y < 2 || space.x >= 4, `${space.id} is outside the L-shaped plan`)

    const cell = `${space.floor}:${space.x}:${space.y}`
    assert.equal(occupiedCells.has(cell), false, `${space.id} overlaps another space`)
    occupiedCells.add(cell)
  }
})

test('app refuses an insecure session secret', () => {
  assert.throws(
    () => createApp({
      repositories,
      sessionStore: new session.MemoryStore(),
      sessionSecret: 'short',
    }),
    /SESSION_SECRET/,
  )
})
