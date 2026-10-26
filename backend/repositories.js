export function createRepositories(pool) {
  return {
    async listPublic({ q, type, floor, accessible }) {
      const result = await pool.query(
        `SELECT id, name, type, floor, x, y, capacity, accessible, description
         FROM space_slots
         WHERE enabled = TRUE
           AND ($1 = '' OR POSITION(LOWER($1) IN LOWER(id || ' ' || name || ' ' || type)) > 0)
           AND ($2::text IS NULL OR type = $2)
           AND ($3::integer IS NULL OR floor = $3)
           AND ($4::boolean IS NULL OR accessible = $4)
         ORDER BY floor, y, x`,
        [q, type ?? null, floor ?? null, accessible ?? null],
      )
      return result.rows
    },

    async listSlots(floor) {
      const result = await pool.query(
        `SELECT id, name, type, floor, x, y, enabled
         FROM space_slots
         WHERE floor = $1
         ORDER BY y, x`,
        [floor],
      )
      return result.rows
    },

    async updateSlot(id, { name, type, enabled }) {
      const result = await pool.query(
        `UPDATE space_slots
         SET name = $2, type = $3, enabled = $4
         WHERE id = $1
         RETURNING id, name, type, floor, x, y, enabled`,
        [id, name, type, enabled],
      )
      return result.rows[0] ?? null
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
