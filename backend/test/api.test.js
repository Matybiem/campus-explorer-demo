import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { app } from '../app.js'
import { spaces } from '../data/spaces.js'

let server
let baseUrl

before(async () => {
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

test('spaces endpoint returns fictional spaces and applies filters', async () => {
  const response = await fetch(`${baseUrl}/api/spaces?type=Sala&floor=2&accessible=true`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), [
    {
      id: 'A-201',
      name: 'Sala A-201',
      type: 'Sala',
      floor: 2,
      x: 0,
      y: 0,
      capacity: 26,
      accessible: true,
      description: 'Sala de clases de ejemplo.',
    },
  ])
})

test('spaces endpoint reports invalid filters', async () => {
  const response = await fetch(`${baseUrl}/api/spaces?accessible=yes`)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    error: 'El filtro accessible debe ser true o false.',
  })
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
