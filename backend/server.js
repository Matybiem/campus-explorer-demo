import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import connectPgSimple from 'connect-pg-simple'
import session from 'express-session'
import { createApp } from './app.js'
import { initializeDatabase } from './database.js'
import { createRepositories } from './repositories.js'

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

const port = Number(process.env.PORT ?? 3001)
const sessionSecret = process.env.SESSION_SECRET

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un puerto válido entre 1 y 65535.')
}
if (!sessionSecret || sessionSecret.length < 32 || sessionSecret.startsWith('replace-with-')) {
  throw new Error('Configura SESSION_SECRET con un valor aleatorio de al menos 32 caracteres.')
}
if (!process.env.PGPASSWORD || process.env.PGPASSWORD.startsWith('replace-with-')) {
  throw new Error('Configura PGPASSWORD en el archivo .env local.')
}

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
})

try {
  await initializeDatabase(pool, {
    adminUsername: process.env.ADMIN_USERNAME,
    adminPassword: process.env.ADMIN_PASSWORD,
  })
} catch (error) {
  await pool.end()
  throw error
}

const PostgreSqlStore = connectPgSimple(session)
const sessionStore = new PostgreSqlStore({
  pool,
  createTableIfMissing: true,
  tableName: 'admin_sessions',
})
const app = createApp({
  repositories: createRepositories(pool),
  sessionStore,
  sessionSecret,
  secureCookies: process.env.NODE_ENV === 'production',
})

const server = app.listen(port, () => {
  console.log(`Campus Explorer API disponible en http://localhost:${port}`)
})

function shutdown() {
  server.close(async (error) => {
    if (error) {
      console.error('No se pudo cerrar el servidor correctamente:', error)
      process.exitCode = 1
    }
    await pool.end()
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
