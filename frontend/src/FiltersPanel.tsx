import { useEffect, useRef, type RefObject } from 'react'
import { Icon } from './icons'
import SpaceIcon from './SpaceIcon'
import { getSpaceColorClass, spaceKinds } from './types'

type FiltersPanelProps = {
  open: boolean
  triggerRef: RefObject<HTMLElement | null>
  showWalls: boolean
  onToggleWalls: () => void
  activeKinds: ReadonlySet<string>
  accessibleOnly: boolean
  resultCount: number
  onToggleKind: (key: string) => void
  onToggleAccessible: () => void
  onReset: () => void
  onClose: (restoreFocus: boolean) => void
}

function FiltersPanel({
  open,
  triggerRef,
  showWalls,
  onToggleWalls,
  activeKinds,
  accessibleOnly,
  resultCount,
  onToggleKind,
  onToggleAccessible,
  onReset,
  onClose,
}: FiltersPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(true)
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      onClose(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open, onClose, triggerRef])

  return (
    <aside
      ref={panelRef}
      id="filters-drawer"
      className={`filters-drawer${open ? ' is-open' : ''}`}
      role="dialog"
      aria-label="Filtros"
      inert={!open}
    >
      <div className="filters-drawer-heading">
        <div>
          <h2>Filtros</h2>
          <p>Los espacios en color se muestran; los grises se ocultan.</p>
        </div>
        <button ref={closeButtonRef} type="button" className="filters-close" onClick={() => onClose(true)} aria-label="Cerrar filtros">
          <Icon name="x" />
        </button>
      </div>

      <div className="filters-grid">
        {spaceKinds.map((kind) => {
          const active = activeKinds.has(kind.key)

          return (
            <button
              key={kind.key}
              type="button"
              className={`filter-tile ${getSpaceColorClass(kind.type, kind.category)}${active ? ' is-on' : ''}`}
              aria-pressed={active}
              onClick={() => onToggleKind(kind.key)}
            >
              <SpaceIcon type={kind.type} category={kind.category} />
              <span>{kind.key}</span>
            </button>
          )
        })}
        <button
          type="button"
          className={`filter-tile filter-tile-accessible${accessibleOnly ? ' is-on' : ''}`}
          aria-pressed={accessibleOnly}
          onClick={onToggleAccessible}
        >
          <Icon name="hand-stop" />
          <span>Accesible</span>
        </button>
        <button
          type="button"
          className={`filter-tile filter-tile-walls${showWalls ? ' is-on' : ''}`}
          aria-pressed={showWalls}
          onClick={onToggleWalls}
        >
          <Icon name="wall" />
          <span>Paredes</span>
        </button>
      </div>

      <div className="filters-drawer-footer">
        <span>{resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}</span>
        <button type="button" onClick={onReset}>Restablecer filtros</button>
      </div>
    </aside>
  )
}

export default FiltersPanel
