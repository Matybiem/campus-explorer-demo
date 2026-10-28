import type { SpaceCategory, SpaceType } from './types'

type SpaceIconProps = {
  type: SpaceType
  category: SpaceCategory | null
}

function SpaceIcon({ type, category }: SpaceIconProps) {
  if (type === 'Espacio común' && category) {
    if (category === 'Escalera') {
      return (
        <svg className="space-icon-outline" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M5 40h10V30h10V20h10V10h8" />
        </svg>
      )
    }
    if (category === 'Ascensor') {
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <rect className="space-icon-frame" x="7" y="5" width="29" height="38" rx="5" />
          <circle cx="21.5" cy="14" r="4" />
          <path d="M16 34V23h11v11m-5.5-11v16M40 17l4 4h-8l4-4Zm0 15-4-4h8l-4 4Z" />
        </svg>
      )
    }
    if (category === 'Baño hombre') {
      return (
        <svg className="space-icon-outline" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="8" r="5" />
          <path d="M18 16h12l4 14h-5v14h-6V31h-2v13h-6V30h-5l4-14h4Z" />
        </svg>
      )
    }
    if (category === 'Baño mujer') {
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="8" r="5" />
          <path d="M19 16h10l9 23H29v5h-5v-5h-5v5h-5v-5H9l10-23Z" />
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M9 5v13m5-13v13m5-13v13m-10 0h10v4c0 4-2 6-5 7v14h-5V29c-3-1-5-3-5-7v-4h5Zm23 0c0-7 3-12 6-12s6 5 6 12v23h-4v15h-5V28h-3V18Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {type === 'Administrativo'
        ? <path d="M24 8v32M8 24h32" />
        : type === 'Laboratorio'
          ? <path d="M18 7h12M21 7v13L10 38h28L27 20V7M15 31h18" />
          : <path d="M9 10h30v28H9zM15 16h7v7h-7zM26 16h7v7h-7zM15 27h7v7h-7zM26 27h7v7h-7z" />
      }
    </svg>
  )
}

export default SpaceIcon
