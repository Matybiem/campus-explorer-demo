import { useEffect, useMemo, useState } from 'react'
import { fetchSpaces } from './api'
import type { Space, SpaceType } from './types'

const typeColors: Record<SpaceType, string> = {
  Sala: 'room-classroom',
  Laboratorio: 'room-lab',
  Baño: 'room-bathroom',
  Servicio: 'room-service',
}

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
  const [rotation, setRotation] = useState(-12)
  const [tilt, setTilt] = useState(52)
  const [zoom, setZoom] = useState(90)

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

  function selectSpace(space: Space) {
    setSelectedId(space.id)
  }

  function resetView() {
    setRotation(-12)
    setTilt(52)
    setZoom(90)
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
        <div className="demo-badge"><span /> Demo ficticia</div>
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
              <option>Baño</option>
              <option>Servicio</option>
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
                <p>Selecciona un espacio para ver sus detalles</p>
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
                <div className="hallway hallway-horizontal" />
                <div className="hallway hallway-vertical" />
                {filteredSpaces.map((space) => (
                  <button
                    key={space.id}
                    type="button"
                    className={`map-space ${typeColors[space.type]}${selectedId === space.id ? ' is-selected' : ''}`}
                    style={{ left: `${space.x}%`, top: `${space.y}%` }}
                    onClick={() => selectSpace(space)}
                    aria-pressed={selectedId === space.id}
                    aria-label={`${space.name}, ${space.type}`}
                  >
                    <span className="space-symbol" aria-hidden="true">
                      {space.type === 'Baño' ? '◇' : space.type === 'Servicio' ? '＋' : '▦'}
                    </span>
                    <span>{space.name}</span>
                  </button>
                ))}
                {filteredSpaces.length === 0 && (
                  <div className="map-empty">No hay espacios que coincidan</div>
                )}
              </div>
              <span className="north-indicator" aria-label="Norte">N <span>↑</span></span>
              <div className="map-caption"><span /> Espacios de demostración · Piso {floor}</div>
            </div>

            <div className="map-controls">
              <div className="control-group">
                <label htmlFor="rotation">Giro</label>
                <input
                  id="rotation"
                  type="range"
                  min="-40"
                  max="40"
                  value={rotation}
                  onChange={(event) => setRotation(Number(event.target.value))}
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
                  max="120"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
                <button
                  type="button"
                  className="zoom-button"
                  aria-label="Acercar mapa"
                  onClick={() => setZoom((value) => Math.min(120, value + 10))}
                >＋</button>
              </div>
              <button type="button" className="reset-button" onClick={resetView}>
                <span aria-hidden="true">↺</span> Restablecer vista
              </button>
            </div>
          </section>

          <aside className="side-column">
            <section className="detail-card" aria-live="polite">
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
            </section>

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
                      {space.type === 'Baño' ? '◇' : space.type === 'Servicio' ? '＋' : '▦'}
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

            {selectedSpace && (
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
