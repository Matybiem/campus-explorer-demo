import { spaceTypes, type AdminFloorLevels, type AdminSlot } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new Error('No hay conexión con la API. Comprueba que el backend esté funcionando.')
  }

  if (response.status === 204) return undefined as T

  const data: unknown = await response.json()
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `La API respondió con el estado ${response.status}.`
    throw new Error(message)
  }

  return data as T
}

export type AdminSession = {
  authenticated: boolean
  username: string | null
}

export function getAdminSession() {
  return request<AdminSession>('/api/admin/session')
}

export function loginAdmin(username: string, password: string) {
  return request<AdminSession>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logoutAdmin() {
  return request<void>('/api/admin/logout', { method: 'POST' })
}

export function getAdminSlots(floor: number) {
  return request<AdminSlot[]>(`/api/admin/slots?floor=${floor}`)
}

export function setAdminFloorActive(floor: number, active: boolean) {
  return request<AdminFloorLevels>(`/api/admin/floors/${floor}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  })
}

export function updateAdminSlots(
  floor: number,
  slots: Pick<AdminSlot, 'id' | 'name' | 'type' | 'category' | 'enabled' | 'useContour' | 'accessible' | 'description'>[],
) {
  return request<{ slots: AdminSlot[] }>(`/api/admin/floors/${floor}/slots`, {
    method: 'PATCH',
    body: JSON.stringify({ slots }),
  })
}

export { spaceTypes }
