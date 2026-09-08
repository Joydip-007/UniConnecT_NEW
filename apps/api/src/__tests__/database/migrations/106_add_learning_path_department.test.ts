import { describe, it, expect, afterAll } from 'vitest'
import { db } from '../../../config/db'

describe('106_add_learning_path_department', () => {
  afterAll(() => db.destroy())

  it('adds a nullable department column to skill_paths', async () => {
    const column = await db('information_schema.columns')
      .where({ table_name: 'skill_paths', column_name: 'department' })
      .first()
    expect(column).toBeDefined()
    expect(column.is_nullable).toBe('YES')
  })
})
