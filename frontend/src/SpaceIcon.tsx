import { Icon, type IconName } from './icons'
import type { SpaceCategory, SpaceType } from './types'

type SpaceIconProps = {
  type: SpaceType
  category: SpaceCategory | null
}

const typeIcons: Record<Exclude<SpaceType, 'Espacio común'>, IconName> = {
  Sala: 'glasses',
  Laboratorio: 'device-desktop',
  Administrativo: 'briefcase',
  Otro: 'users-group',
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

  if (type === 'Otro') {
    return <Icon name={typeIcons[type]} className="room-other" />
  }

  return <Icon name={typeIcons[type]} />
}

export default SpaceIcon
