import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminPanel from './AdminPanel'
import { fetchSpaces } from './api'
import type { AdminSlot, Space, SpaceType } from './types'

const typeColors: Record<SpaceType, string> = {
  Sala: 'room-classroom',
  Laboratorio: 'room-lab',
  Administrativo: 'room-service',
  'Baño hombre': 'room-bathroom',
  'Baño mujer': 'room-bathroom',
}

const defaultView = { rotation: -25, tilt: 55, zoom: 90 }
const flatView = { rotation: 0, tilt: 0, zoom: 90 }

function App() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [accessibleOnly, setAccessibleOnly] = useState(false)
  const [floor, setFloor] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminSlots, setAdminSlots] = useState<AdminSlot[] | null>(null)
  const [rotation, setRotation] = useState(defaultView.rotation)
  const [tilt, setTilt] = useState(defaultView.tilt)
  const [zoom, setZoom] = useState(defaultView.zoom)

  useEffect(() => {
    let cancelled = false

    async function loadSpaces() {
      setLoading(true)
      setApiError(null)

      try {
        const loadedSpaces = await fetchSpaces()
        if (!cancelled) setSpaces(loadedSpaces)
      } catch (error) {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : 'Error desconocido al cargar los espacios.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSpaces()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const filteredSpaces = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')

    return spaces.filter((space) => {
      const matchesFloor = space.floor === floor
      const matchesType = typeFilter === 'Todos' || space.type === typeFilter
      const matchesAccessibility = !accessibleOnly || space.accessible
      const matchesQuery =
        !normalizedQuery ||
        `${space.id} ${space.name} ${space.type}`
          .toLocaleLowerCase('es')
          .includes(normalizedQuery)

      return matchesFloor && matchesType && matchesAccessibility && matchesQuery
    })
  }, [accessibleOnly, floor, query, spaces, typeFilter])

  const selectedSpace = spaces.find((space) => space.id === selectedId)
  const adminMapActive = adminOpen && adminSlots !== null
  const mapSpaces = adminMapActive ? adminSlots : spaces
  const floorSpaces = mapSpaces.filter((space) => space.floor === floor)
  const filteredSpaceIds = new Set(filteredSpaces.map((space) => space.id))
  const updateAdminSlots = useCallback((slots: AdminSlot[] | null) => {
    setAdminSlots(slots)
  }, [])

  function selectSpace(space: Space) {
    setSelectedId(space.id)
  }

  function resetView() {
    setRotation(defaultView.rotation)
    setTilt(defaultView.tilt)
    setZoom(defaultView.zoom)
  }

  function showFlatView() {
    setRotation(flatView.rotation)
    setTilt(flatView.tilt)
    setZoom(flatView.zoom)
  }

  function goToSpace(space: Space) {
    setFloor(space.floor)
    setSelectedId(space.id)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Campus Explorer, inicio">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>campus<span className="brand-light">explorer</span></span>
        </a>
        <div className="topbar-actions">
          <div className="demo-badge"><span /> Demo ficticia</div>
          <button
            type="button"
            className={`admin-entry${adminOpen ? ' is-active' : ''}`}
            onClick={() => {
              setAdminOpen((open) => !open)
              if (adminOpen) setAdminSlots(null)
            }}
            aria-expanded={adminOpen}
          >
            {adminOpen ? 'Cerrar administración' : 'Administrar'}
          </button>
        </div>
      </header>

      <main id="inicio" className="page-content">
        <section className="intro">
          <div>
            <p className="eyebrow">EXPLORA A TU MANERA</p>
            <h1>Encuentra tu próximo espacio</h1>
            <p className="intro-copy">
              Explora un campus de ejemplo y encuentra salas y servicios sin perderte.
            </p>
          </div>
          <div className="campus-chip">
            <span className="campus-icon" aria-hidden="true">⌂</span>
            Campus de demostración
          </div>
        </section>

        <section className="search-panel" aria-label="Buscar espacios">
          <label className="search-field">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <span className="sr-only">Buscar por nombre, código o tipo</span>
            <input
              type="search"
              placeholder="¿Qué espacio estás buscando?"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd>↵</kbd>
          </label>
          <label className="filter-field">
            <span>Tipo de espacio</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option>Todos</option>
              <option>Sala</option>
              <option>Laboratorio</option>
              <option>Administrativo</option>
              <option>Baño hombre</option>
              <option>Baño mujer</option>
            </select>
          </label>
          <label className="accessibility-filter">
            <input
              type="checkbox"
              checked={accessibleOnly}
              onChange={(event) => setAccessibleOnly(event.target.checked)}
            />
            <span className="checkmark" aria-hidden="true">✓</span>
            Accesible
          </label>
        </section>

        {(loading || apiError) && (
          <div className={`api-status${apiError ? ' api-status-error' : ''}`} role="status">
            {apiError ? (
              <>
                <span>No se pudieron cargar los espacios: {apiError}</span>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
                  Reintentar
                </button>
              </>
            ) : (
              <span>Cargando espacios de demostración…</span>
            )}
          </div>
        )}

        <div className="workspace">
          <section className="map-card" aria-label="Plano interactivo de demostración">
            <div className="card-heading">
              <div>
                <h2>Mapa del campus</h2>
                <p>Plano esquemático · selecciona una sala para ver sus detalles</p>
              </div>
              <label className="floor-picker">
                <span className="sr-only">Seleccionar piso</span>
                <select value={floor} onChange={(event) => setFloor(Number(event.target.value))}>
                  <option value={1}>Piso 1</option>
                  <option value={2}>Piso 2</option>
                </select>
                <span aria-hidden="true">⌄</span>
              </label>
            </div>

            <div className="map-stage">
              <div className="map-grid" aria-hidden="true" />
              <div
                className="floor-plan"
                style={{
                  transform: `rotateX(${tilt}deg) rotateZ(${rotation}deg) scale(${zoom / 100})`,
                }}
              >
                <svg
                  className="floor-outline"
                  viewBox="0 0 600 600"
                  role="img"
                  aria-label="Plano esquemático de un edificio con forma de L"
                >
                  <path d="M3 3 H597 V597 H403 V203 H3 Z" />
                </svg                >
                  {floorSpaces.map((space) => {
                    const matchesFilters = filteredSpaceIds.has(space.id)
                    const hiddenInAdmin = adminMapActive && 'enabled' in space && !space.enabled
                    const displayName = space.name || (adminMapActive ? space.id : '')

                    return (
                      <button
                        key={space.id}
                        type="button"
                        className={`map-space ${typeColors[space.type]}${hiddenInAdmin ? ' is-hidden' : ''}${selectedId === space.id ? ' is-selected' : ''}${!adminMapActive && !matchesFilters ? ' is-muted' : ''}`}
                        style={{ gridColumn: space.x + 1, gridRow: space.y + 1 }}
                        onClick={() => setSelectedId(space.id)}
                        disabled={!adminMapActive && !matchesFilters}
                        aria-pressed={selectedId === space.id}
                        aria-label={`${displayName}, ${space.type}${hiddenInAdmin ? ', oculta' : ''}`}
                        title={hiddenInAdmin ? `${displayName} (oculta)` : matchesFilters ? displayName : `${displayName} (no coincide con los filtros)`}
                      >
                        <span className="space-symbol" aria-hidden="true">
                          {space.type.startsWith('Baño') ? '◇' : space.type === 'Administrativo' ? '＋' : '▦'}
                        </span>
                        <span>{displayName}</span>
                      </button>
                    )
                  })}
                {floorSpaces.length === 0 && (
                  <div className="map-empty">No hay espacios cargados para este piso</div>
                )}
              </div>
              <span className="north-indicator" aria-label="Norte">N <span>↑</span></span>
              <div className="map-caption"><span /> {adminMapActive ? 'Casillas ocultas en gris' : 'Espacios de demostración'} · Piso {floor}</div>
            </div>

            <div className="map-controls">
              <div className="control-group">
                <label htmlFor="rotation">Rotación</label>
                <input
                  id="rotation"
                  type="range"
                  min="-180"
                  max="180"
                  value={rotation}
                  onChange={(event) => setRotation(Number(event.target.value))}
                  aria-label={`Rotación: ${rotation} grados`}
                />
              </div>
              <div className="control-group">
                <label htmlFor="tilt">Inclinación</label>
                <input
                  id="tilt"
                  type="range"
                  min="0"
                  max="70"
                  value={tilt}
                  onChange={(event) => setTilt(Number(event.target.value))}
                  aria-label={`Inclinación: ${tilt} grados`}
                />
              </div>
              <div className="control-group">
                <label htmlFor="zoom">Zoom</label>
                <button
                  type="button"
                  className="zoom-button"
                  aria-label="Alejar mapa"
                  onClick={() => setZoom((value) => Math.max(60, value - 10))}
                >−</button>
                <input
                  id="zoom"
                  type="range"
                  min="60"
                  max="140"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  aria-label={`Zoom: ${zoom} por ciento`}
                />
                <button
                  type="button"
                  className="zoom-button"
                  aria-label="Acercar mapa"
                  onClick={() => setZoom((value) => Math.min(140, value + 10))}
                >＋</button>
              </div>
              <button type="button" className="reset-button" onClick={resetView}>
                <span aria-hidden="true">↺</span> Restablecer vista
              </button>
              <button type="button" className="reset-button" onClick={showFlatView}>
                Vista plana
              </button>
            </div>
          </section>

          <aside className="side-column">
            {adminOpen ? (
              <AdminPanel
                floor={floor}
                selectedSlotId={selectedId}
                onSelectSlot={setSelectedId}
                onSlotsChange={updateAdminSlots}
                onSpacesChanged={() => setReloadKey((key) => key + 1)}
              />
            ) : <section className="detail-card" aria-live="polite">
              <div className="side-card-heading">
                <h2>Detalle del espacio</h2>
                <span className="detail-icon" aria-hidden="true">⌖</span>
              </div>
              {selectedSpace ? (
                <div className="selected-details">
                  <span className={`type-tag ${typeColors[selectedSpace.type]}`}>
                    {selectedSpace.type}
                  </span>
                  <h3>{selectedSpace.name}</h3>
                  <p className="space-code">Código · {selectedSpace.id}</p>
                  <p className="space-description">{selectedSpace.description}</p>
                  <div className="detail-divider" />
                  <div className="detail-row">
                    <span>Piso</span><strong>{selectedSpace.floor}</strong>
                  </div>
                  {selectedSpace.capacity && (
                    <div className="detail-row">
                      <span>Capacidad referencial</span><strong>{selectedSpace.capacity} personas</strong>
                    </div>
                  )}
                  <div className="detail-row">
                    <span>Accesibilidad</span>
                    <strong className={selectedSpace.accessible ? 'value-yes' : 'value-no'}>
                      {selectedSpace.accessible ? 'Accesible' : 'No indicada'}
                    </strong>
                  </div>
                  <p className="data-note">Información ficticia para esta demostración.</p>
                </div>
              ) : (
                <div className="empty-detail">
                  <span className="empty-detail-icon" aria-hidden="true">⌖</span>
                  <h3>Selecciona un espacio</h3>
                  <p>Elige una sala o servicio en el mapa o en los resultados.</p>
                </div>
              )}
            </section>}

            <section className="results-card">
              <div className="side-card-heading">
                <div>
                  <h2>Espacios del piso</h2>
                  <p>{filteredSpaces.length} {filteredSpaces.length === 1 ? 'resultado' : 'resultados'}</p>
                </div>
                <span className="result-count">{filteredSpaces.length}</span>
              </div>
              <div className="space-list">
                {filteredSpaces.length ? filteredSpaces.map((space) => (
                  <button
                    className={`space-list-item${selectedId === space.id ? ' is-active' : ''}`}
                    type="button"
                    key={space.id}
                    onClick={() => selectSpace(space)}
                  >
                    <span className={`list-icon ${typeColors[space.type]}`} aria-hidden="true">
                      {space.type.startsWith('Baño') ? '◇' : space.type === 'Administrativo' ? '＋' : '▦'}
                    </span>
                    <span className="list-copy">
                      <strong>{space.name}</strong>
                      <span>{space.type} · Piso {space.floor}</span>
                    </span>
                    <span className="list-arrow" aria-hidden="true">›</span>
                  </button>
                )) : (
                  <div className="no-results">
                    <span aria-hidden="true">⌕</span>
                    <p>No encontramos espacios con esos filtros.</p>
                    <button type="button" onClick={() => {
                      setQuery('')
                      setTypeFilter('Todos')
                      setAccessibleOnly(false)
                    }}>Limpiar filtros</button>
                  </div>
                )}
              </div>
            </section>

            {!adminOpen && selectedSpace && (
              <button type="button" className="show-on-map" onClick={() => goToSpace(selectedSpace)}>
                Ver {selectedSpace.name} en el mapa <span aria-hidden="true">↗</span>
              </button>
            )}
          </aside>
        </div>

        <footer className="page-footer">
          <span className="footer-mark">i</span>
          <p>
            Prototipo de portafolio con datos inventados. No representa una sede real ni
            muestra información institucional.
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
