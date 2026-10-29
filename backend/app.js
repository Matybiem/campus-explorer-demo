import bcrypt from 'bcryptjs'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import helmet from 'helmet'

const matrixSize = 15

export const spaceTypes = new Set([
  'Sala',
  'Laboratorio',
  'Administrativo',
  'Espacio común',
  'Otro',
])
const spaceCategories = new Set(['Baño hombre', 'Baño mujer', 'Escalera', 'Ascensor', 'Comida'])

function validCategory(type, category) {
  return type === 'Espacio común'
    ? typeof category === 'string' && spaceCategories.has(category)
    : category === null
}

function validFloor(value) {
  if (typeof value !== 'string' || !/^-?[1-9]\d*$/.test(value)) return false
  const floor = Number(value)
  return (floor >= 1 && floor <= 10) || (floor >= -5 && floor <= -1)
}

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

export function createApp({ repositories, sessionStore, sessionSecret, secureCookies = false }) {
  if (
    !repositories ||
    !sessionStore ||
    typeof sessionSecret !== 'string' ||
    sessionSecret.length < 32 ||
    sessionSecret.startsWith('replace-with-')
  ) {
    throw new Error('La API requiere repositorios, almacenamiento de sesión y SESSION_SECRET.')
  }

  const app = express()
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' },
  })

  app.disable('x-powered-by')
  app.set('trust proxy', secureCookies ? 1 : false)
  app.use(helmet())
  app.use(express.json({ limit: '1mb' }))
  app.use(session({
    name: 'campus.sid',
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      maxAge: 8 * 60 * 60 * 1000,
    },
  }))

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.get('/api/floors', asyncRoute(async (_request, response) => {
    response.json(await repositories.listFloors())
  }))

  app.get('/api/floors/:floor/plan', asyncRoute(async (request, response) => {
    if (!validFloor(request.params.floor)) {
      response.status(400).json({ error: 'El piso debe estar entre -5 y -1, o entre 1 y 10.' })
      return
    }
    const floorPlan = await repositories.getFloorPlan(Number(request.params.floor))
    if (!floorPlan) {
      response.status(404).json({ error: 'No se encontró el plano del piso.' })
      return
    }
    response.json(floorPlan)
  }))

  app.get('/api/spaces', asyncRoute(async (request, response) => {
    const { q, type, floor, accessible } = request.query

    if (type !== undefined && (typeof type !== 'string' || !spaceTypes.has(type))) {
      response.status(400).json({ error: 'El filtro type no es válido.' })
      return
    }

    if (floor !== undefined && !validFloor(floor)) {
      response.status(400).json({ error: 'El filtro floor debe ser un entero positivo.' })
      return
    }

    if (accessible !== undefined && accessible !== 'true' && accessible !== 'false') {
      response.status(400).json({ error: 'El filtro accessible debe ser true o false.' })
      return
    }

    if (q !== undefined && typeof q !== 'string') {
      response.status(400).json({ error: 'El filtro q debe ser texto.' })
      return
    }

    const results = await repositories.listPublic({
      q: q?.trim() ?? '',
      type,
      floor: floor === undefined ? undefined : Number(floor),
      accessible: accessible === undefined ? undefined : accessible === 'true',
    })
    response.json(results)
  }))

  app.get('/api/admin/session', (request, response) => {
    response.json({
      authenticated: Boolean(request.session.admin),
      username: request.session.admin?.username ?? null,
    })
  })

  app.post('/api/admin/login', loginLimiter, asyncRoute(async (request, response, next) => {
    const { username, password } = request.body ?? {}
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.length > 40 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      response.status(400).json({ error: 'Ingresa un usuario y una contraseña válidos.' })
      return
    }

    const admin = await repositories.findAdmin(username.trim())
    const passwordMatches = admin && await bcrypt.compare(password, admin.passwordHash)
    if (!passwordMatches) {
      response.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
      return
    }

    request.session.regenerate((error) => {
      if (error) return next(error)
      request.session.admin = { id: admin.id, username: admin.username }
      request.session.save((saveError) => {
        if (saveError) return next(saveError)
        response.json({ authenticated: true, username: admin.username })
      })
    })
  }))

  app.post('/api/admin/logout', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error)
      response.clearCookie('campus.sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookies,
      })
      response.status(204).end()
    })
  })

  function requireAdmin(request, response, next) {
    if (!request.session.admin) {
      response.status(401).json({ error: 'Inicia sesión como administrador para continuar.' })
      return
    }
    next()
  }

  app.get('/api/admin/slots', requireAdmin, asyncRoute(async (request, response) => {
    const { floor } = request.query
    if (!validFloor(floor)) {
      response.status(400).json({ error: 'El parámetro floor debe ser un entero positivo.' })
      return
    }
    response.json(await repositories.listSlots(Number(floor)))
  }))

  app.patch('/api/admin/slots/:id', requireAdmin, asyncRoute(async (request, response) => {
    const { name, type, category: requestedCategory, enabled, useContour, accessible, description, customCode } = request.body ?? {}
    const category = requestedCategory ?? null
    if (typeof name !== 'string' || name.trim().length > 60) {
      response.status(400).json({ error: 'El nombre debe tener como máximo 60 caracteres.' })
      return
    }
    if (typeof type !== 'string' || !spaceTypes.has(type)) {
      response.status(400).json({ error: 'El tipo de espacio no es válido.' })
      return
    }
    if (!validCategory(type, category)) {
      response.status(400).json({ error: 'La categoría no es válida para este tipo de espacio.' })
      return
    }
    if (typeof enabled !== 'boolean') {
      response.status(400).json({ error: 'enabled debe ser true o false.' })
      return
    }
    if (typeof useContour !== 'boolean') {
      response.status(400).json({ error: 'useContour debe ser true o false.' })
      return
    }
    if (typeof accessible !== 'boolean') {
      response.status(400).json({ error: 'accessible debe ser true o false.' })
      return
    }
    if (typeof description !== 'string' || description.trim().length > 500) {
      response.status(400).json({ error: 'La descripción debe tener como máximo 500 caracteres.' })
      return
    }
    const normalizedCustomCode = customCode != null ? String(customCode).trim() : null
    if (normalizedCustomCode !== null && normalizedCustomCode.length > 20) {
      response.status(400).json({ error: 'El código personalizado debe tener como máximo 20 caracteres.' })
      return
    }

    const updatedSlot = await repositories.updateSlot(request.params.id, {
      name: type === 'Espacio común' ? '' : name.trim(),
      type,
      category,
      enabled,
      useContour: enabled || useContour,
      accessible,
      description: description.trim(),
      customCode: (type === 'Sala' || type === 'Laboratorio') ? normalizedCustomCode : null,
    })
    if (!updatedSlot) {
      response.status(404).json({ error: 'No se encontró la casilla solicitada.' })
      return
    }
    response.json(updatedSlot)
  }))

  app.patch('/api/admin/floors/:floor/slots', requireAdmin, asyncRoute(async (request, response) => {
    if (!validFloor(request.params.floor)) {
      response.status(400).json({ error: 'El piso debe estar entre -5 y -1, o entre 1 y 10.' })
      return
    }

    const { slots } = request.body ?? {}
    if (!Array.isArray(slots) || slots.length === 0 || slots.length > matrixSize * matrixSize) {
      response.status(400).json({ error: 'Debes enviar entre 1 y 225 casillas para guardar.' })
      return
    }

    const slotIds = new Set()
    const updates = []
    for (const slot of slots) {
      if (
        typeof slot?.id !== 'string' ||
        slot.id.length === 0 ||
        slot.id.length > 30 ||
        slotIds.has(slot.id)
      ) {
        response.status(400).json({ error: 'La lista contiene un identificador de casilla no válido o repetido.' })
        return
      }
      if (typeof slot.name !== 'string' || slot.name.trim().length > 60) {
        response.status(400).json({ error: 'Cada nombre debe tener como máximo 60 caracteres.' })
        return
      }
      if (typeof slot.type !== 'string' || !spaceTypes.has(slot.type)) {
        response.status(400).json({ error: 'Uno o más tipos de espacio no son válidos.' })
        return
      }
      const category = slot.category ?? null
      if (!validCategory(slot.type, category)) {
        response.status(400).json({ error: 'Una o más categorías no son válidas para su tipo de espacio.' })
        return
      }
      if (typeof slot.enabled !== 'boolean') {
        response.status(400).json({ error: 'Cada valor enabled debe ser true o false.' })
        return
      }
      if (typeof slot.useContour !== 'boolean') {
        response.status(400).json({ error: 'Cada valor useContour debe ser true o false.' })
        return
      }
      if (typeof slot.accessible !== 'boolean') {
        response.status(400).json({ error: 'Cada valor accessible debe ser true o false.' })
        return
      }
      if (typeof slot.description !== 'string' || slot.description.trim().length > 500) {
        response.status(400).json({ error: 'Cada descripción debe tener como máximo 500 caracteres.' })
        return
      }
      const slotCustomCode = slot.customCode != null ? String(slot.customCode).trim() : null
      if (slotCustomCode !== null && slotCustomCode.length > 20) {
        response.status(400).json({ error: 'Cada código personalizado debe tener como máximo 20 caracteres.' })
        return
      }

      slotIds.add(slot.id)
      updates.push({
        id: slot.id,
        name: slot.type === 'Espacio común' ? '' : slot.name.trim(),
        type: slot.type,
        category,
        enabled: slot.enabled,
        useContour: slot.enabled || slot.useContour,
        accessible: slot.accessible,
        description: slot.description.trim(),
        customCode: (slot.type === 'Sala' || slot.type === 'Laboratorio') ? slotCustomCode : null,
      })
    }

    const result = await repositories.updateSlots(Number(request.params.floor), updates)
    if (!result.ok) {
      response.status(result.status).json({ error: result.error })
      return
    }
    response.json({ slots: result.slots })
  }))

  app.patch('/api/admin/floors/:floor/active', requireAdmin, asyncRoute(async (request, response) => {
    if (!validFloor(request.params.floor)) {
      response.status(400).json({ error: 'El piso debe estar entre -5 y -1, o entre 1 y 10.' })
      return
    }
    const { active } = request.body ?? {}
    if (typeof active !== 'boolean') {
      response.status(400).json({ error: 'active debe ser true o false.' })
      return
    }

    const result = await repositories.setFloorActive(Number(request.params.floor), active)
    if (!result.ok) {
      response.status(result.status).json({ error: result.error })
      return
    }
    response.json({ floors: result.floors })
  }))

  app.use((_request, response) => {
    response.status(404).json({ error: 'Ruta no encontrada.' })
  })

  app.use((error, _request, response, _next) => {
    console.error('Error en la API:', error)
    if (response.headersSent) return
    response.status(500).json({ error: 'Ocurrió un error interno. Intenta nuevamente.' })
  })

  return app
}
