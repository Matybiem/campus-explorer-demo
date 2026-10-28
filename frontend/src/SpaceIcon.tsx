import { Icon, type IconName } from './icons'
import type { SpaceCategory, SpaceType } from './types'

type SpaceIconProps = {
  type: SpaceType
  category: SpaceCategory | null
}

const typeIcons: Record<Exclude<SpaceType, 'Espacio común'>, IconName> = {
  Sala: 'chalkboard',
  Laboratorio: 'flask',
  Administrativo: 'briefcase',
}

const categoryIcons: Record<SpaceCategory, IconName> = {
  'Baño hombre': 'man',
  'Baño mujer': 'woman',
  Escalera: 'stairs',
  Ascensor: 'elevator',
  Comida: 'tools-kitchen-2',
}

function SpaceIcon({ type, category }: SpaceIconProps) {
  if (type === 'Espacio común') {
    return <Icon name={category ? categoryIcons[category] : 'question-mark'} />
  }

  return <Icon name={typeIcons[type]} />
}

export default SpaceIcon
