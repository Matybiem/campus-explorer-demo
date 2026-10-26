export type SpaceType =
  | 'Sala'
  | 'Laboratorio'
  | 'Administrativo'
  | 'Baño hombre'
  | 'Baño mujer'

export type Space = {
  id: string
  name: string
  type: SpaceType
  floor: number
  x: number
  y: number
  capacity?: number | null
  accessible: boolean
  description: string
}

export type AdminSlot = Pick<
  Space,
  'id' | 'name' | 'type' | 'floor' | 'x' | 'y'
> & {
  enabled: boolean
}
