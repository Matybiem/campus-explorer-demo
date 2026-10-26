import express from 'express'
import { spaces } from './data/spaces.js'

const spaceTypes = new Set(['Sala', 'Laboratorio', 'Baño', 'Servicio'])

export const app = express()

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/spaces', (request, response) => {
  const { q, type, floor, accessible } = request.query

  if (type !== undefined && (typeof type !== 'string' || !spaceTypes.has(type))) {
    response.status(400).json({ error: 'El filtro type no es válido.' })
    return
  }

  let floorNumber
  if (floor !== undefined) {
    floorNumber = Number(floor)
    if (typeof floor !== 'string' || !Number.isInteger(floorNumber) || floorNumber < 1) {
      response.status(400).json({ error: 'El filtro floor debe ser un entero positivo.' })
      return
    }
  }

  if (accessible !== undefined && accessible !== 'true' && accessible !== 'false') {
    response.status(400).json({ error: 'El filtro accessible debe ser true o false.' })
    return
  }

  const normalizedQuery = typeof q === 'string' ? q.trim().toLocaleLowerCase('es') : ''
  const filteredSpaces = spaces.filter((space) => {
    const matchesQuery =
      !normalizedQuery ||
      `${space.id} ${space.name} ${space.type}`.toLocaleLowerCase('es').includes(normalizedQuery)

    return (
      matchesQuery &&
      (type === undefined || space.type === type) &&
      (floorNumber === undefined || space.floor === floorNumber) &&
      (accessible === undefined || space.accessible === (accessible === 'true'))
    )
  })

  response.json(filteredSpaces)
})

app.use((_request, response) => {
  response.status(404).json({ error: 'Ruta no encontrada.' })
})
