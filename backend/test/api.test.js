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
    category: null,
    floor: 1,
    x: 0,
    y: 0,
    enabled: true,
    useContour: true,
    accessible: true,
    capacity: 24,
    description: 'Espacio ficticio para pruebas.',
  },
  {
    id: 'P1-R1-C2',
    name: '',
    type: 'Sala',
    category: null,
    floor: 1,
    x: 1,
    y: 0,
    enabled: false,
    useContour: false,
    accessible: false,
    capacity: null,
    description: '',
  },
]
for (let y = 0; y < 15; y += 1) {
  for (let x = 0; x < 15; x += 1) {
    if ((x === 0 || x === 1) && y === 0) continue
    storedSpaces.push({
      id: `P1-R${y + 1}-C${x + 1}`,
      name: '',
      type: 'Sala',
      category: null,
      floor: 1,
      x,
      y,
      enabled: false,
      useContour: false,
      accessible: false,
      capacity: null,
      description: '',
    })
  }
}
const floorPlans = new Map([
  [1, { floor: 1, horizontalLength: 15, verticalLength: 15 }],
  [2, { floor: 2, horizontalLength: 15, verticalLength: 15 }],
])
const activeFloors = new Set([1, 2])
let server
let baseUrl
let adminCookie

const repositories = {
  async listFloors() {
    return [...activeFloors].map((floor) => floorPlans.get(floor))
  },
  async getFloorPlan(floor) {
    if (!activeFloors.has(floor)) return null
    const plan = floorPlans.get(floor)
    if (!plan) return null
    return {
      ...plan,
      contourCells: storedSpaces
        .filter((slot) => slot.floor === floor && (slot.enabled || slot.useContour))
        .map(({ x, y }) => ({ x, y })),
    }
  },
  async listPublic({ q, type, floor, accessible }) {
    return storedSpaces
      .filter((space) => space.enabled)
      .filter((space) => activeFloors.has(space.floor))
      .filter((space) => !q || `${space.id} ${space.name} ${space.type} ${space.category ?? ''}`.toLocaleLowerCase('es').includes(q.toLocaleLowerCase('es')))
      .filter((space) => !type || space.type === type)
      .filter((space) => !floor || space.floor === floor)
      .filter((space) => accessible === undefined || space.accessible === accessible)
      .map(({ enabled, ...space }) => space)
  },
  async listSlots(floor) {
    return storedSpaces.filter((space) => space.floor === floor)
  },
  async setFloorActive(floor, active) {
    if (active === activeFloors.has(floor)) {
      return { ok: true, floors: [...activeFloors].map((level) => floorPlans.get(level)) }
    }
    if (active) {
      const existingLevels = [...activeFloors].filter((level) => Math.sign(level) === Math.sign(floor))
      const nextFloor = floor > 0
        ? Math.max(0, ...existingLevels) + 1
        : Math.min(0, ...existingLevels) - 1
      if (floor !== nextFloor || (floor > 0 && floor > 10) || (floor < 0 && floor < -5)) {
        return { ok: false, status: 409, error: 'Nivel fuera de orden o del límite permitido.' }
      }
      if (!floorPlans.has(floor)) {
        floorPlans.set(floor, { floor, horizontalLength: 15, verticalLength: 15 })
        for (let y = 0; y < 15; y += 1) {
          for (let x = 0; x < 15; x += 1) {
            storedSpaces.push({
              id: `P${floor}-R${y + 1}-C${x + 1}`,
              name: '',
              type: 'Sala',
              category: null,
              floor,
              x,
              y,
              enabled: false,
              useContour: false,
              accessible: false,
              capacity: null,
              description: '',
            })
          }
        }
      }
      activeFloors.add(floor)
    } else {
      const levels = [...activeFloors].filter((level) => Math.sign(level) === Math.sign(floor))
      const lastLevel = floor > 0 ? Math.max(...levels) : Math.min(...levels)
      if (floor !== lastLevel || floor === 1) {
        return { ok: false, status: 409, error: 'Solo se puede desactivar el nivel del extremo.' }
      }
      activeFloors.delete(floor)
    }
    return { ok: true, floors: [...activeFloors].map((level) => floorPlans.get(level)) }
  },
  async updateSlot(id, update) {
    const slot = storedSpaces.find((space) => space.id === id)
    if (!slot) return null
    Object.assign(slot, update)
    return slot
  },
  async updateSlots(floor, updates) {
    const floorSlotIds = new Set(
      storedSpaces.filter((slot) => slot.floor === floor).map((slot) => slot.id),
    )
    if (updates.some((slot) => !floorSlotIds.has(slot.id))) {
      return {
        ok: false,
        status: 409,
        error: 'Una o más casillas ya no pertenecen a este piso. Recarga el panel e inténtalo de nuevo.',
      }
    }
    for (const update of updates) {
      Object.assign(storedSpaces.find((slot) => slot.id === update.id), update)
    }
    return {
      ok: true,
      slots: storedSpaces.filter((slot) => slot.floor === floor),
    }
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

test('public floor plan endpoint returns current dimensions', async () => {
  const response = await fetch(`${baseUrl}/api/floors/1/plan`)
  assert.equal(response.status, 200)
  const plan = await response.json()
  assert.equal(plan.floor, 1)
  assert.equal(plan.horizontalLength, 15)
  assert.equal(plan.verticalLength, 15)
  assert.deepEqual(plan.contourCells, [{ x: 0, y: 0 }])
})

test('public floors endpoint lists active levels only', async () => {
  const response = await fetch(`${baseUrl}/api/floors`)
  assert.equal(response.status, 200)
  const floors = await response.json()
  assert.deepEqual(floors.map((plan) => plan.floor), [1, 2])
})

test('admin endpoints reject unauthenticated requests', async () => {
  const response = await fetch(`${baseUrl}/api/admin/slots?floor=1`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    error: 'Inicia sesión como administrador para continuar.',
  })

  const batchResponse = await fetch(`${baseUrl}/api/admin/floors/1/slots`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slots: [{
        id: 'P1-R1-C1',
        name: 'Sala',
        type: 'Sala',
        enabled: true,
        accessible: true,
        description: 'Acceso sin escalones.',
      }],
    }),
  })
  assert.equal(batchResponse.status, 401)

  const floorResponse = await fetch(`${baseUrl}/api/admin/floors/3/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: true }),
  })
  assert.equal(floorResponse.status, 401)
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

test('admin can only activate and deactivate floor levels in order within limits', async () => {
  const changeLevel = (floor, active) => fetch(`${baseUrl}/api/admin/floors/${floor}/active`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  })

  for (let floor = 3; floor <= 10; floor += 1) {
    const response = await changeLevel(floor, true)
    assert.equal(response.status, 200)
    if (floor === 3) {
      const sampleSlot = storedSpaces.find((slot) => slot.floor === floor)
      sampleSlot.enabled = true
    }
  }
  assert.equal((await changeLevel(11, true)).status, 400)

  assert.equal((await changeLevel(9, false)).status, 409)
  for (let floor = 10; floor >= 3; floor -= 1) {
    const response = await changeLevel(floor, false)
    assert.equal(response.status, 200)
    if (floor === 3) {
      assert.equal((await fetch(`${baseUrl}/api/floors/3/plan`)).status, 404)
      const hiddenSpaces = await fetch(`${baseUrl}/api/spaces?floor=3`)
      assert.deepEqual(await hiddenSpaces.json(), [])
      assert.equal((await repositories.listSlots(3)).length, 225)
      assert.equal((await changeLevel(3, true)).status, 200)
      assert.equal((await repositories.listSlots(3)).find((slot) => slot.enabled)?.enabled, true)
      assert.equal((await changeLevel(3, false)).status, 200)
      const sampleSlot = storedSpaces.find((slot) => slot.floor === floor)
      sampleSlot.enabled = false
    }
  }
  assert.equal((await changeLevel(1, false)).status, 409)

  for (let floor = -1; floor >= -5; floor -= 1) {
    const response = await changeLevel(floor, true)
    assert.equal(response.status, 200)
  }
  assert.equal((await changeLevel(-6, true)).status, 400)
  assert.equal((await changeLevel(-4, false)).status, 409)
  for (let floor = -5; floor <= -1; floor += 1) {
    const response = await changeLevel(floor, false)
    assert.equal(response.status, 200)
  }

  const finalFloors = await fetch(`${baseUrl}/api/floors`)
  assert.deepEqual((await finalFloors.json()).map((plan) => plan.floor), [1, 2])
})

test('admin can list slots and persist all editable room details', async () => {
  const slotsResponse = await fetch(`${baseUrl}/api/admin/slots?floor=1`, {
    headers: { Cookie: adminCookie },
  })
  assert.equal(slotsResponse.status, 200)
  const listedSlots = await slotsResponse.json()
  assert.equal(listedSlots.length, 225)
  assert.equal(listedSlots[0].accessible, true)
  assert.equal(listedSlots[0].description, 'Espacio ficticio para pruebas.')

  const response = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C2`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Baño mujer',
      type: 'Espacio común',
      category: 'Baño mujer',
      enabled: true,
      useContour: true,
      accessible: true,
      description: 'Acceso por el pasillo norte.',
    }),
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    id: 'P1-R1-C2',
    name: '',
    type: 'Espacio común',
    category: 'Baño mujer',
    floor: 1,
    x: 1,
    y: 0,
    enabled: true,
    useContour: true,
    accessible: true,
    capacity: null,
    description: 'Acceso por el pasillo norte.',
  })

  const publicResponse = await fetch(`${baseUrl}/api/spaces?type=Espacio%20com%C3%BAn`)
  assert.equal((await publicResponse.json()).length, 1)

  const hideResponse = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C2`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '',
      type: 'Espacio común',
      category: 'Baño mujer',
      enabled: false,
      useContour: true,
      accessible: true,
      description: 'Acceso por el pasillo norte.',
    }),
  })
  assert.equal(hideResponse.status, 200)
  const hiddenPublicResponse = await fetch(`${baseUrl}/api/spaces?type=Espacio%20com%C3%BAn`)
  assert.deepEqual(await hiddenPublicResponse.json(), [])
  const floorPlanResponse = await fetch(`${baseUrl}/api/floors/1/plan`)
  const floorPlan = await floorPlanResponse.json()
  assert.ok(floorPlan.contourCells.some((cell) => cell.x === 1 && cell.y === 0))
})

test('admin can save visibility and type when the slot name is blank', async () => {
  const response = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C2`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '',
      type: 'Sala',
      category: null,
      enabled: true,
      useContour: false,
      accessible: false,
      description: '',
    }),
  })

  assert.equal(response.status, 200)
  const updatedSlot = await response.json()
  assert.equal(updatedSlot.name, '')
  assert.equal(updatedSlot.enabled, true)
  assert.equal(updatedSlot.useContour, true)

  const publicResponse = await fetch(`${baseUrl}/api/spaces?floor=1`)
  const publicSpaces = await publicResponse.json()
  assert.ok(publicSpaces.some((space) => space.id === 'P1-R1-C2' && space.name === ''))
})

test('admin can save changes to multiple floor slots in one request', async () => {
  const response = await fetch(`${baseUrl}/api/admin/floors/1/slots`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slots: [
        {
          id: 'P1-R1-C1',
          name: 'Recepción',
          type: 'Administrativo',
          category: null,
          enabled: true,
          useContour: false,
          accessible: true,
          description: 'Atención al público.',
        },
        {
          id: 'P1-R1-C2',
          name: '',
          type: 'Espacio común',
          category: 'Baño mujer',
          enabled: true,
          useContour: true,
          accessible: false,
          description: '',
        },
      ],
    }),
  })

  assert.equal(response.status, 200)
  const { slots } = await response.json()
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C1').name, 'Recepción')
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C1').type, 'Administrativo')
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C1').accessible, true)
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C1').description, 'Atención al público.')
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C1').useContour, true)
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C2').name, '')
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C2').category, 'Baño mujer')
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C2').enabled, true)
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C2').accessible, false)
  assert.equal(slots.find((slot) => slot.id === 'P1-R1-C2').description, '')

  const publicSpaces = await fetch(`${baseUrl}/api/spaces?floor=1`).then((result) => result.json())
  assert.ok(publicSpaces.some((space) =>
    space.id === 'P1-R1-C1' &&
    space.accessible === true &&
    space.description === 'Atención al público.',
  ))
})

test('admin can save all 225 cells in one batch and the API rejects larger batches', async () => {
  const slots = storedSpaces
    .filter((slot) => slot.floor === 1)
    .map((slot) => ({
      id: slot.id,
      name: slot.name,
      type: slot.type,
      category: slot.category ?? null,
      enabled: slot.enabled,
      useContour: slot.useContour,
      accessible: slot.accessible,
      description: slot.description,
    }))
  assert.equal(slots.length, 225)

  const saveResponse = await fetch(`${baseUrl}/api/admin/floors/1/slots`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots }),
  })
  assert.equal(saveResponse.status, 200)
  assert.equal((await saveResponse.json()).slots.length, 225)

  const oversizedResponse = await fetch(`${baseUrl}/api/admin/floors/1/slots`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots: [...slots, { ...slots[0], id: 'overflow' }] }),
  })
  assert.equal(oversizedResponse.status, 400)
})

test('admin batch save rejects duplicates and slots from another floor', async () => {
  const duplicate = await fetch(`${baseUrl}/api/admin/floors/1/slots`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slots: [
        { id: 'P1-R1-C1', name: 'A', type: 'Sala', category: null, enabled: true, useContour: true, accessible: false, description: '' },
        { id: 'P1-R1-C1', name: 'B', type: 'Sala', category: null, enabled: true, useContour: true, accessible: false, description: '' },
      ],
    }),
  })
  assert.equal(duplicate.status, 400)

  const wrongFloor = await fetch(`${baseUrl}/api/admin/floors/1/slots`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slots: [{
        id: 'P2-R1-C1',
        name: 'Sala ajena',
        type: 'Sala',
        category: null,
        enabled: true,
        useContour: true,
        accessible: false,
        description: '',
      }],
    }),
  })
  assert.equal(wrongFloor.status, 409)
})

test('admin rejects unsupported types and standalone bathroom types', async () => {
  const response = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C1`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Oficina', type: 'Servidor', enabled: true }),
  })
  assert.equal(response.status, 400)

  const bathroomTypeResponse = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C1`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '',
      type: 'Baño hombre',
      enabled: true,
      useContour: true,
      accessible: false,
      description: '',
    }),
  })
  assert.equal(bathroomTypeResponse.status, 400)

  const missingCategoryResponse = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C1`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '',
      type: 'Espacio común',
      category: 'Patio',
      enabled: true,
      useContour: true,
      accessible: false,
      description: '',
    }),
  })
  assert.equal(missingCategoryResponse.status, 400)
})

test('admin can save the common-space category', async () => {
  const response = await fetch(`${baseUrl}/api/admin/slots/P1-R1-C1`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Patio central',
      type: 'Espacio común',
      category: 'Comida',
      enabled: true,
      useContour: false,
      accessible: false,
      description: '',
    }),
  })

  assert.equal(response.status, 200)
  const updatedSlot = await response.json()
  assert.equal(updatedSlot.type, 'Espacio común')
  assert.equal(updatedSlot.category, 'Comida')
  assert.equal(updatedSlot.name, '')
})

test('public search can find a common space by its category', async () => {
  const response = await fetch(`${baseUrl}/api/spaces?q=Comida&type=Espacio%20com%C3%BAn`)
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.ok(result.some((space) => space.id === 'P1-R1-C1' && space.category === 'Comida'))
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

test('fictional spaces occupy unique cells within the fixed matrix', () => {
  const occupiedCells = new Set()

  for (const space of spaces) {
    assert.ok(Number.isInteger(space.x) && space.x >= 0 && space.x < 15)
    assert.ok(Number.isInteger(space.y) && space.y >= 0 && space.y < 15)

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
