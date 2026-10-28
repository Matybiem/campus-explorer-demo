import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import AdminPanel from './AdminPanel'
import SpaceIcon from './SpaceIcon'
import { fetchFloorPlan, fetchFloors, fetchSpaces } from './api'
import { setAdminFloorActive } from './adminApi'
import { floorLabel, getSpaceColorClass, getSpaceLabel, spaceTypes, type AdminSlot, type ContourCell, type FloorPlan, type Space } from './types'

const defaultView = { rotation: -39, tilt: 61, zoom: 60 }
const flatView = { rotation: 0, tilt: 0, zoom: 55 }
const matrixSize = 15
const mapCellSize = 60
const wallHeight = mapCellSize
const mapCanvasPadding = 240
const slotDragDelayMs = 400
const orbitThresholdPx = 5
const orbitDegreesPerPixel = 0.4
const minZoom = 20
const maxZoom = 140
const wheelZoomPerPixel = 0.05
const stackLayerGap = wallHeight
const stackSelectedGap = 130
const stackFit = 1
const svgCellSize = 100

function getContourPaths(cells: ContourCell[]) {
  const occupied = new Set(
    cells
      .filter(({ x, y }) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < matrixSize && y >= 0 && y < matrixSize)
      .map(({ x, y }) => `${x}:${y}`),
  )
  let fillPath = ''
  let outlinePath = ''

  for (const cell of occupied) {
    const [x, y] = cell.split(':').map(Number)
    const left = x * svgCellSize
    const top = y * svgCellSize
    fillPath += `M${left} ${top}h${svgCellSize}v${svgCellSize}h-${svgCellSize}z`
    if (!occupied.has(`${x}:${y - 1}`)) outlinePath += `M${left} ${top}h${svgCellSize}`
    if (!occupied.has(`${x + 1}:${y}`)) outlinePath += `M${left + svgCellSize} ${top}v${svgCellSize}`
    if (!occupied.has(`${x}:${y + 1}`)) outlinePath += `M${left + svgCellSize} ${top + svgCellSize}h-${svgCellSize}`
    if (!occupied.has(`${x - 1}:${y}`)) outlinePath += `M${left} ${top + svgCellSize}v-${svgCellSize}`
  }

  return { fillPath, outlinePath }
}

type ContourWall = {
  key: string
  orientation: 'horizontal' | 'vertical'
  line: number
  start: number
  length: number
}

function getContourWalls(cells: ContourCell[]): ContourWall[] {
  const occupied = new Set(
    cells
      .filter(({ x, y }) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < matrixSize && y >= 0 && y < matrixSize)
      .map(({ x, y }) => `${x}:${y}`),
  )
  const horizontal = new Map<number, number[]>()
  const vertical = new Map<number, number[]>()
  const addEdge = (edges: Map<number, number[]>, line: number, position: number) => {
    edges.set(line, [...(edges.get(line) ?? []), position])
  }

  for (const cell of occupied) {
    const [x, y] = cell.split(':').map(Number)
    if (!occupied.has(`${x}:${y - 1}`)) addEdge(horizontal, y, x)
    if (!occupied.has(`${x}:${y + 1}`)) addEdge(horizontal, y + 1, x)
    if (!occupied.has(`${x - 1}:${y}`)) addEdge(vertical, x, y)
    if (!occupied.has(`${x + 1}:${y}`)) addEdge(vertical, x + 1, y)
  }

  const walls: ContourWall[] = []
  const mergeRuns = (edges: Map<number, number[]>, orientation: ContourWall['orientation']) => {
    for (const [line, positions] of edges) {
      const sorted = [...positions].sort((a, b) => a - b)
      let start = sorted[0]
      let previous = sorted[0]
      for (const position of [...sorted.slice(1), Infinity]) {
        if (position === previous + 1) {
          previous = position
          continue
        }
        walls.push({ key: `${orientation}-${line}-${start}`, orientation, line, start, length: previous - start + 1 })
        start = position
        previous = position
      }
    }
  }
  mergeRuns(horizontal, 'horizontal')
  mergeRuns(vertical, 'vertical')

  return walls
}

function FloorWalls({ walls }: { walls: ContourWall[] }) {
  return (
    <div className="floor-walls" aria-hidden="true">
      {walls.map((wall) => (
        <span
          key={wall.key}
          className={`floor-wall floor-wall-${wall.orientation}`}
          style={wall.orientation === 'horizontal'
            ? {
              left: `${wall.start * mapCellSize}px`,
              top: `${wall.line * mapCellSize}px`,
              width: `${wall.length * mapCellSize}px`,
              height: `${wallHeight}px`,
            }
            : {
              left: `${wall.line * mapCellSize}px`,
              top: `${wall.start * mapCellSize}px`,
              width: `${wallHeight}px`,
              height: `${wall.length * mapCellSize}px`,
            }}
        />
      ))}
    </div>
  )
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
  const [floors, setFloors] = useState<FloorPlan[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminSlots, setAdminSlots] = useState<AdminSlot[] | null>(null)
  const [hasPendingAdminChanges, setHasPendingAdminChanges] = useState(false)
  const [floorPlan, setFloorPlan] = useState<FloorPlan>({
    floor: 1,
    horizontalLength: matrixSize,
    verticalLength: matrixSize,
    contourCells: [],
  })
  const [floorBusy, setFloorBusy] = useState(false)
  const [floorError, setFloorError] = useState<string | null>(null)
  const [rotation, setRotation] = useState(defaultView.rotation)
  const [tilt, setTilt] = useState(defaultView.tilt)
  const [zoom, setZoom] = useState(defaultView.zoom)
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const orbitRef = useRef<{ x: number; y: number; rotation: number; tilt: number; active: boolean } | null>(null)
  const orbitedRef = useRef(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [stackView, setStackView] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2
    viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2
  }, [stackView])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      setZoom((value) => Math.max(minZoom, Math.min(maxZoom, Math.round(value - event.deltaY * wheelZoomPerPixel))))
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])
  const [stackContours, setStackContours] = useState<Record<number, ContourCell[]>>({})
  const swapSlotsRef = useRef<((fromId: string, toId: string) => void) | null>(null)
  const dragTimerRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const [dragSourceId, setDragSourceId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  function cancelDragTimer() {
    if (dragTimerRef.current !== null) {
      window.clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
  }

  function slotIdAtPoint(x: number, y: number) {
    const element = document.elementFromPoint(x, y)
    return element?.closest<HTMLElement>('[data-slot-id]')?.dataset.slotId ?? null
  }

  function startSlotDrag(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || !adminMapActive) return
    cancelDragTimer()

    const cleanup = () => {
      cancelDragTimer()
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('pointermove', handleMove)
      setDragSourceId(null)
      setDragOverId(null)
    }
    const handleMove = (moveEvent: PointerEvent) => {
      if (dragTimerRef.current === null && !orbitedRef.current) setDragOverId(slotIdAtPoint(moveEvent.clientX, moveEvent.clientY))
    }
    const handleUp = (upEvent: PointerEvent) => {
      const dragging = dragTimerRef.current === null && !orbitedRef.current
      const targetId = slotIdAtPoint(upEvent.clientX, upEvent.clientY)
      cleanup()
      if (!dragging) return
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 0)
      if (targetId && targetId !== id) swapSlotsRef.current?.(id, targetId)
    }
    const handleCancel = () => cleanup()

    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('pointermove', handleMove)
    dragTimerRef.current = window.setTimeout(() => {
      dragTimerRef.current = null
      setDragSourceId(id)
    }, slotDragDelayMs)
  }

  useEffect(() => {
    let cancelled = false

    async function loadSpaces() {
      setLoading(true)
      setApiError(null)

      try {
        const [loadedSpaces, loadedFloorPlan, loadedFloors] = await Promise.all([
          fetchSpaces(),
          fetchFloorPlan(floor),
          fetchFloors(),
        ])
        if (!cancelled) {
          setSpaces(loadedSpaces)
          setFloorPlan(loadedFloorPlan)
          setFloors(loadedFloors)
        }
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
  }, [floor, reloadKey])

  useEffect(() => {
    if (!stackView) return
    let cancelled = false

    async function loadStackPlans() {
      try {
        const plans = await Promise.all(floors.map((item) => fetchFloorPlan(item.floor)))
        if (cancelled) return
        setStackContours(Object.fromEntries(plans.map((plan, index) => [floors[index].floor, plan.contourCells ?? []])))
      } catch {
        if (!cancelled) setStackContours({})
      }
    }

    void loadStackPlans()
    return () => {
      cancelled = true
    }
  }, [stackView, floors, reloadKey])

  const filteredSpaces = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')

    return spaces.filter((space) => {
      const matchesType = typeFilter === 'Todos' || space.type === typeFilter
      const matchesAccessibility = !accessibleOnly || space.accessible
      const matchesQuery =
        !normalizedQuery ||
        `${space.id} ${space.name} ${space.type} ${space.category ?? ''}`
          .toLocaleLowerCase('es')
          .includes(normalizedQuery)

      return matchesType && matchesAccessibility && matchesQuery
    })
  }, [accessibleOnly, query, spaces, typeFilter])

  const selectedSpace = spaces.find((space) => space.id === selectedId)
  const adminMapActive = adminOpen && adminSlots !== null
  const mapSpaces = adminMapActive ? adminSlots : spaces
  const floorSpaces = mapSpaces.filter((space) => space.floor === floor)
  const filteredSpaceIds = new Set(filteredSpaces.map((space) => space.id))
  const updateAdminSlots = useCallback((slots: AdminSlot[] | null) => {
    setAdminSlots(slots)
  }, [])
  const updateFloorPlan = useCallback((plan: FloorPlan) => {
    setFloorPlan(plan)
  }, [])
  const updatePendingAdminChanges = useCallback((hasChanges: boolean) => {
    setHasPendingAdminChanges(hasChanges)
  }, [])

  async function changeFloorActive(targetFloor: number, active: boolean) {
    setFloorBusy(true)
    setFloorError(null)
    try {
      const result = await setAdminFloorActive(targetFloor, active)
      setFloors(result.floors)
      setReloadKey((key) => key + 1)
      if (!active && floor === targetFloor) {
        setFloor(1)
        setSelectedId(null)
      }
    } catch (error) {
      setFloorError(error instanceof Error ? error.message : 'No se pudo modificar el nivel.')
    } finally {
      setFloorBusy(false)
    }
  }

  const orderedFloors = [...floors].sort((a, b) => b.floor - a.floor)
  const activePositiveFloors = floors.filter((item) => item.floor > 0)
  const activeBasements = floors.filter((item) => item.floor < 0)
  const highestFloor = Math.max(0, ...activePositiveFloors.map(({ floor: level }) => level))
  const deepestBasement = Math.min(0, ...activeBasements.map(({ floor: level }) => level))

  function selectSpace(space: Space) {
    setFloor(space.floor)
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

  const planWidth = floorPlan.horizontalLength * mapCellSize
  const planHeight = floorPlan.verticalLength * mapCellSize
  const contourCells = adminMapActive
    ? floorSpaces
      .filter((space): space is AdminSlot => 'useContour' in space)
      .filter((slot) => slot.enabled || slot.useContour)
    : floorPlan.contourCells ?? []
  const { fillPath, outlinePath } = getContourPaths(contourCells)
  const contourWalls = getContourWalls(contourCells)
  const rotationRadians = rotation * Math.PI / 180
  const tiltScale = Math.cos(tilt * Math.PI / 180)
  const stackActive = stackView && !adminMapActive
  const zoomScale = (zoom / 100) * (stackActive ? stackFit : 1)
  const stackFloors = orderedFloors
  const selectedStackIndex = stackFloors.findIndex((item) => item.floor === floor)
  const hasFloorsAbove = selectedStackIndex > 0
  const stackTotalHeight = Math.max(0, stackFloors.length - 1) * stackLayerGap +
    (hasFloorsAbove ? stackSelectedGap : 0)
  const stackExtraHeight = stackActive
    ? (stackTotalHeight + wallHeight) * Math.sin(tilt * Math.PI / 180) * zoomScale
    : 0
  const mapCanvasWidth = Math.ceil(
    (Math.abs(Math.cos(rotationRadians)) * planWidth +
      Math.abs(Math.sin(rotationRadians)) * planHeight * tiltScale) * zoomScale +
      mapCanvasPadding * 2,
  )
  const mapCanvasHeight = Math.ceil(
    (Math.abs(Math.sin(rotationRadians)) * planWidth +
      Math.abs(Math.cos(rotationRadians)) * planHeight * tiltScale) * zoomScale +
      stackExtraHeight +
      mapCanvasPadding * 2,
  )

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
            disabled={adminOpen && hasPendingAdminChanges}
            title={adminOpen && hasPendingAdminChanges ? 'Guarda los cambios pendientes antes de cerrar.' : undefined}
            onClick={() => {
              setAdminOpen((open) => !open)
              if (adminOpen) {
                setAdminSlots(null)
                setHasPendingAdminChanges(false)
              }
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
              <div className="floor-heading-tools">
                <label className="floor-picker">
                  <span className="sr-only">Seleccionar nivel</span>
                  <select
                    value={floor}
                    onChange={(event) => setFloor(Number(event.target.value))}
                    disabled={adminOpen && hasPendingAdminChanges}
                    title={adminOpen && hasPendingAdminChanges ? 'Guarda los cambios pendientes antes de cambiar de nivel.' : undefined}
                  >
                    {orderedFloors.map((item) => (
                      <option key={item.floor} value={item.floor}>{floorLabel(item.floor)}</option>
                    ))}
                  </select>
                  <span aria-hidden="true">⌄</span>
                </label>
                {!adminMapActive && (
                  <button
                    type="button"
                    className={`stack-toggle${stackView ? ' is-active' : ''}`}
                    aria-pressed={stackView}
                    onClick={() => {
                      if (!stackView && orderedFloors.length > 0) setFloor(orderedFloors[0].floor)
                      setStackView((value) => !value)
                    }}
                  >
                    {stackView ? 'Ver un piso' : 'Ver todos los pisos'}
                  </button>
                )}
                {adminMapActive && (
                  <div className="floor-admin-controls" aria-label="Administrar niveles">
                    <div>
                      <span>{activePositiveFloors.length}/10 pisos</span>
                      <button
                        type="button"
                        disabled={floorBusy || hasPendingAdminChanges || highestFloor >= 10}
                        onClick={() => void changeFloorActive(highestFloor + 1, true)}
                      >＋ Piso</button>
                      <button
                        type="button"
                        disabled={floorBusy || hasPendingAdminChanges || highestFloor <= 1}
                        onClick={() => void changeFloorActive(highestFloor, false)}
                        aria-label={`Desactivar ${floorLabel(highestFloor)}`}
                        title={`Desactivar ${floorLabel(highestFloor)}`}
                      >−</button>
                    </div>
                    <div>
                      <span>{activeBasements.length}/5 subterráneos</span>
                      <button
                        type="button"
                        disabled={floorBusy || hasPendingAdminChanges || deepestBasement <= -5}
                        onClick={() => void changeFloorActive(deepestBasement - 1, true)}
                      >＋ Subterráneo</button>
                      <button
                        type="button"
                        disabled={floorBusy || hasPendingAdminChanges || deepestBasement === 0}
                        onClick={() => void changeFloorActive(deepestBasement, false)}
                        aria-label={deepestBasement === 0 ? 'No hay subterráneos que desactivar' : `Desactivar ${floorLabel(deepestBasement)}`}
                        title={deepestBasement === 0 ? 'No hay subterráneos que desactivar' : `Desactivar ${floorLabel(deepestBasement)}`}
                      >−</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {adminMapActive && floorError && <div className="floor-admin-error" role="alert">{floorError}</div>}

            <div className="map-stage">
              <div
                className="map-viewport"
                ref={viewportRef}
                role="region"
                aria-label={`Plano de ${floorLabel(floor)}; desplázate para recorrer el mapa completo`}
                tabIndex={0}
                onContextMenu={(event) => event.preventDefault()}
                onPointerDown={(event) => {
                  const viewport = event.currentTarget
                  if (event.button === 0) {
                    const bounds = viewport.getBoundingClientRect()
                    const onScrollbar = event.clientX - bounds.left >= viewport.clientWidth ||
                      event.clientY - bounds.top >= viewport.clientHeight
                    if (onScrollbar) return
                    orbitedRef.current = false
                    orbitRef.current = {
                      x: event.clientX,
                      y: event.clientY,
                      rotation,
                      tilt,
                      active: false,
                    }
                    return
                  }
                  if (event.button !== 2) return
                  event.preventDefault()
                  panRef.current = {
                    x: event.clientX,
                    y: event.clientY,
                    left: viewport.scrollLeft,
                    top: viewport.scrollTop,
                  }
                  viewport.setPointerCapture(event.pointerId)
                  viewport.classList.add('is-panning')
                }}
                onPointerMove={(event) => {
                  const orbit = orbitRef.current
                  if (orbit && !dragSourceId) {
                    const deltaX = event.clientX - orbit.x
                    const deltaY = event.clientY - orbit.y
                    if (!orbit.active && Math.hypot(deltaX, deltaY) > orbitThresholdPx) {
                      orbit.active = true
                      orbitedRef.current = true
                      cancelDragTimer()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      event.currentTarget.classList.add('is-orbiting')
                    }
                    if (orbit.active) {
                      setRotation(Math.max(-180, Math.min(180, Math.round(orbit.rotation + deltaX * orbitDegreesPerPixel))))
                      setTilt(Math.max(0, Math.min(90, Math.round(orbit.tilt - deltaY * orbitDegreesPerPixel))))
                      return
                    }
                  }
                  const pan = panRef.current
                  if (!pan) return
                  event.currentTarget.scrollLeft = pan.left - (event.clientX - pan.x)
                  event.currentTarget.scrollTop = pan.top - (event.clientY - pan.y)
                }}
                onPointerUp={(event) => {
                  const orbit = orbitRef.current
                  if (event.button === 0 && orbit) {
                    orbitRef.current = null
                    if (orbit.active) {
                      suppressClickRef.current = true
                      window.setTimeout(() => { suppressClickRef.current = false }, 0)
                      event.currentTarget.classList.remove('is-orbiting')
                      event.currentTarget.releasePointerCapture(event.pointerId)
                    }
                    return
                  }
                  if (event.button !== 2 || !panRef.current) return
                  panRef.current = null
                  event.currentTarget.classList.remove('is-panning')
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }}
                onPointerCancel={(event) => {
                  orbitRef.current = null
                  panRef.current = null
                  event.currentTarget.classList.remove('is-panning', 'is-orbiting')
                }}
              >
                <div
                  className="map-canvas"
                  style={{
                    width: `${mapCanvasWidth}px`,
                    height: `${mapCanvasHeight}px`,
                  }}
                >
                  {stackActive ? (
                    <div
                      className="floor-stack"
                      style={{
                        transform: `rotateX(${tilt}deg) rotateZ(${rotation}deg) scale(${zoomScale})`,
                        width: `${planWidth}px`,
                        height: `${planHeight}px`,
                      }}
                    >
                      {[...stackFloors].reverse().map((item, index) => {
                        const layerContour = getContourPaths(stackContours[item.floor] ?? [])
                        const layerSpaces = spaces.filter((space) => space.floor === item.floor)
                        const aboveSelected = hasFloorsAbove && index > stackFloors.length - 1 - selectedStackIndex
                        const offset = index * stackLayerGap +
                          (aboveSelected ? stackSelectedGap : 0) -
                          stackTotalHeight / 2

                        return (
                          <div
                            key={item.floor}
                            className={`floor-plan stack-layer${item.floor === floor ? ' is-current' : ''}`}
                            style={{
                              transform: `translateZ(${offset}px)`,
                              width: `${planWidth}px`,
                              height: `${planHeight}px`,
                              gridTemplateColumns: `repeat(${floorPlan.horizontalLength}, ${mapCellSize}px)`,
                              gridTemplateRows: `repeat(${floorPlan.verticalLength}, ${mapCellSize}px)`,
                            }}
                          >
                            <svg
                              className="floor-outline"
                              viewBox={`0 0 ${floorPlan.horizontalLength * svgCellSize} ${floorPlan.verticalLength * svgCellSize}`}
                              aria-hidden="true"
                            >
                              <path className="floor-fill" d={layerContour.fillPath} />
                              <path className="floor-boundary" d={layerContour.outlinePath} />
                            </svg>
                            <FloorWalls walls={getContourWalls(stackContours[item.floor] ?? [])} />
                            {layerSpaces.map((space) => {
                              const matchesFilters = filteredSpaceIds.has(space.id)
                              const displayName = getSpaceLabel(space)

                              return (
                                <button
                                  key={space.id}
                                  type="button"
                                  className={`map-space ${getSpaceColorClass(space.type, space.category)}${selectedId === space.id ? ' is-selected' : ''}${!matchesFilters ? ' is-muted' : ''}`}
                                  style={{ gridColumn: space.x + 1, gridRow: space.y + 1 }}
                                  onClick={() => {
                                    if (suppressClickRef.current) return
                                    goToSpace(space)
                                  }}
                                  disabled={!matchesFilters}
                                  aria-pressed={selectedId === space.id}
                                  aria-label={`${displayName}, ${space.type}, ${floorLabel(item.floor)}`}
                                  title={`${displayName} · ${floorLabel(item.floor)}`}
                                >
                                  <span className="space-symbol"><SpaceIcon type={space.type} category={space.category} /></span>
                                  <span>{displayName}</span>
                                </button>
                              )
                            })}
                            <span className="stack-layer-label">{floorLabel(item.floor)}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                  <div
                    className="floor-plan"
                    style={{
                      transform: `rotateX(${tilt}deg) rotateZ(${rotation}deg) scale(${zoom / 100})`,
                      width: `${floorPlan.horizontalLength * mapCellSize}px`,
                      height: `${floorPlan.verticalLength * mapCellSize}px`,
                      aspectRatio: `${floorPlan.horizontalLength} / ${floorPlan.verticalLength}`,
                      gridTemplateColumns: `repeat(${floorPlan.horizontalLength}, ${mapCellSize}px)`,
                      gridTemplateRows: `repeat(${floorPlan.verticalLength}, ${mapCellSize}px)`,
                    }}
                  >
                    <svg
                      className="floor-outline"
                      viewBox={`0 0 ${floorPlan.horizontalLength * svgCellSize} ${floorPlan.verticalLength * svgCellSize}`}
                      aria-hidden="true"
                    >
                      <path className="floor-fill" d={fillPath} />
                      <path className="floor-boundary" d={outlinePath} />
                    </svg>
                    <FloorWalls walls={contourWalls} />
                    {floorSpaces.map((space) => {
                      const matchesFilters = filteredSpaceIds.has(space.id)
                      const hiddenInAdmin = adminMapActive && 'enabled' in space && !space.enabled
                      const displayName = getSpaceLabel(space)

                      return (
                        <button
                          key={space.id}
                          type="button"
                          className={`map-space ${getSpaceColorClass(space.type, space.category)}${hiddenInAdmin ? ' is-hidden' : ''}${selectedId === space.id ? ' is-selected' : ''}${!adminMapActive && !matchesFilters ? ' is-muted' : ''}${dragSourceId === space.id ? ' is-drag-source' : ''}${dragSourceId && dragOverId === space.id && dragOverId !== dragSourceId ? ' is-drag-target' : ''}`}
                          style={{ gridColumn: space.x + 1, gridRow: space.y + 1 }}
                          data-slot-id={space.id}
                          onPointerDown={(event) => startSlotDrag(event, space.id)}
                          onClick={() => {
                            if (suppressClickRef.current) return
                            setSelectedId(space.id)
                          }}
                          disabled={!adminMapActive && !matchesFilters}
                          aria-pressed={selectedId === space.id}
                          aria-label={`${displayName}, ${space.type}${hiddenInAdmin ? ', oculta' : ''}`}
                          title={hiddenInAdmin ? `${displayName} (oculta)` : matchesFilters ? displayName : `${displayName} (no coincide con los filtros)`}
                        >
                          <span className="space-symbol"><SpaceIcon type={space.type} category={space.category} /></span>
                          <span>{displayName}</span>
                        </button>
                      )
                    })}
                    {floorSpaces.length === 0 && (
                      <div className="map-empty">No hay espacios cargados para este piso</div>
                    )}
                  </div>
                  )}
                </div>
              </div>
              <span className="north-indicator" aria-label="Norte">N <span>↑</span></span>
              <div className="map-caption"><span /> {adminMapActive ? 'Casillas ocultas en gris' : 'Espacios de demostración'} · {floorLabel(floor)}</div>
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
                  onClick={() => setZoom((value) => Math.max(minZoom, value - 10))}
                >−</button>
                <input
                  id="zoom"
                  type="range"
                  min={minZoom}
                  max={maxZoom}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  aria-label={`Zoom: ${zoom} por ciento`}
                />
                <button
                  type="button"
                  className="zoom-button"
                  aria-label="Acercar mapa"
                  onClick={() => setZoom((value) => Math.min(maxZoom, value + 10))}
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
                onFloorPlanChange={updateFloorPlan}
                onPendingChangesChange={updatePendingAdminChanges}
                swapRef={swapSlotsRef}
                onSpacesChanged={() => setReloadKey((key) => key + 1)}
              />
            ) : <section className="detail-card" aria-live="polite">
              <div className="side-card-heading">
                <h2>Detalle del espacio</h2>
                <span className="detail-icon" aria-hidden="true">⌖</span>
              </div>
              {selectedSpace ? (
                <div className="selected-details">
                  <span className={`type-tag ${getSpaceColorClass(selectedSpace.type, selectedSpace.category)}`}>
                    <SpaceIcon type={selectedSpace.type} category={selectedSpace.category} />
                    {selectedSpace.type === 'Espacio común'
                      ? `${selectedSpace.type} · ${getSpaceLabel(selectedSpace)}`
                      : selectedSpace.type}
                  </span>
                  <h3>{getSpaceLabel(selectedSpace)}</h3>
                  <p className="space-code">Código · {selectedSpace.id}</p>
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
                  {selectedSpace.description && (
                    <p className="space-description">{selectedSpace.description}</p>
                  )}
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

            <section className="search-panel" aria-label="Buscar espacios">
              <label className="search-field">
                <span className="search-icon" aria-hidden="true">⌕</span>
                <span className="sr-only">Buscar por nombre, código, tipo o categoría</span>
                <input
                  type="search"
                  placeholder="¿Qué espacio o categoría buscas?"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <kbd>↵</kbd>
              </label>
              <div className="search-filters">
                <label className="filter-field">
                  <span>Tipo de espacio</span>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option>Todos</option>
                    {spaceTypes.map((type) => <option key={type}>{type}</option>)}
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
              </div>
            </section>

            <section className="results-card">
              <div className="side-card-heading">
                <div>
                  <h2>Espacios encontrados</h2>
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
                    <span className={`list-icon ${getSpaceColorClass(space.type, space.category)}`}>
                      <SpaceIcon type={space.type} category={space.category} />
                    </span>
                    <span className="list-copy">
                      <strong>{getSpaceLabel(space)}</strong>
                      <span>{space.type} · {floorLabel(space.floor)}</span>
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
                Ver {getSpaceLabel(selectedSpace)} en el mapa <span aria-hidden="true">↗</span>
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
