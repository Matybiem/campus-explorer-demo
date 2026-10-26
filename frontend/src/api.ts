import type { Space, SpaceType } from './types'

const spaceTypes: SpaceType[] = [
  'Sala',
  'Laboratorio',
  'Administrativo',
  'Baño hombre',
  'Baño mujer',
]

function isSpace(value: unknown): value is Space {
  if (typeof value !== 'object' || value === null) return false

  const space = value as Record<string, unknown>
  return (
    typeof space.id === 'string' &&
    typeof space.name === 'string' &&
    typeof space.type === 'string' &&
    spaceTypes.some((type) => type === space.type) &&
    typeof space.floor === 'number' &&
    typeof space.x === 'number' &&
    typeof space.y === 'number' &&
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
