export type SpaceType =
  | 'Sala'
  | 'Laboratorio'
  | 'Administrativo'
  | 'Espacio común'
  | 'Otro'

export type SpaceCategory =
  | 'Baño hombre'
  | 'Baño mujer'
  | 'Escalera'
  | 'Ascensor'
  | 'Comida'

export const spaceTypes: SpaceType[] = [
  'Sala',
  'Laboratorio',
  'Administrativo',
  'Espacio común',
  'Otro',
]

export const spaceCategories: SpaceCategory[] = [
  'Baño hombre',
  'Baño mujer',
  'Escalera',
  'Ascensor',
  'Comida',
]

export type SpaceKind = {
  key: string
  type: SpaceType
  category: SpaceCategory | null
}

export const spaceKinds: SpaceKind[] = [
  { key: 'Sala', type: 'Sala', category: null },
  { key: 'Laboratorio', type: 'Laboratorio', category: null },
  { key: 'Administrativo', type: 'Administrativo', category: null },
  { key: 'Otro', type: 'Otro', category: null },
  ...spaceCategories.map((category): SpaceKind => ({ key: category, type: 'Espacio común', category })),
]

export function getSpaceKindKey(space: { type: SpaceType; category: SpaceCategory | null }): string {
  return space.type === 'Espacio común' ? space.category ?? space.type : space.type
}

export function getSpaceColorClass(type: SpaceType, category: SpaceCategory | null): string {
  if (type !== 'Espacio común') {
    if (type === 'Laboratorio') return 'room-lab'
    if (type === 'Administrativo') return 'room-service'
    if (type === 'Otro') return 'room-other'
    return 'room-classroom'
  }
  switch (category) {
    case 'Escalera': return 'room-stairs'
    case 'Ascensor': return 'room-elevator'
    case 'Baño hombre': return 'room-bathroom'
    case 'Baño mujer': return 'room-bathroom-women'
    case 'Comida': return 'room-food'
    default: return 'room-common'
  }
}

export function getSpaceLabel(space: Pick<Space, 'id' | 'name' | 'type' | 'category'>): string {
  return space.type === 'Espacio común'
    ? space.category || space.name || space.id
    : space.name || space.id
}

export type Space = {
  id: string
  name: string
  type: SpaceType
  category: SpaceCategory | null
  floor: number
  x: number
  y: number
  capacity?: number | null
  accessible: boolean
  description: string
  customCode?: string | null
}

export type AdminSlot = Pick<
  Space,
  'id' | 'name' | 'type' | 'category' | 'floor' | 'x' | 'y' | 'accessible' | 'description' | 'customCode'
> & {
  enabled: boolean
  useContour: boolean
}

export type ContourCell = Pick<Space, 'x' | 'y'>

export type FloorPlan = {
  floor: number
  horizontalLength: number
  verticalLength: number
  contourCells?: ContourCell[]
}

export function floorLabel(floor: number): string {
  return floor < 0 ? `Subterráneo ${Math.abs(floor)}` : `Piso ${floor}`
}

export type AdminFloorLevels = {
  floors: FloorPlan[]
}
