import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react'
import {
  getAdminSession,
  getAdminSlots,
  loginAdmin,
  logoutAdmin,
  spaceTypes,
  updateAdminSlots,
} from './adminApi'
import { fetchFloorPlan } from './api'
import { Icon } from './icons'
import SpaceCategoryPicker from './SpaceCategoryPicker'
import { floorLabel, type AdminSlot, type FloorPlan, type SpaceCategory } from './types'

type AdminPanelProps = {
  floor: number
  selectedSlotId: string | null
  onSelectSlot: (id: string) => void
  onSlotsChange: (slots: AdminSlot[] | null) => void
  onFloorPlanChange: (plan: FloorPlan) => void
  onPendingChangesChange: (hasChanges: boolean) => void
  onSpacesChanged: () => void
  swapRef?: MutableRefObject<((fromId: string, toId: string) => void) | null>
}

function AdminPanel({
  floor,
  selectedSlotId,
  onSelectSlot,
  onSlotsChange,
  onFloorPlanChange,
  onPendingChangesChange,
  onSpacesChanged,
  swapRef,
}: AdminPanelProps) {
  const [authenticated, setAuthenticated] = useState(false)
  const [slots, setSlots] = useState<AdminSlot[]>([])
  const [savedSlots, setSavedSlots] = useState<AdminSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const selectedSlotIdRef = useRef(selectedSlotId)
  selectedSlotIdRef.current = selectedSlotId

  useEffect(() => {
    let cancelled = false

    async function loadAdminState() {
      setLoading(true)
      try {
        const sessionState = await getAdminSession()
        if (cancelled) return

        setAuthenticated(sessionState.authenticated)
        if (sessionState.authenticated) {
          const [loadedSlots, floorPlan] = await Promise.all([
            getAdminSlots(floor),
            fetchFloorPlan(floor),
          ])
          if (!cancelled) {
            setSlots(loadedSlots)
            setSavedSlots(loadedSlots)
            onSlotsChange(loadedSlots)
            onFloorPlanChange(floorPlan)
            const selectedSlot = loadedSlots.find((slot) => slot.id === selectedSlotIdRef.current)
            if (selectedSlot ?? loadedSlots[0]) onSelectSlot((selectedSlot ?? loadedSlots[0]).id)
          }
        } else {
          setSlots([])
          setSavedSlots([])
          onSlotsChange(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setAuthenticated(false)
          setError(loadError instanceof Error ? loadError.message : 'No se pudo consultar la sesión.')
          setSlots([])
          setSavedSlots([])
          onSlotsChange(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadAdminState()
    return () => {
      cancelled = true
    }
  }, [floor, onFloorPlanChange, onSelectSlot, onSlotsChange])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    const formData = new FormData(event.currentTarget)
    const loginUsername = String(formData.get('username') ?? '')
    const password = String(formData.get('password') ?? '')

    try {
      await loginAdmin(loginUsername, password)
      const [adminSlots, floorPlan] = await Promise.all([
        getAdminSlots(floor),
        fetchFloorPlan(floor),
      ])
      setAuthenticated(true)
      setSlots(adminSlots)
      setSavedSlots(adminSlots)
      onSlotsChange(adminSlots)
      onFloorPlanChange(floorPlan)
      if (adminSlots[0]) onSelectSlot(adminSlots[0].id)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setError(null)
    setNotice(null)
    try {
      await logoutAdmin()
      setAuthenticated(false)
      setSlots([])
      setSavedSlots([])
      onSlotsChange(null)
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'No se pudo cerrar sesión.')
    }
  }

  function updateDraft(
    id: string,
    changes: Partial<Pick<AdminSlot, 'name' | 'type' | 'category' | 'enabled' | 'useContour' | 'accessible' | 'description'>>,
  ) {
    const updated = slots.map((slot) => slot.id === id ? { ...slot, ...changes } : slot)
    setSlots(updated)
    onSlotsChange(updated)
    setNotice(null)
  }

  function pickContent(slot: AdminSlot) {
    return {
      name: slot.name,
      type: slot.type,
      category: slot.category,
      enabled: slot.enabled,
      useContour: slot.useContour,
      accessible: slot.accessible,
      description: slot.description,
    }
  }

  useEffect(() => {
    if (!swapRef) return
    swapRef.current = (fromId, toId) => {
      const from = slots.find((slot) => slot.id === fromId)
      const to = slots.find((slot) => slot.id === toId)
      if (!from || !to || busy) return
      const fromContent = pickContent(from)
      const toContent = pickContent(to)
      const updated = slots.map((slot) => {
        if (slot.id === fromId) return { ...slot, ...toContent }
        if (slot.id === toId) return { ...slot, ...fromContent }
        return slot
      })
      setSlots(updated)
      onSlotsChange(updated)
      setNotice(null)
      onSelectSlot(toId)
    }
    return () => {
      swapRef.current = null
    }
  })

  const savedSlotsById = new Map(savedSlots.map((slot) => [slot.id, slot]))
  const pendingSlots = slots.filter((slot) => {
    const savedSlot = savedSlotsById.get(slot.id)
    return !savedSlot ||
      slot.name !== savedSlot.name ||
      slot.type !== savedSlot.type ||
      slot.category !== savedSlot.category ||
      slot.enabled !== savedSlot.enabled ||
      slot.useContour !== savedSlot.useContour ||
      slot.accessible !== savedSlot.accessible ||
      slot.description !== savedSlot.description
  })

  useEffect(() => {
    onPendingChangesChange(pendingSlots.length > 0)
  }, [onPendingChangesChange, pendingSlots.length])

  async function saveAllSlots() {
    if (pendingSlots.length === 0) return
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const result = await updateAdminSlots(floor, pendingSlots.map((slot) => ({
        id: slot.id,
        name: slot.name,
        type: slot.type,
        category: slot.category,
        enabled: slot.enabled,
        useContour: slot.useContour,
        accessible: slot.accessible,
        description: slot.description,
      })))
      setSlots(result.slots)
      setSavedSlots(result.slots)
      onSlotsChange(result.slots)
      setNotice(
        pendingSlots.length === 1
          ? 'Se guardó 1 cambio correctamente.'
          : `Se guardaron ${pendingSlots.length} cambios correctamente.`,
      )
      onSpacesChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudieron guardar los cambios.')
    } finally {
      setBusy(false)
    }
  }

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId)

  return (
    <section className="detail-card admin-sidebar" aria-labelledby="admin-heading">
      <div className="side-card-heading">
        <div>
          <h2 id="admin-heading">Administrar espacios</h2>
          <p>Los cambios del piso se guardan juntos.</p>
        </div>
        {authenticated && (
          <button
            type="button"
            className="admin-logout-button"
            onClick={() => void handleLogout()}
            disabled={busy || pendingSlots.length > 0}
            title={pendingSlots.length > 0 ? 'Guarda los cambios pendientes antes de salir.' : undefined}
          >
            Salir
          </button>
        )}
      </div>

      {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}
      {notice && <div className="admin-alert admin-alert-success" role="status">{notice}</div>}

      {loading && <p className="admin-loading" role="status">Cargando configuración…</p>}

      {!loading && !authenticated && (
        <form className="admin-login-card" onSubmit={handleLogin}>
          <div className="admin-lock-icon" aria-hidden="true"><Icon name="lock" /></div>
          <h3>Acceso de administrador</h3>
          <p>Inicia sesión para editar la configuración del plano.</p>
          <label>
            Usuario
            <input name="username" autoComplete="username" required maxLength={40} />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
            />
          </label>
          <button type="submit" className="admin-primary-button" disabled={loading}>
            Iniciar sesión
          </button>
        </form>
      )}

      {!loading && authenticated && (
        <div className="admin-editor">
          <div className="admin-toolbar">
            <span>
              {slots.filter((slot) => slot.enabled).length} de {slots.length} casillas activas
              {pendingSlots.length > 0 && ` · ${pendingSlots.length} cambios pendientes`}
            </span>
            <button
              type="button"
              className="admin-save-button"
              disabled={busy || pendingSlots.length === 0}
              onClick={() => void saveAllSlots()}
            >
              {busy ? 'Guardando…' : pendingSlots.length > 0
                ? `Guardar cambios (${pendingSlots.length})`
                : 'Todo guardado'}
            </button>
          </div>
          {selectedSlot ? (
            <article className={`admin-slot-card${selectedSlot.enabled ? ' is-enabled' : ''}`}>
              <div className="admin-slot-heading">
                <strong>{selectedSlot.name || selectedSlot.id}</strong>
                <label className="visibility-toggle">
                  <input
                    type="checkbox"
                    checked={selectedSlot.enabled}
                    disabled={busy}
                    onChange={(event) => updateDraft(selectedSlot.id, {
                      enabled: event.target.checked,
                      ...(event.target.checked ? { useContour: true } : {}),
                    })}
                    aria-label={`Mostrar ${selectedSlot.name || selectedSlot.id} en el mapa`}
                  />
                  <span className="toggle-track" aria-hidden="true" />
                  <span>{selectedSlot.enabled ? 'Visible' : 'Oculta'}</span>
                </label>
              </div>
              <label className="admin-field">
                Tipo de espacio
                <select
                  value={selectedSlot.type}
                  disabled={busy}
                  onChange={(event) => {
                    const type = spaceTypes.find((item) => item === event.target.value)
                    if (type) {
                      updateDraft(selectedSlot.id, {
                        type,
                        ...(type === 'Espacio común' ? { name: '', category: null } : { category: null }),
                      })
                    }
                  }}
                >
                  {spaceTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              {selectedSlot.type === 'Espacio común' ? (
                <div className="admin-field">
                  <span>Categoría</span>
                  <SpaceCategoryPicker
                    value={selectedSlot.category}
                    disabled={busy}
                    onChange={(category: SpaceCategory) => updateDraft(selectedSlot.id, { category })}
                  />
                </div>
              ) : (
                <label className="admin-field">
                  Nombre
                  <input
                    value={selectedSlot.name}
                    disabled={busy}
                    onChange={(event) => updateDraft(selectedSlot.id, { name: event.target.value })}
                    placeholder="Opcional; se mostrará el código si queda vacío"
                    maxLength={60}
                  />
                </label>
              )}
              <div className="admin-slot-options">
                <label className="admin-accessibility-toggle">
                  <input
                    type="checkbox"
                    checked={selectedSlot.accessible}
                    disabled={busy}
                    onChange={(event) => updateDraft(selectedSlot.id, { accessible: event.target.checked })}
                  />
                  Espacio accesible
                </label>
                <label className="admin-accessibility-toggle">
                  <input
                    type="checkbox"
                    checked={selectedSlot.enabled || selectedSlot.useContour}
                    disabled={busy || selectedSlot.enabled}
                    onChange={(event) => updateDraft(selectedSlot.id, { useContour: event.target.checked })}
                  />
                  Usar contorno
                </label>
              </div>
              <label className="admin-field">
                Descripción
                <textarea
                  value={selectedSlot.description}
                  disabled={busy}
                  onChange={(event) => updateDraft(selectedSlot.id, { description: event.target.value })}
                  placeholder="Descripción opcional del espacio"
                  maxLength={500}
                  rows={3}
                />
              </label>
              <p className="admin-slot-coordinate">{floorLabel(selectedSlot.floor)} · {selectedSlot.id}</p>
            </article>
          ) : (
            <div className="empty-detail">
              <span className="empty-detail-icon" aria-hidden="true"><Icon name="current-location" /></span>
              <h3>Selecciona una casilla</h3>
              <p>Elige cualquier recuadro del mapa, incluso los que están ocultos.</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default AdminPanel
