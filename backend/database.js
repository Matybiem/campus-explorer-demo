import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { spaces } from './data/spaces.js'

const spaceTypes = ['Sala', 'Laboratorio', 'Administrativo', 'Espacio común']
const spaceCategories = ['Baño hombre', 'Baño mujer', 'Escalera', 'Ascensor', 'Comida']
const legacyBathroomTypes = ['Baño hombre', 'Baño mujer']
const matrixSize = 15
const initialSpacesByCell = new Map(spaces.map((space) => [
  `${space.floor}:${space.x}:${space.y}`,
  space,
]))

async function migrateFloorMatrices(pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      ALTER TABLE floor_plans DROP CONSTRAINT IF EXISTS floor_plans_horizontal_length_check;
      ALTER TABLE floor_plans DROP CONSTRAINT IF EXISTS floor_plans_vertical_length_check;
      ALTER TABLE space_slots DROP CONSTRAINT IF EXISTS space_slots_x_check;
      ALTER TABLE space_slots DROP CONSTRAINT IF EXISTS space_slots_y_check;
      ALTER TABLE space_slots DROP CONSTRAINT IF EXISTS space_slots_type_check;
      ALTER TABLE space_slots DROP CONSTRAINT IF EXISTS space_slots_category_check;
    `)
    for (const floor of [1, 2]) {
      await client.query(
        `INSERT INTO floor_plans (floor, horizontal_length, vertical_length)
         VALUES ($1, $2, $2)
         ON CONFLICT (floor) DO NOTHING`,
        [floor, matrixSize],
      )
    }

    const plans = await client.query('SELECT floor FROM floor_plans ORDER BY floor')
    const slotsResult = await client.query(
      'SELECT id, floor, x, y FROM space_slots ORDER BY floor, y, x, id',
    )
    const slotsByFloor = new Map(plans.rows.map(({ floor }) => [floor, []]))
    for (const slot of slotsResult.rows) {
      const floorSlots = slotsByFloor.get(slot.floor)
      if (!floorSlots) throw new Error(`Se encontró una casilla sin plano asociado en el nivel ${slot.floor}.`)
      floorSlots.push(slot)
    }

    for (const [floor, floorSlots] of slotsByFloor) {
      if (floorSlots.length > matrixSize * matrixSize) {
        throw new Error(`El nivel ${floor} tiene más de 225 casillas; no se puede migrar a una matriz 15×15 sin perder datos.`)
      }

      const reservedCoordinates = new Set(
        floorSlots
          .filter(({ x, y }) => x >= 0 && x < matrixSize && y >= 0 && y < matrixSize)
          .map(({ x, y }) => `${x}:${y}`),
      )
      const assignments = floorSlots.map((slot) => {
        let { x, y } = slot
        if (x < 0 || x >= matrixSize || y < 0 || y >= matrixSize) {
          let found = false
          for (let candidateY = 0; candidateY < matrixSize && !found; candidateY += 1) {
            for (let candidateX = 0; candidateX < matrixSize; candidateX += 1) {
              const candidateKey = `${candidateX}:${candidateY}`
              if (!reservedCoordinates.has(candidateKey)) {
                x = candidateX
                y = candidateY
                reservedCoordinates.add(candidateKey)
                found = true
                break
              }
            }
          }
          if (!found) throw new Error(`No hay posiciones libres para migrar las casillas del nivel ${floor}.`)
        }
        return { ...slot, x, y }
      })

      await client.query(
        'UPDATE space_slots SET x = -x - 1, y = -y - 1 WHERE floor = $1',
        [floor],
      )
      for (const slot of assignments) {
        await client.query(
          'UPDATE space_slots SET x = $2, y = $3 WHERE id = $1',
          [slot.id, slot.x, slot.y],
        )
      }

      for (let y = 0; y < matrixSize; y += 1) {
        for (let x = 0; x < matrixSize; x += 1) {
          if (reservedCoordinates.has(`${x}:${y}`)) continue
          const initialSpace = floorSlots.length === 0
            ? initialSpacesByCell.get(`${floor}:${x}:${y}`)
            : undefined
          await client.query(
            `INSERT INTO space_slots
              (id, floor, x, y, name, type, category, enabled, accessible, capacity, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              initialSpace?.id ?? `P${floor}-N-${randomBytes(9).toString('hex')}`,
              floor,
              x,
              y,
              initialSpace?.name ?? '',
              initialSpace?.type ?? 'Sala',
              initialSpace?.category ?? null,
              Boolean(initialSpace),
              initialSpace?.accessible ?? false,
              initialSpace?.capacity ?? null,
              initialSpace?.description ?? '',
            ],
          )
        }
      }
    }

    for (const legacyType of legacyBathroomTypes) {
      await client.query(
        `UPDATE space_slots
         SET type = 'Espacio común', category = $1, name = ''
         WHERE type = $1`,
        [legacyType],
      )
    }
    await client.query(`
      UPDATE space_slots
      SET category = name, name = ''
      WHERE type = 'Espacio común'
        AND category IS NULL
        AND name IN (${spaceCategories.map((category) => `'${category}'`).join(', ')});
      UPDATE space_slots
      SET category = 'Comida', name = ''
      WHERE type = 'Espacio común' AND category IS NULL
        AND LOWER(name) ~ '(casino|comida|cafeter|comedor)';
      UPDATE space_slots
      SET type = 'Administrativo'
      WHERE type = 'Espacio común' AND category IS NULL;
      UPDATE space_slots SET category = NULL WHERE type <> 'Espacio común';
    `)

    await client.query('UPDATE space_slots SET use_contour = TRUE WHERE enabled = TRUE')
    await client.query(
      'UPDATE floor_plans SET horizontal_length = $1, vertical_length = $1',
      [matrixSize],
    )
    await client.query(`
      ALTER TABLE floor_plans
        ADD CONSTRAINT floor_plans_horizontal_length_check CHECK (horizontal_length = 15),
        ADD CONSTRAINT floor_plans_vertical_length_check CHECK (vertical_length = 15);
      ALTER TABLE space_slots
        ADD CONSTRAINT space_slots_x_check CHECK (x >= 0 AND x < 15),
        ADD CONSTRAINT space_slots_y_check CHECK (y >= 0 AND y < 15);
      ALTER TABLE space_slots
        ADD CONSTRAINT space_slots_type_check
        CHECK (type IN (${spaceTypes.map((type) => `'${type}'`).join(', ')}));
      ALTER TABLE space_slots
        ADD CONSTRAINT space_slots_category_check
        CHECK (category IS NULL OR category IN (${spaceCategories.map((category) => `'${category}'`).join(', ')}));
    `)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function initializeDatabase(pool, { adminUsername, adminPassword }) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS floor_plans (
      floor INTEGER PRIMARY KEY CHECK ((floor BETWEEN 1 AND 10) OR (floor BETWEEN -5 AND -1)),
      horizontal_length INTEGER NOT NULL DEFAULT 15 CHECK (horizontal_length = 15),
      vertical_length INTEGER NOT NULL DEFAULT 15 CHECK (vertical_length = 15),
      enabled BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(40) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS space_slots (
      id VARCHAR(30) PRIMARY KEY,
      floor INTEGER NOT NULL CHECK ((floor BETWEEN 1 AND 10) OR (floor BETWEEN -5 AND -1)),
      x INTEGER NOT NULL CHECK (x >= 0 AND x < 15),
      y INTEGER NOT NULL CHECK (y >= 0 AND y < 15),
      name VARCHAR(60) NOT NULL DEFAULT '',
      type VARCHAR(30) NOT NULL CHECK (type IN (${spaceTypes.map((type) => `'${type}'`).join(', ')})),
      category VARCHAR(30) CHECK (category IS NULL OR category IN (${spaceCategories.map((category) => `'${category}'`).join(', ')})),
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      use_contour BOOLEAN NOT NULL DEFAULT FALSE,
      accessible BOOLEAN NOT NULL DEFAULT FALSE,
      capacity INTEGER,
      description TEXT NOT NULL DEFAULT '',
      UNIQUE (floor, x, y)
    );
  `)
  await pool.query(`
    ALTER TABLE floor_plans DROP CONSTRAINT IF EXISTS floor_plans_floor_check;
    ALTER TABLE floor_plans
      ADD CONSTRAINT floor_plans_floor_check
      CHECK ((floor BETWEEN 1 AND 10) OR (floor BETWEEN -5 AND -1));
    ALTER TABLE floor_plans
      ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE space_slots
      ADD COLUMN IF NOT EXISTS use_contour BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE space_slots
      ADD COLUMN IF NOT EXISTS category VARCHAR(30);
    ALTER TABLE space_slots DROP CONSTRAINT IF EXISTS space_slots_floor_check;
    ALTER TABLE space_slots
      ADD CONSTRAINT space_slots_floor_check
      CHECK ((floor BETWEEN 1 AND 10) OR (floor BETWEEN -5 AND -1));
    DO $$
    DECLARE
      constraint_is_deferrable BOOLEAN;
    BEGIN
      SELECT condeferrable INTO constraint_is_deferrable
      FROM pg_constraint
      WHERE conrelid = 'space_slots'::regclass
        AND conname = 'space_slots_floor_x_y_key';

      IF constraint_is_deferrable IS DISTINCT FROM TRUE THEN
        ALTER TABLE space_slots DROP CONSTRAINT IF EXISTS space_slots_floor_x_y_key;
        ALTER TABLE space_slots
          ADD CONSTRAINT space_slots_floor_x_y_key
          UNIQUE (floor, x, y) DEFERRABLE INITIALLY IMMEDIATE;
      END IF;
    END $$;
  `)
  await migrateFloorMatrices(pool)

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
