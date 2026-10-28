function floorPlanFromRow(row) {
  if (!row) return null
  return {
    floor: row.floor,
    horizontalLength: row.horizontal_length,
    verticalLength: row.vertical_length,
  }
}

function floorPlansFromRows(rows) {
  return rows.map(floorPlanFromRow)
}

async function listSlots(client, floor) {
  const result = await client.query(
    `SELECT id, name, type, category, floor, x, y, enabled, use_contour AS "useContour", accessible, description
     FROM space_slots
     WHERE floor = $1
     ORDER BY y, x`,
    [floor],
  )
  return result.rows
}

async function createInitialFloorSlots(client, floor) {
  for (let y = 0; y < 15; y += 1) {
    for (let x = 0; x < 15; x += 1) {
      await client.query(
        `INSERT INTO space_slots (id, floor, x, y, type)
         VALUES ($1, $2, $3, $4, 'Sala')`,
        [`P${floor}-R${y + 1}-C${x + 1}`, floor, x, y],
      )
    }
  }
}

export function createRepositories(pool) {
  return {
    async listFloors() {
      const result = await pool.query(
        `SELECT floor, horizontal_length, vertical_length
         FROM floor_plans
         WHERE enabled = TRUE
         ORDER BY floor DESC`,
      )
      return floorPlansFromRows(result.rows)
    },

    async getFloorPlan(floor) {
      const result = await pool.query(
        `SELECT floor, horizontal_length, vertical_length
         FROM floor_plans
         WHERE floor = $1 AND enabled = TRUE`,
        [floor],
      )
      const plan = floorPlanFromRow(result.rows[0])
      if (!plan) return null
      const contourResult = await pool.query(
        `SELECT x, y
         FROM space_slots
         WHERE floor = $1 AND (enabled = TRUE OR use_contour = TRUE)
         ORDER BY y, x`,
        [floor],
      )
      return { ...plan, contourCells: contourResult.rows }
    },

    async setFloorActive(floor, active) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('LOCK TABLE floor_plans IN EXCLUSIVE MODE')
        const result = await client.query(
          'SELECT floor, enabled FROM floor_plans ORDER BY floor FOR UPDATE',
        )
        const current = result.rows.find((row) => row.floor === floor)
        if (current?.enabled === active) {
          await client.query('COMMIT')
          return {
            ok: true,
            floors: floorPlansFromRows(result.rows.filter((row) => row.enabled)),
          }
        }

        const activeFloors = result.rows.filter((row) => row.enabled).map((row) => row.floor)
        const positiveFloors = activeFloors.filter((level) => level > 0)
        const basementFloors = activeFloors.filter((level) => level < 0)

        if (active) {
          const nextFloor = floor > 0
            ? Math.max(0, ...positiveFloors) + 1
            : Math.min(0, ...basementFloors) - 1
          const maxFloor = floor > 0 ? 10 : -5
          const withinLimit = floor > 0 ? floor <= maxFloor : floor >= maxFloor
          if (floor !== nextFloor || !withinLimit) {
            await client.query('ROLLBACK')
            return {
              ok: false,
              status: 409,
              error: floor > 0
                ? 'Activa los pisos en orden y hasta un máximo de 10.'
                : 'Activa los subterráneos en orden y hasta un máximo de 5.',
            }
          }

          if (current) {
            await client.query(
              'UPDATE floor_plans SET enabled = TRUE WHERE floor = $1',
              [floor],
            )
          } else {
            await client.query(
              `INSERT INTO floor_plans (floor, horizontal_length, vertical_length, enabled)
               VALUES ($1, 15, 15, TRUE)`,
              [floor],
            )
            await createInitialFloorSlots(client, floor)
          }
        } else {
          const highestFloor = Math.max(0, ...positiveFloors)
          const deepestBasement = Math.min(0, ...basementFloors)
          const isLastPositiveFloor = floor > 0 && floor === highestFloor && floor > 1
          const isDeepestBasement = floor < 0 && floor === deepestBasement
          if (!current?.enabled || (!isLastPositiveFloor && !isDeepestBasement)) {
            await client.query('ROLLBACK')
            return {
              ok: false,
              status: 409,
              error: floor > 0
                ? 'Desactiva los pisos desde el último hacia el primero. El Piso 1 siempre debe quedar activo.'
                : 'Desactiva los subterráneos desde el más profundo hacia arriba.',
            }
          }
          await client.query(
            'UPDATE floor_plans SET enabled = FALSE WHERE floor = $1',
            [floor],
          )
        }

        const floorsResult = await client.query(
          `SELECT floor, horizontal_length, vertical_length
           FROM floor_plans
           WHERE enabled = TRUE
           ORDER BY floor DESC`,
        )
        await client.query('COMMIT')
        return { ok: true, floors: floorPlansFromRows(floorsResult.rows) }
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },

    async listPublic({ q, type, floor, accessible }) {
      const result = await pool.query(
        `SELECT id, name, type, category, floor, x, y, capacity, accessible, description
         FROM space_slots
         WHERE enabled = TRUE
           AND EXISTS (
             SELECT 1 FROM floor_plans
             WHERE floor_plans.floor = space_slots.floor AND floor_plans.enabled = TRUE
           )
           AND ($1 = '' OR POSITION(LOWER($1) IN LOWER(id || ' ' || name || ' ' || type || ' ' || COALESCE(category, ''))) > 0)
           AND ($2::text IS NULL OR type = $2)
           AND ($3::integer IS NULL OR floor = $3)
           AND ($4::boolean IS NULL OR accessible = $4)
         ORDER BY floor, y, x`,
        [q, type ?? null, floor ?? null, accessible ?? null],
      )
      return result.rows
    },

    async listSlots(floor) {
      return listSlots(pool, floor)
    },

    async updateSlot(id, { name, type, category, enabled, useContour, accessible, description }) {
      const result = await pool.query(
        `UPDATE space_slots
         SET name = $2, type = $3, category = $4, enabled = $5, use_contour = $6, accessible = $7, description = $8
         WHERE id = $1
         RETURNING id, name, type, category, floor, x, y, enabled, use_contour AS "useContour", accessible, description`,
        [id, name, type, category, enabled, useContour, accessible, description],
      )
      return result.rows[0] ?? null
    },

    async updateSlots(floor, updates) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const planResult = await client.query(
          'SELECT floor FROM floor_plans WHERE floor = $1 FOR UPDATE',
          [floor],
        )
        if (planResult.rowCount === 0) {
          await client.query('ROLLBACK')
          return { ok: false, status: 404, error: 'No se encontró el plano del piso.' }
        }

        const floorSlots = await client.query(
          'SELECT id FROM space_slots WHERE floor = $1 FOR UPDATE',
          [floor],
        )
        const floorSlotIds = new Set(floorSlots.rows.map((slot) => slot.id))
        if (updates.some((slot) => !floorSlotIds.has(slot.id))) {
          await client.query('ROLLBACK')
          return {
            ok: false,
            status: 409,
            error: 'Una o más casillas ya no pertenecen a este piso. Recarga el panel e inténtalo de nuevo.',
          }
        }

        for (const slot of updates) {
          await client.query(
            `UPDATE space_slots
             SET name = $3, type = $4, category = $5, enabled = $6, use_contour = $7, accessible = $8, description = $9
             WHERE floor = $1 AND id = $2`,
            [
              floor,
              slot.id,
              slot.name,
              slot.type,
              slot.category,
              slot.enabled,
              slot.useContour,
              slot.accessible,
              slot.description,
            ],
          )
        }

        const updatedSlots = await listSlots(client, floor)
        await client.query('COMMIT')
        return { ok: true, slots: updatedSlots }
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },

    async findAdmin(username) {
      const result = await pool.query(
        'SELECT id, username, password_hash AS "passwordHash" FROM admin_users WHERE username = $1',
        [username],
      )
      return result.rows[0] ?? null
    },
  }
}
