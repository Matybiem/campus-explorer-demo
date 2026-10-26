export type SpaceType = 'Sala' | 'Laboratorio' | 'Baño' | 'Servicio'

export type Space = {
  id: string
  name: string
  type: SpaceType
  floor: number
  x: number
  y: number
  capacity?: number
  accessible: boolean
  description: string
}
