import bcrypt from 'bcryptjs'
import { spaces } from './data/spaces.js'

const floorSlots = [
  ...Array.from({ length: 12 }, (_, index) => ({
    x: index % 6,
    y: Math.floor(index / 6),
  })),
  ...Array.from({ length: 8 }, (_, index) => ({
    x: 4 + (index % 2),
    y: 2 + Math.floor(index / 2),
  })),
]

const spaceTypes = ['Sala', 'Laboratorio', 'Administrativo', 'Baño hombre', 'Baño mujer']

export async function initializeDatabase(pool, { adminUsername, adminPassword }) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(40) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS space_slots (
      id VARCHAR(30) PRIMARY KEY,
      floor INTEGER NOT NULL CHECK (floor > 0),
      x INTEGER NOT NULL CHECK (x >= 0 AND x < 6),
      y INTEGER NOT NULL CHECK (y >= 0 AND y < 6),
      name VARCHAR(60) NOT NULL DEFAULT '',
      type VARCHAR(30) NOT NULL CHECK (type IN (${spaceTypes.map((type) => `'${type}'`).join(', ')})),
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      accessible BOOLEAN NOT NULL DEFAULT FALSE,
      capacity INTEGER,
      description TEXT NOT NULL DEFAULT '',
      UNIQUE (floor, x, y)
    );
  `)

  const configuredAdmin = adminUsername?.trim()
  if (!configuredAdmin || !/^[a-zA-Z0-9._-]{3,40}$/.test(configuredAdmin)) {
    throw new Error('ADMIN_USERNAME debe tener entre 3 y 40 caracteres alfanuméricos o . _ -.')
  }
  if (
    typeof adminPassword !== 'string' ||
    adminPassword.length < 14 ||
    Buffer.byteLength(adminPassword, 'utf8') > 72 ||
    adminPassword.startsWith('replace-with-')
  ) {
    throw new Error('ADMIN_PASSWORD debe tener entre 14 y 72 bytes y no puede ser un valor de ejemplo.')
  }

  const initialSpacesByCell = new Map(spaces.map((space) => [
    `${space.floor}:${space.x}:${space.y}`,
    space,
  ]))

  for (const floor of [1, 2]) {
    for (const slot of floorSlots) {
      const initialSpace = initialSpacesByCell.get(`${floor}:${slot.x}:${slot.y}`)
      const slotId = initialSpace?.id ?? `P${floor}-R${slot.y + 1}-C${slot.x + 1}`
      await pool.query(
        `INSERT INTO space_slots
          (id, floor, x, y, name, type, enabled, accessible, capacity, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (floor, x, y) DO NOTHING`,
        [
          slotId,
          floor,
          slot.x,
          slot.y,
          initialSpace?.name ?? '',
          initialSpace?.type ?? 'Sala',
          Boolean(initialSpace),
          initialSpace?.accessible ?? false,
          initialSpace?.capacity ?? null,
          initialSpace?.description ?? '',
        ],
      )
    }
  }

  const existingAdmin = await pool.query(
    'SELECT id FROM admin_users WHERE username = $1',
    [configuredAdmin],
  )
  if (existingAdmin.rowCount === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    await pool.query(
      `INSERT INTO admin_users (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO NOTHING`,
      [configuredAdmin, passwordHash],
    )
  }
}
