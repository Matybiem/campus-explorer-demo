import { useEffect, useState, type FormEvent } from 'react'
import {
  getAdminSession,
  getAdminSlots,
  loginAdmin,
  logoutAdmin,
  spaceTypes,
  updateAdminSlot,
} from './adminApi'
import type { AdminSlot, SpaceType } from './types'

type AdminPanelProps = {
  floor: number
  selectedSlotId: string | null
  onSelectSlot: (id: string) => void
  onSlotsChange: (slots: AdminSlot[] | null) => void
  onSpacesChanged: () => void
}

function AdminPanel({
  floor,
  selectedSlotId,
  onSelectSlot,
  onSlotsChange,
  onSpacesChanged,
}: AdminPanelProps) {
  const [authenticated, setAuthenticated] = useState(false)
  const [slots, setSlots] = useState<AdminSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAdminState() {
      setLoading(true)
      try {
        const sessionState = await getAdminSession()
        if (cancelled) return

        setAuthenticated(sessionState.authenticated)
        if (sessionState.authenticated) {
          const adminSlots = await getAdminSlots(floor)
          if (!cancelled) {
            setSlots(adminSlots)
            onSlotsChange(adminSlots)
            if (adminSlots[0]) onSelectSlot(adminSlots[0].id)
          }
        } else {
          setSlots([])
          onSlotsChange(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setAuthenticated(false)
          setError(loadError instanceof Error ? loadError.message : 'No se pudo consultar la sesión.')
          setSlots([])
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
  }, [floor, onSlotsChange])

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
      const adminSlots = await getAdminSlots(floor)
      setAuthenticated(true)
      setSlots(adminSlots)
      onSlotsChange(adminSlots)
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
      onSlotsChange(null)
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'No se pudo cerrar sesión.')
    }
  }

  function updateDraft(id: string, changes: Partial<Pick<AdminSlot, 'name' | 'type' | 'enabled'>>) {
    const updated = slots.map((slot) => slot.id === id ? { ...slot, ...changes } : slot)
    setSlots(updated)
    onSlotsChange(updated)
    setNotice(null)
  }

  async function saveSlot(slot: AdminSlot) {
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const savedSlot = await updateAdminSlot(slot.id, {
        name: slot.name,
        type: slot.type,
        enabled: slot.enabled,
      })
      const updatedSlots = slots.map((currentSlot) => (
        currentSlot.id === savedSlot.id ? savedSlot : currentSlot
      ))
      setSlots(updatedSlots)
      onSlotsChange(updatedSlots)
      setNotice(`${savedSlot.name} guardado correctamente.`)
      onSpacesChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la casilla.')
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
          <p>Selecciona una casilla en el mapa para editarla.</p>
        </div>
        {authenticated && (
          <button
            type="button"
            className="admin-logout-button"
            onClick={() => void handleLogout()}
            disabled={busy}
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
          <div className="admin-lock-icon" aria-hidden="true">⌑</div>
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
            <span>{slots.filter((slot) => slot.enabled).length} de {slots.length} casillas activas</span>
          </div>
          {selectedSlot ? (
            <article className={`admin-slot-card${selectedSlot.enabled ? ' is-enabled' : ''}`}>
              <div className="admin-slot-heading">
                <strong>{selectedSlot.name || selectedSlot.id}</strong>
                <label className="visibility-toggle">
                  <input
                    type="checkbox"
                    checked={selectedSlot.enabled}
                    onChange={(event) => updateDraft(selectedSlot.id, { enabled: event.target.checked })}
                    aria-label={`Mostrar ${selectedSlot.name || selectedSlot.id} en el mapa`}
                  />
                  <span className="toggle-track" aria-hidden="true" />
                  <span>{selectedSlot.enabled ? 'Visible' : 'Oculta'}</span>
                </label>
              </div>
              <label className="admin-field">
                Nombre
                <input
                  value={selectedSlot.name}
                  onChange={(event) => updateDraft(selectedSlot.id, { name: event.target.value })}
                  placeholder="Nombre del espacio"
                  maxLength={60}
                />
              </label>
              <label className="admin-field">
                Tipo de espacio
                <select
                  value={selectedSlot.type}
                  onChange={(event) => {
                    const type: SpaceType | undefined = spaceTypes.find((item) => item === event.target.value)
                    if (type) updateDraft(selectedSlot.id, { type })
                  }}
                >
                  {spaceTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <p className="admin-slot-coordinate">Piso {selectedSlot.floor} · {selectedSlot.id}</p>
              <button
                type="button"
                className="admin-save-button"
                disabled={busy || selectedSlot.name.trim().length < 2}
                onClick={() => void saveSlot(selectedSlot)}
              >
                {busy ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </article>
          ) : (
            <div className="empty-detail">
              <span className="empty-detail-icon" aria-hidden="true">⌖</span>
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
