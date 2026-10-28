// Iconos de Tabler Icons (https://tabler.io/icons), licencia MIT. Ver README, sección «Créditos y licencias».
const iconPaths = {
  chalkboard: [
    'M8 19h-3a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v11a1 1 0 0 1 -1 1',
    'M11 17a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -1',
  ],
  'device-desktop': [
    'M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10',
    'M7 20h10',
    'M9 16v4',
    'M15 16v4',
  ],
  briefcase: [
    'M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9',
    'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2',
    'M12 12l0 .01',
    'M3 13a20 20 0 0 0 18 0',
  ],
  man: [
    'M10 16v5',
    'M14 16v5',
    'M9 9h6l-1 7h-4l-1 -7',
    'M5 11c1.333 -1.333 2.667 -2 4 -2',
    'M19 11c-1.333 -1.333 -2.667 -2 -4 -2',
    'M10 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ],
  woman: [
    'M10 16v5',
    'M14 16v5',
    'M8 16h8l-2 -7h-4l-2 7',
    'M5 11c1.667 -1.333 3.333 -2 5 -2',
    'M19 11c-1.667 -1.333 -3.333 -2 -5 -2',
    'M10 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ],
  stairs: ['M22 5h-5v5h-5v5h-5v5h-5'],
  elevator: [
    'M5 5a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -14',
    'M10 10l2 -2l2 2',
    'M10 14l2 2l2 -2',
  ],
  'tools-kitchen-2': ['M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3'],
  wall: [
    'M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12',
    'M4 8h16',
    'M20 12h-16',
    'M4 16h16',
    'M9 4v4',
    'M14 8v4',
    'M8 12v4',
    'M16 12v4',
    'M11 16v4',
  ],
  'hand-stop': [
    'M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5',
    'M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5',
    'M14 5.5a1.5 1.5 0 0 1 3 0v6.5',
    'M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47',
  ],
  filter: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227'],
  search: ['M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'],
  plus: ['M12 5l0 14', 'M5 12l14 0'],
  minus: ['M5 12l14 0'],
  refresh: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
  x: ['M18 6l-12 12', 'M6 6l12 12'],
  'chevron-down': ['M6 9l6 6l6 -6'],
  'chevron-right': ['M9 6l6 6l-6 6'],
  'arrow-up': ['M12 5l0 14', 'M18 11l-6 -6', 'M6 11l6 -6'],
  'arrow-up-right': ['M17 7l-10 10', 'M8 7l9 0l0 9'],
  'current-location': [
    'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
    'M4 12a8 8 0 1 0 16 0a8 8 0 1 0 -16 0',
    'M12 2l0 2',
    'M12 20l0 2',
    'M20 12l2 0',
    'M2 12l2 0',
  ],
  lock: [
    'M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6',
    'M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0',
    'M8 11v-4a4 4 0 1 1 8 0v4',
  ],
  check: ['M5 12l5 5l10 -10'],
  'question-mark': ['M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4', 'M12 19l0 .01'],
  home: [
    'M5 12l-2 0l9 -9l9 9l-2 0',
    'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7',
    'M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
  ],
  'info-circle': ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 9h.01', 'M11 12h1v4h1'],
  'corner-down-left': ['M18 6v6a3 3 0 0 1 -3 3h-10l4 -4m0 8l-4 -4'],
} as const

export type IconName = keyof typeof iconPaths

type IconProps = {
  name: IconName
  className?: string
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name].map((path) => <path key={path} d={path} />)}
    </svg>
  )
}
