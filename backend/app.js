import bcrypt from 'bcryptjs'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import helmet from 'helmet'

export const spaceTypes = new Set([
  'Sala',
  'Laboratorio',
  'Administrativo',
  'Baño hombre',
  'Baño mujer',
])

function validFloor(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value)
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
  app.use(express.json({ limit: '20kb' }))
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
    const { name, type, enabled } = request.body ?? {}
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
      response.status(400).json({ error: 'El nombre debe tener entre 2 y 60 caracteres.' })
      return
    }
    if (typeof type !== 'string' || !spaceTypes.has(type)) {
      response.status(400).json({ error: 'El tipo de espacio no es válido.' })
      return
    }
    if (typeof enabled !== 'boolean') {
      response.status(400).json({ error: 'enabled debe ser true o false.' })
      return
    }

    const updatedSlot = await repositories.updateSlot(request.params.id, {
      name: name.trim(),
      type,
      enabled,
    })
    if (!updatedSlot) {
      response.status(404).json({ error: 'No se encontró la casilla solicitada.' })
      return
    }
    response.json(updatedSlot)
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
