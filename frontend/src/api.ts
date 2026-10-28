import { spaceCategories, spaceTypes, type ContourCell, type FloorPlan, type Space } from './types'

const matrixSize = 15

function isContourCell(value: unknown): value is ContourCell {
  if (typeof value !== 'object' || value === null || !('x' in value) || !('y' in value)) {
    return false
  }
  return typeof value.x === 'number' && Number.isInteger(value.x) &&
    value.x >= 0 && value.x < matrixSize &&
    typeof value.y === 'number' && Number.isInteger(value.y) &&
    value.y >= 0 && value.y < matrixSize
}

function isSpace(value: unknown): value is Space {
  if (typeof value !== 'object' || value === null) return false

  const space = value as Record<string, unknown>
  return (
    typeof space.id === 'string' &&
    typeof space.name === 'string' &&
    typeof space.type === 'string' &&
    spaceTypes.some((type) => type === space.type) &&
    (space.category === null ||
      (typeof space.category === 'string' && spaceCategories.some((category) => category === space.category))) &&
    (space.type === 'Espacio común' ? typeof space.category === 'string' : space.category === null) &&
    typeof space.floor === 'number' &&
    typeof space.x === 'number' && Number.isInteger(space.x) && space.x >= 0 && space.x < matrixSize &&
    typeof space.y === 'number' && Number.isInteger(space.y) && space.y >= 0 && space.y < matrixSize &&
    (space.capacity === undefined || space.capacity === null || typeof space.capacity === 'number') &&
    typeof space.accessible === 'boolean' &&
    typeof space.description === 'string'
  )
}

export async function fetchSpaces(): Promise<Space[]> {
  let response: Response

  try {
    response = await fetch('/api/spaces')
  } catch {
    throw new Error('No hay conexión con la API. Comprueba que el backend esté ejecutándose.')
  }

  if (!response.ok) {
    throw new Error(`La API respondió con el estado ${response.status}.`)
  }

  const data: unknown = await response.json()
  if (!Array.isArray(data) || !data.every(isSpace)) {
    throw new Error('La API devolvió un formato de espacios no válido.')
  }

  return data
}

export async function fetchFloorPlan(floor: number): Promise<FloorPlan> {
  let response: Response

  try {
    response = await fetch(`/api/floors/${floor}/plan`)
  } catch {
    throw new Error('No hay conexión con la API. Comprueba que el backend esté ejecutándose.')
  }

  if (!response.ok) {
    throw new Error(`La API respondió con el estado ${response.status}.`)
  }

  const data: unknown = await response.json()
  const record = typeof data === 'object' && data !== null ? data as Record<string, unknown> : null
  if (
    !record ||
    typeof record.floor !== 'number' ||
    record.horizontalLength !== matrixSize ||
    record.verticalLength !== matrixSize ||
    !Array.isArray(record.contourCells) ||
    !record.contourCells.every(isContourCell) ||
    record.contourCells.length > matrixSize * matrixSize
  ) {
    throw new Error('La API devolvió un plano o contorno no válido.')
  }

  return data as FloorPlan
}

export async function fetchFloors(): Promise<FloorPlan[]> {
  let response: Response

  try {
    response = await fetch('/api/floors')
  } catch {
    throw new Error('No hay conexión con la API. Comprueba que el backend esté ejecutándose.')
  }

  if (!response.ok) {
    throw new Error(`La API respondió con el estado ${response.status}.`)
  }

  const data: unknown = await response.json()
  if (
    !Array.isArray(data) ||
    !data.every((floor): floor is FloorPlan =>
      typeof floor === 'object' &&
      floor !== null &&
      'floor' in floor &&
      'horizontalLength' in floor &&
      'verticalLength' in floor &&
      typeof floor.floor === 'number' &&
      floor.horizontalLength === matrixSize &&
      floor.verticalLength === matrixSize,
    )
  ) {
    throw new Error('La API devolvió una lista de pisos no válida.')
  }

  return data
}
